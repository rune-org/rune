/*
Package models defines shared data types for the RUNE CLI.

These types mirror the API response structures from the FastAPI backend
and are used by both HTTP and database access layers.
*/
package models

import "time"

// User represents a RUNE platform user
type User struct {
	ID           int       `json:"id"`
	Email        string    `json:"email"`
	FirstName    string    `json:"first_name"`
	LastName     string    `json:"last_name"`
	Role         string    `json:"role"`
	IsActive     bool      `json:"is_active"`
	AuthProvider string    `json:"auth_provider"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// UserCreate represents the data needed to create a new user
type UserCreate struct {
	Email     string `json:"email"`
	Password  string `json:"password"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Role      string `json:"role"`
}

// UserUpdate represents the data that can be updated for a user
type UserUpdate struct {
	Email     *string `json:"email,omitempty"`
	FirstName *string `json:"first_name,omitempty"`
	LastName  *string `json:"last_name,omitempty"`
	Role      *string `json:"role,omitempty"`
}

// Workflow represents a RUNE workflow
type Workflow struct {
	ID                 int       `json:"id"`
	Name               string    `json:"name"`
	Description        string    `json:"description"`
	OwnerID            int       `json:"owner_id"`
	LatestVersionID    *int      `json:"latest_version_id"`
	PublishedVersionID *int      `json:"published_version_id"`
	IsPublished        bool      `json:"is_published"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

// WorkflowVersion represents a version of a workflow
type WorkflowVersion struct {
	ID         int       `json:"id"`
	WorkflowID int       `json:"workflow_id"`
	Version    int       `json:"version"`
	Data       any       `json:"data"`
	CreatedAt  time.Time `json:"created_at"`
}

// Execution represents a workflow execution
type Execution struct {
	ID          string     `json:"id"`
	WorkflowID  int        `json:"workflow_id"`
	VersionID   int        `json:"version_id"`
	Status      string     `json:"status"`
	TriggerType string     `json:"trigger_type"`
	TriggerBy   int        `json:"trigger_by"`
	StartedAt   time.Time  `json:"started_at"`
	CompletedAt *time.Time `json:"completed_at"`
}

// Credential represents an encrypted credential
type Credential struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	Type        string    `json:"type"`
	Description string    `json:"description"`
	OwnerID     int       `json:"owner_id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// CredentialCreate represents data for creating a credential
type CredentialCreate struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	Description string `json:"description"`
	Value       string `json:"value"`
}

// Template represents a workflow template
type Template struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Category    string    `json:"category"`
	UsageCount  int       `json:"usage_count"`
	CreatedAt   time.Time `json:"created_at"`
}

// LoginRequest represents the login API request
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// LoginResponse represents the login API response
type LoginResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	User         User   `json:"user"`
}

// SetupStatus represents the first-time setup status
type SetupStatus struct {
	IsFirstTimeSetup bool `json:"is_first_time_setup"`
}

// HealthStatus represents the API health check response
type HealthStatus struct {
	Status    string            `json:"status"`
	Version   string            `json:"version"`
	Timestamp time.Time         `json:"timestamp"`
	Services  map[string]string `json:"services"`
}

// ErrorResponse represents an API error response
type ErrorResponse struct {
	Detail string `json:"detail"`
}

// PaginatedResponse is a generic wrapper for paginated API responses
type PaginatedResponse[T any] struct {
	Items      []T `json:"items"`
	Total      int `json:"total"`
	Page       int `json:"page"`
	PageSize   int `json:"page_size"`
	TotalPages int `json:"total_pages"`
}

// DBHealthInfo contains database health check results from the API
type DBHealthInfo struct {
	Connected     bool          `json:"connected"`
	Version       string        `json:"version"`
	DatabaseName  string        `json:"database_name"`
	DatabaseSize  string        `json:"database_size"`
	TableCount    int           `json:"table_count"`
	UserCount     int           `json:"user_count"`
	WorkflowCount int           `json:"workflow_count"`
	LatencyMs     float64       `json:"latency_ms"`
}

// DBTableInfo contains information about a database table
type DBTableInfo struct {
	Name      string `json:"name"`
	RowCount  int64  `json:"row_count"`
	SizeBytes int64  `json:"size_bytes"`
	SizeHuman string `json:"size_human"`
}

// DBTableData contains the data from a database table query
type DBTableData struct {
	TableName string     `json:"table_name"`
	Columns   []string   `json:"columns"`
	Rows      [][]string `json:"rows"`
	RowCount  int        `json:"row_count"`
}
