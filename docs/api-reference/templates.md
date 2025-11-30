# Templates API

API endpoints for managing workflow templates. Templates allow you to save and reuse workflow configurations.

---

## Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/templates/` | List all templates |
| POST | `/templates/` | Create a template |
| GET | `/templates/{id}` | Get template details |
| PUT | `/templates/{id}` | Update a template |
| DELETE | `/templates/{id}` | Delete a template |
| POST | `/templates/{id}/instantiate` | Create workflow from template |

---

## List Templates

Get all available templates for the current user.

**Endpoint:** `GET /templates/`

**Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/templates/
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": 1,
      "name": "Basic HTTP Request",
      "description": "Simple GET request with logging",
      "category": "http",
      "is_public": false,
      "created_at": "2025-11-01T10:00:00Z"
    },
    {
      "id": 2,
      "name": "Email Notification",
      "description": "Send email via SMTP",
      "category": "notifications",
      "is_public": true,
      "created_at": "2025-11-15T14:30:00Z"
    }
  ]
}
```

---

## Create Template

Create a new workflow template.

**Endpoint:** `POST /templates/`

**Request:**
```bash
curl -X POST http://localhost:8000/templates/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "API Health Check",
    "description": "Periodically check API status and log results",
    "category": "monitoring",
    "is_public": false,
    "workflow_data": {
      "nodes": [
        {
          "id": "health_check",
          "name": "Health Check",
          "type": "http",
          "parameters": {
            "method": "GET",
            "url": "{{$variable.api_url}}/health",
            "timeout": 5
          }
        },
        {
          "id": "check_status",
          "name": "Check Status",
          "type": "conditional",
          "parameters": {
            "condition": "{{$health_check.statusCode}} == 200",
            "true_edge_id": "to_success",
            "false_edge_id": "to_failure"
          }
        },
        {
          "id": "log_success",
          "name": "Log Success",
          "type": "log",
          "parameters": {
            "message": "API is healthy",
            "level": "info"
          }
        },
        {
          "id": "log_failure",
          "name": "Log Failure",
          "type": "log",
          "parameters": {
            "message": "API is down! Status: {{$health_check.statusCode}}",
            "level": "error"
          }
        }
      ],
      "edges": [
        {"id": "e1", "src": "health_check", "dst": "check_status"},
        {"id": "to_success", "src": "check_status", "dst": "log_success"},
        {"id": "to_failure", "src": "check_status", "dst": "log_failure"}
      ]
    },
    "variables": [
      {
        "name": "api_url",
        "type": "string",
        "description": "Base URL of the API to monitor",
        "required": true,
        "default": "https://api.example.com"
      }
    ]
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Template name |
| `description` | string | No | Template description |
| `category` | string | No | Category for organization |
| `is_public` | boolean | No | Make template available to all users (default: false) |
| `workflow_data` | object | Yes | Workflow nodes and edges |
| `variables` | array | No | Configurable variables for instantiation |

**Variables Schema:**

```json
{
  "name": "string",           // Variable name (used as {{$variable.name}})
  "type": "string",           // string, number, boolean, array, object
  "description": "string",    // Help text for users
  "required": true,           // Is this variable required?
  "default": "any"            // Default value if not provided
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": 3,
    "name": "API Health Check",
    "description": "Periodically check API status and log results",
    "category": "monitoring",
    "is_public": false,
    "workflow_data": {...},
    "variables": [...],
    "created_at": "2025-12-01T10:00:00Z",
    "updated_at": "2025-12-01T10:00:00Z"
  }
}
```

---

## Get Template

Get detailed information about a specific template.

**Endpoint:** `GET /templates/{template_id}`

**Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/templates/1
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": 1,
    "name": "Basic HTTP Request",
    "description": "Simple GET request with logging",
    "category": "http",
    "is_public": false,
    "workflow_data": {
      "nodes": [
        {
          "id": "request",
          "name": "HTTP Request",
          "type": "http",
          "parameters": {
            "method": "{{$variable.method}}",
            "url": "{{$variable.url}}"
          }
        },
        {
          "id": "log",
          "name": "Log Response",
          "type": "log",
          "parameters": {
            "message": "Response: {{$request.body}}"
          }
        }
      ],
      "edges": [
        {"id": "e1", "src": "request", "dst": "log"}
      ]
    },
    "variables": [
      {
        "name": "method",
        "type": "string",
        "description": "HTTP method",
        "required": false,
        "default": "GET"
      },
      {
        "name": "url",
        "type": "string",
        "description": "URL to request",
        "required": true
      }
    ],
    "created_at": "2025-11-01T10:00:00Z",
    "updated_at": "2025-11-01T10:00:00Z"
  }
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 404 | Template not found |

---

## Update Template

Update an existing template.

**Endpoint:** `PUT /templates/{template_id}`

**Request:**
```bash
curl -X PUT http://localhost:8000/templates/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Template Name",
    "description": "Updated description",
    "category": "new-category",
    "is_public": true,
    "workflow_data": {
      "nodes": [...],
      "edges": [...]
    },
    "variables": [...]
  }'
```

**Request Body:**

All fields are optional. Only provided fields will be updated.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Template name |
| `description` | string | Template description |
| `category` | string | Category for organization |
| `is_public` | boolean | Public visibility |
| `workflow_data` | object | Workflow nodes and edges |
| `variables` | array | Configurable variables |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": 1,
    "name": "Updated Template Name",
    ...
  }
}
```

---

## Delete Template

Permanently delete a template.

**Endpoint:** `DELETE /templates/{template_id}`

**Request:**
```bash
curl -X DELETE http://localhost:8000/templates/1 \
  -H "Authorization: Bearer $TOKEN"
```

**Response (204 No Content):**
No response body.

**Error Responses:**

| Status | Description |
|--------|-------------|
| 404 | Template not found |
| 403 | Cannot delete public template you don't own |

---

## Instantiate Template

Create a new workflow from a template, providing values for the template's variables.

**Endpoint:** `POST /templates/{template_id}/instantiate`

**Request:**
```bash
curl -X POST http://localhost:8000/templates/1/instantiate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My API Health Check",
    "variables": {
      "api_url": "https://api.myservice.com"
    }
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Name for the new workflow |
| `description` | string | No | Description for the new workflow |
| `variables` | object | No | Values for template variables |

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Workflow created from template",
  "data": {
    "id": 5,
    "name": "My API Health Check",
    "description": "Periodically check API status and log results",
    "is_active": false,
    "workflow_data": {
      "nodes": [
        {
          "id": "health_check",
          "name": "Health Check",
          "type": "http",
          "parameters": {
            "method": "GET",
            "url": "https://api.myservice.com/health",
            "timeout": 5
          }
        },
        ...
      ],
      "edges": [...]
    },
    "version": 1,
    "created_at": "2025-12-01T10:00:00Z"
  }
}
```

**What Happens:**
1. Template is retrieved
2. Variables are substituted with provided values
3. Default values are used for missing optional variables
4. A new workflow is created with the resolved configuration
5. The workflow is returned in inactive state

**Error Responses:**

| Status | Description |
|--------|-------------|
| 404 | Template not found |
| 400 | Missing required variable |

---

## Template Examples

### Slack Notification Template

```bash
curl -X POST http://localhost:8000/templates/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Slack Notification",
    "description": "Send a message to a Slack channel",
    "category": "notifications",
    "workflow_data": {
      "nodes": [
        {
          "id": "send_slack",
          "name": "Send to Slack",
          "type": "http",
          "parameters": {
            "method": "POST",
            "url": "{{$variable.webhook_url}}",
            "headers": {
              "Content-Type": "application/json"
            },
            "body": {
              "text": "{{$variable.message}}",
              "channel": "{{$variable.channel}}"
            }
          }
        }
      ],
      "edges": []
    },
    "variables": [
      {
        "name": "webhook_url",
        "type": "string",
        "description": "Slack Incoming Webhook URL",
        "required": true
      },
      {
        "name": "channel",
        "type": "string",
        "description": "Slack channel (e.g., #general)",
        "required": false,
        "default": "#general"
      },
      {
        "name": "message",
        "type": "string",
        "description": "Message to send",
        "required": true
      }
    ]
  }'
```

### Data Pipeline Template

```bash
curl -X POST http://localhost:8000/templates/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ETL Pipeline",
    "description": "Extract, transform, and load data",
    "category": "data",
    "workflow_data": {
      "nodes": [
        {
          "id": "extract",
          "name": "Extract Data",
          "type": "http",
          "parameters": {
            "method": "GET",
            "url": "{{$variable.source_url}}"
          }
        },
        {
          "id": "transform",
          "name": "Transform",
          "type": "log",
          "parameters": {
            "message": "Processing {{$extract.body.length}} records"
          }
        },
        {
          "id": "load",
          "name": "Load Data",
          "type": "http",
          "parameters": {
            "method": "POST",
            "url": "{{$variable.destination_url}}",
            "body": "{{$extract.body}}"
          }
        }
      ],
      "edges": [
        {"id": "e1", "src": "extract", "dst": "transform"},
        {"id": "e2", "src": "transform", "dst": "load"}
      ]
    },
    "variables": [
      {
        "name": "source_url",
        "type": "string",
        "description": "URL to fetch data from",
        "required": true
      },
      {
        "name": "destination_url",
        "type": "string",
        "description": "URL to send data to",
        "required": true
      }
    ]
  }'
```

---

## Response Schema

### TemplateListItem

```json
{
  "id": "integer",
  "name": "string",
  "description": "string | null",
  "category": "string | null",
  "is_public": "boolean",
  "created_at": "datetime"
}
```

### TemplateDetail

```json
{
  "id": "integer",
  "name": "string",
  "description": "string | null",
  "category": "string | null",
  "is_public": "boolean",
  "workflow_data": {
    "nodes": "array",
    "edges": "array"
  },
  "variables": [
    {
      "name": "string",
      "type": "string",
      "description": "string | null",
      "required": "boolean",
      "default": "any"
    }
  ],
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

---

[← Workflows API](./workflows.md) | [Back to API Reference](./README.md) | [Credentials API →](./credentials.md)
