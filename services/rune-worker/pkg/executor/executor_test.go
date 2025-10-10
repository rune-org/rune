package executor

import (
	"context"
	"encoding/json"
	"testing"

	"rune-worker/pkg/messages"
	"rune-worker/pkg/nodes"
	"rune-worker/pkg/core"
	"rune-worker/plugin"
)

// MockPublisher is a test double for queue.Publisher
type MockPublisher struct {
	published    map[string][][]byte // queue name -> messages
	publishError error
}

func NewMockPublisher() *MockPublisher {
	return &MockPublisher{
		published: make(map[string][][]byte),
	}
}

func (m *MockPublisher) Publish(ctx context.Context, queue string, payload []byte) error {
	if m.publishError != nil {
		return m.publishError
	}
	m.published[queue] = append(m.published[queue], payload)
	return nil
}

func (m *MockPublisher) Close() error {
	return nil
}

func (m *MockPublisher) GetPublishedMessages(queue string) [][]byte {
	return m.published[queue]
}

func (m *MockPublisher) GetPublishedCount(queue string) int {
	return len(m.published[queue])
}

// MockNode is a test node that returns predefined output
type MockNode struct {
	output map[string]any
	err    error
}

func (m *MockNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.output, nil
}

func TestExecutor_SimpleLinearWorkflow(t *testing.T) {
	// Setup mock publisher and registry
	pub := NewMockPublisher()
	reg := nodes.NewRegistry()

	// Register mock node
	reg.Register("mock", func(execCtx plugin.ExecutionContext) plugin.Node {
		return &MockNode{
			output: map[string]any{"result": "success"},
		}
	})

	exec := NewExecutor(reg, pub)

	// Create simple workflow: node1 -> node2
	workflow := core.Workflow{
		Nodes: []core.Node{
			{
				ID:         "node1",
				Name:       "Node 1",
				Type:       "mock",
				Parameters: map[string]interface{}{},
			},
			{
				ID:         "node2",
				Name:       "Node 2",
				Type:       "mock",
				Parameters: map[string]interface{}{},
			},
		},
		Edges: []core.Edge{
			{ID: "edge1", Src: "node1", Dst: "node2"},
		},
	}

	// Execute node1
	msg := &messages.NodeExecutionMessage{
		WorkflowID:         "wf_test",
		ExecutionID:        "exec_test",
		CurrentNode:        "node1",
		WorkflowDefinition: workflow,
		AccumulatedContext: map[string]interface{}{
			"$trigger": map[string]interface{}{"start": true},
		},
	}

	err := exec.Execute(context.Background(), msg)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Verify status messages published (running + success)
	statusMsgs := pub.GetPublishedMessages("workflow.node.status")
	if len(statusMsgs) != 2 {
		t.Errorf("Expected 2 status messages, got %d", len(statusMsgs))
	}

	// Verify next node execution message published
	execMsgs := pub.GetPublishedMessages("workflow.execution")
	if len(execMsgs) != 1 {
		t.Fatalf("Expected 1 execution message, got %d", len(execMsgs))
	}

	// Decode and verify the next execution message
	var nextMsg messages.NodeExecutionMessage
	if err := json.Unmarshal(execMsgs[0], &nextMsg); err != nil {
		t.Fatalf("Failed to unmarshal next message: %v", err)
	}

	if nextMsg.CurrentNode != "node2" {
		t.Errorf("Expected next node to be node2, got %s", nextMsg.CurrentNode)
	}

	// Verify context accumulation
	if _, ok := nextMsg.AccumulatedContext["$Node 1"]; !ok {
		t.Error("Expected accumulated context to contain $Node 1")
	}
}

func TestExecutor_WorkflowCompletion(t *testing.T) {
	// Setup mock publisher and registry
	pub := NewMockPublisher()
	reg := nodes.NewRegistry()

	reg.Register("mock", func(execCtx plugin.ExecutionContext) plugin.Node {
		return &MockNode{
			output: map[string]any{"result": "final"},
		}
	})

	exec := NewExecutor(reg, pub)

	// Create workflow with single node (no outgoing edges)
	workflow := core.Workflow{
		Nodes: []core.Node{
			{
				ID:         "final_node",
				Name:       "Final Node",
				Type:       "mock",
				Parameters: map[string]interface{}{},
			},
		},
		Edges: []core.Edge{},
	}

	msg := &messages.NodeExecutionMessage{
		WorkflowID:         "wf_test",
		ExecutionID:        "exec_test",
		CurrentNode:        "final_node",
		WorkflowDefinition: workflow,
		AccumulatedContext: map[string]interface{}{},
	}

	err := exec.Execute(context.Background(), msg)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Verify completion message published
	completionMsgs := pub.GetPublishedMessages("workflow.completion")
	if len(completionMsgs) != 1 {
		t.Fatalf("Expected 1 completion message, got %d", len(completionMsgs))
	}

	// Decode and verify completion message
	var completion messages.CompletionMessage
	if err := json.Unmarshal(completionMsgs[0], &completion); err != nil {
		t.Fatalf("Failed to unmarshal completion message: %v", err)
	}

	if completion.Status != messages.CompletionStatusCompleted {
		t.Errorf("Expected status completed, got %s", completion.Status)
	}

	if completion.WorkflowID != "wf_test" {
		t.Errorf("Expected workflow_id wf_test, got %s", completion.WorkflowID)
	}
}

func TestExecutor_NodeFailureHaltStrategy(t *testing.T) {
	// Setup mock publisher and registry
	pub := NewMockPublisher()
	reg := nodes.NewRegistry()

	reg.Register("mock", func(execCtx plugin.ExecutionContext) plugin.Node {
		return &MockNode{
			err: &NodeExecutionError{Message: "simulated failure"},
		}
	})

	exec := NewExecutor(reg, pub)

	// Create workflow with halt error strategy
	workflow := core.Workflow{
		Nodes: []core.Node{
			{
				ID:         "failing_node",
				Name:       "Failing Node",
				Type:       "mock",
				Parameters: map[string]interface{}{},
				Error: &core.ErrorHandling{
					Type: "halt",
				},
			},
		},
		Edges: []core.Edge{},
	}

	msg := &messages.NodeExecutionMessage{
		WorkflowID:         "wf_test",
		ExecutionID:        "exec_test",
		CurrentNode:        "failing_node",
		WorkflowDefinition: workflow,
		AccumulatedContext: map[string]interface{}{},
	}

	err := exec.Execute(context.Background(), msg)
	if err != nil {
		t.Fatalf("Expected no error from executor, got %v", err)
	}

	// Verify completion message with halted status
	completionMsgs := pub.GetPublishedMessages("workflow.completion")
	if len(completionMsgs) != 1 {
		t.Fatalf("Expected 1 completion message, got %d", len(completionMsgs))
	}

	var completion messages.CompletionMessage
	json.Unmarshal(completionMsgs[0], &completion)

	if completion.Status != messages.CompletionStatusHalted {
		t.Errorf("Expected status halted, got %s", completion.Status)
	}
}

func TestExecutor_ContextAccumulation(t *testing.T) {
	// Setup mock publisher and registry
	pub := NewMockPublisher()
	reg := nodes.NewRegistry()

	reg.Register("mock", func(execCtx plugin.ExecutionContext) plugin.Node {
		return &MockNode{
			output: map[string]any{
				"status": 200,
				"data":   "test data",
			},
		}
	})

	exec := NewExecutor(reg, pub)

	workflow := core.Workflow{
		Nodes: []core.Node{
			{
				ID:         "node1",
				Name:       "Test Node",
				Type:       "mock",
				Parameters: map[string]interface{}{},
			},
			{
				ID:         "node2",
				Name:       "Next Node",
				Type:       "mock",
				Parameters: map[string]interface{}{},
			},
		},
		Edges: []core.Edge{
			{ID: "edge1", Src: "node1", Dst: "node2"},
		},
	}

	initialContext := map[string]interface{}{
		"$trigger": map[string]interface{}{"user_id": "123"},
	}

	msg := &messages.NodeExecutionMessage{
		WorkflowID:         "wf_test",
		ExecutionID:        "exec_test",
		CurrentNode:        "node1",
		WorkflowDefinition: workflow,
		AccumulatedContext: initialContext,
	}

	err := exec.Execute(context.Background(), msg)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Get the published next execution message
	execMsgs := pub.GetPublishedMessages("workflow.execution")
	if len(execMsgs) != 1 {
		t.Fatalf("Expected 1 execution message, got %d", len(execMsgs))
	}

	var nextMsg messages.NodeExecutionMessage
	json.Unmarshal(execMsgs[0], &nextMsg)

	// Verify context contains both trigger and node output
	if _, ok := nextMsg.AccumulatedContext["$trigger"]; !ok {
		t.Error("Expected context to preserve $trigger")
	}

	nodeOutput, ok := nextMsg.AccumulatedContext["$Test Node"]
	if !ok {
		t.Fatal("Expected context to contain $Test Node")
	}

	outputMap, ok := nodeOutput.(map[string]interface{})
	if !ok {
		t.Fatal("Expected node output to be a map")
	}

	if outputMap["status"] != float64(200) {
		t.Errorf("Expected status 200, got %v", outputMap["status"])
	}
}

func TestExecutor_CredentialsHandling(t *testing.T) {
	pub := NewMockPublisher()
	reg := nodes.NewRegistry()

	var receivedCredentials map[string]any

	reg.Register("mock", func(execCtx plugin.ExecutionContext) plugin.Node {
		receivedCredentials = execCtx.GetCredentials()
		return &MockNode{
			output: map[string]any{"result": "ok"},
		}
	})

	exec := NewExecutor(reg, pub)

	workflow := core.Workflow{
		Nodes: []core.Node{
			{
				ID:         "node_with_creds",
				Name:       "Node With Credentials",
				Type:       "mock",
				Parameters: map[string]interface{}{},
				Credentials: &core.Credential{
					ID:   "cred_123",
					Name: "Test Credentials",
					Type: "api_key",
					Values: map[string]interface{}{
						"key":    "secret_key_123",
						"header": "X-API-Key",
					},
				},
			},
		},
		Edges: []core.Edge{},
	}

	msg := &messages.NodeExecutionMessage{
		WorkflowID:         "wf_test",
		ExecutionID:        "exec_test",
		CurrentNode:        "node_with_creds",
		WorkflowDefinition: workflow,
		AccumulatedContext: map[string]interface{}{},
	}

	err := exec.Execute(context.Background(), msg)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Verify credentials were passed to node
	if receivedCredentials == nil {
		t.Fatal("Expected credentials to be passed to node")
	}

	if receivedCredentials["key"] != "secret_key_123" {
		t.Errorf("Expected key secret_key_123, got %v", receivedCredentials["key"])
	}
}

// NodeExecutionError is a simple error type for testing
type NodeExecutionError struct {
	Message string
}

func (e *NodeExecutionError) Error() string {
	return e.Message
}
