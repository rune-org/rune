# Nodes

Learn about nodes — the building blocks of workflows in Rune.

---

## Table of Contents

- [What is a Node?](#what-is-a-node)
- [Node Structure](#node-structure)
- [Available Node Types](#available-node-types)
- [Adding Nodes to Workflows](#adding-nodes-to-workflows)
- [Node Configuration](#node-configuration)
- [Data Access Between Nodes](#data-access-between-nodes)

---

## What is a Node?

A **node** is a single operation within a workflow. Think of it as one step in your automation. Each node:

- Performs a specific action (HTTP request, logging, decision making)
- Receives input (parameters + data from previous nodes)
- Produces output (available to subsequent nodes)
- Can be configured with credentials and error handling

```
┌─────────────────────────────────────────┐
│                 NODE                     │
├─────────────────────────────────────────┤
│  Type: http                              │
│  Name: "Fetch User Data"                 │
│                                          │
│  Parameters:                             │
│    • method: GET                         │
│    • url: https://api.example.com/users  │
│                                          │
│  Credentials: api_credentials            │
│                                          │
│  Error Handling: branch on error         │
├─────────────────────────────────────────┤
│  Output:                                 │
│    • status_code: 200                    │
│    • body: { id: 1, name: "John" }       │
└─────────────────────────────────────────┘
```

---

## Node Structure

Every node has the following structure:

```json
{
  "id": "unique_node_id",
  "name": "Human Readable Name",
  "type": "http | log | conditional",
  "parameters": {
    // Type-specific configuration
  },
  "credentials": {
    // Optional: credential reference
  },
  "error": {
    // Optional: error handling configuration
  }
}
```

### Required Fields

| Field | Description | Example |
|-------|-------------|---------|
| `id` | Unique identifier (used in edges and data access) | `"fetch_user"` |
| `name` | Display name in the UI | `"Fetch User Data"` |
| `type` | Node type | `"http"`, `"log"`, `"conditional"` |
| `parameters` | Type-specific configuration | `{ "method": "GET", ... }` |

### Optional Fields

| Field | Description |
|-------|-------------|
| `credentials` | Reference to stored credentials |
| `error` | Error handling configuration |

---

## Available Node Types

### HTTP Node

Make HTTP/HTTPS requests to external APIs.

```json
{
  "id": "fetch_data",
  "name": "Fetch Data from API",
  "type": "http",
  "parameters": {
    "method": "GET",
    "url": "https://api.example.com/data",
    "headers": {
      "Authorization": "Bearer {{$credential.api_key}}"
    }
  }
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `method` | string | Yes | HTTP method (GET, POST, PUT, DELETE, PATCH) |
| `url` | string | Yes | Request URL (supports templates) |
| `headers` | object | No | HTTP headers |
| `query` | object | No | URL query parameters |
| `body` | any | No | Request body (for POST/PUT/PATCH) |
| `timeout` | number | No | Timeout in seconds (default: 30) |
| `retry` | number | No | Retry attempts on failure (default: 0) |
| `retry_delay` | number | No | Delay between retries in ms (default: 1000) |

**Output:**

```json
{
  "status_code": 200,
  "headers": { "content-type": "application/json" },
  "body": { "data": "..." },
  "duration_ms": 150
}
```

---

### Log Node

Output messages for debugging and monitoring.

```json
{
  "id": "log_result",
  "name": "Log the Result",
  "type": "log",
  "parameters": {
    "level": "info",
    "message": "Processed user: {{$fetch_data.body.name}}"
  }
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `message` | string | Yes | Message to log (supports templates) |
| `level` | string | No | Log level: `debug`, `info`, `warn`, `error` |
| `data` | object | No | Additional structured data |

**Output:**

```json
{
  "logged": true,
  "message": "Processed user: John",
  "level": "info",
  "timestamp": "2025-12-01T10:00:00Z"
}
```

---

### Conditional Node

Add branching logic based on conditions.

```json
{
  "id": "check_status",
  "name": "Check if Active",
  "type": "conditional",
  "parameters": {
    "condition": "{{$fetch_user.body.status}} == 'active'",
    "true_edge_id": "to_welcome",
    "false_edge_id": "to_notify"
  }
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `condition` | string | Yes | Boolean expression to evaluate |
| `true_edge_id` | string | Yes | Edge to follow if true |
| `false_edge_id` | string | Yes | Edge to follow if false |

**Supported Operators:**

| Operator | Description | Example |
|----------|-------------|---------|
| `==` | Equal | `{{$node.value}} == 'active'` |
| `!=` | Not equal | `{{$node.value}} != 'inactive'` |
| `>` | Greater than | `{{$node.count}} > 10` |
| `<` | Less than | `{{$node.count}} < 5` |
| `>=` | Greater or equal | `{{$node.count}} >= 10` |
| `<=` | Less or equal | `{{$node.count}} <= 5` |
| `&&` | Logical AND | `{{$a}} == 1 && {{$b}} == 2` |
| `\|\|` | Logical OR | `{{$a}} == 1 \|\| {{$a}} == 2` |

**Output:**

```json
{
  "condition": "{{$fetch_user.body.status}} == 'active'",
  "result": true,
  "edge_taken": "to_welcome"
}
```

---

## Adding Nodes to Workflows

### Via the Visual Editor

1. Open your workflow in the editor
2. Locate the **Node Palette** on the left
3. **Drag** a node type onto the canvas
4. **Click** the node to configure it
5. **Connect** nodes by dragging from output to input ports

### Via the API

Add nodes to the `nodes` array in your workflow:

```bash
curl -X PUT http://localhost:8000/workflows/1/data \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_data": {
      "nodes": [
        {
          "id": "step_1",
          "name": "First Step",
          "type": "http",
          "parameters": {
            "method": "GET",
            "url": "https://api.example.com/data"
          }
        },
        {
          "id": "step_2",
          "name": "Log Result",
          "type": "log",
          "parameters": {
            "message": "Got: {{$step_1.body}}"
          }
        }
      ],
      "edges": [
        {
          "id": "e1",
          "src": "step_1",
          "dst": "step_2"
        }
      ]
    }
  }'
```

---

## Node Configuration

### Adding Credentials

Reference stored credentials in your node:

```json
{
  "id": "api_call",
  "type": "http",
  "parameters": {
    "method": "POST",
    "url": "https://api.stripe.com/v1/charges",
    "headers": {
      "Authorization": "Bearer {{$credential.stripe_key}}"
    }
  },
  "credentials": {
    "source": "stripe_credentials"
  }
}
```

### Configuring Error Handling

Control what happens when a node fails:

**Halt (default):** Stop the workflow

```json
{
  "error": {
    "type": "halt"
  }
}
```

**Ignore:** Continue to the next node

```json
{
  "error": {
    "type": "ignore"
  }
}
```

**Branch:** Follow an error-specific edge

```json
{
  "error": {
    "type": "branch",
    "error_edge": "to_error_handler"
  }
}
```

---

## Data Access Between Nodes

### Template Syntax

Use `{{$node_id.field}}` to access data from previous nodes:

```json
{
  "parameters": {
    "message": "User: {{$fetch_user.body.name}}"
  }
}
```

### Available Data Sources

| Source | Syntax | Description |
|--------|--------|-------------|
| Workflow input | `{{$input.field}}` | Data passed when workflow starts |
| Previous node | `{{$node_id.field}}` | Output from a completed node |
| Credentials | `{{$credential.field}}` | Decrypted credential values |

### Nested Field Access

Access nested data with dot notation:

```json
{
  "parameters": {
    "user_email": "{{$fetch_user.body.user.contact.email}}",
    "first_item": "{{$get_list.body.items.0.name}}"
  }
}
```

### Examples

**Using workflow input:**
```json
{
  "parameters": {
    "url": "https://api.example.com/users/{{$input.user_id}}"
  }
}
```

**Using previous node output:**
```json
{
  "parameters": {
    "to": "{{$fetch_user.body.email}}",
    "subject": "Hello {{$fetch_user.body.name}}"
  }
}
```

**Combining multiple sources:**
```json
{
  "parameters": {
    "url": "{{$credential.base_url}}/users/{{$input.user_id}}",
    "headers": {
      "Authorization": "Bearer {{$credential.api_key}}"
    }
  }
}
```

---

## Best Practices

### Naming Conventions

```
✅ Node ID: fetch_user, check_status, send_email
✅ Node Name: "Fetch User Data", "Check Account Status"
❌ Node ID: node1, step_a, n
❌ Node Name: "node", "step"
```

### Keep Nodes Focused

Each node should do one thing:

```
✅ fetch_user → validate_user → send_notification
❌ fetch_user_validate_and_notify (too many responsibilities)
```

### Use Logging for Debugging

Add log nodes to understand data flow:

```json
{
  "id": "debug_response",
  "type": "log",
  "parameters": {
    "level": "debug",
    "message": "API Response: {{$api_call.status_code}} - {{$api_call.body}}"
  }
}
```

### Handle Errors Gracefully

Always consider failure scenarios:

```json
{
  "error": {
    "type": "branch",
    "error_edge": "to_fallback"
  }
}
```

---

## Node Reference

For detailed documentation on each node type:

- [HTTP Node](../nodes/http.md) - Full HTTP configuration options
- [Log Node](../nodes/log.md) - Logging options and levels
- [Conditional Node](../nodes/conditional.md) - Condition expressions

---

[← Back to Concepts](./README.md) | [Credentials →](./credentials.md)
