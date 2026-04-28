package sheets

import "rune-worker/pkg/mcp"

func init() {
	mcp.RegisterIntegration(mcp.IntegrationConfig{
		Name: "google_sheets",
		URL:  "http://google-sheets-mcp:3100/mcp",
	})
}
