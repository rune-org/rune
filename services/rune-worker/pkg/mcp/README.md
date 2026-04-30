# MCP Integration Bridge

## Overview

The MCP bridge connects `rune-worker` to external MCP servers. Each integration
**explicitly declares** which tools it wraps via `ToolDef` entries. Tools are
registered as workflow nodes at startup — **no runtime auto-discovery**.
MCP connections are established **lazily** on first workflow execution.

### Optional: live tool listing (not used for the DSL)

[`Provider.DiscoverTools`](./provider.go) and [`Provider.Tools`](./provider.go) let you query a **connected** MCP server and cache its tool list (for example in tests or ad-hoc inspection). That is **separate** from workflow registration: the DSL and executor only know about tools that appear as explicit [`ToolDef`](./integration.go) entries and are registered via [`RegisterAllTools`](./integration.go) at startup. We do **not** auto-register discovered server tools as workflow node types.

## Architecture

```mermaid
graph TB
    subgraph Worker["rune-worker"]
        REG[Node Registry]
        EXE[Executor]
        MGR[Manager]

        subgraph Integrations["pkg/mcp/integrations"]
            G["google<br/>gmail + sheets"]
            MS["microsoft<br/>outlook"]
        end

        subgraph Bridge["pkg/mcp"]
            INT[integration.go]
            PRV[provider.go]
            NOD[node.go]
        end
    end

    subgraph Servers["External MCP Servers"]
        S1["Google Sheets MCP<br/>:3100"]
        S2["Gmail MCP<br/>:3200"]
        S3["Outlook MCP<br/>:3300"]
    end

    G -->|"init: RegisterIntegration<br/>(with ToolDefs)"| INT
    MS -->|"init: RegisterIntegration<br/>(with ToolDefs)"| INT

    INT -->|"RegisterAllTools<br/>(static, no MCP needed)"| REG
    MGR -->|"lazy GetOrConnect"| PRV
    PRV -->|JSON-RPC| S1
    PRV -->|JSON-RPC| S2
    PRV -->|JSON-RPC| S3

    EXE -->|Create MCPNode| NOD
    NOD -->|"GetOrConnect + CallTool"| MGR
```

## Startup Flow (No MCP Connections)

```mermaid
sequenceDiagram
    participant main as main.go
    participant init as init_registry
    participant int as integrations/*
    participant fn as RegisterAllTools
    participant reg as Registry

    init->>int: blank import triggers init()
    int->>int: RegisterIntegration(config + ToolDefs)

    main->>init: InitializeRegistry()
    init->>fn: RegisterAllTools(registry, manager)
    fn->>int: RegisteredIntegrations()
    note over fn: Iterates ToolDefs statically
    fn->>reg: Register("mcp.google.gmail.send_email", factory)
    fn->>reg: Register("mcp.google.gmail.read_email", factory)
    fn->>reg: Register("mcp.google.sheets.read_range", factory)
    note over fn: ... all explicitly declared tools
    init-->>main: (registry, mcpManager)
    note over main: No MCP connections opened yet!
```

## Runtime Execution (Lazy Connection)

```mermaid
sequenceDiagram
    participant exe as Executor
    participant reg as Registry
    participant node as MCPNode
    participant mgr as Manager
    participant prv as Provider
    participant srv as MCP Server

    exe->>reg: Create("mcp.google.gmail.send_email", execCtx)
    reg-->>exe: MCPNode
    exe->>node: Execute(ctx, execCtx)
    node->>mgr: GetOrConnect(ctx, "google.gmail")
    alt First call to this integration
        mgr->>prv: NewProvider + ConnectHTTP
        prv->>srv: initialize (JSON-RPC)
        srv-->>prv: server info
    else Already connected
        mgr-->>node: cached Provider
    end
    node->>prv: CallTool("send_email", args)
    prv->>srv: tools/call (JSON-RPC)
    srv-->>prv: CallToolResult
    prv-->>node: result
    node->>node: ExtractResult()
    node-->>exe: map[string]any
```

## File Structure

```
pkg/mcp/
├── integration.go                     # IntegrationConfig, ToolDef, RegisterAllTools
├── provider.go                        # MCP client wrapper: connect, discover, call
├── manager.go                         # Lazy connection manager (GetOrConnect)
├── node.go                            # MCPNode implementing plugin.Node
├── bridge_test.go                     # Integration tests with in-memory MCP server
└── integrations/
    ├── google/
    │   ├── sheets.go                  # 4 tools: read_range, write_range, append_row, create_spreadsheet
    │   └── gmail.go                   # 4 tools: send_email, read_email, search_emails, list_labels
    └── microsoft/
        └── outlook.go                 # 3 tools: send_email, read_email, list_inbox
```

## How to Add an Integration

### Step 1: Discover tools from the MCP server (dev time only)

```bash
# Start the MCP server locally and inspect its tools
# This is a one-time dev step, NOT done at runtime
```

### Step 2: Create the integration package with explicit ToolDefs

```go
// pkg/mcp/integrations/slack/messages.go
package slack

import "rune-worker/pkg/mcp"

func init() {
    mcp.RegisterIntegration(mcp.IntegrationConfig{
        Provider: "slack",
        Service:  "messages",
        URL:      "http://slack-mcp:3400/mcp",
        Tools: []mcp.ToolDef{
            {
                MCPName:     "send_message",
                Description: "Send a message to a Slack channel",
            },
            {
                MCPName:     "list_channels",
                Description: "List all Slack channels",
            },
            // Only wrap the tools you want to expose to users!
            // If the MCP server has 50 tools, you might only wrap 5.
        },
    })
}
```

### Step 3: Add the import

In `pkg/registry/init_registry.go`:

```go
_ "rune-worker/pkg/mcp/integrations/slack"
```

### Step 4: Custom node names (optional)

Use `NodeName` to override the default naming:

```go
{
    MCPName:     "send_message_v2",  // actual tool name on MCP server
    NodeName:    "send_message",     // becomes mcp.slack.messages.send_message
    Description: "Send a message to a Slack channel",
},
```

## Multi-Provider Workflow

A single workflow can use nodes from different MCP servers:

```json
{
  "nodes": [
    {
      "id": "1",
      "type": "mcp.google.sheets.read_range",
      "parameters": {
        "spreadsheet_id": "abc123",
        "range": "Sheet1!A1:B10"
      }
    },
    {
      "id": "2",
      "type": "mcp.microsoft.outlook.send_email",
      "parameters": {
        "to": "team@company.com",
        "subject": "Report",
        "body": "{{ $1.data }}"
      }
    }
  ]
}
```

## Connection Lifecycle

- **Startup**: No MCP connections. Tools registered statically from ToolDefs.
- **First execution**: `GetOrConnect` lazily connects to the MCP server when a workflow first uses a tool from that provider/service integration.
- **Subsequent executions**: Reuses the cached connection.
- **Shutdown**: `defer mcpManager.DisconnectAll()` in main.go closes all active sessions.

## Key Design Decisions

1. **No auto-discovery**: Tools must be explicitly declared in Go. This ensures the DSL generator knows all available tools at build time, and users only see curated tools.
2. **Lazy connections**: MCP servers don't need to be running at worker startup. Connection failures are scoped to the specific workflow execution, not the entire worker.
3. **Provider-qualified node types**: Workflow node types use `mcp.<provider>.<service>.<tool>` to avoid collisions between providers with similarly named services.
4. **Custom naming via NodeName**: The raw MCP tool name can differ from the workflow node name, allowing clean DSL types even when upstream APIs change.

## How to Test

```bash
# Run MCP bridge tests (in-memory server, no external deps)
go test ./pkg/mcp/... -v

# Run registry tests (verifies MCP tools are statically registered)
go test ./pkg/registry/... -v

# Run all tests
go test ./... -count=1
```
