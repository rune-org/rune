# Workflows

Learn how to create, structure, and manage workflows in Rune.

---

## Table of Contents

- [What is a Workflow?](#what-is-a-workflow)
- [Workflow Structure](#workflow-structure)
- [Creating Workflows](#creating-workflows)
- [Managing Workflows](#managing-workflows)
- [Running Workflows](#running-workflows)
- [Workflow Status](#workflow-status)

---

## What is a Workflow?

A **workflow** is an automated sequence of operations that executes when triggered. Workflows consist of:

- **Nodes**: Individual operations (HTTP calls, logging, conditions)
- **Edges**: Connections that define execution order
- **Input**: Data passed when the workflow starts
- **Context**: Accumulated data from node outputs

```
┌─────────────────────────────────────────────────────────────┐
│                        WORKFLOW                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Input ─────▶ [Node A] ─────▶ [Node B] ─────▶ [Node C]     │
│                    │              │              │           │
│                    └──────────────┴──────────────┘           │
│                        Context accumulates                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Workflow Structure

### Complete Workflow Definition

```json
{
  "id": "user_notification_workflow",
  "name": "User Notification Workflow",
  "description": "Fetches user data and sends a notification",
  "version": "1.0.0",
  "nodes": [
    {
      "id": "fetch_user",
      "name": "Fetch User",
      "type": "http",
      "parameters": {
        "method": "GET",
        "url": "https://api.example.com/users/{{$input.userId}}"
      }
    },
    {
      "id": "send_notification",
      "name": "Send Notification",
      "type": "http",
      "parameters": {
        "method": "POST",
        "url": "https://api.example.com/notify",
        "body": {
          "email": "{{$fetch_user.body.email}}",
          "message": "{{$input.message}}"
        }
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "src": "fetch_user",
      "dst": "send_notification"
    }
  ]
}
```

### Nodes Array

Nodes are the operations in your workflow:

```json
"nodes": [
  {
    "id": "unique_id",           // Required: unique identifier
    "name": "Display Name",      // Required: shown in UI
    "type": "http",              // Required: node type
    "parameters": { ... },       // Required: type-specific config
    "credentials": { ... },      // Optional: credential reference
    "error": { ... }             // Optional: error handling
  }
]
```

### Edges Array

Edges connect nodes and define execution order:

```json
"edges": [
  {
    "id": "edge_id",             // Required: unique identifier
    "src": "source_node_id",     // Required: where edge starts
    "dst": "destination_node_id", // Required: where edge ends
    "label": "Optional Label"    // Optional: displayed in UI
  }
]
```

---

## Creating Workflows

### Via the UI

1. Navigate to the **Dashboard**
2. Click **"+ New Workflow"**
3. Enter a name and description
4. Click **Create**
5. Use the visual editor to add nodes and edges
6. Click **Save**

### Via the API

**Create a new workflow:**

```bash
curl -X POST http://localhost:8000/workflows/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My First Workflow",
    "description": "A simple workflow example",
    "workflow_data": {
      "nodes": [
        {
          "id": "hello",
          "name": "Say Hello",
          "type": "log",
          "parameters": {
            "message": "Hello, World!"
          }
        }
      ],
      "edges": []
    }
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "My First Workflow",
    "description": "A simple workflow example",
    "is_active": false,
    "workflow_data": { ... },
    "version": 1,
    "created_at": "2025-12-01T10:00:00Z",
    "updated_at": "2025-12-01T10:00:00Z"
  }
}
```

---

## Managing Workflows

### List All Workflows

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/workflows/
```

### Get Workflow Details

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/workflows/1
```

### Update Workflow Name

```bash
curl -X PUT http://localhost:8000/workflows/1/name \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Workflow Name"
  }'
```

### Update Workflow Data (Nodes & Edges)

```bash
curl -X PUT http://localhost:8000/workflows/1/data \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_data": {
      "nodes": [ ... ],
      "edges": [ ... ]
    }
  }'
```

### Enable/Disable Workflow

```bash
# Enable
curl -X PUT http://localhost:8000/workflows/1/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "is_active": true }'

# Disable
curl -X PUT http://localhost:8000/workflows/1/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "is_active": false }'
```

### Delete Workflow

```bash
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/workflows/1
```

---

## Running Workflows

### Via the UI

1. Open the workflow
2. Click the **"Run"** button
3. (Optional) Enter input data in the modal
4. Click **Execute**
5. Watch execution progress in real-time

### Via the API

```bash
curl -X POST http://localhost:8000/workflows/1/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**Response:**

```json
{
  "success": true,
  "message": "Workflow queued for execution",
  "data": "exec_abc123"
}
```

The `data` field contains the `execution_id` for tracking.

### With Input Data

Pass data to the workflow that nodes can access via `{{$input.field}}`:

```bash
curl -X POST http://localhost:8000/workflows/1/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "userId": 123,
      "message": "Welcome!"
    }
  }'
```

---

## Workflow Execution

### Execution Flow

When a workflow runs:

1. **Validation**: Workflow structure is validated
2. **Credential Resolution**: Credentials are decrypted
3. **Queue**: Execution message sent to worker
4. **Processing**: Worker executes nodes sequentially
5. **Completion**: Final status reported

```
Run Request ──▶ Validate ──▶ Resolve Creds ──▶ Queue
                                                  │
                                                  ▼
              Completion ◀── Execute Nodes ◀── Worker
```

### Context Accumulation

As nodes execute, their outputs accumulate in the context:

```json
// After first node
{
  "$input": { "userId": 123 },
  "$fetch_user": { "status_code": 200, "body": { "name": "John" } }
}

// After second node
{
  "$input": { "userId": 123 },
  "$fetch_user": { ... },
  "$send_email": { "sent": true }
}
```

Each node can access all previous outputs.

---

## Workflow Status

### Status Values

| Status | Description |
|--------|-------------|
| `is_active: false` | Workflow is disabled (default) |
| `is_active: true` | Workflow is enabled and can be triggered |

### Execution Status

When a workflow runs, each execution has a status:

| Status | Description |
|--------|-------------|
| `queued` | Waiting for worker to pick up |
| `running` | Currently executing |
| `completed` | Finished successfully |
| `failed` | Stopped due to error |

---

## Workflow Patterns

### Linear Workflow

Sequential execution:

```
[A] ──▶ [B] ──▶ [C] ──▶ [D]
```

```json
{
  "edges": [
    { "id": "e1", "src": "A", "dst": "B" },
    { "id": "e2", "src": "B", "dst": "C" },
    { "id": "e3", "src": "C", "dst": "D" }
  ]
}
```

### Branching Workflow

Conditional paths:

```
           ┌──▶ [B] (if true)
[A] ──▶ [Check]
           └──▶ [C] (if false)
```

```json
{
  "nodes": [
    { "id": "A", "type": "http", ... },
    {
      "id": "Check",
      "type": "conditional",
      "parameters": {
        "condition": "{{$A.status_code}} == 200",
        "true_edge_id": "to_B",
        "false_edge_id": "to_C"
      }
    },
    { "id": "B", "type": "log", ... },
    { "id": "C", "type": "log", ... }
  ],
  "edges": [
    { "id": "e1", "src": "A", "dst": "Check" },
    { "id": "to_B", "src": "Check", "dst": "B" },
    { "id": "to_C", "src": "Check", "dst": "C" }
  ]
}
```

### Error Handling Pattern

Fallback on failure:

```
[API Call] ──(success)──▶ [Process]
     │
     └──(error)──▶ [Fallback]
```

```json
{
  "nodes": [
    {
      "id": "api_call",
      "type": "http",
      "error": {
        "type": "branch",
        "error_edge": "to_fallback"
      }
    },
    { "id": "process", "type": "log", ... },
    { "id": "fallback", "type": "log", ... }
  ],
  "edges": [
    { "id": "e1", "src": "api_call", "dst": "process" },
    { "id": "to_fallback", "src": "api_call", "dst": "fallback" }
  ]
}
```

---

## Best Practices

### 1. Use Descriptive Names

```json
{
  "name": "Daily Sales Report Generator",
  "description": "Fetches sales data and emails a summary report each morning"
}
```

### 2. Keep Workflows Focused

Each workflow should do one thing well. For complex processes, create multiple workflows.

### 3. Add Error Handling

Always consider what should happen when nodes fail:

```json
{
  "error": {
    "type": "branch",
    "error_edge": "to_error_handler"
  }
}
```

### 4. Use Templates for Reusable Patterns

Save common patterns as templates for reuse.

### 5. Test with Real Data

Before enabling a workflow, test it with realistic input data.

---

## Next Steps

- [Nodes](./nodes.md) - Learn about available node types
- [Credentials](./credentials.md) - Secure your API keys
- [Templates](./templates.md) - Create reusable patterns

---

[← Back to Concepts](./README.md) | [Nodes →](./nodes.md)
