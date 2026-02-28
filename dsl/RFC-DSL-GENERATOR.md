```
RFC: DSL Code Generator
Author: dopebiscuit
Status: IMPLEMENTED
Created: 2026-02-19
```

# RFC: DSL Code Generator

## Abstract

This document specifies the DSL (Domain-Specific Language) code generator for the Rune workflow system. The generator ensures type consistency across Frontend (TypeScript), Backend (Python), and Worker (Go) services by generating strongly-typed, inheritance-based code from a single source of truth (`dsl/dsl-definition.json`).

## Status of This Memo

This document specifies the DSL code generator implementation for the Rune workflow system. The generator is implemented and ready for integration into the codebase.

## Table of Contents

1. [Introduction](#1-introduction)
2. [Motivation](#2-motivation)
3. [Architecture](#3-architecture)
4. [DSL Definition Format](#4-dsl-definition-format)
5. [Generated Code Structure](#5-generated-code-structure)
6. [Inheritance-Based Design](#6-inheritance-based-design)
7. [Credential Type Filtering](#7-credential-type-filtering)
8. [Usage](#8-usage)
9. [Integration Guide](#9-integration-guide)
10. [Future Extensions](#10-future-extensions)

---

## 1. Introduction

### 1.1 Purpose

The DSL code generator provides:

- **Type Consistency**: Ensures identical type definitions across all services
- **Single Source of Truth**: All types generated from `dsl/dsl-definition.json`
- **Type Safety**: Strongly-typed node classes with IDE autocomplete support
- **Automatic Validation**: Generated sanitization methods for all types
- **Credential Filtering**: Automatic credential type metadata for UI filtering

### 1.2 Scope

This specification covers:

- DSL definition JSON format
- Generator implementation
- Generated code structure for TypeScript, Python, and Go
- Inheritance-based architecture
- Credential type filtering mechanism

This specification does NOT cover:

- Workflow execution semantics (see RFC-002)
- Node implementation details
- Service-specific integration logic

---

## 2. Motivation

### 2.1 Problem Statement

Previously, workflow DSL structures were manually maintained across three services:

- **Frontend (TypeScript)**: Manual interfaces in `workflow-dsl.ts`
- **Backend (Python)**: Manual Pydantic models in `schemas.py`
- **Worker (Go)**: Manual structs in `core/node.go`

This led to:
- **Type Drift**: Types diverged across services over time
- **Maintenance Burden**: Changes required manual updates in three places
- **Inconsistency**: Same field had different types in different services
- **No Type Safety**: Generic `dict[str, Any]` instead of typed parameters

### 2.2 Solution

A centralized code generator that:
- Reads a single JSON definition file
- Generates strongly-typed code for all three services
- Uses inheritance-based architecture for type safety
- Automatically sets node types and credential types
- Provides validation methods for all generated types

---

## 3. Architecture

### 3.1 Generator Structure

```
dsl/
├── dsl-definition.json      # Single source of truth
├── generator/
│   └── generate.py         # Generator script
├── generated/              # Generated files (DO NOT EDIT)
│   ├── types.ts            # TypeScript definitions
│   ├── types.py            # Python definitions
│   └── types.go            # Go definitions
└── README.md               # Usage documentation
```

### 3.2 Generation Flow

1. **Load DSL Definition**: Read `dsl-definition.json`
2. **Parse Structure**: Extract core structures, node types, nested types
3. **Generate Base Classes**: Create `BaseNode` with common fields
4. **Generate Specific Classes**: Create node-specific classes (HttpNode, SmtpNode, etc.)
5. **Generate Union Types**: Create union types for all nodes
6. **Generate Validation**: Create sanitization methods for all types
7. **Write Files**: Output generated code to `dsl/generated/`

---

## 4. DSL Definition Format

### 4.1 Structure

The DSL definition is a type-aware JSON file with explicit type information for every field:

```json
{
  "core_structures": {
    "Workflow": {
      "fields": {
        "workflow_id": {
          "type": "string",
          "required": true,
          "description": "..."
        }
      }
    },
    "Node": {
      "fields": {
        "id": {"type": "string", "required": true},
        "name": {"type": "string", "required": true},
        ...
      }
    }
  },
  "node_types": {
    "http": {
      "description": "HTTP request node",
      "credential_type": ["api_key", "oauth2", "basic_auth", "header", "token"],
      "parameters": {
        "url": {"type": "string", "required": true},
        "method": {"type": "string", "required": true, "enum": ["GET", "POST", ...]}
      }
    }
  }
}
```

### 4.2 Supported Types

- `string` - Text data
- `number` - Numeric data
- `boolean` - True/false values
- `object` - Key-value pairs
- `array` - Lists (requires `items_type`)
- `any` - Any type

### 4.3 Field Properties

- `type`: Data type (required)
- `required`: Whether field is required (default: false)
- `description`: Field description
- `enum`: Allowed values (for string types)
- `items_type`: Element type for arrays
- `default`: Default value

---

## 5. Generated Code Structure

### 5.1 Python (Pydantic Models)

```python
class BaseNode(BaseModel):
    """Base node class with common fields."""
    id: str
    name: str
    trigger: bool
    output: dict[str, Any] = Field(default_factory=dict)
    error: Optional[ErrorHandling] = None
    credential_type: Optional[list[str]] = None
    credentials: Optional[Credential] = None

class HttpNode(BaseNode):
    """HTTP request node"""
    type_: Literal["http"] = Field(default="http", alias="type")
    parameters: HttpParameters
    credential_type: Optional[list[str]] = ["api_key", "oauth2", "basic_auth", "header", "token"]
    
    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the node including parameters."""
        # Chains: base validation → parameters validation → credential validation

Node = Union[HttpNode, SmtpNode, ConditionalNode, ...]
```

### 5.2 TypeScript (Interfaces)

```typescript
interface BaseNode {
  id: string;
  name: string;
  trigger: boolean;
  output: Record<string, any>;
  error?: ErrorHandling;
  credential_type?: string[];
  credentials?: Credential;
}

interface HttpNode extends BaseNode {
  type: "http";
  parameters: HttpParameters;
  credential_type: ("api_key" | "oauth2" | "basic_auth" | "header" | "token")[];
}

type Node = HttpNode | SmtpNode | ConditionalNode | ...;
```

### 5.3 Go (Structs)

```go
type BaseNode struct {
  Id string `json:"id"`
  Name string `json:"name"`
  Trigger bool `json:"trigger"`
  Output map[string]interface{} `json:"output"`
  Error *ErrorHandling `json:"error,omitempty"`
  CredentialType []string `json:"credential_type,omitempty"`
  Credentials *Credential `json:"credentials,omitempty"`
}

func (n *BaseNode) Sanitize() (bool, []string) {
  // Validation logic
}
```

---

## 6. Inheritance-Based Design

### 6.1 BaseNode Class

All nodes inherit from `BaseNode`, which contains:

- **Common Fields**: `id`, `name`, `trigger`, `output`, `error`
- **Credential Fields**: `credential_type`, `credentials`
- **Base Validation**: Common field validation logic

### 6.2 Specific Node Classes

Each node type has its own class:

- **Automatic Type Setting**: `type="http"` is set automatically
- **Type-Safe Parameters**: `HttpNode.parameters` is `HttpParameters`, not `dict`
- **Automatic Credential Types**: `credential_type` set from DSL definition
- **Chained Validation**: Base → Parameters → Credential validation

### 6.3 Benefits

1. **Type Safety**: Impossible to access wrong fields
2. **IDE Support**: Full autocomplete for all fields
3. **Compile-Time Checking**: Type errors caught before runtime
4. **Automatic Validation**: Credential types validated automatically

---

## 7. Credential Type Filtering

### 7.1 Purpose

The `credential_type` field enables UI filtering of credentials based on node type.

### 7.2 Automatic Setting

Each node type has `credential_type` automatically set from DSL definition:

- **HTTP nodes**: `["api_key", "oauth2", "basic_auth", "header", "token"]`
- **SMTP nodes**: `["smtp"]`
- **Other nodes**: `None` (no credentials needed)

### 7.3 Usage

```python
def get_compatible_credentials(node: BaseNode, all_credentials: list[Credential]) -> list[Credential]:
    """Filter credentials based on node's credential_type."""
    if node.credential_type is None:
        return []
    return [c for c in all_credentials if c.type in node.credential_type]
```

### 7.4 Validation

The generated `sanitize()` method validates that assigned credentials match the node's `credential_type`:

```python
if self.credentials and self.credential_type:
    if self.credentials.type_ not in self.credential_type:
        errors.append(f"HttpNode.credentials.type must be one of {self.credential_type}")
```

---

## 8. Usage

### 8.1 Generation

```bash
# Generate all files
make dsl-generate

# Or directly
python3 dsl/generator/generate.py
```

### 8.2 Example Usage

**Python:**
```python
from dsl.generated.types import HttpNode, HttpParameters, Credential

# Type-safe construction
http_node = HttpNode(
    id="node_1",
    name="Fetch API",
    trigger=False,
    parameters=HttpParameters(
        url="https://api.example.com",
        method="GET"
    ),
    credentials=Credential(
        type="api_key",
        values={"key": "...", "header_name": "X-API-Key"}
    )
)

# Type-safe access
url = http_node.parameters.url  # ✅ IDE autocomplete works!
credential_types = http_node.credential_type  # ✅ ["api_key", "oauth2", ...]

# Validation
valid, errors = http_node.sanitize()  # ✅ Validates everything
```

**TypeScript:**
```typescript
import { HttpNode, HttpParameters } from './dsl/generated/types';

const httpNode: HttpNode = {
  id: "node_1",
  name: "Fetch API",
  type: "http",
  trigger: false,
  parameters: {
    url: "https://api.example.com",
    method: "GET"
  },
  credential_type: ["api_key", "oauth2", "basic_auth", "header", "token"]
};

// Type-safe access
const url = httpNode.parameters.url;  // ✅ Type-checked!
```

---

## 9. Integration Guide

### 9.1 Current Status

Generated files are in `dsl/generated/` and are **not yet integrated** into the codebase. They are ready for integration when services are updated.

### 9.2 Integration Steps

1. **Import Generated Types**
   ```python
   # services/api/src/smith/schemas.py
   from dsl.generated.types import HttpNode, SmtpNode, Node
   ```

2. **Replace Manual Types**
   ```python
   # Before:
   class WorkflowNode(BaseModel):
       type: str
       parameters: dict[str, Any]
   
   # After:
   # Use generated HttpNode, SmtpNode, etc.
   ```

3. **Update Validation Logic**
   ```python
   # Before:
   def validate_node(node: dict):
       if node["type"] == "http":
           # Manual validation
   
   # After:
   node = HttpNode.model_validate(node)
   valid, errors = node.sanitize()
   ```

4. **Update Type Hints**
   ```python
   # Before:
   def process_node(node: dict[str, Any]):
       ...
   
   # After:
   def process_node(node: Node):
       if isinstance(node, HttpNode):
           url = node.parameters.url  # Type-safe!
   ```

### 9.3 Migration Strategy

1. **Phase 1**: Import generated types alongside existing types
2. **Phase 2**: Update new code to use generated types
3. **Phase 3**: Migrate existing code incrementally
4. **Phase 4**: Remove manual type definitions

---

## 10. Future Extensions

### 10.1 Planned Enhancements

- **Custom Node Types**: Support for user-defined node types
- **Versioning**: DSL definition versioning and migration
- **Validation Rules**: More sophisticated validation logic
- **Code Generation**: Generate service-specific code (API routes, etc.)

### 10.2 Potential Improvements

- **Template System**: Jinja2 templates for more complex code generation
- **Type Inference**: Automatic type inference from examples
- **Documentation Generation**: Auto-generate API documentation
- **Test Generation**: Generate test cases from DSL definition

---

## References

- RFC-002: Workflow Definition DSL Specification
- Pydantic Documentation: https://docs.pydantic.dev/
- TypeScript Handbook: https://www.typescriptlang.org/docs/

