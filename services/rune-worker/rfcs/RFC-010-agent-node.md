# RFC-010: Agent Node (Gemini via ADK Go)

**Author:** unauthorised-401

**Status:** Implemented (v0)

**Depends On:** RFC-001, RFC-002

## Summary

The **Agent** node runs an LLM agent inside a workflow. v0 is wired to **Gemini** through Google's [ADK Go SDK](https://pkg.go.dev/google.golang.org/adk), with a pluggable model factory so other providers can land later. The node accepts a system prompt, a seeded conversation, an `http_request` tool with per-field "fixed | agent-decides" inputs, and any number of MCP servers (HTTP / SSE / Streamable HTTP). It returns the full conversation, the final response, every tool call (with response), and token usage.

## Architecture

The feature spans three services and reuses existing pieces:

```
Inspector (web)  →  DSL save  →  api master   →  RabbitMQ   →  rune-worker
   AgentInspector     workflow-     resolves        workflow.       agent_node
   FieldWithMode-     dsl.ts        per-tool +      execution       Execute() →
   Toggle                           per-server                      ADK runner →
                                    credential                      Gemini
                                    refs
```

- **Web** — `AgentInspector` lets the author pick provider/model, write a system prompt, seed messages, and configure tools and MCP servers. Each tool field is rendered through `FieldWithModeToggle`, which switches between a fixed value (with `$Node` refs allowed) and an agent-supplied JSON-schema slot.
- **API master** — same credential-resolution stage as every other node, plus a small extra walk (`_resolve_agent_nested_credentials`) that resolves per-tool and per-MCP-server credential refs nested under `parameters.tools[]` / `parameters.mcp_servers[]`. The full credential block is embedded before the message is published.
- **Worker** — the `agent` node parses params, builds an ADK `llmagent`, seeds an in-memory session with prior messages, runs the agent against the last user message, and folds streamed events into a single output map.

## Worker internals

`services/rune-worker/pkg/nodes/custom/agent/`:

| File                  | Responsibility                                                                                                                                                            |
| :-------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `agent_node.go`       | `Execute()` orchestrates the run: parse → buildModel → buildTools → buildMCPToolsets → `llmagent.New` → seed session history → `runner.Run` → collect output.             |
| `params.go`           | Deserialize the raw parameter map. Validates required fields and tool type (`http_request` only in v0).                                                                   |
| `types.go`            | Domain structs (`agentParams`, `modelConfig`, `message`, `fieldMode`, `agentField`, `httpToolConfig`, `toolConfig`, `mcpServerConfig`).                                   |
| `model_factory.go`    | `buildModel()` — provider switch. `gemini` is wired (AI Studio / Vertex backends); `openai`/`anthropic` return an explicit "not yet supported" error.                     |
| `tool_builder.go`     | Convert each `toolConfig` into an ADK `functiontool.Tool`. Builds the JSON schema from `agent`-mode fields and routes the handler through the shared `httpcore` executor. |
| `mcp_loader.go`       | Build an ADK `mcptoolset` per server. Picks transport (`sse` / `streamable_http`) and applies credential auth headers (mirrors `httpcore` credential handling).           |
| `message_adapter.go`  | Splits seeded messages: validates the last is a `user` message, peels it off as the run input, converts the rest to `genai.Content` for session seeding.                  |
| `output_collector.go` | Folds runner events into `{messages, final_response, tool_calls, model, usage}`.                                                                                          |

**Shared HTTP** — `services/rune-worker/pkg/nodes/shared/httpcore/` (`executor.go`, `credentials.go`, `types.go`) is the request engine extracted from the HTTP node. The agent's `http_request` tool builds a `httpcore.RequestSpec` and calls `httpcore.Execute` instead of forking the request logic. The HTTP node itself (`http_node.go`) is now a thin adapter over the same package.

## Configuration (DSL)

Top-level `parameters` keys on an agent node:

| Key             | Type   | Notes                                                                                                                                                      |
| :-------------- | :----- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model`         | object | `{ provider, name, backend?, temperature? }`. `provider` is `gemini` (only wired option). `backend` is gemini-only: `"ai_studio"` (default) or `"vertex"`. |
| `system_prompt` | string | Optional. Literal — `{...}` is **not** interpreted as ADK template syntax.                                                                                 |
| `messages`      | array  | Seeded conversation. Each entry: `{ role: "user" \| "model", content }`. The last message must be `user` (it becomes the run input).                       |
| `tools`         | array  | Each entry: `{ type: "http_request", name, description, credential?, config }` where `config` is an `AgentHttpToolConfig` (see below).                     |
| `mcp_servers`   | array  | Each entry: `{ name, transport: "sse" \| "streamable_http", url, credential? }`.                                                                           |

A tool field that the agent should fill at call time uses the `fieldMode` shape:

- Fixed: `{ "mode": "fixed", "value": <any> }` (or just a bare scalar).
- Agent-decides: `{ "mode": "agent", "agent": { "description", "type": "string"|"number"|"boolean"|"object", "required": bool } }`.

In an `http_request` tool's `config`: `method` is always fixed; `url` is toggleable; each row of `headers` / `query` / `body` has a fixed key and a toggleable value.

**Compact example** (agent calling a single HTTP tool, with one MCP server):

```json
{
  "type": "agent",
  "parameters": {
    "model": {
      "provider": "gemini",
      "name": "gemini-2.0-flash",
      "temperature": 0.2
    },
    "system_prompt": "You are a helpful assistant. Use tools when needed.",
    "messages": [{ "role": "user", "content": "What's the weather in Cairo?" }],
    "tools": [
      {
        "type": "http_request",
        "name": "get_weather",
        "description": "Fetch current weather for a city.",
        "config": {
          "method": "GET",
          "url": {
            "mode": "fixed",
            "value": "https://api.example.com/weather"
          },
          "query": [
            {
              "key": "city",
              "value": {
                "mode": "agent",
                "agent": {
                  "description": "City name",
                  "type": "string",
                  "required": true
                }
              }
            }
          ]
        }
      }
    ],
    "mcp_servers": [
      {
        "name": "docs",
        "transport": "streamable_http",
        "url": "https://mcp.example.com/sse"
      }
    ]
  }
}
```

## Output

`Execute()` returns a single map with the full run trace, so downstream nodes can branch on whichever piece they need:

| Key              | Description                                                                                                                 |
| :--------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| `messages`       | Full conversation as `[{ role, content }]` (ADK roles: `user` / `model`).                                                   |
| `final_response` | The last `model` text in the run.                                                                                           |
| `tool_calls`     | One entry per tool invocation: `{ id, name, args, response }`. Orphan responses (no matching call) are appended standalone. |
| `model`          | The model name that ran the request (echoed from input).                                                                    |
| `usage`          | `{ prompt_tokens, completion_tokens, total_tokens }` taken from the last event's usage metadata.                            |

Any error from the run is returned as a normal Go error and routes through the standard `error_edge` mechanism (RFC-001).

## Credentials

The model credential rides on the existing top-level `node.credentials` mechanism (one credential per agent node, used to authenticate against the LLM provider — `gemini_api_key` is the new credential type added for this feature).

Per-tool and per-MCP-server credentials are different: they live nested inside `parameters.tools[].credential` and `parameters.mcp_servers[].credential` as `{ id }` refs. The master walks these in `_resolve_agent_nested_credentials` (`services/api/src/workflow/service.py`) and writes the resolved `{ id, name, type, values }` block back as `credentials` (plural) on the same entry before publishing. The worker then reads them out of `tools[i].credentials` / `mcp_servers[i].credentials` — same shape as `node.credentials` everywhere else.

## Current state and limitations

What's wired in v0:

- **Provider:** Gemini only (AI Studio + Vertex via the model factory). OpenAI and Anthropic show in the inspector dropdown disabled with "Coming soon"; the worker returns a friendly error if either is selected.
- **Tools:** built-in `http_request` only, with the per-field fixed-or-agent toggle.
- **MCP transports:** HTTP / SSE / Streamable HTTP. **No stdio / subprocess.**
- **Model knobs:** `temperature` only — `top_p`, `max_output_tokens`, etc. are not yet exposed.
- **Tool inputs are _either_ fully fixed _or_ fully agent-decided per field.** No inline `{{agent.X}}` placeholders mid-string.
- **No `max_iterations` / `timeout` runaway protection.** The agent inherits only the workflow's outer context plus ADK's defaults — a tool-calling loop or long generation can run up Gemini cost or stall a workflow run. **Don't run untrusted prompts or untrusted tool configs in production until iteration caps land.**

## Code map

| Layer           | Path                                              | Start here                                                                                                                                                                             |
| :-------------- | :------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Worker          | `services/rune-worker/pkg/nodes/custom/agent/`    | `agent_node.go` (`Execute`) → `model_factory.go` → `tool_builder.go` → `output_collector.go`                                                                                           |
| Worker (shared) | `services/rune-worker/pkg/nodes/shared/httpcore/` | `executor.go`, `credentials.go`, `types.go`                                                                                                                                            |
| API             | `services/api/src/workflow/service.py`            | `_resolve_agent_nested_credentials` (and the `gemini_api_key` migration under `migrations/versions/`)                                                                                  |
| Web             | `apps/web/src/features/canvas/`                   | `components/inspectors/AgentInspector.tsx`, `components/inspectors/agent/HttpToolConfig.tsx`, `components/inspectors/agent/FieldWithModeToggle.tsx`, `types.ts`, `lib/workflow-dsl.ts` |

## Next steps

- Audit the output schema (`messages` / `final_response` / `tool_calls` / `model` / `usage`) once a few real consumers exist.
- Inspector UX refactor — particularly tool and MCP-server configuration flows.
- Additional model knobs (`top_p`, `max_output_tokens`, …).
- Built-in webhook tool — let the agent trigger another Rune workflow whose start node is a webhook trigger.
- Iteration / timeout caps before any production-grade use.
