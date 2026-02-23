# OpenAPI response documentation for SSE endpoints
SSE_RESPONSES = {
    200: {
        "description": "Server-Sent Events (SSE) stream",
        "content": {
            "text/event-stream": {
                "schema": {
                    "type": "string",
                    "format": "binary",
                    "description": "Server-Sent Events stream with JSON payloads",
                },
                "examples": {
                    "stream_start": {
                        "summary": "Stream Start Event",
                        "value": 'data: {"type": "stream_start"}\n\n',
                    },
                    "token": {
                        "summary": "AI Token Event",
                        "value": 'data: {"type": "token", "content": "I will create a workflow..."}\n\n',
                    },
                    "tool_call": {
                        "summary": "Tool Call Event",
                        "value": 'data: {"type": "tool_call", "name": "create_node", "arguments": {...}, "call_id": "..."}\n\n',
                    },
                    "tool_result": {
                        "summary": "Tool Result Event",
                        "value": 'data: {"type": "tool_result", "output": {...}, "call_id": "..."}\n\n',
                    },
                    "warning": {
                        "summary": "Warning Event",
                        "value": 'data: {"type": "warning", "message": "Parse error: unexpected token"}\n\n',
                    },
                    "workflow_state": {
                        "summary": "Workflow State Event",
                        "value": 'data: {"type": "workflow_state", "workflow_nodes": [...], "workflow_edges": [...]}\n\n',
                    },
                    "stream_end": {
                        "summary": "Stream End Event",
                        "value": 'data: {"type": "stream_end"}\n\n',
                    },
                    "error": {
                        "summary": "Error Event",
                        "value": 'data: {"type": "error", "message": "Error description"}\n\n',
                    },
                },
            }
        },
    }
}
