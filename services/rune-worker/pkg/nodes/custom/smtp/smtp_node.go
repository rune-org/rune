package smtp

import (
	"context"
	"fmt"
	"net/smtp"
	"strconv"
	"strings"
	"time"

	"rune-worker/pkg/core"
	"rune-worker/pkg/nodes"
	"rune-worker/plugin"
)

// SMTPNode sends emails via SMTP protocol with support for authentication
// and multiple recipients (to, cc, bcc).
type SMTPNode struct {
	host     string
	port     int
	username string
	password string
	from     string
	to       []string
	cc       []string
	bcc      []string
	subject  string
	body     string
}

// NewSMTPNode creates a new SMTPNode instance from execution context parameters.
func NewSMTPNode(execCtx plugin.ExecutionContext) *SMTPNode {
	node := &SMTPNode{
		port: 587, // Default SMTP submission port (fallback)
		to:   []string{},
		cc:   []string{},
		bcc:  []string{},
	}

	// Get credentials from context - host, port, username, and password come from credentials
	creds := execCtx.GetCredentials()

	// Extract host from credentials
	if host, ok := creds["host"].(string); ok {
		node.host = host
	}

	// Extract port from credentials
	if portStr, ok := creds["port"].(string); ok {
		if port, err := strconv.Atoi(portStr); err == nil {
			node.port = port
		}
	} else if portFloat, ok := creds["port"].(float64); ok {
		node.port = int(portFloat)
	} else if portInt, ok := creds["port"].(int); ok {
		node.port = portInt
	}

	// Extract username from credentials
	if username, ok := creds["username"].(string); ok {
		node.username = username
	}

	// Extract password from credentials
	if password, ok := creds["password"].(string); ok {
		node.password = password
	}

	// Parse from address
	if from, ok := execCtx.Parameters["from"].(string); ok {
		node.from = from
	}

	// Parse to addresses (support both string and array)
	if to, ok := execCtx.Parameters["to"].(string); ok {
		// Single recipient as string
		node.to = []string{to}
	} else if toList, ok := execCtx.Parameters["to"].([]interface{}); ok {
		// Multiple recipients as array
		for _, recipient := range toList {
			if recipientStr, ok := recipient.(string); ok {
				node.to = append(node.to, recipientStr)
			}
		}
	}

	// Parse CC addresses
	if cc, ok := execCtx.Parameters["cc"].(string); ok {
		node.cc = []string{cc}
	} else if ccList, ok := execCtx.Parameters["cc"].([]interface{}); ok {
		for _, recipient := range ccList {
			if recipientStr, ok := recipient.(string); ok {
				node.cc = append(node.cc, recipientStr)
			}
		}
	}

	// Parse BCC addresses
	if bcc, ok := execCtx.Parameters["bcc"].(string); ok {
		node.bcc = []string{bcc}
	} else if bccList, ok := execCtx.Parameters["bcc"].([]interface{}); ok {
		for _, recipient := range bccList {
			if recipientStr, ok := recipient.(string); ok {
				node.bcc = append(node.bcc, recipientStr)
			}
		}
	}

	// Parse subject (accept any value)
	if subject := execCtx.Parameters["subject"]; subject != nil {
		node.subject = fmt.Sprintf("%v", subject)
	}

	// Parse body
	if body := execCtx.Parameters["body"]; body != nil {
		node.body = fmt.Sprintf("%v", body) // We need the body to accept any value not just strings, instead of being resolved prematurely
	}

	// TODO(worker): update parsing logic for the other fields if needed to match the parsing logic of subject and body

	return node
}

// Execute sends an email via SMTP.
func (n *SMTPNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
	// Validate required credentials
	if n.host == "" {
		return nil, fmt.Errorf("host is required in credentials")
	}
	if n.username == "" {
		return nil, fmt.Errorf("username is required in credentials")
	}
	if n.password == "" {
		return nil, fmt.Errorf("password is required in credentials")
	}

	// Validate required parameters
	if n.from == "" {
		return nil, fmt.Errorf("from parameter is required")
	}
	if len(n.to) == 0 {
		return nil, fmt.Errorf("at least one recipient in 'to' is required")
	}
	if n.subject == "" {
		return nil, fmt.Errorf("subject parameter is required")
	}

	// Build the email message
	message, err := n.buildMessage()
	if err != nil {
		return nil, fmt.Errorf("failed to build email message: %w", err)
	}

	// Collect all recipients (to, cc, bcc)
	allRecipients := append([]string{}, n.to...)
	allRecipients = append(allRecipients, n.cc...)
	allRecipients = append(allRecipients, n.bcc...)

	// Send the email
	startTime := time.Now()
	err = n.sendEmail(ctx, allRecipients, message)
	duration := time.Since(startTime)

	if err != nil {
		return nil, fmt.Errorf("failed to send email: %w", err)
	}

	// Build successful response
	result := map[string]any{
		"success":     true,
		"message":     "Email sent successfully",
		"from":        n.from,
		"to":          n.to,
		"cc":          n.cc,
		"bcc":         n.bcc,
		"subject":     n.subject,
		"duration_ms": duration.Milliseconds(),
		"recipients":  len(allRecipients),
	}

	return result, nil
}

// buildMessage constructs the email message with headers and body.
func (n *SMTPNode) buildMessage() ([]byte, error) {
	var sb strings.Builder

	// From header
	sb.WriteString(fmt.Sprintf("From: %s\r\n", n.from))

	// To header
	if len(n.to) > 0 {
		sb.WriteString(fmt.Sprintf("To: %s\r\n", strings.Join(n.to, ", ")))
	}

	// CC header
	if len(n.cc) > 0 {
		sb.WriteString(fmt.Sprintf("Cc: %s\r\n", strings.Join(n.cc, ", ")))
	}

	// Subject header
	sb.WriteString(fmt.Sprintf("Subject: %s\r\n", n.subject))

	// MIME headers
	sb.WriteString("MIME-Version: 1.0\r\n")
	sb.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")

	// Date header
	sb.WriteString(fmt.Sprintf("Date: %s\r\n", time.Now().Format(time.RFC1123Z)))

	// Empty line separating headers from body
	sb.WriteString("\r\n")

	// Body
	sb.WriteString(n.body)

	return []byte(sb.String()), nil
}

// sendEmail sends the email using plain SMTP.
func (n *SMTPNode) sendEmail(ctx context.Context, recipients []string, message []byte) error {
	addr := fmt.Sprintf("%s:%d", n.host, n.port)

	// Create auth if credentials provided
	var auth smtp.Auth
	if n.username != "" && n.password != "" {
		auth = smtp.PlainAuth("", n.username, n.password, n.host)
	}

	// Send email
	err := smtp.SendMail(addr, auth, n.from, recipients, message)
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	return nil
}

// init registers the SMTP node type automatically on package import.
func init() {
	nodes.RegisterNodeType(RegisterSMTP)
}

// RegisterSMTP registers the SMTP node type with the registry.
func RegisterSMTP(reg *nodes.Registry) {
	reg.Register(core.NodeTypeSMTP, func(execCtx plugin.ExecutionContext) plugin.Node {
		return NewSMTPNode(execCtx)
	})
}
