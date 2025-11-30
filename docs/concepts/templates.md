# Templates

Learn how to create, share, and use workflow templates to accelerate your automation development.

---

## Table of Contents

- [What are Templates?](#what-are-templates)
- [Using Templates](#using-templates)
- [Creating Templates](#creating-templates)
- [Managing Templates](#managing-templates)
- [Template Best Practices](#template-best-practices)

---

## What are Templates?

Templates are reusable workflow blueprints. They allow you to:

- **Save time** by starting from proven patterns
- **Share knowledge** across your team
- **Standardize** common automation patterns
- **Learn** from pre-built examples

```
┌─────────────────┐         ┌─────────────────┐
│    Template     │         │  New Workflow   │
│                 │  ────▶  │                 │
│  Slack Alert    │   Use   │  My Alert Flow  │
│  Pattern        │         │  (customized)   │
└─────────────────┘         └─────────────────┘
```

---

## Using Templates

### Via the UI

1. Go to the **Templates** page
2. Browse or search for a template
3. Click on a template to preview
4. Click **"Use Template"**
5. Customize the workflow for your needs
6. Save as your new workflow

### Via the API

**List available templates:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/templates/
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Slack Notification",
      "description": "Send alerts to Slack when triggered",
      "category": "notifications",
      "usage_count": 42,
      "is_public": true
    },
    {
      "id": 2,
      "name": "GitHub Issue Tracker",
      "description": "Create GitHub issues from form submissions",
      "category": "integrations",
      "usage_count": 18,
      "is_public": true
    }
  ]
}
```

**Get template details:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/templates/1
```

**Use a template (get workflow data):**
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/templates/1/use
```

**Response:**
```json
{
  "success": true,
  "data": {
    "workflow_data": {
      "nodes": [...],
      "edges": [...]
    }
  }
}
```

This workflow data can then be used to create a new workflow.

---

## Creating Templates

### From an Existing Workflow

The easiest way to create a template is from a working workflow:

1. Open your workflow
2. Click **"Save as Template"**
3. Fill in template details:
   - **Name**: Clear, descriptive name
   - **Description**: What the template does
   - **Category**: Organization category
   - **Public**: Whether others can use it
4. Click **Save**

### Via the API

```bash
curl -X POST http://localhost:8000/templates/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "API Health Check",
    "description": "Monitor an API endpoint and alert on failures",
    "category": "monitoring",
    "is_public": true,
    "workflow_data": {
      "nodes": [
        {
          "id": "health_check",
          "name": "Check API Health",
          "type": "http",
          "parameters": {
            "method": "GET",
            "url": "{{$input.api_url}}/health",
            "timeout": 10
          }
        },
        {
          "id": "check_status",
          "name": "Verify Response",
          "type": "conditional",
          "parameters": {
            "condition": "{{$health_check.status_code}} == 200",
            "true_edge_id": "to_success",
            "false_edge_id": "to_alert"
          }
        },
        {
          "id": "log_success",
          "name": "Log Success",
          "type": "log",
          "parameters": {
            "level": "info",
            "message": "API is healthy"
          }
        },
        {
          "id": "send_alert",
          "name": "Send Alert",
          "type": "http",
          "parameters": {
            "method": "POST",
            "url": "{{$credential.slack_webhook}}",
            "body": {
              "text": "🚨 API health check failed!"
            }
          }
        }
      ],
      "edges": [
        {"id": "e1", "src": "health_check", "dst": "check_status"},
        {"id": "to_success", "src": "check_status", "dst": "log_success"},
        {"id": "to_alert", "src": "check_status", "dst": "send_alert"}
      ]
    }
  }'
```

---

## Template Categories

Organize templates by category for easy discovery:

| Category | Description | Examples |
|----------|-------------|----------|
| `notifications` | Alert and messaging | Slack, Email, SMS alerts |
| `integrations` | Third-party service connections | GitHub, Jira, Salesforce |
| `monitoring` | Health checks and observability | API monitoring, uptime checks |
| `data` | Data processing and transformation | CSV import, API sync |
| `devops` | CI/CD and infrastructure | Deployments, backups |
| `general` | General purpose | Starter templates |

---

## Managing Templates

### Viewing Your Templates

```bash
# List all templates you have access to
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/templates/
```

### Updating a Template

To update a template, delete and recreate it with the new content.

### Deleting a Template

```bash
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/templates/1
```

> ⚠️ Only the template creator can delete a template.

### Template Visibility

| Setting | Who can see | Who can use |
|---------|-------------|-------------|
| `is_public: false` | Only you | Only you |
| `is_public: true` | Everyone | Everyone |

---

## Template Best Practices

### 1. Use Descriptive Names

```
✅ "Slack Alert on HTTP Error"
✅ "Daily Sales Report to Email"
❌ "My Template"
❌ "Test 1"
```

### 2. Write Clear Descriptions

Include:
- What the template does
- Required credentials
- Expected inputs
- What outputs to expect

**Good description:**
```
Monitors an API endpoint every 5 minutes. Sends a Slack notification 
if the endpoint returns a non-200 status code.

Requires:
- Slack webhook credential
- Input: api_url (the endpoint to monitor)
```

### 3. Use Input Variables

Make templates flexible with `{{$input.variable}}`:

```json
{
  "parameters": {
    "url": "{{$input.api_url}}",
    "headers": {
      "X-Custom-Header": "{{$input.custom_header}}"
    }
  }
}
```

Document the expected inputs in the description.

### 4. Use Credential References

Never hardcode sensitive data. Use `{{$credential.field}}`:

```json
{
  "parameters": {
    "headers": {
      "Authorization": "Bearer {{$credential.api_token}}"
    }
  },
  "credentials": {
    "source": "api_credentials"
  }
}
```

### 5. Include Error Handling

Make templates robust with error handling:

```json
{
  "error": {
    "type": "branch",
    "error_edge": "to_error_handler"
  }
}
```

### 6. Add Logging for Debugging

Include log nodes to help users debug:

```json
{
  "id": "debug_log",
  "name": "Debug - API Response",
  "type": "log",
  "parameters": {
    "level": "debug",
    "message": "API returned: {{$api_call.status_code}}"
  }
}
```

---

## Example Templates

### Slack Notification

```json
{
  "name": "Slack Notification",
  "description": "Send a message to Slack. Requires: Slack webhook credential.",
  "category": "notifications",
  "is_public": true,
  "workflow_data": {
    "nodes": [
      {
        "id": "send_slack",
        "name": "Send to Slack",
        "type": "http",
        "parameters": {
          "method": "POST",
          "url": "{{$credential.webhook_url}}",
          "headers": {
            "Content-Type": "application/json"
          },
          "body": {
            "text": "{{$input.message}}",
            "channel": "{{$input.channel}}"
          }
        },
        "credentials": {
          "source": "slack_webhook"
        }
      }
    ],
    "edges": []
  }
}
```

### GitHub Issue Creator

```json
{
  "name": "Create GitHub Issue",
  "description": "Creates a GitHub issue. Requires: GitHub PAT credential.",
  "category": "integrations",
  "is_public": true,
  "workflow_data": {
    "nodes": [
      {
        "id": "create_issue",
        "name": "Create Issue",
        "type": "http",
        "parameters": {
          "method": "POST",
          "url": "https://api.github.com/repos/{{$input.owner}}/{{$input.repo}}/issues",
          "headers": {
            "Authorization": "Bearer {{$credential.github_token}}",
            "Accept": "application/vnd.github+json"
          },
          "body": {
            "title": "{{$input.title}}",
            "body": "{{$input.body}}",
            "labels": "{{$input.labels}}"
          }
        },
        "credentials": {
          "source": "github_pat"
        }
      },
      {
        "id": "log_result",
        "name": "Log Issue URL",
        "type": "log",
        "parameters": {
          "message": "Created issue: {{$create_issue.body.html_url}}"
        }
      }
    ],
    "edges": [
      {"id": "e1", "src": "create_issue", "dst": "log_result"}
    ]
  }
}
```

### API Health Monitor

```json
{
  "name": "API Health Monitor",
  "description": "Check API health and alert on failures. Requires: Slack webhook.",
  "category": "monitoring",
  "is_public": true,
  "workflow_data": {
    "nodes": [
      {
        "id": "health_check",
        "name": "Check Health",
        "type": "http",
        "parameters": {
          "method": "GET",
          "url": "{{$input.health_url}}",
          "timeout": 10,
          "retry": 2
        },
        "error": {
          "type": "branch",
          "error_edge": "to_alert"
        }
      },
      {
        "id": "check_status",
        "name": "Check Status Code",
        "type": "conditional",
        "parameters": {
          "condition": "{{$health_check.status_code}} == 200",
          "true_edge_id": "to_success",
          "false_edge_id": "to_alert"
        }
      },
      {
        "id": "log_healthy",
        "name": "Log Healthy",
        "type": "log",
        "parameters": {
          "message": "✅ API is healthy"
        }
      },
      {
        "id": "send_alert",
        "name": "Send Alert",
        "type": "http",
        "parameters": {
          "method": "POST",
          "url": "{{$credential.slack_webhook}}",
          "body": {
            "text": "🚨 Health check failed for {{$input.health_url}}"
          }
        },
        "credentials": {
          "source": "slack_webhook"
        }
      }
    ],
    "edges": [
      {"id": "e1", "src": "health_check", "dst": "check_status"},
      {"id": "to_success", "src": "check_status", "dst": "log_healthy"},
      {"id": "to_alert", "src": "check_status", "dst": "send_alert"}
    ]
  }
}
```

---

## Next Steps

- [Nodes Reference](../nodes/README.md) - All available node types
- [Credentials](./credentials.md) - Set up secure credentials
- [Error Handling](./error-handling.md) - Handle failures gracefully

---

[← Back to Concepts](./README.md) | [Error Handling →](./error-handling.md)
