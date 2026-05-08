# RFC-010: Integration Nodes Architecture for rune-worker

## Status

Implemented (Phase 1: Gmail)

## Authors

Rune Worker Team

## Created

2026-05-07

## Abstract

This RFC defines the architecture for executing integration nodes in
`services/rune-worker` using node kinds in the format:

`integration.<provider>.<service>.<tool>`

The design introduces a dedicated `pkg/integrations` package with:

- A local tool registry keyed by full integration kind.
- A thin adapter wired into the global node registry.
- A shared connector layer that reuses `pkg/nodes/shared/httpcore`.
- Per-tool typed argument parsing and validation.

Phase 1 implements Gmail tools with tests and documentation.

## Motivation

The frontend integration catalog already defines provider/service/tool metadata and
arguments, but the worker lacked a standardized execution layer for those nodes.
Without a dedicated package, adding integrations would duplicate HTTP logic,
credential handling, registration patterns, and tests.

We need:

- A scalable structure for many tools across providers.
- Consistent dispatch and output contracts.
- Reuse of existing shared HTTP behavior (`httpcore`).
- Predictable error behavior integrating with existing worker error strategies.

## Scope

In scope:

- New `pkg/integrations` architecture and wiring.
- Shared connector implementation on top of `httpcore`.
- Gmail tools:
  - `integration.google.gmail.send_email`
  - `integration.google.gmail.read_email`
  - `integration.google.gmail.search_emails`
  - `integration.google.gmail.list_labels`
- Unit tests for connector, registry, args decode, and Gmail tools.

Out of scope:

- Token refresh lifecycle in worker.
- Sheets and Outlook tools (follow-up phases).
- Cross-service protocol changes to API/frontend payload contracts.

## Design Decisions

### 1) Execution model

Integration tools execute in-process in worker, same as other node types.

### 2) Credentials

Credentials are already resolved by master and inserted into node credentials.
Worker uses `ExecutionContext.GetCredentials()` as-is.

### 3) Node kind dispatch

- Global registry still requires exact node type registration.
- Integrations register each full kind using a shared adapter factory.
- Adapter delegates execution to integration-local registry by kind.

### 4) Tool contract

Each tool is a stateless singleton:

```go
type Tool interface {
    Kind() string
    Execute(context.Context, plugin.ExecutionContext) (map[string]any, error)
}
```

### 5) HTTP behavior reuse

All HTTP calls are routed through shared `httpcore`:

- URL/path/query assembly via connector.
- Auth header injection via `httpcore.ApplyCredential`.
- HTTP execution via `httpcore.Execute`.

### 6) Error behavior

Connector defaults to fail on non-2xx and returns typed `*connector.Error`.
Tools can opt into pass-through with `AllowNon2xx` for special cases.

### 7) Output contract

Tools return the same envelope shape as HTTP node by default:

`{status, status_text, body, headers, duration_ms}`.

### 8) Arguments

Each tool defines a typed args struct and decodes from `ec.Parameters` via shared
`DecodeArgs(...)` helper (JSON marshal/unmarshal round-trip).

## Package Layout

```text
pkg/integrations/
  args.go
  registry.go
  loader.go
  internal/connector/connector.go
  providers/google/gmail/*.go
```

Wiring point:

- `pkg/registry/init_registry.go` blank-imports `rune-worker/pkg/integrations`.

## Runtime Flow

1. Executor builds `plugin.ExecutionContext`.
2. `Registry.Create(ec.Type, ec)` returns integration adapter for matching kind.
3. Adapter looks up tool in integration map and calls `Tool.Execute`.
4. Tool parses args, builds connector spec, calls connector.
5. Connector builds request and invokes `httpcore`.
6. Tool returns envelope output or error.
7. Existing executor status/error handling logic proceeds unchanged.

## Security Considerations

- Credential values are never resolved in worker and are consumed only from
  pre-resolved execution context.
- Auth header injection uses existing shared credential logic from `httpcore`.
- Non-2xx response handling preserves provider error payload in typed connector
  errors for observability.
- No additional credential storage/persistence is introduced.

## Testing Strategy

- Unit tests for:
  - argument decode helper,
  - integration registry + adapter dispatch,
  - connector URL/auth/error handling,
  - each Gmail tool behavior.
- `httptest.Server` is used for tool and connector tests.
- Service package `baseURL` vars are swapped in tests for deterministic endpoints.

## Trade-offs

Pros:

- Reuses mature HTTP core behavior.
- Isolates integration complexity from generic executor code.
- Scales linearly with new tools using small focused files.
- Keeps contracts consistent with existing HTTP output shape.

Cons:

- Global registry still receives one registration per integration kind.
- Connector currently uses one-value-per-query-key map (no repeated-key query
  encoding yet).
- Worker does not refresh OAuth tokens in this phase.

## Future Work

1. Add Sheets and Outlook tool implementations.
2. Introduce richer query encoding support (repeated query keys where needed).
3. Optional provider-aware retry/backoff policies.
4. Evaluate token refresh strategy with API coordination.
5. Add integration/e2e scenarios through full worker execution pipeline.

## Rollout Plan

Phase 1 (this RFC implementation):

- Scaffold architecture and Gmail tools.
- Add tests and docs.

Phase 2:

- Add Google Sheets tools.

Phase 3:

- Add Microsoft Outlook tools.

## Acceptance Criteria

- Worker can execute Gmail integration kinds from DSL nodes.
- Auth is injected through existing credential mechanism.
- Non-2xx responses surface as node execution errors.
- Unit tests pass for connector/registry/args/Gmail tools.
- Docs exist:
  - `pkg/integrations/README.md`
  - RFC entry in `rfcs/README.md`.
