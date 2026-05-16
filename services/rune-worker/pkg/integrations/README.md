# Integrations Package

`pkg/integrations` is the worker-side execution layer for integration nodes using
the kind format:

`integration.<provider>.<service>.<tool>`

Example: `integration.google.gmail.read_email`.

## Architecture

- Integration tools execute **in-process** in `rune-worker`.
- Credentials are resolved by master and attached to the node before worker
  execution. Tools read credentials from `plugin.ExecutionContext.GetCredentials()`.
- Each integration tool is a stateless singleton implementing:
  - `Kind() string`
  - `Execute(context.Context, plugin.ExecutionContext) (map[string]any, error)`
- All tools are stored in an internal integration registry map keyed by kind.
- Each tool registration also wires a factory into the global node registry
  (`pkg/nodes`) so executor can instantiate integration nodes by type.

## Directory Layout

```text
pkg/integrations/
  args.go                            # DecodeArgs helper
  registry.go                        # Tool registry + node adapter wiring
  loader.go                          # blank imports of service packages
  internal/connector/connector.go    # shared httpcore-based request pipeline
  providers/
    google/
      gmail/
        gmail.go
        send_email.go
        read_email.go
        search_emails.go
        list_labels.go
```

## Dispatch Flow

1. Executor receives a node with `Type = integration.<provider>.<service>.<tool>`.
2. Global nodes registry creates an `integrationNode`.
3. `integrationNode.Execute(...)` looks up the exact kind in integrations registry.
4. Matched tool executes with the already-built `ExecutionContext`.
5. Tool calls `internal/connector.Do(...)`.
6. Connector builds URL, injects credentials via `httpcore.ApplyCredential`, and
   calls `httpcore.Execute(...)`.
7. Output is returned in the same envelope shape used by HTTP node:
   `{status, status_text, body, headers, duration_ms}`.

## Connector Contract

`internal/connector.Spec`:

- `Method`, `BaseURL`, `Path`, `PathArgs`, `Query`, `Headers`, `Body`
- `Timeout` (defaults to 30 seconds when unset)
- `AllowNon2xx` (default false)

Default behavior:

- Non-2xx responses return `*connector.Error` with `Status`, `URL`, and `Body`.
- Transport and request-build failures bubble up as standard errors from `httpcore`.

## Argument Decoding Pattern

Every tool defines its own typed args struct and decodes from
`ec.Parameters` using `DecodeArgs(...)`.

```go
type readEmailArgs struct {
    ID string `json:"id"`
    Format string `json:"format"`
}
```

This keeps per-tool validation local and avoids duplicating central schemas.

## Adding a New Integration Tool

1. Create a new file under:
   `pkg/integrations/providers/<provider>/<service>/<tool>.go`.
2. Implement a stateless tool struct with `Kind()` and `Execute(...)`.
3. Parse arguments using `DecodeArgs`.
4. Build a connector `Spec` and call `connector.Do(...)`.
5. Register the tool in `init()`:
   `integrations.Register(MyTool{})`.
6. Add unit tests using `httptest.Server`.
7. If adding a new service package, update `pkg/integrations/loader.go` with a
   blank import.

## Testing Pattern

- Use `httptest.Server` to validate URL, query, headers, auth injection, and body.
- Use package-level `baseURL` vars in each service package and swap during tests.
- Verify non-2xx returns `*connector.Error`.
- Keep unit tests colocated with tool files.

## Current Scope

Implemented in this phase:

- Gmail:
  - `integration.google.gmail.send_email`
  - `integration.google.gmail.read_email`
  - `integration.google.gmail.search_emails`
  - `integration.google.gmail.list_labels`

- Microsoft Outlook tools:
  - `integration.microsoft.outlook.send_email`
  - `integration.microsoft.outlook.read_email`
  - `integration.microsoft.outlook.search_emails`
  - `integration.microsoft.outlook.list_folders`

Planned next:

- Google Sheets tools
