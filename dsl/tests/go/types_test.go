package dsl_test

import (
	"strings"
	"testing"

	dsl "github.com/rune-org/rune/dsl/generated"
)

func TestWorkflow_Sanitize_Valid(t *testing.T) {
	node := dsl.Node{
		Id:         "node_1",
		Name:       "Fetch API",
		Trigger:    false,
		Type:       "http",
		Parameters: map[string]interface{}{"method": "GET", "url": "https://api.example.com"},
		Output:     map[string]interface{}{},
	}
	edge := dsl.Edge{
		Id:  "edge_1",
		Src: "node_1",
		Dst: "node_2",
	}
	workflow := dsl.Workflow{
		WorkflowId:  "wf_1",
		ExecutionId: "exec_1",
		Nodes:       []dsl.Node{node},
		Edges:       []dsl.Edge{edge},
	}

	ok, errors := workflow.Sanitize()
	if !ok {
		t.Fatalf("expected valid workflow, got errors: %v", errors)
	}
	if len(errors) != 0 {
		t.Fatalf("expected no errors, got: %v", errors)
	}
}

func TestEdge_Sanitize_Valid(t *testing.T) {
	edge := dsl.Edge{Id: "e1", Src: "n1", Dst: "n2"}
	ok, errors := edge.Sanitize()
	if !ok {
		t.Fatalf("expected valid edge, got errors: %v", errors)
	}
	if len(errors) != 0 {
		t.Fatalf("expected no errors, got: %v", errors)
	}
}

func TestNode_Sanitize_Valid(t *testing.T) {
	node := dsl.Node{
		Id:         "n1",
		Name:       "HTTP node",
		Trigger:    false,
		Type:       "http",
		Parameters: map[string]interface{}{"url": "https://example.com", "method": "GET"},
		Output:     map[string]interface{}{},
	}
	ok, errors := node.Sanitize()
	if !ok {
		t.Fatalf("expected valid node, got errors: %v", errors)
	}
	if len(errors) != 0 {
		t.Fatalf("expected no errors, got: %v", errors)
	}
}

func TestWorkflow_Sanitize_Invalid(t *testing.T) {
	workflow := dsl.Workflow{
		WorkflowId:  "", // invalid: empty
		ExecutionId: "exec_1",
		Nodes:       []dsl.Node{},
		Edges:       []dsl.Edge{},
	}
	ok, errors := workflow.Sanitize()
	if ok {
		t.Fatal("expected invalid workflow")
	}
	if len(errors) == 0 {
		t.Fatal("expected non-empty errors")
	}
	found := false
	for _, e := range errors {
		if strings.Contains(e, "workflow_id") {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected error mentioning workflow_id, got: %v", errors)
	}
}
