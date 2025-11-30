# Workflows API

API endpoints for creating, managing, and executing workflows.

---

## Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workflows/` | List all workflows |
| POST | `/workflows/` | Create a workflow |
| GET | `/workflows/{id}` | Get workflow details |
| PUT | `/workflows/{id}/name` | Update workflow name |
| PUT | `/workflows/{id}/status` | Enable/disable workflow |
| PUT | `/workflows/{id}/data` | Update workflow nodes & edges |
| DELETE | `/workflows/{id}` | Delete a workflow |
| POST | `/workflows/{id}/run` | Run a workflow |

---

## List Workflows

Get all workflows for the current user.

**Endpoint:** `GET /workflows/`

**Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/workflows/
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": 1,
      "name": "User Notification Workflow",
      "is_active": true
    },
    {
      "id": 2,
      "name": "Daily Report Generator",
      "is_active": false
    }
  ]
}
```

---

## Create Workflow

Create a new workflow.

**Endpoint:** `POST /workflows/`

**Request:**
```bash
curl -X POST http://localhost:8000/workflows/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My New Workflow",
    "description": "Fetches data and sends notifications",
    "workflow_data": {
      "nodes": [
        {
          "id": "fetch_data",
          "name": "Fetch Data",
          "type": "http",
          "parameters": {
            "method": "GET",
            "url": "https://api.example.com/data"
          }
        },
        {
          "id": "log_result",
          "name": "Log Result",
          "type": "log",
          "parameters": {
            "message": "Data: {{$fetch_data.body}}"
          }
        }
      ],
      "edges": [
        {
          "id": "e1",
          "src": "fetch_data",
          "dst": "log_result"
        }
      ]
    }
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Workflow name (min 1 char) |
| `description` | string | No | Workflow description |
| `workflow_data` | object | No | Nodes and edges definition |

**workflow_data Structure:**

```json
{
  "nodes": [
    {
      "id": "string",           // Unique node ID
      "name": "string",         // Display name
      "type": "string",         // http, log, conditional
      "parameters": {},         // Type-specific config
      "credentials": {},        // Optional credential ref
      "error": {}               // Optional error handling
    }
  ],
  "edges": [
    {
      "id": "string",           // Unique edge ID
      "src": "string",          // Source node ID
      "dst": "string",          // Destination node ID
      "label": "string"         // Optional label
    }
  ]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": 3,
    "name": "My New Workflow",
    "description": "Fetches data and sends notifications",
    "is_active": false,
    "workflow_data": {
      "nodes": [...],
      "edges": [...]
    },
    "version": 1,
    "created_at": "2025-12-01T10:00:00Z",
    "updated_at": "2025-12-01T10:00:00Z"
  }
}
```

---

## Get Workflow

Get detailed information about a specific workflow.

**Endpoint:** `GET /workflows/{workflow_id}`

**Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/workflows/1
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": 1,
    "name": "User Notification Workflow",
    "description": "Sends notifications to users",
    "is_active": true,
    "workflow_data": {
      "nodes": [
        {
          "id": "fetch_user",
          "name": "Fetch User",
          "type": "http",
          "parameters": {
            "method": "GET",
            "url": "https://api.example.com/users/{{$input.userId}}"
          }
        }
      ],
      "edges": []
    },
    "version": 3,
    "created_at": "2025-11-15T08:00:00Z",
    "updated_at": "2025-12-01T10:30:00Z"
  }
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 404 | Workflow not found |

---

## Update Workflow Name

Update only the workflow name.

**Endpoint:** `PUT /workflows/{workflow_id}/name`

**Request:**
```bash
curl -X PUT http://localhost:8000/workflows/1/name \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Workflow Name"
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | New workflow name (min 1 char) |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": 1,
    "name": "Updated Workflow Name",
    "description": "...",
    "is_active": true,
    "workflow_data": {...},
    "version": 3,
    "created_at": "2025-11-15T08:00:00Z",
    "updated_at": "2025-12-01T11:00:00Z"
  }
}
```

---

## Update Workflow Status

Enable or disable a workflow.

**Endpoint:** `PUT /workflows/{workflow_id}/status`

**Request:**
```bash
# Enable workflow
curl -X PUT http://localhost:8000/workflows/1/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "is_active": true
  }'

# Disable workflow
curl -X PUT http://localhost:8000/workflows/1/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "is_active": false
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `is_active` | boolean | Yes | Enable (true) or disable (false) |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": 1,
    "name": "My Workflow",
    "is_active": true,
    ...
  }
}
```

---

## Update Workflow Data

Update the workflow definition (nodes and edges).

**Endpoint:** `PUT /workflows/{workflow_id}/data`

**Request:**
```bash
curl -X PUT http://localhost:8000/workflows/1/data \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_data": {
      "nodes": [
        {
          "id": "step1",
          "name": "First Step",
          "type": "http",
          "parameters": {
            "method": "GET",
            "url": "https://api.example.com/data"
          }
        },
        {
          "id": "step2",
          "name": "Second Step",
          "type": "log",
          "parameters": {
            "message": "Got: {{$step1.body}}"
          }
        }
      ],
      "edges": [
        {
          "id": "e1",
          "src": "step1",
          "dst": "step2"
        }
      ]
    }
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `workflow_data` | object | Yes | Complete workflow definition |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": 1,
    "name": "My Workflow",
    "workflow_data": {...},
    "version": 4,
    "updated_at": "2025-12-01T12:00:00Z",
    ...
  }
}
```

**Note:** Each update increments the workflow version.

---

## Delete Workflow

Permanently delete a workflow.

**Endpoint:** `DELETE /workflows/{workflow_id}`

**Request:**
```bash
curl -X DELETE http://localhost:8000/workflows/1 \
  -H "Authorization: Bearer $TOKEN"
```

**Response (204 No Content):**
No response body.

**Error Responses:**

| Status | Description |
|--------|-------------|
| 404 | Workflow not found |

---

## Run Workflow

Queue a workflow for execution.

**Endpoint:** `POST /workflows/{workflow_id}/run`

**Request:**
```bash
curl -X POST http://localhost:8000/workflows/1/run \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Workflow queued for execution",
  "data": "exec_abc123def456"
}
```

The `data` field contains the `execution_id` for tracking the run.

**What Happens:**
1. Workflow is validated
2. Credentials are resolved
3. Execution message is published to RabbitMQ
4. Worker picks up and processes the workflow

**Error Responses:**

| Status | Description |
|--------|-------------|
| 404 | Workflow not found |
| 400 | Invalid workflow configuration |

---

## Complete Examples

### Create a Complete Workflow

```bash
curl -X POST http://localhost:8000/workflows/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "User Welcome Flow",
    "description": "Fetches user and sends welcome email",
    "workflow_data": {
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
          "id": "check_active",
          "name": "Check if Active",
          "type": "conditional",
          "parameters": {
            "condition": "{{$fetch_user.body.active}} == true",
            "true_edge_id": "to_welcome",
            "false_edge_id": "to_skip"
          }
        },
        {
          "id": "send_welcome",
          "name": "Send Welcome Email",
          "type": "http",
          "parameters": {
            "method": "POST",
            "url": "https://api.sendgrid.com/v3/mail/send",
            "headers": {
              "Authorization": "Bearer {{$credential.sendgrid_key}}"
            },
            "body": {
              "to": "{{$fetch_user.body.email}}",
              "subject": "Welcome!",
              "body": "Hello {{$fetch_user.body.name}}!"
            }
          },
          "credentials": {
            "source": "sendgrid"
          }
        },
        {
          "id": "log_skip",
          "name": "Log Skipped",
          "type": "log",
          "parameters": {
            "message": "Skipped inactive user: {{$fetch_user.body.id}}"
          }
        }
      ],
      "edges": [
        {"id": "e1", "src": "fetch_user", "dst": "check_active"},
        {"id": "to_welcome", "src": "check_active", "dst": "send_welcome", "label": "Active"},
        {"id": "to_skip", "src": "check_active", "dst": "log_skip", "label": "Inactive"}
      ]
    }
  }'
```

### Workflow with Error Handling

```bash
curl -X POST http://localhost:8000/workflows/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Resilient API Call",
    "workflow_data": {
      "nodes": [
        {
          "id": "api_call",
          "name": "Call External API",
          "type": "http",
          "parameters": {
            "method": "GET",
            "url": "https://api.example.com/data",
            "timeout": 10,
            "retry": 3,
            "retry_delay": 2000
          },
          "error": {
            "type": "branch",
            "error_edge": "to_fallback"
          }
        },
        {
          "id": "process",
          "name": "Process Data",
          "type": "log",
          "parameters": {
            "message": "Processing: {{$api_call.body}}"
          }
        },
        {
          "id": "fallback",
          "name": "Handle Error",
          "type": "log",
          "parameters": {
            "level": "error",
            "message": "API call failed, using fallback"
          }
        }
      ],
      "edges": [
        {"id": "e1", "src": "api_call", "dst": "process"},
        {"id": "to_fallback", "src": "api_call", "dst": "fallback"}
      ]
    }
  }'
```

---

## Response Schema

### WorkflowListItem

```json
{
  "id": "integer",
  "name": "string",
  "is_active": "boolean"
}
```

### WorkflowDetail

```json
{
  "id": "integer",
  "name": "string",
  "description": "string | null",
  "is_active": "boolean",
  "workflow_data": {
    "nodes": "array",
    "edges": "array"
  },
  "version": "integer",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

---

[← Back to API Reference](./README.md) | [Templates API →](./templates.md)
