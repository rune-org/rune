package core

// Credential references a credential definition by type, ID, and name.
type Credential struct {
	ID     string         `json:"id"`
	Name   string         `json:"name"`
	Type   string         `json:"type"`   // e.g., "smtp", "api_key", "oauth2", "username_password"
	Values map[string]any `json:"values"` // Actual credential values, e.g., username, password
}

// SMTPCredentials contains SMTP server connection credentials.
type SMTPCredentials struct {
	Port     string `json:"port"`
	Host     string `json:"host"`
	Username string `json:"username"`
	Password string `json:"password"`
}
