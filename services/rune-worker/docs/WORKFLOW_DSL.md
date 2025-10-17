# Workflow DSL Reference

Complete guide to the Workflow Definition Language (DSL) used by the Rune Workflow Worker.

## Table of Contents

- [Overview](#overview)
- [Workflow Structure](#workflow-structure)
- [Complete Examples](#complete-examples)
- [Best Practices](#best-practices)

## Overview

Workflows are defined in JSON format following the RFC-002 specification. Each workflow contains nodes (operations) connected by edges (execution flow).

## Workflow Structure

### Root Structure

```json
{
  "id": "unique_workflow_id",
  "name": "Human Readable Name",
  "description": "Workflow description",
  "version": "1.0.0",
  "nodes": [/* Array of nodes */],
  "edges": [/* Array of edges */],
  "metadata": {/* Optional metadata */}
}
```

### Node Structure

```json
{
  "id": "node_id",
  "name": "Node Name",
  "type": "http | log | conditional",
  "parameters": {/* Type-specific parameters */},
  "credentials": {/* Optional credentials */},
  "error": {/* Optional error handling */}
}
```

### Edge Structure

```json
{
  "id": "edge_id",
  "src": "source_node_id",
  "dst": "destination_node_id",
  "label": "Optional edge label"
}
```

## Complete Examples

### Example 1: Simple Linear Workflow

Fetch user data and log the result.

```json
{
  "id": "simple_user_fetch",
  "name": "Simple User Fetch Workflow",
  "description": "Fetch and log user information",
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
      "id": "log_result",
      "name": "Log User Info",
      "type": "log",
      "parameters": {
        "message": "Fetched user: {{$fetch_user.body.name}} ({{$fetch_user.body.email}})"
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "src": "fetch_user",
      "dst": "log_result"
    }
  ]
}
```

### Example 2: Conditional Branching

Route workflow based on user status.

```json
{
  "id": "user_validation_workflow",
  "name": "User Validation Workflow",
  "description": "Validate user and send appropriate notification",
  "version": "1.0.0",
  "nodes": [
    {
      "id": "fetch_user",
      "name": "Fetch User Data",
      "type": "http",
      "parameters": {
        "method": "GET",
        "url": "https://api.example.com/users/{{$input.userId}}"
      }
    },
    {
      "id": "check_status",
      "name": "Check User Status",
      "type": "conditional",
      "parameters": {
        "condition": "{{$fetch_user.body.status}} == 'active'",
        "true_edge_id": "to_welcome",
        "false_edge_id": "to_notify_admin"
      }
    },
    {
      "id": "send_welcome",
      "name": "Send Welcome Email",
      "type": "http",
      "parameters": {
        "method": "POST",
        "url": "https://api.example.com/emails/send",
        "headers": {
          "Content-Type": "application/json",
          "Authorization": "Bearer {{$credential.email_api_token}}"
        },
        "body": {
          "to": "{{$fetch_user.body.email}}",
          "template": "welcome_back",
          "data": {
            "name": "{{$fetch_user.body.name}}"
          }
        }
      },
      "credentials": {
        "source": "email_service_credentials"
      }
    },
    {
      "id": "notify_admin",
      "name": "Notify Admin",
      "type": "http",
      "parameters": {
        "method": "POST",
        "url": "https://api.example.com/admin/notify",
        "headers": {
          "Content-Type": "application/json"
        },
        "body": {
          "event": "inactive_user_login",
          "userId": "{{$fetch_user.body.id}}",
          "timestamp": "{{$input.timestamp}}"
        }
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
      "id": "to_notify_admin",
      "src": "check_status",
      "dst": "notify_admin",
      "label": "Inactive User"
    }
  ]
}
```

### Example 3: Error Handling with Fallback

Handle API failures gracefully.

```json
{
  "id": "resilient_api_workflow",
  "name": "Resilient API Workflow",
  "description": "API call with error handling and fallback",
  "version": "1.0.0",
  "nodes": [
    {
      "id": "primary_api_call",
      "name": "Call Primary API",
      "type": "http",
      "parameters": {
        "method": "POST",
        "url": "https://api.example.com/process",
        "headers": {
          "Content-Type": "application/json"
        },
        "body": {
          "data": "{{$input.data}}"
        },
        "timeout": 30,
        "retry": 3,
        "retry_delay": 2000
      },
      "error": {
        "type": "branch",
        "error_edge": "to_fallback"
      }
    },
    {
      "id": "log_success",
      "name": "Log Success",
      "type": "log",
      "parameters": {
        "level": "info",
        "message": "Primary API call succeeded",
        "data": {
          "result": "{{$primary_api_call.body}}"
        }
      }
    },
    {
      "id": "fallback_api_call",
      "name": "Call Fallback API",
      "type": "http",
      "parameters": {
        "method": "POST",
        "url": "https://backup-api.example.com/process",
        "headers": {
          "Content-Type": "application/json"
        },
        "body": {
          "data": "{{$input.data}}"
        }
      }
    },
    {
      "id": "log_fallback",
      "name": "Log Fallback Used",
      "type": "log",
      "parameters": {
        "level": "warn",
        "message": "Used fallback API due to primary failure"
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "src": "primary_api_call",
      "dst": "log_success"
    },
    {
      "id": "to_fallback",
      "src": "primary_api_call",
      "dst": "fallback_api_call",
      "label": "On Error"
    },
    {
      "id": "e2",
      "src": "fallback_api_call",
      "dst": "log_fallback"
    }
  ]
}
```

### Example 4: Multi-Step Data Processing

Fetch, validate, transform, and store data.

```json
{
  "id": "data_processing_workflow",
  "name": "Data Processing Workflow",
  "description": "Multi-step data processing pipeline",
  "version": "1.0.0",
  "nodes": [
    {
      "id": "fetch_data",
      "name": "Fetch Source Data",
      "type": "http",
      "parameters": {
        "method": "GET",
        "url": "https://api.example.com/data/{{$input.datasetId}}"
      }
    },
    {
      "id": "validate_data",
      "name": "Validate Data",
      "type": "conditional",
      "parameters": {
        "condition": "{{$fetch_data.body.status}} == 'valid'",
        "true_edge_id": "to_transform",
        "false_edge_id": "to_log_invalid"
      }
    },
    {
      "id": "transform_data",
      "name": "Transform Data",
      "type": "http",
      "parameters": {
        "method": "POST",
        "url": "https://api.example.com/transform",
        "body": {
          "data": "{{$fetch_data.body.data}}",
          "format": "normalized"
        }
      }
    },
    {
      "id": "store_data",
      "name": "Store Processed Data",
      "type": "http",
      "parameters": {
        "method": "POST",
        "url": "https://api.example.com/storage",
        "body": {
          "dataset_id": "{{$input.datasetId}}",
          "processed_data": "{{$transform_data.body.result}}"
        }
      }
    },
    {
      "id": "log_success",
      "name": "Log Success",
      "type": "log",
      "parameters": {
        "message": "Data processing completed for dataset {{$input.datasetId}}"
      }
    },
    {
      "id": "log_invalid",
      "name": "Log Invalid Data",
      "type": "log",
      "parameters": {
        "level": "error",
        "message": "Invalid data received for dataset {{$input.datasetId}}"
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "src": "fetch_data",
      "dst": "validate_data"
    },
    {
      "id": "to_transform",
      "src": "validate_data",
      "dst": "transform_data",
      "label": "Valid Data"
    },
    {
      "id": "to_log_invalid",
      "src": "validate_data",
      "dst": "log_invalid",
      "label": "Invalid Data"
    },
    {
      "id": "e2",
      "src": "transform_data",
      "dst": "store_data"
    },
    {
      "id": "e3",
      "src": "store_data",
      "dst": "log_success"
    }
  ]
}
```

### Example 5: Complex Conditional Logic

Multiple conditions and branches.

```json
{
  "id": "order_processing_workflow",
  "name": "Order Processing Workflow",
  "description": "Process orders based on amount and customer tier",
  "version": "1.0.0",
  "nodes": [
    {
      "id": "fetch_order",
      "name": "Fetch Order",
      "type": "http",
      "parameters": {
        "method": "GET",
        "url": "https://api.example.com/orders/{{$input.orderId}}"
      }
    },
    {
      "id": "check_amount",
      "name": "Check Order Amount",
      "type": "conditional",
      "parameters": {
        "condition": "{{$fetch_order.body.total}} > 1000",
        "true_edge_id": "to_check_vip",
        "false_edge_id": "to_standard_processing"
      }
    },
    {
      "id": "check_vip",
      "name": "Check VIP Status",
      "type": "conditional",
      "parameters": {
        "condition": "{{$fetch_order.body.customer.vip}} == true",
        "true_edge_id": "to_vip_processing",
        "false_edge_id": "to_premium_processing"
      }
    },
    {
      "id": "vip_processing",
      "name": "VIP Processing",
      "type": "log",
      "parameters": {
        "message": "VIP order processing for {{$fetch_order.body.id}}"
      }
    },
    {
      "id": "premium_processing",
      "name": "Premium Processing",
      "type": "log",
      "parameters": {
        "message": "Premium order processing for {{$fetch_order.body.id}}"
      }
    },
    {
      "id": "standard_processing",
      "name": "Standard Processing",
      "type": "log",
      "parameters": {
        "message": "Standard order processing for {{$fetch_order.body.id}}"
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "src": "fetch_order",
      "dst": "check_amount"
    },
    {
      "id": "to_check_vip",
      "src": "check_amount",
      "dst": "check_vip",
      "label": "High Value Order"
    },
    {
      "id": "to_standard_processing",
      "src": "check_amount",
      "dst": "standard_processing",
      "label": "Standard Order"
    },
    {
      "id": "to_vip_processing",
      "src": "check_vip",
      "dst": "vip_processing",
      "label": "VIP Customer"
    },
    {
      "id": "to_premium_processing",
      "src": "check_vip",
      "dst": "premium_processing",
      "label": "Premium Customer"
    }
  ]
}
```

## Best Practices

### Workflow Design

1. **Keep workflows focused** - One workflow should do one thing well
2. **Use descriptive names** - Clear IDs and names for nodes and workflows
3. **Plan error handling** - Consider failure scenarios upfront
4. **Version workflows** - Use semantic versioning (1.0.0, 1.1.0, etc.)
5. **Document complex logic** - Use metadata for documentation

### Node Organization

1. **Linear flows first** - Start with simple linear flows, add branches as needed
2. **Logical grouping** - Group related operations together
3. **Minimize dependencies** - Reduce coupling between nodes
4. **Reusable patterns** - Extract common patterns into separate workflows

### Edge Management

1. **Clear labels** - Use descriptive labels for conditional branches
2. **Unique IDs** - Ensure all edge IDs are unique within the workflow
3. **Avoid cycles** - Workflows should be DAGs (no circular dependencies)
4. **Name error edges** - Use consistent naming like `to_error`, `to_fallback`

### Parameter Management

1. **Use input variables** - Reference `$input` for workflow parameters
2. **Template carefully** - Validate interpolation syntax
3. **Handle missing data** - Plan for missing or null values
4. **Type consistency** - Ensure data types match expectations

### Performance Optimization

1. **Set appropriate timeouts** - Don't use excessively long timeouts
2. **Use retries wisely** - Add retries for transient failures
3. **Minimize HTTP calls** - Batch requests when possible
4. **Cache results** - Use intermediate nodes to cache expensive operations

### Security

1. **Never hardcode secrets** - Always use credentials
2. **Validate input** - Don't trust workflow input data
3. **Use HTTPS** - Always use secure connections
4. **Limit permissions** - Use least-privilege credentials

### Testing

1. **Test incrementally** - Test nodes individually first
2. **Use sample data** - Create realistic test inputs
3. **Test error paths** - Verify error handling works
4. **Monitor execution** - Watch logs during development

### Common Patterns

**Retry with Exponential Backoff:**
```json
{
  "parameters": {
    "retry": 3,
    "retry_delay": 1000
  }
}
```

**Conditional Error Handling:**
```json
{
  "error": {
    "type": "branch",
    "error_edge": "to_fallback"
  }
}
```

**Secure API Calls:**
```json
{
  "parameters": {
    "headers": {
      "Authorization": "Bearer {{$credential.token}}"
    }
  },
  "credentials": {
    "source": "api_credentials"
  }
}
```

---

**Related Documentation:**
- [Node Types Reference](NODE_TYPES.md) - Detailed node type documentation
- [Custom Nodes Guide](CUSTOM_NODES.md) - Create custom node types
- [Architecture Guide](ARCHITECTURE.md) - Understand workflow execution
