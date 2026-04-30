package sheets

import "rune-worker/pkg/mcp"

func init() {
	mcp.RegisterIntegration(mcp.IntegrationConfig{
		Name: "google_sheets",
		URL:  "http://google-sheets-mcp:3100/mcp",
		Tools: []mcp.ToolDef{
			{
				MCPName:     "read_range",
				Description: "Read a range of cells from a Google Sheet",
			},
			{
				MCPName:     "write_range",
				Description: "Write data to a range of cells in a Google Sheet",
			},
			{
				MCPName:     "append_row",
				Description: "Append a row to the end of a Google Sheet",
			},
			{
				MCPName:     "create_spreadsheet",
				Description: "Create a new Google Spreadsheet",
			},
		},
	})
}
