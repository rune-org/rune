```
RFC 002: Workflow Definition DSL Specification
Author: Seif Elwarwary
Status: PROPOSED
Created: 2025-10-10
Updated: 2025-10-10
```

# RFC 002: Workflow Definition DSL Specification

## Abstract

This document specifies the Domain-Specific Language (DSL) for defining executable workflows in the Rune platform. The DSL provides a JSON-based declarative format for describing workflow structure, node configuration, credential management, and error handling. This specification defines the complete schema, semantics, and validation rules for workflow definitions that are executed by the rune-worker service.

## Status of This Memo

This document specifies a proposed DSL for the Rune workflow system and requests discussion and suggestions for improvements. Distribution of this memo is unlimited.

## Table of Contents

1. [Introduction](#1-introduction)
2. [Terminology](#2-terminology)
3. [Design Principles](#3-design-principles)
4. [Core Schema](#4-core-schema)
5. [Node Types](#5-node-types)
6. [Credential Management](#6-credential-management)
7. [Error Handling](#7-error-handling)
8. [Edge Semantics](#8-edge-semantics)
9. [Validation Rules](#9-validation-rules)
10. [Complete Examples](#10-complete-examples)
11. [Security Considerations](#11-security-considerations)
12. [Future Extensions](#12-future-extensions)
13. [References](#13-references)

---

## 1. Introduction

### 1.1 Purpose

This RFC defines a standardized DSL for expressing workflow definitions in the Rune platform. The DSL enables users to:

- Define complex multi-step automation workflows
- Configure node-specific parameters and behavior
- Manage credentials securely
- Specify error handling strategies
- Create conditional branching logic
- Integrate with external services via HTTP, SMTP, and custom nodes

### 1.2 Scope

This specification covers:

- Complete JSON schema for workflow definitions
- Detailed specifications for all supported node types
- Credential reference and resolution semantics
- Error handling configuration options
- Edge types and routing behavior
- Validation requirements and constraints

This specification does NOT cover:

- Execution semantics (see RFC-001)
- Node implementation details
- Master service API contracts
- UI/UX for workflow creation

### 1.3 Applicability

This DSL applies to:

- All workflows created and executed on the Rune platform
- Both master service (workflow storage) and worker service (execution)
- API integrations for programmatic workflow creation
- Import/export functionality for workflow sharing

---

## 2. Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in RFC 2119.

**Workflow**: A directed acyclic graph (DAG) representing an automated process.

**Node**: A vertex in the workflow graph representing a single executable operation.

**Edge**: A directed connection between two nodes defining execution flow.

**Trigger Node**: A node that initiates workflow execution (type: "ManualTrigger" or external triggers).

**Execution Node**: A node that performs work during workflow execution.

**Parameter**: A configuration value for a node's behavior.

**Credential**: A secure reference to authentication information.

**Context**: Runtime data accumulated from previous node outputs.

**Error Handling**: Configuration defining behavior when a node fails.

---

## 3. Design Principles

### 3.1 Declarative Over Imperative

The DSL is purely declarative - it describes WHAT should happen, not HOW it should be executed. Execution logic is handled by the worker service.

### 3.2 Separation of Concerns

- Workflow structure (nodes/edges) is separate from execution metadata
- Credential references are separate from credential values
- Node configuration is separate from node implementation

### 3.3 Extensibility

The DSL supports custom node types through a plugin architecture while maintaining backward compatibility with core node types.

### 3.4 Security by Design

- Sensitive data flows through secure context mechanisms
- Parameter validation occurs before execution

### 3.5 Clarity and Simplicity

- Human-readable JSON format
- Clear naming conventions
- Self-documenting structure

---

## 4. Core Schema

### 4.1 Workflow Object

The root workflow object sent to the worker service contains only essential execution data.

```json
{
  "workflow_id": "string",
  "execution_id": "string",
  "nodes": [Node],
  "edges": [Edge]
}
```

**Field Definitions:**

- `workflow_id` (string, required): Unique identifier for the workflow definition
- `execution_id` (string, required): Unique identifier for this specific execution instance
- `nodes` (array, required): Array of node definitions (minimum 1 node)
- `edges` (array, required): Array of edge definitions connecting nodes

**Note on Workflow Metadata:**

Metadata such as `name`, `desc`, `active`, and top-level credential storage are maintained in the master service but NOT included in the execution payload sent to workers. This separation ensures workers receive only what's needed for execution.

**Constraints:**

- At least one node MUST be marked as a trigger
- All edge source and destination IDs MUST reference existing nodes
- The workflow graph MUST be acyclic

### 4.2 Node Object

Each node represents a single operation in the workflow.

```json
{
  "id": "string",
  "name": "string",
  "trigger": boolean,
  "type": "string",
  "parameters": {},
  "credentials": {
    "id": "string",
    "name": "string",
    "type": "string",
    "values": {}
  },
  "output": {},
  "error": {
    "type": "string",
    "error_edge": "string"
  }
}
```

**Field Definitions:**

- `id` (string, required): Unique identifier for the node within the workflow
- `name` (string, required): Human-readable node name
- `trigger` (boolean, required): Whether this node initiates workflow execution
- `type` (string, required): Node type identifier (see Section 5)
- `parameters` (object, required): Type-specific configuration (may be empty)
- `credentials` (object, optional): Complete credential object with values (see Section 6)
- `output` (object, required): Placeholder for execution output (empty in definition)
- `error` (object, optional): Error handling configuration (see Section 7)

**Note:** The `position` field used in UI representations is NOT included in the worker execution payload.

**Constraints:**

- Node IDs MUST be unique within the workflow
- Trigger nodes SHOULD NOT have incoming edges (except for loop scenarios)
- Parameter structure MUST match the requirements for the node type
- If credentials are provided, they MUST include the complete `values` map

### 4.3 Edge Object

Edges define the flow of execution between nodes.

```json
{
  "id": "string",
  "src": "string",
  "dst": "string"
}
```

**Field Definitions:**

- `id` (string, required): Unique identifier for the edge
- `src` (string, required): Source node ID
- `dst` (string, required): Destination node ID

**Note:** Fields like `style`, `label`, and `is_error` are UI-level metadata maintained in the master service but NOT included in the worker execution payload.

**Constraints:**

- Edge IDs MUST be unique within the workflow
- Source and destination nodes MUST exist
- Cycles in the edge graph are NOT permitted

---

## 5. Node Types

### 5.1 HTTP Node

Executes HTTP requests to external APIs.

**Type Identifier:** `"http"`

**Parameters Schema:**

```json
{
  "method": "string",
  "url": "string",
  "body": Any,
  "query": {
    "key": "value"
  },
  "headers": {
    "key": "value"
  },
  "retry": "string",
  "retry_delay": "string",
  "timeout": "string",
  "raise_on_status": "string",
  "ignore_ssl": boolean
}
```

**Parameter Definitions:**

- `method` (string, required): HTTP method (GET, POST, PUT, DELETE, PATCH, etc.)
- `url` (string, required): Target URL (supports template variables from context)
- `body` (any, optional): Request body (JSON only for current version)
- `query` (object, optional): URL query parameters as key-value pairs
- `headers` (object, optional): HTTP headers as key-value pairs
- `retry` (string, optional): Number of retry attempts (default: "0")
- `retry_delay` (string, optional): Delay between retries in seconds (default: "0")
- `timeout` (string, optional): Request timeout in seconds (default: "30")
- `raise_on_status` (string, optional): Comma-separated status code patterns to treat as errors (e.g., "4xx,5xx" or "404,500"). Supports patterns like "2xx", "3xx", "4xx", "5xx" and specific codes like "404", "500". Default: no error raising.
- `ignore_ssl` (boolean, optional): Whether to ignore SSL certificate validation (default: false)

**Status Code Pattern Matching:**

The `raise_on_status` parameter supports flexible pattern matching for HTTP status codes:

- **Range Patterns**: Use "2xx", "3xx", "4xx", "5xx" to match status code ranges
  - "2xx" matches 200-299 (success responses)
  - "3xx" matches 300-399 (redirects)
  - "4xx" matches 400-499 (client errors)
  - "5xx" matches 500-599 (server errors)

- **Specific Codes**: Use exact status codes like "404", "500", "201"

- **Comma Separation**: Combine multiple patterns with commas (no spaces)
  - "4xx,5xx" - Raise on any 4xx or 5xx error
  - "404,500" - Raise only on 404 or 500
  - "404,5xx" - Mix specific codes and patterns

- **Behavior**: When a response status code matches any pattern in `raise_on_status`, the request is treated as failed and will retry if retries are configured

**Example:**

```json
{
  "id": "http_node_1",
  "name": "Fetch User Data",
  "trigger": false,
  "type": "http",
  "parameters": {
    "method": "GET",
    "url": "https://api.example.com/users/{{user_id}}",
    "headers": {
      "Authorization": "Bearer {{api_token}}",
      "Content-Type": "application/json"
    },
    "query": {
      "include": "profile,settings"
    },
    "retry": "3",
    "retry_delay": "5",
    "timeout": "30",
    "raise_on_status": "4xx,5xx",
    "ignore_ssl": false
  },
  "credentials": {
    "id": "cred_123",
    "name": "Example API Key",
    "type": "api_key",
    "values": {
      "key": "sk_live_abcd1234xyz",
      "header_name": "Authorization"
    }
  },
  "output": {},
  "error": {
    "type": "branch",
    "error_edge": "edge_error_1"
  }
}
```

### 5.2 Conditional Node

Evaluates expressions and routes execution based on the result.

**Type Identifier:** `"conditional"`

**Parameters Schema:**

```json
{
  "expression": [
    {
      "op1": Any,
      "op2": Any,
      "operator": "string"
    }
  ],
  "operator": "string",
  "true_edge_id": "string",
  "false_edge_id": "string"
}
```

**Parameter Definitions:**

- `expression` (array, required): Array of comparison expressions
- `operator` (string, required): Logical operator combining expressions ("and" or "or")
- `true_edge_id` (string, required): Edge ID to follow when condition is true
- `false_edge_id` (string, required): Edge ID to follow when condition is false

**Expression Object:**

- `op1` (any, required): First operand (supports context variables)
- `op2` (any, required): Second operand (supports context variables)
- `operator` (string, required): Comparison operator

**Supported Operators:**

- `gt`: Greater than
- `lt`: Less than
- `eq`: Equal
- `neq`: Not equal
- `gte`: Greater than or equal
- `lte`: Less than or equal

**Example:**

```json
{
  "id": "conditional_1",
  "name": "Check Status Code",
  "trigger": false,
  "type": "conditional",
  "parameters": {
    "expression": [
      {
        "op1": "{{http_node_1.status_code}}",
        "op2": 200,
        "operator": "eq"
      },
      {
        "op1": "{{http_node_1.response.user.active}}",
        "op2": true,
        "operator": "eq"
      }
    ],
    "operator": "and",
    "true_edge_id": "edge_success",
    "false_edge_id": "edge_failure"
  },
  "output": {},
  "error": {
    "type": "halt"
  }
}
```

### 5.3 SMTP Node

Sends email via SMTP protocol.

**Type Identifier:** `"smtp"`

**Parameters Schema:**

```json
{
  "subject": "string",
  "body": "string",
  "to": "string",
  "from": "string",
  "cc": ["string"],
  "bcc": ["string"]
}
```

**Parameter Definitions:**

- `subject` (string, required): Email subject line
- `body` (string, required): Email body content (plain text or HTML)
- `to` (string, required): Primary recipient email address
- `from` (string, required): Sender email address
- `cc` (array, optional): Carbon copy recipients
- `bcc` (array, optional): Blind carbon copy recipients

**Credential Requirements:**

SMTP nodes REQUIRE credentials with type "SMTP" containing:

```json
{
  "port": "string",
  "host": "string",
  "username": "string",
  "password": "string"
}
```

**Example:**

```json
{
  "id": "smtp_1",
  "name": "Send Notification Email",
  "trigger": false,
  "type": "smtp",
  "parameters": {
    "subject": "Workflow Completed: {{workflow.name}}",
    "body": "The workflow has completed successfully. User: {{user.email}}",
    "to": "{{user.email}}",
    "from": "noreply@example.com",
    "cc": ["admin@example.com"],
    "bcc": []
  },
  "credentials": {
    "id": "smtp_cred_1",
    "name": "Company SMTP Server",
    "type": "smtp",
    "values": {
      "port": "587",
      "host": "smtp.example.com",
      "username": "noreply@example.com",
      "password": "encrypted_password_here"
    }
  },
  "output": {},
  "error": {
    "type": "ignore"
  }
}
```

### 5.4 Manual Trigger Node

Initiates workflow execution through manual user action.

**Type Identifier:** `"ManualTrigger"`

**Parameters Schema:**

```json
{}
```

Manual trigger nodes have no parameters. They are executed in the master service and provide initial context to the workflow.

**Example:**

```json
{
  "id": "trigger_1",
  "name": "Manual Start",
  "trigger": true,
  "type": "ManualTrigger",
  "parameters": {},
  "output": {},
  "error": {}
}
```

### 5.5 Log Node

Logs information during workflow execution (custom node type).

**Type Identifier:** `"log"`

**Parameters Schema:**

```json
{
  "message": "string",
  "level": "string"
}
```

**Parameter Definitions:**

- `message` (string, required): Message to log (supports context variables)
- `level` (string, optional): Log level (debug, info, warn, error)

**Example:**

```json
{
  "id": "log_1",
  "name": "Log Request",
  "trigger": false,
  "type": "log",
  "parameters": {
    "message": "Processing request for user: {{user.id}}",
    "level": "info"
  },
  "output": {},
  "error": {
    "type": "ignore"
  }
}
```

---

## 6. Credential Management

### 6.1 Credential Object Structure

Credentials are embedded directly within each node that requires them. The master service resolves credential references and injects the complete credential data (including sensitive values) into the node before sending to the worker service.

```json
{
  "id": "string",
  "name": "string",
  "type": "string",
  "values": {}
}
```

**Field Definitions:**

- `id` (string, required): Unique credential identifier
- `name` (string, required): Human-readable credential name
- `type` (string, required): Credential type identifier (e.g., "smtp", "api_key", "oauth2", "username_password")
- `values` (object, required): Type-specific credential values (actual secrets)

**Security Model:**

- In the **master service**: Workflows store credential references (ID only), and credentials are stored separately with encrypted values
- In the **worker service**: Nodes receive complete credential objects with decrypted values for immediate use during execution
- This design ensures credentials are decrypted once by the master service and securely transmitted to workers, rather than requiring workers to perform credential resolution

### 6.2 Credential Types

#### 6.2.1 SMTP Credentials

```json
{
  "id": "smtp_cred_1",
  "name": "Company SMTP Server",
  "type": "smtp",
  "values": {
    "port": "587",
    "host": "smtp.example.com",
    "username": "user@example.com",
    "password": "secret123"
  }
}
```

#### 6.2.2 API Key Credentials

```json
{
  "id": "api_cred_1",
  "name": "External API Key",
  "type": "api_key",
  "values": {
    "key": "sk_live_abcd1234",
    "header_name": "X-API-Key"
  }
}
```

#### 6.2.3 OAuth2 Credentials

```json
{
  "id": "oauth_cred_1",
  "name": "Google OAuth",
  "type": "oauth2",
  "values": {
    "client_id": "client123",
    "client_secret": "secret456",
    "access_token": "token789",
    "refresh_token": "refresh123",
    "expires_at": "2025-12-31T23:59:59Z"
  }
}
```

#### 6.2.4 Username/Password Credentials

```json
{
  "id": "basic_cred_1",
  "name": "Database Credentials",
  "type": "username_password",
  "values": {
    "username": "user",
    "password": "pass"
  }
}
```

### 6.3 Security Requirements

- Credential values MUST be encrypted at rest in the master service database
- Credentials MUST be decrypted by the master service before sending to workers
- Credential transmission MUST use TLS 1.2 or higher (e.g., via secure RabbitMQ connections)
- Workers MUST NOT persist credential values to disk after node execution
- Workers SHOULD clear credential values from memory after use
- Credentials in logs or error messages MUST be redacted

---

## 7. Error Handling

### 7.1 Error Handling Types

Each node can specify how errors should be handled:

```json
{
  "type": "string",
  "error_edge": "string"
}
```

**Type Values:**

1. **halt**: Stop workflow execution immediately (default)
2. **ignore**: Continue to next node, ignoring the error
3. **branch**: Follow a specific error edge to alternative flow

### 7.2 Halt Behavior

```json
{
  "error": {
    "type": "halt"
  }
}
```

- Workflow execution stops immediately
- Error is reported to user
- No subsequent nodes are executed

### 7.3 Ignore Behavior

```json
{
  "error": {
    "type": "ignore"
  }
}
```

- Error is logged but not propagated
- Execution continues to next node
- Node output is empty or contains error information

### 7.4 Branch Behavior

```json
{
  "error": {
    "type": "branch",
    "error_edge": "edge_error_handler"
  }
}
```

- Execution follows the specified error edge
- Allows for error recovery workflows
- Error context is available to subsequent nodes

**Requirements:**

- The `error_edge` MUST reference a valid edge ID
- The destination node receives error information in context

---

## 8. Edge Semantics

### 8.1 Edge Purpose

Edges define the directed connections between nodes, establishing the execution flow through the workflow graph. The worker service uses edges to determine which node(s) to execute next after completing the current node.

### 8.2 Edge Routing

- **Sequential Execution**: Most nodes have a single outgoing edge to the next node
- **Conditional Routing**: Conditional nodes specify which edge to follow via `true_edge_id` or `false_edge_id` in their parameters
- **Error Routing**: Nodes with error handling type "branch" specify which edge to follow via `error_edge` in their error configuration

### 8.3 Edge Validation

- No dangling edges (both src and dst must exist)
- No self-loops (src cannot equal dst)
- No cycles in the complete graph
- Conditional nodes MUST have exactly two outgoing edges (referenced in `true_edge_id` and `false_edge_id`)
- Error edges MUST be referenced in a node's `error.error_edge` field

---

## 9. Validation Rules

### 9.1 Structural Validation

- [ ] At least one trigger node exists
- [ ] All node IDs are unique
- [ ] All edge IDs are unique
- [ ] All edge src/dst references exist
- [ ] No cycles in the directed graph
- [ ] All credential references are valid

### 9.2 Node-Specific Validation

#### HTTP Node

- [ ] `method` is a valid HTTP verb
- [ ] `url` is a valid URL or template
- [ ] `retry` is a non-negative integer string
- [ ] `retry_delay` is a non-negative integer string
- [ ] `timeout` is a positive integer string

#### Conditional Node

- [ ] `expression` array is non-empty
- [ ] `operator` is "and" or "or"
- [ ] `true_edge_id` references a valid edge
- [ ] `false_edge_id` references a valid edge
- [ ] Expression operators are valid

#### SMTP Node

- [ ] `to` is a valid email address
- [ ] `from` is a valid email address
- [ ] `cc` and `bcc` contain valid email addresses
- [ ] Credentials of type "SMTP" are provided

### 9.3 Error Handling Validation

- [ ] Error type is one of: "halt", "ignore", "branch"
- [ ] If type is "branch", `error_edge` is provided
- [ ] Error edge references a valid edge ID

---

## 10. Complete Examples

### 10.1 Simple HTTP to Email Workflow

```json
{
  "workflow_id": "workflow_001",
  "execution_id": "exec_20251010_001",
  "nodes": [
    {
      "id": "trigger_1",
      "name": "Manual Trigger",
      "trigger": true,
      "type": "ManualTrigger",
      "parameters": {},
      "output": {},
      "error": {}
    },
    {
      "id": "http_1",
      "name": "Check API Health",
      "trigger": false,
      "type": "http",
      "parameters": {
        "method": "GET",
        "url": "https://api.example.com/health",
        "headers": {
          "Accept": "application/json"
        },
        "retry": "3",
        "retry_delay": "5",
        "timeout": "10",
        "raise_on_status": "4xx or 5xx",
        "ignore_ssl": false
      },
      "output": {},
      "error": {
        "type": "branch",
        "error_edge": "edge_error"
      }
    },
    {
      "id": "smtp_success",
      "name": "Send Success Email",
      "trigger": false,
      "type": "smtp",
      "parameters": {
        "subject": "API Health Check: Success",
        "body": "API is healthy. Status: {{http_1.status_code}}",
        "to": "admin@example.com",
        "from": "noreply@example.com",
        "cc": [],
        "bcc": []
      },
      "credentials": {
        "id": "smtp_cred_1",
        "name": "Company SMTP",
        "type": "smtp",
        "values": {
          "port": "587",
          "host": "smtp.example.com",
          "username": "noreply@example.com",
          "password": "smtp_password_123"
        }
      },
      "output": {},
      "error": {
        "type": "ignore"
      }
    },
    {
      "id": "smtp_failure",
      "name": "Send Failure Email",
      "trigger": false,
      "type": "smtp",
      "parameters": {
        "subject": "API Health Check: FAILED",
        "body": "API check failed. Error: {{http_1.error}}",
        "to": "admin@example.com",
        "from": "noreply@example.com",
        "cc": ["oncall@example.com"],
        "bcc": []
      },
      "credentials": {
        "id": "smtp_cred_1",
        "name": "Company SMTP",
        "type": "smtp",
        "values": {
          "port": "587",
          "host": "smtp.example.com",
          "username": "noreply@example.com",
          "password": "smtp_password_123"
        }
      },
      "output": {},
      "error": {
        "type": "ignore"
      }
    }
  ],
  "edges": [
    {
      "id": "edge_1",
      "src": "trigger_1",
      "dst": "http_1"
    },
    {
      "id": "edge_success",
      "src": "http_1",
      "dst": "smtp_success"
    },
    {
      "id": "edge_error",
      "src": "http_1",
      "dst": "smtp_failure"
    }
  ]
}
```

### 10.2 Conditional Branching Workflow

```json
{
  "workflow_id": "workflow_002",
  "execution_id": "exec_20251010_002",
  "nodes": [
    {
      "id": "trigger_1",
      "name": "New User Trigger",
      "trigger": true,
      "type": "ManualTrigger",
      "parameters": {},
      "output": {},
      "error": {}
    },
    {
      "id": "http_1",
      "name": "Fetch User Details",
      "trigger": false,
      "type": "http",
      "parameters": {
        "method": "GET",
        "url": "https://api.example.com/users/{{user_id}}",
        "headers": {
          "Authorization": "Bearer {{api_token}}"
        },
        "timeout": "30"
      },
      "credentials": {
        "id": "api_cred_1",
        "name": "API Key",
        "type": "api_key",
        "values": {
          "key": "sk_live_abc123",
          "header_name": "Authorization"
        }
      },
      "output": {},
      "error": {
        "type": "halt"
      }
    },
    {
      "id": "conditional_1",
      "name": "Check User Type",
      "trigger": false,
      "type": "conditional",
      "parameters": {
        "expression": [
          {
            "op1": "{{http_1.response.user.type}}",
            "op2": "premium",
            "operator": "eq"
          }
        ],
        "operator": "and",
        "true_edge_id": "edge_premium",
        "false_edge_id": "edge_standard"
      },
      "output": {},
      "error": {
        "type": "halt"
      }
    },
    {
      "id": "smtp_premium",
      "name": "Send Premium Welcome",
      "trigger": false,
      "type": "smtp",
      "parameters": {
        "subject": "Welcome to Premium!",
        "body": "Welcome {{http_1.response.user.name}}! Enjoy premium features.",
        "to": "{{http_1.response.user.email}}",
        "from": "premium@example.com",
        "cc": [],
        "bcc": []
      },
      "credentials": {
        "id": "smtp_cred_1",
        "name": "SMTP",
        "type": "smtp",
        "values": {
          "port": "587",
          "host": "smtp.example.com",
          "username": "system@example.com",
          "password": "smtp_pass_456"
        }
      },
      "output": {},
      "error": {
        "type": "ignore"
      }
    },
    {
      "id": "smtp_standard",
      "name": "Send Standard Welcome",
      "trigger": false,
      "type": "smtp",
      "parameters": {
        "subject": "Welcome!",
        "body": "Welcome {{http_1.response.user.name}}!",
        "to": "{{http_1.response.user.email}}",
        "from": "welcome@example.com",
        "cc": [],
        "bcc": []
      },
      "credentials": {
        "id": "smtp_cred_1",
        "name": "SMTP",
        "type": "smtp",
        "values": {
          "port": "587",
          "host": "smtp.example.com",
          "username": "system@example.com",
          "password": "smtp_pass_456"
        }
      },
      "output": {},
      "error": {
        "type": "ignore"
      }
    }
  ],
  "edges": [
    {
      "id": "edge_1",
      "src": "trigger_1",
      "dst": "http_1"
    },
    {
      "id": "edge_2",
      "src": "http_1",
      "dst": "conditional_1"
    },
    {
      "id": "edge_premium",
      "src": "conditional_1",
      "dst": "smtp_premium"
    },
    {
      "id": "edge_standard",
      "src": "conditional_1",
      "dst": "smtp_standard"
    }
  ]
}
```

### 10.3 Multi-Step API Integration with Logging

```json
{
  "workflow_id": "workflow_003",
  "execution_id": "exec_20251010_003",
  "nodes": [
    {
      "id": "trigger_1",
      "name": "Scheduled Trigger",
      "trigger": true,
      "type": "ManualTrigger",
      "parameters": {},
      "output": {},
      "error": {}
    },
    {
      "id": "log_1",
      "name": "Log Start",
      "trigger": false,
      "type": "log",
      "parameters": {
        "message": "Starting data sync pipeline",
        "level": "info"
      },
      "output": {},
      "error": {
        "type": "ignore"
      }
    },
    {
      "id": "http_fetch",
      "name": "Fetch Source Data",
      "trigger": false,
      "type": "http",
      "parameters": {
        "method": "GET",
        "url": "https://source-api.example.com/data",
        "headers": {
          "X-API-Key": "{{source_api_key}}"
        },
        "query": {
          "limit": "100",
          "offset": "0"
        },
        "retry": "3",
        "retry_delay": "10",
        "timeout": "60"
      },
      "output": {},
      "error": {
        "type": "branch",
        "error_edge": "edge_fetch_error"
      }
    },
    {
      "id": "log_2",
      "name": "Log Fetch Success",
      "trigger": false,
      "type": "log",
      "parameters": {
        "message": "Fetched {{http_fetch.response.count}} records",
        "level": "info"
      },
      "output": {},
      "error": {
        "type": "ignore"
      }
    },
    {
      "id": "http_post",
      "name": "Post to Destination",
      "trigger": false,
      "type": "http",
      "parameters": {
        "method": "POST",
        "url": "https://dest-api.example.com/data",
        "headers": {
          "Authorization": "Bearer {{dest_api_token}}",
          "Content-Type": "application/json"
        },
        "body": "{{http_fetch.response.data}}",
        "retry": "2",
        "retry_delay": "5",
        "timeout": "30"
      },
      "output": {},
      "error": {
        "type": "branch",
        "error_edge": "edge_post_error"
      }
    },
    {
      "id": "log_3",
      "name": "Log Success",
      "trigger": false,
      "type": "log",
      "parameters": {
        "message": "Data sync completed successfully",
        "level": "info"
      },
      "output": {},
      "error": {
        "type": "ignore"
      }
    },
    {
      "id": "log_error",
      "name": "Log Error",
      "trigger": false,
      "type": "log",
      "parameters": {
        "message": "Data sync failed: {{error.message}}",
        "level": "error"
      },
      "output": {},
      "error": {
        "type": "ignore"
      }
    }
  ],
  "edges": [
    {
      "id": "edge_1",
      "src": "trigger_1",
      "dst": "log_1"
    },
    {
      "id": "edge_2",
      "src": "log_1",
      "dst": "http_fetch"
    },
    {
      "id": "edge_3",
      "src": "http_fetch",
      "dst": "log_2"
    },
    {
      "id": "edge_4",
      "src": "log_2",
      "dst": "http_post"
    },
    {
      "id": "edge_5",
      "src": "http_post",
      "dst": "log_3"
    },
    {
      "id": "edge_fetch_error",
      "src": "http_fetch",
      "dst": "log_error"
    },
    {
      "id": "edge_post_error",
      "src": "http_post",
      "dst": "log_error"
    }
  ]
}
```

---

## 11. Security Considerations

### 11.1 Credential Protection

- Credentials MUST be encrypted at rest using industry-standard encryption (AES-256)
- Credential values MUST NOT appear in logs or error messages
- Credential transmission MUST use TLS 1.2 or higher
- Credentials MUST be scoped to specific workflows or organizations

### 11.2 Input Validation

- All URL parameters MUST be validated and sanitized
- Template variable substitution MUST prevent injection attacks
- Node parameters MUST be validated against schema before execution
- File paths and system commands MUST NOT be allowed in node parameters

### 11.3 Output Sanitization

- Sensitive data in node outputs SHOULD be masked in logs
- Error messages MUST NOT expose internal system details
- Node outputs SHOULD have size limits to prevent memory exhaustion

### 11.4 Access Control

- Workflow definitions MUST be associated with user/organization
- Credential access MUST be authorized per workflow
- Workflow execution MUST validate user permissions

### 11.5 Rate Limiting

- HTTP nodes SHOULD respect rate limiting headers
- Workflow execution SHOULD have resource limits
- Retry logic MUST include backoff to prevent API abuse

---

## 12. Future Extensions

### 12.1 Planned Node Types

- **Database Node**: Execute SQL queries
- **Transform Node**: Data transformation and mapping
- **Webhook Node**: HTTP webhook triggers
- **Schedule Node**: Cron-based scheduling
- **Loop Node**: Iterate over arrays
- **Wait Node**: Delay execution

### 12.2 Advanced Features

- **Parallel Execution**: Execute independent branches concurrently
- **Subworkflows**: Call workflows from within workflows
- **Dynamic Node Generation**: Create nodes at runtime
- **Versioning**: Workflow version control and rollback

### 12.3 Expression Language

- **Template Engine**: More powerful variable substitution
- **Functions**: Built-in functions for data manipulation
- **Filters**: Data filtering and transformation

---

## 13. References

### 13.1 Related RFCs

- RFC-001: Recursive Node-by-Node Workflow Executor

### 13.2 Standards

- RFC 2119: Key words for use in RFCs to Indicate Requirement Levels
- JSON Schema: https://json-schema.org/
- HTTP/1.1: RFC 7231
- SMTP: RFC 5321

### 13.3 External References

- Node-RED: https://nodered.org/ (inspiration for node-based flows)
- n8n: https://n8n.io/ (workflow automation reference)
- Temporal: https://temporal.io/ (workflow orchestration patterns)

---

## Appendix A: JSON Schema

A complete JSON Schema definition for workflow validation:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["workflow_id", "execution_id", "nodes", "edges"],
  "properties": {
    "workflow_id": {
      "type": "string",
      "minLength": 1
    },
    "execution_id": {
      "type": "string",
      "minLength": 1
    },
    "nodes": {
      "type": "array",
      "minItems": 1,
      "items": {
        "$ref": "#/definitions/node"
      }
    },
    "edges": {
      "type": "array",
      "items": {
        "$ref": "#/definitions/edge"
      }
    }
  },
  "definitions": {
    "node": {
      "type": "object",
      "required": ["id", "name", "trigger", "type", "parameters", "output"],
      "properties": {
        "id": {
          "type": "string"
        },
        "name": {
          "type": "string"
        },
        "trigger": {
          "type": "boolean"
        },
        "type": {
          "type": "string",
          "enum": ["http", "smtp", "conditional", "ManualTrigger", "log"]
        },
        "parameters": {
          "type": "object"
        },
        "credentials": {
          "type": "object",
          "required": ["id", "name", "type", "values"],
          "properties": {
            "id": {"type": "string"},
            "name": {"type": "string"},
            "type": {"type": "string"},
            "values": {"type": "object"}
          }
        },
        "output": {
          "type": "object"
        },
        "error": {
          "type": "object",
          "properties": {
            "type": {
              "type": "string",
              "enum": ["halt", "ignore", "branch"]
            },
            "error_edge": {
              "type": "string"
            }
          }
        }
      }
    },
    "edge": {
      "type": "object",
      "required": ["id", "src", "dst"],
      "properties": {
        "id": {
          "type": "string"
        },
        "src": {
          "type": "string"
        },
        "dst": {
          "type": "string"
        }
      }
    }
  }
}
```

---

## Appendix B: Changelog

| Date       | Version | Changes                           |
|------------|---------|-----------------------------------|
| 2025-10-10 | 1.0     | Initial draft                     |

---

**End of RFC-002**
