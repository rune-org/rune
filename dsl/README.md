# DSL Code Generator

This directory contains the DSL (Domain-Specific Language) definition and code generator for the Rune workflow system.

## Overview

The DSL generator creates strongly-typed definitions for three languages:
- **TypeScript** (`dsl/generated/types.ts`)
- **Python** (`dsl/generated/types.py`)
- **Go** (`dsl/generated/types.go`)

Each generated file contains:
- Core structures (Workflow, Node, Edge, Credential, ErrorHandling)
- Node-specific parameter types (HttpParameters, SmtpParameters, etc.)
- Nested types (SwitchRule, EditAssignment)
- Sanitization/validation methods for each class/struct
- Credential type constants for each node type

## Directory Structure

```
dsl/
├── dsl-definition.json    # Type-aware JSON DSL definition (source of truth)
├── generator/
│   └── generate.py       # Generator script
├── generated/            # Generated files (DO NOT EDIT)
│   ├── types.ts          # TypeScript definitions
│   ├── types.py          # Python definitions
│   └── types.go          # Go definitions
└── README.md             # This file
```

## DSL Definition Format

The `dsl-definition.json` file uses a type-aware format where every field explicitly declares its data type:

```json
{
  "field_name": {
    "type": "string",
    "required": true,
    "description": "Field description",
    "enum": ["value1", "value2"]  // Optional: for enum types
  }
}
```

### Supported Types

- `string` - Text data
- `number` - Numeric data
- `boolean` - True/false values
- `object` - Key-value pairs
- `array` - Lists (requires `items_type` to specify element type)
- `any` - Any type

### Array Types

Arrays must specify the type of their elements using `items_type`:

```json
{
  "nodes": {
    "type": "array",
    "items_type": "Node",
    "required": true
  }
}
```

## Generating Code

Run the generator script:

```bash
python3 dsl/generator/generate.py
```

Or use the Makefile target:

```bash
make dsl-generate
```

## Generated Files

### TypeScript (`types.ts`)

- Interfaces for all structures
- Type unions for enums
- Sanitization functions that return `{ valid: boolean; errors: string[] }`
- Credential type constants

### Python (`types.py`)

- Pydantic `BaseModel` classes
- Type hints using `typing` module
- `sanitize()` methods that return `(bool, list[str])`
- Credential type constants

### Go (`types.go`)

- Struct definitions with JSON tags
- Exported field names (capitalized)
- `Sanitize()` methods that return `(bool, []string)`
- Credential type constants

## Credential Types

Each node type has an associated credential type (or `null` if it doesn't require credentials):

- **HTTP nodes**: Can use `api_key`, `oauth2`, `basic_auth`, `header`, or `token`
- **SMTP nodes**: Require `smtp` credentials
- **Other nodes**: No credentials required (`null`)

This allows the UI to filter credentials by type when selecting credentials for a node.

## Adding New Node Types

1. Add the node type to `dsl-definition.json` under `node_types`:
   ```json
   {
     "my_node": {
       "description": "My custom node",
       "credential_type": ["api_key"] or null,
       "parameters": {
         "param1": {
           "type": "string",
           "required": true,
           "description": "Parameter description"
         }
       }
     }
   }
   ```

2. Run the generator:
   ```bash
   python3 dsl/generator/generate.py
   ```

3. The generator will automatically create:
   - Parameter class/struct (e.g., `MyNodeParameters`)
   - Sanitization method
   - Credential type constant

## Type Safety

All generated code is strongly typed:

- **TypeScript**: Full type checking with interfaces and type unions
- **Python**: Type hints compatible with Pydantic and mypy
- **Go**: Strong typing with struct definitions

## Sanitization

Each generated class/struct includes a sanitization method that:

1. **Validates required fields**: Checks that all required fields are present
2. **Type checks**: Verifies that values match their declared types
3. **Returns validation results**: Provides a list of errors if validation fails

Example usage:

**TypeScript:**
```typescript
const result = sanitizeNode(node);
if (!result.valid) {
  console.error(result.errors);
}
```

**Python:**
```python
valid, errors = node.sanitize()
if not valid:
    print(errors)
```

**Go:**
```go
valid, errors := node.Sanitize()
if !valid {
    log.Println(errors)
}
```

## Notes

- **DO NOT EDIT** generated files directly - they will be overwritten
- Always update `dsl-definition.json` and regenerate
- The generator preserves JSON field names in Go structs using JSON tags
- Go field names are capitalized for export (e.g., `workflow_id` → `WorkflowId`)


