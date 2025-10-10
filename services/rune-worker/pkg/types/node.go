package types

// Node represents a single executable node within the workflow.
// Trigger nodes are included in the structure for graph completeness but are never executed in this service.
// The master service handles trigger execution and sends the resulting data in the execution context.
type Node struct {
	ID          string         `json:"id"`
	Name        string         `json:"name"`
	Trigger     bool           `json:"trigger"` // Marks trigger nodes (NOT executed here, only for graph structure)
	Type        string         `json:"type"`
	Parameters  map[string]any `json:"parameters"`
	Credentials *Credential    `json:"credentials,omitempty"`
	Output      map[string]any `json:"output"`
	Error       *ErrorHandling `json:"error,omitempty"`
}

// HasCredentials checks if the node has credentials configured.
func (n *Node) HasCredentials() bool {
	return n.Credentials != nil && n.Credentials.ID != ""
}

// HasErrorHandling checks if the node has error handling configured.
func (n *Node) HasErrorHandling() bool {
	return n.Error != nil && n.Error.Type != ""
}
