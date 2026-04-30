package google

import "rune-worker/pkg/mcp"

func init() {
	mcp.RegisterIntegration(mcp.IntegrationConfig{
		Provider: "google",
		Service:  "gmail",
		URL:      "http://gmail-mcp:3200/mcp",
		Tools: []mcp.ToolDef{
			{
				MCPName:     "send_email",
				Description: "Send an email via Gmail",
			},
			{
				MCPName:     "read_email",
				Description: "Read an email by ID from Gmail",
			},
			{
				MCPName:     "search_emails",
				Description: "Search emails in Gmail using a query",
			},
			{
				MCPName:     "list_labels",
				Description: "List all Gmail labels",
			},
		},
	})
}
