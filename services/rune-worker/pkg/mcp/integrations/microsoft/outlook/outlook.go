package outlook

import "rune-worker/pkg/mcp"

func init() {
	mcp.RegisterIntegration(mcp.IntegrationConfig{
		Name: "outlook",
		URL:  "http://outlook-mcp:3300/mcp",
		Tools: []mcp.ToolDef{
			{
				MCPName:     "send_email",
				NodeName:    "send_email",
				Description: "Send an email via Microsoft Outlook",
			},
			{
				MCPName:     "read_email",
				Description: "Read an email by ID from Outlook",
			},
			{
				MCPName:     "list_inbox",
				Description: "List recent emails from Outlook inbox",
			},
		},
	})
}
