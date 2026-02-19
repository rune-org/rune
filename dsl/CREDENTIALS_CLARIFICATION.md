# Credentials Architecture Clarification

## Current Credential Structure

**Single `Credential` class:**
```python
class Credential(BaseModel):
    id: str
    name: str
    type: Literal["api_key", "oauth2", "basic_auth", "header", "token", "custom", "smtp"]
    values: dict[str, Any]  # Type-specific values (e.g., {"key": "...", "header_name": "..."})
```

**Node has:**
```python
class Node(BaseModel):
    ...
    credentials: Optional[Credential] = None  # The actual credential object
```

## What You Want

**Node should have `credential_type` field:**
```python
class HttpNode(BaseNode):
    type: Literal["http"] = "http"
    parameters: HttpParameters
    credential_type: Optional[str] = "api_key"  # For UI filtering!
    credentials: Optional[Credential] = None  # The actual credential object
```

**NOT separate credential classes** like `HttpCredential` - that was my mistake in the proposal!

## The `credential_type` Field Purpose

The `credential_type` field is **metadata for UI filtering**, not a separate class:

1. **UI Filtering**: When user selects credentials for an HTTP node, UI shows only credentials where `credential.type` matches one of the allowed types for HTTP nodes
2. **Type Safety**: Ensures you can't assign SMTP credentials to an HTTP node
3. **Automatic**: Set automatically based on node type (no manual setting needed)

## Example

```python
# HTTP node can use multiple credential types
class HttpNode(BaseNode):
    type: Literal["http"] = "http"
    credential_type: Optional[list[str]] = ["api_key", "oauth2", "basic_auth", "header", "token"]
    credentials: Optional[Credential] = None

# SMTP node only uses SMTP credentials
class SmtpNode(BaseNode):
    type: Literal["smtp"] = "smtp"
    credential_type: Optional[list[str]] = ["smtp"]
    credentials: Optional[Credential] = None

# Conditional node doesn't need credentials
class ConditionalNode(BaseNode):
    type: Literal["conditional"] = "conditional"
    credential_type: Optional[list[str]] = None
    credentials: Optional[Credential] = None
```

## Usage

```python
# Create HTTP node
http_node = HttpNode(
    id="node_1",
    name="Fetch API",
    parameters=HttpParameters(url="...", method="GET"),
    credentials=Credential(
        id="cred_1",
        name="API Key",
        type="api_key",  # Must match one of HttpNode.credential_type values
        values={"key": "...", "header_name": "X-API-Key"}
    )
)

# UI filtering logic:
def get_compatible_credentials(node: Node, all_credentials: list[Credential]) -> list[Credential]:
    if node.credential_type is None:
        return []
    return [c for c in all_credentials if c.type in node.credential_type]
```

## Answer to Your Questions

### Q1: Python only or all three services?

**Answer: All three services!**

The inheritance-based architecture can work for:
- **Python**: Full inheritance with Pydantic (best support)
- **TypeScript**: Union types with discriminated unions
- **Go**: Interfaces + type assertions (more limited, but possible)

However, the **benefits are greatest in Python** because:
- Pydantic has excellent discriminated union support
- Type checking is most powerful in Python
- The backend API is where this matters most

For TypeScript and Go, we can:
- **TypeScript**: Use union types and type guards
- **Go**: Use interfaces and type switches (less type-safe, but still useful)

### Q2: Credentials clarification

**Current (what I mistakenly proposed):**
```python
class HttpCredential(Credential):  # ❌ WRONG - separate class
    ...
```

**What you want (correct):**
```python
class HttpNode(BaseNode):
    credential_type: Optional[list[str]] = ["api_key", "oauth2", ...]  # ✅ Metadata for filtering
    credentials: Optional[Credential] = None  # ✅ The actual credential object
```

The `credential_type` is just a **list of allowed credential types** for that node, used for:
- UI filtering (show only compatible credentials)
- Validation (ensure credential.type matches one of the allowed types)

## Updated Architecture

```python
# Base node with credential_type metadata
class BaseNode(BaseModel):
    id: str
    name: str
    trigger: bool
    output: dict[str, Any] = Field(default_factory=dict)
    error: Optional[ErrorHandling] = None
    credential_type: Optional[list[str]] = None  # Metadata for UI filtering
    credentials: Optional[Credential] = None  # Actual credential object

# Specific nodes set credential_type automatically
class HttpNode(BaseNode):
    type: Literal["http"] = "http"
    parameters: HttpParameters
    credential_type: Optional[list[str]] = ["api_key", "oauth2", "basic_auth", "header", "token"]
    
class SmtpNode(BaseNode):
    type: Literal["smtp"] = "smtp"
    parameters: SmtpParameters
    credential_type: Optional[list[str]] = ["smtp"]
    
class ConditionalNode(BaseNode):
    type: Literal["conditional"] = "conditional"
    parameters: ConditionalParameters
    credential_type: Optional[list[str]] = None  # No credentials needed
```

This way:
- ✅ `credential_type` is automatically set based on node type
- ✅ UI can filter credentials using `node.credential_type`
- ✅ Still uses single `Credential` class (no separate classes)
- ✅ Type-safe parameter access (`node.parameters.url`)

