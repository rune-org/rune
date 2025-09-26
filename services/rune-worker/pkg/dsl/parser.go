package dsl

import (
	"encoding/json"
	"fmt"
)

// ParseWorkflow converts a JSON document into a validated workflow structure.
func ParseWorkflow(data []byte) (*Workflow, error) {
	var wf Workflow
	if err := json.Unmarshal(data, &wf); err != nil {
		return nil, fmt.Errorf("parse workflow: %w", err)
	}

	if err := wf.Validate(); err != nil {
		return nil, fmt.Errorf("validate workflow: %w", err)
	}

	graph := BuildGraph(&wf)
	if graph.HasCycle() {
		return nil, fmt.Errorf("workflow %s contains a cycle", wf.Name)
	}

	return &wf, nil
}
