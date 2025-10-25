package smtp

import (
	"context"
	"testing"

	"rune-worker/plugin"
)

func TestNewSMTPNode(t *testing.T) {
	tests := []struct {
		name         string
		params       map[string]any
		creds        map[string]any
		wantHost     string
		wantPort     int
		wantUsername string
		wantPassword string
		wantFrom     string
		wantTo       []string
		wantSubject  string
	}{
		{
			name: "basic configuration with credentials",
			params: map[string]any{
				"from":    "sender@example.com",
				"to":      "recipient@example.com",
				"subject": "Test Email",
				"body":    "This is a test",
			},
			creds: map[string]any{
				"host":     "smtp.example.com",
				"port":     "587",
				"username": "user@example.com",
				"password": "secret123",
			},
			wantHost:     "smtp.example.com",
			wantPort:     587,
			wantUsername: "user@example.com",
			wantPassword: "secret123",
			wantFrom:     "sender@example.com",
			wantTo:       []string{"recipient@example.com"},
			wantSubject:  "Test Email",
		},
		{
			name: "multiple recipients",
			params: map[string]any{
				"from":    "sender@example.com",
				"to":      []any{"recipient1@example.com", "recipient2@example.com"},
				"subject": "Test Email",
				"body":    "This is a test",
			},
			creds: map[string]any{
				"host":     "smtp.example.com",
				"port":     "587",
				"username": "user@example.com",
				"password": "secret123",
			},
			wantHost:     "smtp.example.com",
			wantPort:     587,
			wantUsername: "user@example.com",
			wantPassword: "secret123",
			wantFrom:     "sender@example.com",
			wantTo:       []string{"recipient1@example.com", "recipient2@example.com"},
			wantSubject:  "Test Email",
		},
		{
			name: "custom port 465",
			params: map[string]any{
				"from":    "sender@example.com",
				"to":      "recipient@example.com",
				"subject": "Test Email",
				"body":    "This is a test",
			},
			creds: map[string]any{
				"host":     "smtp.gmail.com",
				"port":     "465",
				"username": "user@gmail.com",
				"password": "apppassword",
			},
			wantHost:     "smtp.gmail.com",
			wantPort:     465,
			wantUsername: "user@gmail.com",
			wantPassword: "apppassword",
			wantFrom:     "sender@example.com",
			wantTo:       []string{"recipient@example.com"},
			wantSubject:  "Test Email",
		},
		{
			name: "default port when not specified",
			params: map[string]any{
				"from":    "sender@example.com",
				"to":      "recipient@example.com",
				"subject": "Test Email",
				"body":    "This is a test",
			},
			creds: map[string]any{
				"host":     "smtp.example.com",
				"username": "user@example.com",
				"password": "secret123",
			},
			wantHost:     "smtp.example.com",
			wantPort:     587, // default
			wantUsername: "user@example.com",
			wantPassword: "secret123",
			wantFrom:     "sender@example.com",
			wantTo:       []string{"recipient@example.com"},
			wantSubject:  "Test Email",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			execCtx := plugin.ExecutionContext{
				Parameters: tt.params,
			}
			if tt.creds != nil {
				execCtx.SetCredentials(tt.creds)
			}

			node := NewSMTPNode(execCtx)

			if node.host != tt.wantHost {
				t.Errorf("host = %v, want %v", node.host, tt.wantHost)
			}
			if node.port != tt.wantPort {
				t.Errorf("port = %v, want %v", node.port, tt.wantPort)
			}
			if node.username != tt.wantUsername {
				t.Errorf("username = %v, want %v", node.username, tt.wantUsername)
			}
			if node.password != tt.wantPassword {
				t.Errorf("password = %v, want %v", node.password, tt.wantPassword)
			}
			if node.from != tt.wantFrom {
				t.Errorf("from = %v, want %v", node.from, tt.wantFrom)
			}
			if len(node.to) != len(tt.wantTo) {
				t.Errorf("to length = %v, want %v", len(node.to), len(tt.wantTo))
			}
			for i, recipient := range tt.wantTo {
				if node.to[i] != recipient {
					t.Errorf("to[%d] = %v, want %v", i, node.to[i], recipient)
				}
			}
			if node.subject != tt.wantSubject {
				t.Errorf("subject = %v, want %v", node.subject, tt.wantSubject)
			}
		})
	}
}

func TestSMTPNode_BuildMessage(t *testing.T) {
	tests := []struct {
		name        string
		node        *SMTPNode
		wantFrom    string
		wantTo      string
		wantSubject string
	}{
		{
			name: "simple message",
			node: &SMTPNode{
				from:    "sender@example.com",
				to:      []string{"recipient@example.com"},
				subject: "Test Subject",
				body:    "Test Body",
			},
			wantFrom:    "From: sender@example.com",
			wantTo:      "To: recipient@example.com",
			wantSubject: "Subject: Test Subject",
		},
		{
			name: "message with CC",
			node: &SMTPNode{
				from:    "sender@example.com",
				to:      []string{"recipient@example.com"},
				cc:      []string{"cc@example.com"},
				subject: "Test Subject",
				body:    "Test Body",
			},
			wantFrom:    "From: sender@example.com",
			wantTo:      "To: recipient@example.com",
			wantSubject: "Subject: Test Subject",
		},
		{
			name: "plain text message",
			node: &SMTPNode{
				from:    "sender@example.com",
				to:      []string{"recipient@example.com"},
				subject: "Test Plain Text",
				body:    "This is plain text body",
			},
			wantFrom:    "From: sender@example.com",
			wantTo:      "To: recipient@example.com",
			wantSubject: "Subject: Test Plain Text",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			message, err := tt.node.buildMessage()
			if err != nil {
				t.Fatalf("buildMessage() error = %v", err)
			}

			msgStr := string(message)

			if !contains(msgStr, tt.wantFrom) {
				t.Errorf("message missing %q", tt.wantFrom)
			}
			if !contains(msgStr, tt.wantTo) {
				t.Errorf("message missing %q", tt.wantTo)
			}
			if !contains(msgStr, tt.wantSubject) {
				t.Errorf("message missing %q", tt.wantSubject)
			}
			if !contains(msgStr, tt.node.body) {
				t.Errorf("message missing body %q", tt.node.body)
			}
		})
	}
}

func TestSMTPNode_Execute_Validation(t *testing.T) {
	tests := []struct {
		name    string
		node    *SMTPNode
		wantErr string
	}{
		{
			name: "missing host in credentials",
			node: &SMTPNode{
				username: "user@example.com",
				password: "secret123",
				from:     "sender@example.com",
				to:       []string{"recipient@example.com"},
				subject:  "Test",
			},
			wantErr: "host is required in credentials",
		},
		{
			name: "missing username in credentials",
			node: &SMTPNode{
				host:     "smtp.example.com",
				password: "secret123",
				from:     "sender@example.com",
				to:       []string{"recipient@example.com"},
				subject:  "Test",
			},
			wantErr: "username is required in credentials",
		},
		{
			name: "missing password in credentials",
			node: &SMTPNode{
				host:     "smtp.example.com",
				username: "user@example.com",
				from:     "sender@example.com",
				to:       []string{"recipient@example.com"},
				subject:  "Test",
			},
			wantErr: "password is required in credentials",
		},
		{
			name: "missing from parameter",
			node: &SMTPNode{
				host:     "smtp.example.com",
				username: "user@example.com",
				password: "secret123",
				to:       []string{"recipient@example.com"},
				subject:  "Test",
			},
			wantErr: "from parameter is required",
		},
		{
			name: "missing to parameter",
			node: &SMTPNode{
				host:     "smtp.example.com",
				username: "user@example.com",
				password: "secret123",
				from:     "sender@example.com",
				subject:  "Test",
			},
			wantErr: "at least one recipient in 'to' is required",
		},
		{
			name: "missing subject parameter",
			node: &SMTPNode{
				host:     "smtp.example.com",
				username: "user@example.com",
				password: "secret123",
				from:     "sender@example.com",
				to:       []string{"recipient@example.com"},
			},
			wantErr: "subject parameter is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			execCtx := plugin.ExecutionContext{}

			_, err := tt.node.Execute(ctx, execCtx)
			if err == nil {
				t.Fatal("Execute() expected error, got nil")
			}
			if !contains(err.Error(), tt.wantErr) {
				t.Errorf("Execute() error = %v, want error containing %q", err, tt.wantErr)
			}
		})
	}
}

func TestSMTPNode_CollectRecipients(t *testing.T) {
	node := &SMTPNode{
		host:    "smtp.example.com",
		from:    "sender@example.com",
		to:      []string{"to1@example.com", "to2@example.com"},
		cc:      []string{"cc@example.com"},
		bcc:     []string{"bcc@example.com"},
		subject: "Test",
		body:    "Test body",
	}

	// Build message to check recipient collection
	message, err := node.buildMessage()
	if err != nil {
		t.Fatalf("buildMessage() error = %v", err)
	}

	msgStr := string(message)

	// Verify To recipients are in the message
	if !contains(msgStr, "to1@example.com") || !contains(msgStr, "to2@example.com") {
		t.Error("message missing To recipients")
	}

	// Verify CC is in the message
	if !contains(msgStr, "cc@example.com") {
		t.Error("message missing CC recipient")
	}

	// BCC should NOT be in the message headers
	if contains(msgStr, "Bcc:") || contains(msgStr, "bcc@example.com") {
		t.Error("message should not contain BCC in headers")
	}
}

// Helper function to check if a string contains a substring
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 ||
		(len(s) > 0 && len(substr) > 0 && containsHelper(s, substr)))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
