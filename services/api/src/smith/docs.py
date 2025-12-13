"""SSE API documentation for OpenAPI spec."""

SSE_RESPONSE_DESCRIPTION = """
## Server-Sent Events (SSE) Stream

Returns a stream of SSE events. Each event has the format:
```
data: <JSON payload>\\n\\n
```

### Event Types

#### 1. `stream_start`
Stream has started.
```json
{"type": "stream_start"}
```

#### 2. `token`
AI-generated text token (streamed incrementally).
```json
{"type": "token", "content": "I'll create a workflow..."}
```

#### 3. `tool_call`
Agent is invoking a tool.
```json
{
  "type": "tool_call",
  "name": "create_node",
  "arguments": "{\\"node_type\\": \\"trigger\\", \\"name\\": \\"Start\\"}",
  "call_id": "call_abc123"
}
```
**Available tools:** `create_node`, `create_edge`, `build_workflow`

#### 4. `tool_result`
Result returned from a tool execution.
```json
{
  "type": "tool_result",
  "output": "{\\"node_id\\": \\"uuid-123\\", \\"node\\": {...}}",
  "call_id": "call_abc123"
}
```

#### 5. `warning`
Non-fatal issue (stream continues).
```json
{"type": "warning", "message": "Parse error: unexpected token"}
```

#### 6. `error`
Fatal error (stream ends).
```json
{
  "type": "error",
  "message": "Stream error: Connection timeout",
  "trace": "Traceback..."
}
```

#### 7. `stream_end`
Stream completed successfully.
```json
{"type": "stream_end"}
```

### Example Flow

```
data: {"type": "stream_start"}

data: {"type": "token", "content": "I'll create a workflow for you."}

data: {"type": "tool_call", "name": "create_node", "arguments": "{\\"node_type\\": \\"trigger\\", \\"name\\": \\"Start\\"}", "call_id": "call_1"}

data: {"type": "tool_result", "output": "{\\"node_id\\": \\"abc-123\\", \\"node\\": {\\"id\\": \\"abc-123\\", \\"name\\": \\"Start\\", \\"type\\": \\"ManualTrigger\\", \\"trigger\\": true}}", "call_id": "call_1"}

data: {"type": "tool_call", "name": "build_workflow", "arguments": "{\\"nodes_json\\": \\"[...]\\", \\"edges_json\\": \\"[...]\\"}", "call_id": "call_2"}

data: {"type": "tool_result", "output": "{\\"nodes\\": [...], \\"edges\\": [...]}", "call_id": "call_2"}

data: {"type": "token", "content": "Done! Your workflow is ready."}

data: {"type": "stream_end"}
```
"""
