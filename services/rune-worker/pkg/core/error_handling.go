package core

// ErrorHandling defines how errors should be handled when a node fails.
type ErrorHandling struct {
	Type      string `json:"type"`       // "halt", "ignore", or "branch"
	ErrorEdge string `json:"error_edge"` // Edge ID to follow on error if type is "branch"
}

// Constants for error handling types
const (
	ErrorHandlingHalt   = "halt"
	ErrorHandlingIgnore = "ignore"
	ErrorHandlingBranch = "branch"
)
