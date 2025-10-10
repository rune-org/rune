package executor

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"rune-worker/pkg/dsl"
	"rune-worker/pkg/messages"
	"rune-worker/pkg/nodes"
	"rune-worker/pkg/nodes/custom"
	httpnode "rune-worker/pkg/nodes/custom/http"
	"rune-worker/pkg/platform/queue"
	"rune-worker/plugin"
)

// Executor evaluates workflow definitions and invokes nodes in order.
// It implements the recursive node-by-node execution model as specified in RFC-001.
type Executor struct {
	registry  *nodes.Registry
	publisher queue.Publisher
}

// NewExecutor builds an executor with the provided registry and publisher.
func NewExecutor(reg *nodes.Registry, pub queue.Publisher) *Executor {
	if reg == nil {
		reg = DefaultRegistry()
	}

	return &Executor{
		registry:  reg,
		publisher: pub,
	}
}

// Execute processes a single node execution message.
// This method handles both initial workflow starts (from master) and recursive
// node executions (from other workers).
//
// Execution sequence per RFC-001 Section 7.2:
//  1. Parse workflow definition
//  2. Lookup node by current_node ID
//  3. Validate node exists and is executable
//  4. Publish NodeStatusMessage(status=running)
//  5. Build ExecutionContext from accumulated_context
//  6. Execute node logic with ExecutionContext
//  7. If successful:
//     a. Publish NodeStatusMessage(status=success)
//     b. Accumulate result into context
//     c. Determine next nodes via graph traversal
//     d. Publish NodeExecutionMessage for each next node OR CompletionMessage
//  8. If failed:
//     a. Publish NodeStatusMessage(status=failed)
//     b. Apply error handling strategy (halt|ignore|branch)
//     c. Publish appropriate next message or completion
func (e *Executor) Execute(ctx context.Context, msg *messages.NodeExecutionMessage) error {
	startTime := time.Now()

	// Step 1 & 2: Get workflow and current node
	node, err := msg.GetCurrentNodeDetails()
	if err != nil {
		slog.Error("failed to get current node", "error", err, "node_id", msg.CurrentNode)
		return fmt.Errorf("get current node: %w", err)
	}

	slog.Info("executing node",
		"workflow_id", msg.WorkflowID,
		"execution_id", msg.ExecutionID,
		"node_id", node.ID,
		"node_name", node.Name,
		"node_type", node.Type,
	)

	// Step 4: Publish "running" status
	if err := e.publishRunningStatus(ctx, msg, &node); err != nil {
		slog.Error("failed to publish running status", "error", err)
		// Continue execution even if status publish fails
	}

	// Step 5 & 6: Build context and execute node
	execContext := e.buildExecutionContext(msg, &node)
	nodeInstance, err := e.registry.Create(node.Type, execContext)
	if err != nil {
		return e.handleNodeCreationFailure(ctx, msg, &node, err, startTime)
	}

	output, execErr := nodeInstance.Execute(ctx, execContext)
	duration := time.Since(startTime)

	// Step 7 & 8: Handle execution result
	if execErr != nil {
		return e.handleNodeFailure(ctx, msg, &node, execErr, duration)
	}

	return e.handleNodeSuccess(ctx, msg, &node, output, duration, startTime)
}

// buildExecutionContext creates the plugin.ExecutionContext from the message.
// Credentials are already resolved by the master service and included in the node definition.
func (e *Executor) buildExecutionContext(msg *messages.NodeExecutionMessage, node *dsl.Node) plugin.ExecutionContext {
	execCtx := plugin.ExecutionContext{
		ExecutionID: msg.ExecutionID,
		WorkflowID:  msg.WorkflowID,
		NodeID:      node.ID,
		Type:        node.Type,
		Parameters:  node.Parameters,
		Input:       msg.AccumulatedContext,
	}

	// Set credentials if present (already resolved by master)
	if node.Credentials != nil && node.Credentials.Values != nil {
		execCtx.SetCredentials(node.Credentials.Values)
	}

	return execCtx
}

// publishRunningStatus publishes a "running" status message.
func (e *Executor) publishRunningStatus(ctx context.Context, msg *messages.NodeExecutionMessage, node *dsl.Node) error {
	statusMsg := &messages.NodeStatusMessage{
		WorkflowID:  msg.WorkflowID,
		ExecutionID: msg.ExecutionID,
		NodeID:      node.ID,
		NodeName:    node.Name,
		Status:      messages.StatusRunning,
		ExecutedAt:  time.Now(),
		DurationMs:  0,
	}

	return e.publishStatus(ctx, statusMsg)
}

// handleNodeCreationFailure handles the case when a node cannot be created from the registry.
func (e *Executor) handleNodeCreationFailure(ctx context.Context, msg *messages.NodeExecutionMessage, node *dsl.Node, err error, startTime time.Time) error {
	duration := time.Since(startTime)
	slog.Error("failed to create node", "error", err, "node_type", node.Type)

	statusMsg := &messages.NodeStatusMessage{
		WorkflowID:  msg.WorkflowID,
		ExecutionID: msg.ExecutionID,
		NodeID:      node.ID,
		NodeName:    node.Name,
		Status:      messages.StatusFailed,
		Error: &messages.NodeError{
			Message: fmt.Sprintf("failed to create node of type %s", node.Type),
			Code:    "NODE_CREATION_FAILED",
			Details: map[string]interface{}{"error": err.Error()},
		},
		ExecutedAt: time.Now(),
		DurationMs: duration.Milliseconds(),
	}

	_ = e.publishStatus(ctx, statusMsg)

	// Node creation failure is always a halt condition
	return e.publishCompletion(ctx, msg, messages.CompletionStatusFailed, startTime)
}

// handleNodeFailure processes a node execution failure according to error handling strategy.
func (e *Executor) handleNodeFailure(ctx context.Context, msg *messages.NodeExecutionMessage, node *dsl.Node, execErr error, duration time.Duration) error {
	slog.Error("node execution failed",
		"error", execErr,
		"node_id", node.ID,
		"node_name", node.Name,
	)

	// Publish failed status
	statusMsg := &messages.NodeStatusMessage{
		WorkflowID:  msg.WorkflowID,
		ExecutionID: msg.ExecutionID,
		NodeID:      node.ID,
		NodeName:    node.Name,
		Status:      messages.StatusFailed,
		Error: &messages.NodeError{
			Message: execErr.Error(),
			Code:    "NODE_EXECUTION_FAILED",
		},
		ExecutedAt: time.Now(),
		DurationMs: duration.Milliseconds(),
	}

	if err := e.publishStatus(ctx, statusMsg); err != nil {
		slog.Error("failed to publish failed status", "error", err)
	}

	// Apply error handling strategy
	errorStrategy := "halt" // default
	if node.Error != nil && node.Error.Type != "" {
		errorStrategy = node.Error.Type
	}

	switch errorStrategy {
	case "halt":
		return e.publishCompletion(ctx, msg, messages.CompletionStatusHalted, time.Now())

	case "ignore":
		// Continue to next nodes despite error
		nextNodes := e.determineNextNodes(&msg.WorkflowDefinition, node, nil)
		return e.publishNextNodes(ctx, msg, nextNodes, msg.AccumulatedContext)

	case "branch":
		// Follow error edge if specified
		if node.Error != nil && node.Error.ErrorEdge != "" {
			errorNode := e.getNodeByErrorEdge(&msg.WorkflowDefinition, node.Error.ErrorEdge)
			if errorNode != nil {
				return e.publishNextNodes(ctx, msg, []string{errorNode.ID}, msg.AccumulatedContext)
			}
		}
		// If no error edge, halt
		return e.publishCompletion(ctx, msg, messages.CompletionStatusHalted, time.Now())

	default:
		slog.Warn("unknown error strategy, halting", "strategy", errorStrategy)
		return e.publishCompletion(ctx, msg, messages.CompletionStatusHalted, time.Now())
	}
}

// handleNodeSuccess processes a successful node execution.
func (e *Executor) handleNodeSuccess(ctx context.Context, msg *messages.NodeExecutionMessage, node *dsl.Node, output map[string]any, duration time.Duration, startTime time.Time) error {
	slog.Info("node execution succeeded",
		"node_id", node.ID,
		"node_name", node.Name,
		"duration_ms", duration.Milliseconds(),
	)

	// Publish success status
	statusMsg := &messages.NodeStatusMessage{
		WorkflowID:  msg.WorkflowID,
		ExecutionID: msg.ExecutionID,
		NodeID:      node.ID,
		NodeName:    node.Name,
		Status:      messages.StatusSuccess,
		Output:      output,
		ExecutedAt:  time.Now(),
		DurationMs:  duration.Milliseconds(),
	}

	if err := e.publishStatus(ctx, statusMsg); err != nil {
		slog.Error("failed to publish success status", "error", err)
	}

	// Accumulate result into context with $<node_name> key
	updatedContext := e.accumulateContext(msg.AccumulatedContext, node.Name, output)

	// Determine next nodes via graph traversal
	nextNodes := e.determineNextNodes(&msg.WorkflowDefinition, node, output)

	if len(nextNodes) == 0 {
		// No more nodes to execute - workflow completed
		slog.Info("workflow completed", "workflow_id", msg.WorkflowID, "execution_id", msg.ExecutionID)
		return e.publishCompletion(ctx, msg, messages.CompletionStatusCompleted, startTime)
	}

	// Publish execution messages for next nodes
	return e.publishNextNodes(ctx, msg, nextNodes, updatedContext)
}

// accumulateContext adds the node output to the accumulated context with $<node_name> key.
func (e *Executor) accumulateContext(currentContext map[string]interface{}, nodeName string, output map[string]any) map[string]interface{} {
	updated := make(map[string]interface{}, len(currentContext)+1)
	for k, v := range currentContext {
		updated[k] = v
	}
	updated[fmt.Sprintf("$%s", nodeName)] = output
	return updated
}

// determineNextNodes implements the graph traversal algorithm from RFC-001 Section 7.3.
func (e *Executor) determineNextNodes(wf *dsl.Workflow, currentNode *dsl.Node, output map[string]any) []string {
	graph := dsl.BuildGraph(wf)
	outgoingEdges := e.getOutgoingEdges(wf, currentNode.ID)

	switch currentNode.Type {
	case "conditional":
		// Evaluate condition and follow true/false edge
		return e.handleConditionalNode(currentNode, output, wf)

	case "split":
		// Parallel execution - return all destinations
		nextNodes := make([]string, 0, len(outgoingEdges))
		for _, edge := range outgoingEdges {
			nextNodes = append(nextNodes, edge.Dst)
		}
		return nextNodes

	default:
		// Regular node - return all successor nodes
		return graph.GetNeighbors(currentNode.ID)
	}
}

// getOutgoingEdges returns all edges originating from the given node.
func (e *Executor) getOutgoingEdges(wf *dsl.Workflow, nodeID string) []dsl.Edge {
	edges := make([]dsl.Edge, 0)
	for _, edge := range wf.Edges {
		if edge.Src == nodeID {
			edges = append(edges, edge)
		}
	}
	return edges
}

// handleConditionalNode evaluates a conditional node and returns the appropriate next node.
func (e *Executor) handleConditionalNode(node *dsl.Node, output map[string]any, wf *dsl.Workflow) []string {
	// Extract true_edge_id and false_edge_id from parameters
	trueEdgeID, _ := node.Parameters["true_edge_id"].(string)
	falseEdgeID, _ := node.Parameters["false_edge_id"].(string)

	// Get result from output
	result, ok := output["result"].(bool)
	if !ok {
		slog.Warn("conditional node did not return boolean result, defaulting to false", "node_id", node.ID)
		result = false
	}

	var edgeID string
	if result {
		edgeID = trueEdgeID
	} else {
		edgeID = falseEdgeID
	}

	if edgeID == "" {
		return []string{}
	}

	// Find the destination node for this edge
	for _, edge := range wf.Edges {
		if edge.ID == edgeID {
			return []string{edge.Dst}
		}
	}

	slog.Warn("conditional edge not found", "edge_id", edgeID, "node_id", node.ID)
	return []string{}
}

// getNodeByErrorEdge finds the destination node of an error edge.
func (e *Executor) getNodeByErrorEdge(wf *dsl.Workflow, errorEdgeID string) *dsl.Node {
	for _, edge := range wf.Edges {
		if edge.ID == errorEdgeID {
			if node, found := wf.GetNodeByID(edge.Dst); found {
				return &node
			}
		}
	}
	return nil
}

// publishNextNodes publishes NodeExecutionMessages for all next nodes.
func (e *Executor) publishNextNodes(ctx context.Context, msg *messages.NodeExecutionMessage, nextNodeIDs []string, updatedContext map[string]interface{}) error {
	for _, nextNodeID := range nextNodeIDs {
		nextMsg := &messages.NodeExecutionMessage{
			WorkflowID:         msg.WorkflowID,
			ExecutionID:        msg.ExecutionID,
			CurrentNode:        nextNodeID,
			WorkflowDefinition: msg.WorkflowDefinition,
			AccumulatedContext: updatedContext,
		}

		payload, err := nextMsg.Encode()
		if err != nil {
			slog.Error("failed to encode next node message", "error", err, "next_node", nextNodeID)
			return fmt.Errorf("encode next node message: %w", err)
		}

		if err := e.publisher.Publish(ctx, "workflow.execution", payload); err != nil {
			slog.Error("failed to publish next node message", "error", err, "next_node", nextNodeID)
			return fmt.Errorf("publish next node message: %w", err)
		}

		slog.Info("published next node message", "next_node", nextNodeID)
	}

	return nil
}

// publishStatus publishes a NodeStatusMessage to the status queue.
func (e *Executor) publishStatus(ctx context.Context, msg *messages.NodeStatusMessage) error {
	payload, err := msg.Encode()
	if err != nil {
		return fmt.Errorf("encode status message: %w", err)
	}

	return e.publisher.Publish(ctx, "workflow.node.status", payload)
}

// publishCompletion publishes a CompletionMessage to the completion queue.
func (e *Executor) publishCompletion(ctx context.Context, msg *messages.NodeExecutionMessage, status string, startTime time.Time) error {
	totalDuration := time.Since(startTime)

	completionMsg := &messages.CompletionMessage{
		WorkflowID:      msg.WorkflowID,
		ExecutionID:     msg.ExecutionID,
		Status:          status,
		FinalContext:    msg.AccumulatedContext,
		CompletedAt:     time.Now(),
		TotalDurationMs: totalDuration.Milliseconds(),
	}

	payload, err := completionMsg.Encode()
	if err != nil {
		return fmt.Errorf("encode completion message: %w", err)
	}

	if err := e.publisher.Publish(ctx, "workflow.completion", payload); err != nil {
		return fmt.Errorf("publish completion message: %w", err)
	}

	slog.Info("published completion message",
		"workflow_id", msg.WorkflowID,
		"execution_id", msg.ExecutionID,
		"status", status,
		"duration_ms", totalDuration.Milliseconds(),
	)

	return nil
}

// DefaultRegistry returns a registry populated with the built-in nodes.
func DefaultRegistry() *nodes.Registry {
	reg := nodes.NewRegistry()
	custom.RegisterLog(reg)
	httpnode.RegisterHTTP(reg)
	return reg
}
