# Node Types Reference

This document provides comprehensive documentation for all built-in node types available in the Rune Workflow Worker.

## Table of Contents

- [Overview](#overview)
- [HTTP Node](#http-node)
- [Log Node](#log-node)
- [Conditional Node](#conditional-node)
- [Template Interpolation](#template-interpolation)
- [Error Handling](#error-handling)
- [Credentials](#credentials)

## Overview

Nodes are the building blocks of workflows. Each node type performs a specific operation and can access data from previous nodes through context variables.

### Common Node Properties

All nodes share these common properties:

```json
{
  "id": "unique_node_id",
  "name": "Human Readable Name",
  "type": "node_type",
  "parameters": {
    /* Type-specific parameters */
  },
  "credentials": {
    /* Optional credentials */
  },
  "error": {
    /* Optional error handling configuration */
  }
}
```

### Context Variables

Nodes can access data using template interpolation:

- `{{$input.field}}` - Access workflow input/trigger data
- `{{$previous_node.field}}` - Access output from a specific node
- `{{$credential.field}}` - Access credential values

## HTTP Node

The HTTP node makes HTTP/HTTPS requests to external APIs and services.

### Type Identifier

```json
{
  "type": "http"
}
```

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `method` | string | Yes | - | HTTP method (GET, POST, PUT, PATCH, DELETE) |
| `url` | string | Yes | - | Target URL (supports template interpolation) |
| `headers` | object | No | `{}` | HTTP headers |
| `query` | object | No | `{}` | URL query parameters |
| `body` | any | No | - | Request body (for POST/PUT/PATCH) |
| `timeout` | number | No | `30` | Request timeout in seconds |
| `retry` | number | No | `0` | Number of retry attempts |
| `retry_delay` | number | No | `1000` | Delay between retries in milliseconds |
| `raise_on_status` | string | No | - | Raise error on status codes (e.g., "4xx,5xx") |
| `ignore_ssl` | boolean | No | `false` | Skip SSL certificate verification |

### Basic GET Request

```json
{
  "id": "fetch_user",
  "name": "Fetch User Data",
  "type": "http",
  "parameters": {
    "method": "GET",
    "url": "https://api.example.com/users/123"
  }
}
```

### POST Request with Body

```json
{
  "id": "create_user",
  "name": "Create New User",
  "type": "http",
  "parameters": {
    "method": "POST",
    "url": "https://api.example.com/users",
    "headers": {
      "Content-Type": "application/json"
    },
    "body": {
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user"
    }
  }
}
```

### Request with Authentication

```json
{
  "id": "auth_request",
  "name": "Authenticated API Call",
  "type": "http",
  "parameters": {
    "method": "GET",
    "url": "https://api.example.com/protected/data",
    "headers": {
      "Authorization": "Bearer {{$credential.api_token}}",
      "Content-Type": "application/json"
    }
  },
  "credentials": {
    "source": "api_credentials"
  }
}
```

### Request with Query Parameters

```json
{
  "id": "search_users",
  "name": "Search Users",
  "type": "http",
  "parameters": {
    "method": "GET",
    "url": "https://api.example.com/users/search",
    "query": {
      "q": "{{$input.search_term}}",
      "limit": "10",
      "offset": "0"
    }
  }
}
```

### Request with Retry Logic

```json
{
  "id": "resilient_api_call",
  "name": "API Call with Retries",
  "type": "http",
  "parameters": {
    "method": "POST",
    "url": "https://api.example.com/process",
    "body": {
      "data": "{{$input.data}}"
    },
    "timeout": 30,
    "retry": 3,
    "retry_delay": 2000,
    "raise_on_status": "5xx"
  }
}
```

### Dynamic URL Construction

```json
{
  "id": "dynamic_fetch",
  "name": "Fetch Dynamic Resource",
  "type": "http",
  "parameters": {
    "method": "GET",
    "url": "https://api.example.com/{{$input.resource_type}}/{{$input.resource_id}}",
    "headers": {
      "Accept": "application/json"
    }
  }
}
```

### HTTP Node Output

The HTTP node outputs a structured response:

```json
{
  "status_code": 200,
  "headers": {
    "content-type": "application/json",
    "server": "nginx"
  },
  "body": {
    "id": 123,
    "name": "John Doe",
    "email": "john@example.com"
  },
  "duration_ms": 245
}
```

Access output in subsequent nodes:

```json
{
  "parameters": {
    "message": "Fetched user: {{$fetch_user.body.name}}"
  }
}
```

## Log Node

The Log node outputs messages for debugging and monitoring workflows.

### Type Identifier

```json
{
  "type": "log"
}
```

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `message` | string | Yes | - | Message to log (supports template interpolation) |
| `level` | string | No | `info` | Log level (debug, info, warn, error) |
| `data` | object | No | `{}` | Additional structured data to log |

### Basic Logging

```json
{
  "id": "log1",
  "name": "Log Message",
  "type": "log",
  "parameters": {
    "message": "Workflow started successfully"
  }
}
```

### Logging with Template Interpolation

```json
{
  "id": "log_user",
  "name": "Log User Info",
  "type": "log",
  "parameters": {
    "message": "Processing user: {{$fetch_user.body.name}} (ID: {{$fetch_user.body.id}})"
  }
}
```

### Logging with Different Levels

```json
{
  "id": "log_error",
  "name": "Log Error",
  "type": "log",
  "parameters": {
    "level": "error",
    "message": "Failed to process user: {{$error.message}}"
  }
}
```

### Logging with Structured Data

```json
{
  "id": "log_detailed",
  "name": "Log with Data",
  "type": "log",
  "parameters": {
    "message": "User processed successfully",
    "level": "info",
    "data": {
      "user_id": "{{$fetch_user.body.id}}",
      "timestamp": "{{$input.timestamp}}",
      "environment": "production"
    }
  }
}
```

### Log Node Output

The Log node outputs a simple confirmation:

```json
{
  "logged": true,
  "message": "User processed successfully",
  "level": "info",
  "timestamp": "2025-10-17T12:00:00Z"
}
```

## Conditional Node

The Conditional node enables branching logic based on conditions.

### Type Identifier

```json
{
  "type": "conditional"
}
```

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `condition` | string | Yes | - | Boolean expression to evaluate |
| `true_edge_id` | string | Yes | - | Edge ID to follow if condition is true |
| `false_edge_id` | string | Yes | - | Edge ID to follow if condition is false |

### Supported Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `==` | Equal to | `{{$user.status}} == 'active'` |
| `!=` | Not equal to | `{{$user.role}} != 'admin'` |
| `>` | Greater than | `{{$user.age}} > 18` |
| `<` | Less than | `{{$order.total}} < 100` |
| `>=` | Greater than or equal | `{{$score}} >= 75` |
| `<=` | Less than or equal | `{{$count}} <= 10` |
| `&&` | Logical AND | `{{$user.active}} == true && {{$user.verified}} == true` |
| `\|\|` | Logical OR | `{{$status}} == 'pending' \|\| {{$status}} == 'processing'` |

### Simple Conditional

```json
{
  "id": "check_status",
  "name": "Check User Status",
  "type": "conditional",
  "parameters": {
    "condition": "{{$fetch_user.body.status}} == 'active'",
    "true_edge_id": "to_active_flow",
    "false_edge_id": "to_inactive_flow"
  }
}
```

### Numeric Comparison

```json
{
  "id": "check_age",
  "name": "Check Age Requirement",
  "type": "conditional",
  "parameters": {
    "condition": "{{$user.age}} >= 18",
    "true_edge_id": "to_adult_flow",
    "false_edge_id": "to_minor_flow"
  }
}
```

### Complex Conditional with AND

```json
{
  "id": "check_eligibility",
  "name": "Check Eligibility",
  "type": "conditional",
  "parameters": {
    "condition": "{{$user.age}} >= 18 && {{$user.verified}} == true",
    "true_edge_id": "to_eligible",
    "false_edge_id": "to_not_eligible"
  }
}
```

### Complex Conditional with OR

```json
{
  "id": "check_priority",
  "name": "Check Priority Status",
  "type": "conditional",
  "parameters": {
    "condition": "{{$order.total}} > 1000 || {{$customer.vip}} == true",
    "true_edge_id": "to_priority_processing",
    "false_edge_id": "to_standard_processing"
  }
}
```

### String Comparison

```json
{
  "id": "check_role",
  "name": "Check User Role",
  "type": "conditional",
  "parameters": {
    "condition": "{{$user.role}} == 'admin'",
    "true_edge_id": "to_admin_dashboard",
    "false_edge_id": "to_user_dashboard"
  }
}
```

### Conditional Node Output

The Conditional node outputs the evaluation result:

```json
{
  "condition": "{{$user.status}} == 'active'",
  "result": true,
  "edge_taken": "to_active_flow",
  "evaluated_at": "2025-10-17T12:00:00Z"
}
```

### Workflow with Conditional

Complete example showing conditional flow:

```json
{
  "id": "conditional_workflow",
  "name": "User Validation Workflow",
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
      "id": "check_status",
      "name": "Check Status",
      "type": "conditional",
      "parameters": {
        "condition": "{{$fetch_user.body.status}} == 'active'",
        "true_edge_id": "to_welcome",
        "false_edge_id": "to_notify"
      }
    },
    {
      "id": "send_welcome",
      "name": "Send Welcome",
      "type": "log",
      "parameters": {
        "message": "Welcome back, {{$fetch_user.body.name}}!"
      }
    },
    {
      "id": "notify_admin",
      "name": "Notify Admin",
      "type": "log",
      "parameters": {
        "message": "Inactive user attempted access: {{$fetch_user.body.id}}"
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "src": "fetch_user",
      "dst": "check_status"
    },
    {
      "id": "to_welcome",
      "src": "check_status",
      "dst": "send_welcome",
      "label": "Active User"
    },
    {
      "id": "to_notify",
      "src": "check_status",
      "dst": "notify_admin",
      "label": "Inactive User"
    }
  ]
}
```

## Template Interpolation

All node parameters support template interpolation using `{{}}` syntax.

### Accessing Workflow Input

```json
{
  "parameters": {
    "url": "https://api.example.com/users/{{$input.userId}}",
    "message": "Processing request from {{$input.username}}"
  }
}
```

### Accessing Previous Node Output

```json
{
  "parameters": {
    "message": "User {{$fetch_user.body.name}} has email {{$fetch_user.body.email}}"
  }
}
```

### Accessing Nested Fields

```json
{
  "parameters": {
    "url": "https://api.example.com/orders/{{$create_order.body.data.order_id}}"
  }
}
```

### Accessing Credentials

```json
{
  "parameters": {
    "headers": {
      "Authorization": "Bearer {{$credential.api_token}}",
      "X-API-Key": "{{$credential.api_key}}"
    }
  }
}
```

## Error Handling

Nodes support configurable error handling strategies.

### Error Configuration

```json
{
  "error": {
    "type": "halt | ignore | branch",
    "error_edge": "edge_id_to_error_handler"
  }
}
```

### Halt on Error (Default)

```json
{
  "id": "critical_operation",
  "name": "Critical Operation",
  "type": "http",
  "parameters": {
    "method": "POST",
    "url": "https://api.example.com/critical"
  },
  "error": {
    "type": "halt"
  }
}
```

### Ignore Errors

```json
{
  "id": "optional_operation",
  "name": "Optional Operation",
  "type": "http",
  "parameters": {
    "method": "GET",
    "url": "https://api.example.com/optional"
  },
  "error": {
    "type": "ignore"
  }
}
```

### Branch on Error

```json
{
  "id": "api_call",
  "name": "API Call",
  "type": "http",
  "parameters": {
    "method": "POST",
    "url": "https://api.example.com/process"
  },
  "error": {
    "type": "branch",
    "error_edge": "to_error_handler"
  }
}
```

Complete workflow with error handling:

```json
{
  "nodes": [
    {
      "id": "api_call",
      "name": "Call API",
      "type": "http",
      "parameters": {
        "method": "POST",
        "url": "https://api.example.com/process"
      },
      "error": {
        "type": "branch",
        "error_edge": "to_fallback"
      }
    },
    {
      "id": "success_log",
      "name": "Success",
      "type": "log",
      "parameters": {
        "message": "API call succeeded"
      }
    },
    {
      "id": "error_handler",
      "name": "Handle Error",
      "type": "log",
      "parameters": {
        "level": "error",
        "message": "API call failed, using fallback"
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "src": "api_call",
      "dst": "success_log"
    },
    {
      "id": "to_fallback",
      "src": "api_call",
      "dst": "error_handler",
      "label": "On Error"
    }
  ]
}
```

## Credentials

Nodes can access secure credentials for authentication.

### Credential Configuration

```json
{
  "credentials": {
    "source": "credential_id",
    "values": {
      "api_token": "resolved_by_master_service",
      "api_key": "resolved_by_master_service"
    }
  }
}
```

### Using Credentials in HTTP Headers

```json
{
  "id": "secure_api_call",
  "name": "Secure API Call",
  "type": "http",
  "parameters": {
    "method": "GET",
    "url": "https://api.example.com/secure/data",
    "headers": {
      "Authorization": "Bearer {{$credential.api_token}}",
      "X-API-Key": "{{$credential.api_key}}"
    }
  },
  "credentials": {
    "source": "api_credentials"
  }
}
```

### Multiple Credential Fields

```json
{
  "id": "database_query",
  "name": "Database Query",
  "type": "sql",
  "parameters": {
    "host": "{{$credential.db_host}}",
    "port": "{{$credential.db_port}}",
    "username": "{{$credential.db_user}}",
    "password": "{{$credential.db_pass}}",
    "database": "production"
  },
  "credentials": {
    "source": "database_credentials"
  }
}
```

## Best Practices

### Naming Conventions

- Use descriptive node IDs: `fetch_user`, `check_eligibility`, `send_notification`
- Use clear node names: "Fetch User Data", "Check Eligibility", "Send Email Notification"
- Keep IDs lowercase with underscores
- Keep names in Title Case

### Parameter Organization

- Group related parameters together
- Use consistent naming across workflows
- Document complex parameters with comments (in workflow metadata)
- Validate required parameters

### Error Handling

- Use `halt` for critical operations that must succeed
- Use `ignore` for optional operations that don't affect workflow outcome
- Use `branch` for operations with fallback strategies
- Always provide error edges when using `branch` type

### Template Interpolation

- Always validate that referenced nodes exist
- Use clear variable names
- Handle missing fields gracefully
- Test interpolation with sample data

### Performance

- Set appropriate timeouts for HTTP requests
- Use retry logic for transient failures
- Minimize unnecessary API calls
- Cache results when possible

---

**Next Steps:**
- [Create Custom Nodes](CUSTOM_NODES.md) to extend functionality
- [Review Workflow DSL](WORKFLOW_DSL.md) for complete workflow examples
- [Read Architecture Guide](ARCHITECTURE.md) to understand node execution
