# DSL Architecture Proposal: Type-Safe Node Classes

## Current Architecture

**Current approach:**
```python
class Node(BaseModel):
    type: str  # Manual, "http", "smtp", etc.
    parameters: dict[str, Any]  # Generic dict
    credentials: Optional[Credential]

# Usage:
node = Node(
    id="...",
    type="http",  # Manual type setting
    parameters={"url": "...", "method": "GET"},  # No type safety
    credentials=Credential(...)
)
```

**Problems:**
- No type safety for `parameters` (could be any dict)
- Must manually set `type` field
- No IDE autocomplete for `node.parameters.url`
- Credential type not enforced at type level

## Proposed Architecture

**Inheritance-based with discriminated unions:**

```python
# Base class
class BaseNode(BaseModel):
    id: str
    name: str
    trigger: bool
    output: dict[str, Any] = Field(default_factory=dict)
    error: Optional[ErrorHandling] = None

# Specific node classes
class HttpNode(BaseNode):
    type: Literal["http"] = "http"  # Automatically set
    parameters: HttpParameters  # Typed!
    credentials: Optional[HttpCredential] = None  # Type-specific credential

class SmtpNode(BaseNode):
    type: Literal["smtp"] = "smtp"
    parameters: SmtpParameters
    credentials: Optional[SmtpCredential] = None

# Union type for all nodes
Node = Union[
    ManualTriggerNode,
    HttpNode,
    SmtpNode,
    ConditionalNode,
    SwitchNode,
    LogNode,
    AgentNode,
    WaitNode,
    EditNode,
    SplitNode,
    AggregatorNode,
    MergeNode,
]

# Or use Pydantic discriminated union
class Workflow(BaseModel):
    nodes: list[Node] = Field(..., discriminator="type")
```

**Usage:**
```python
# Type-safe construction
http_node = HttpNode(
    id="node_1",
    name="Fetch API",
    trigger=False,
    parameters=HttpParameters(
        url="https://api.example.com",
        method="GET"
    ),
    credentials=HttpCredential(...)  # Type-checked!
)

# Type-safe access
url = http_node.parameters.url  # IDE autocomplete works!
method = http_node.parameters.method  # Type-checked!

# Validation
valid, errors = http_node.sanitize()  # Validates HttpParameters too
```

## Benefits

1. **Type Safety**
   - `HttpNode.parameters` is `HttpParameters`, not `dict`
   - Compile-time type checking
   - IDE autocomplete for all fields

2. **Automatic Type Setting**
   - No need to manually set `type="http"`
   - Impossible to create `HttpNode` with wrong type

3. **Credential Type Safety**
   - `HttpNode.credentials` can only be `HttpCredential` or compatible types
   - Prevents assigning SMTP credentials to HTTP node

4. **Better Validation**
   - Each node type can have custom validation
   - Parameters validated at construction time
   - Can chain validation: `node.sanitize()` → `parameters.sanitize()`

5. **Cleaner API**
   ```python
   # Before:
   node = Node(type="http", parameters={"url": "..."})
   
   # After:
   node = HttpNode(parameters=HttpParameters(url="..."))
   ```

## Implementation Strategy

### Option 1: Full Inheritance (Recommended)

Generate both base class and specific classes:

```python
class BaseNode(BaseModel):
    """Base node with common fields."""
    id: str
    name: str
    trigger: bool
    output: dict[str, Any] = Field(default_factory=dict)
    error: Optional[ErrorHandling] = None
    
    def base_sanitize(self) -> tuple[bool, list[str]]:
        """Validate base fields."""
        errors = []
        if not self.id:
            errors.append("Node.id is required")
        # ... other base validations
        return len(errors) == 0, errors

class HttpNode(BaseNode):
    """HTTP request node."""
    type: Literal["http"] = "http"
    parameters: HttpParameters
    credentials: Optional[Credential] = None  # Can be more specific
    
    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate HTTP node including parameters."""
        valid, errors = self.base_sanitize()
        if not valid:
            return False, errors
        
        # Validate parameters
        params_valid, params_errors = self.parameters.sanitize()
        errors.extend(params_errors)
        
        return len(errors) == 0, errors
```

### Option 2: Discriminated Union (Pydantic v2)

Use Pydantic's discriminated union for automatic deserialization:

```python
class Workflow(BaseModel):
    nodes: list[Annotated[
        Union[HttpNode, SmtpNode, ...],
        Field(discriminator="type")
    ]]
```

This allows automatic type selection when deserializing JSON:
```python
# JSON: {"type": "http", "parameters": {...}}
# Automatically creates HttpNode instance
```

## Migration Path

1. **Phase 1**: Generate both approaches
   - Keep `Node` class for backward compatibility
   - Add specific node classes (`HttpNode`, `SmtpNode`, etc.)
   - Add `Node` as Union type

2. **Phase 2**: Update codebase
   - Update API endpoints to use specific node classes
   - Update validation logic
   - Update serialization

3. **Phase 3**: Remove generic `Node` class
   - Fully migrate to typed node classes
   - Remove `dict[str, Any]` parameters

## Considerations

### JSON Serialization

Pydantic handles this automatically:
```python
# Serialization
json_str = http_node.model_dump_json()
# {"type": "http", "parameters": {...}, ...}

# Deserialization (with discriminated union)
node = HttpNode.model_validate_json(json_str)
```

### Backward Compatibility

Can support both during migration:
```python
# Old way still works
node = Node(type="http", parameters={...})

# New way preferred
node = HttpNode(parameters=HttpParameters(...))
```

### Type Checking

With Union types:
```python
def process_node(node: Node):
    if isinstance(node, HttpNode):
        # Type checker knows node.parameters is HttpParameters
        url = node.parameters.url
    elif isinstance(node, SmtpNode):
        # Type checker knows node.parameters is SmtpParameters
        to = node.parameters.to
```

## Recommendation

**Implement Option 1 (Full Inheritance)** because:

1. ✅ Maximum type safety
2. ✅ Best IDE support
3. ✅ Clear, explicit API
4. ✅ Easy to extend with custom validation
5. ✅ Works with all Python type checkers (mypy, pyright, etc.)

The generator can create:
- `BaseNode` class with common fields
- Specific node classes (`HttpNode`, `SmtpNode`, etc.)
- Union type `Node = Union[HttpNode, SmtpNode, ...]`
- Discriminated union for `Workflow.nodes`

This gives the best of both worlds: type safety and JSON compatibility.

