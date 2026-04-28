package gmail

import "rune-worker/pkg/mcp"

func init() {
	mcp.RegisterIntegration(mcp.IntegrationConfig{
		Name: "gmail",
		URL:  "http://gmail-mcp:3200/mcp",
	})
}
