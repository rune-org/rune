package outlook

import "rune-worker/pkg/mcp"

func init() {
	mcp.RegisterIntegration(mcp.IntegrationConfig{
		Name: "outlook",
		URL:  "http://outlook-mcp:3300/mcp",
	})
}
