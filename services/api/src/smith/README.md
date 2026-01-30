# Server-Sent Events (SSE) Stream

Returns a stream of SSE events. Each event has the format:

```text
data: <JSON payload>

```

(Events are separated by two newlines `\n\n`)

### Event Types

#### 1. `stream_start`

Stream has started.

```json
{ "type": "stream_start" }
```

#### 2. `token`

AI-generated text token (streamed incrementally).

```json
{ "type": "token", "content": "I'll create a workflow..." }
```

#### 3. `tool_call`

Agent is invoking a tool.

```json
{
  "type": "tool_call",
  "name": "create_node",
  "arguments": "{\"node_type\": \"trigger\", \"name\": \"Start\"}",
  "call_id": "call_abc123"
}
```

**Available tools:** `create_node`, `create_edge`, `build_workflow`

#### 4. `tool_result`

Result returned from a tool execution.

```json
{
  "type": "tool_result",
  "output": {"node": {...}},
  "call_id": "call_abc123"
}
```

#### 5. `warning`

Non-fatal issue (stream continues).

```json
{ "type": "warning", "message": "Parse error: unexpected token" }
```

#### 6. `workflow_state`

Current workflow structure (sent after each tool result to keep UI synchronized).

```json
{
  "type": "workflow_state",
  "workflow_nodes": [
    {
      "id": "uuid-123",
      "name": "TriggerNode",
      "type": "trigger",
      "trigger": true,
      "parameters": {},
      "output": {},
      "position": [100, 100]
    },
    {
      "id": "uuid-456",
      "name": "FetchUser",
      "type": "http",
      "trigger": false,
      "parameters": {
        "url": "https://api.example.com/users",
        "method": "GET"
      },
      "output": {},
      "position": [300, 100]
    }
  ],
  "workflow_edges": [
    {
      "id": "edge-uuid-789",
      "src": "uuid-123",
      "dst": "uuid-456"
    }
  ]
}
```

**Note:** This event is emitted after each `tool_result` to keep the UI synchronized with the current workflow state. It contains the complete workflow structure from the agent's state at that moment, reflecting all nodes and edges that have been created, modified, or deleted.

#### 7. `error`

Fatal error (stream ends).

```json
{
  "type": "error",
  "message": "Stream error: Connection timeout"
}
```

#### 8. `stream_end`

Stream completed successfully.

```json
{ "type": "stream_end" }
```

### Example Flow

```text
data: {"type": "stream_start"}

data: {"type": "token", "content": "I'll create a workflow for you."}

data: {"type": "tool_call", "name": "create_node", "arguments": "{\"node_type\": \"trigger\", \"name\": \"Start\"}", "call_id": "call_1"}

data: {"type": "tool_result", "output": {"node": {"id": "abc-123", "name": "Start", "type": "trigger", "trigger": true}}, "call_id": "call_1"}

data: {"type": "workflow_state", "workflow_nodes": [{"id": "abc-123", ...}], "workflow_edges": []}

data: {"type": "token", "content": "Done! Your workflow is ready."}

data: {"type": "stream_end"}
```
