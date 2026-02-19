# Credential Type - How It Works

## Your Understanding (Correct!)

✅ **Credential class**: Stores the actual credential object that gets assigned to a node
✅ **credential_type field**: Metadata on the node that tells us what types of credentials this node can accept (for UI filtering)
✅ **When picking a credential**: The selected credential object gets stored in the `credentials` field

## The Syntax Explained

When I wrote:
```python
class SmtpNode(BaseNode):
    credential_type: Optional[list[str]] = ["smtp"]
```

This is **both type checking AND automatic setting**! Let me break it down:

### Python Type Annotation Syntax

```python
credential_type: Optional[list[str]] = ["smtp"]
#              ↑                    ↑
#              |                    |
#         Type hint          Default value
```

- `Optional[list[str]]` = Type hint (tells Python/type checker this field can be `None` or a list of strings)
- `= ["smtp"]` = **Default value** (automatically sets this when creating the object)

## How "Automatic Setting" Works

### 1. At Class Definition (Code Generation)

When the generator creates the class, it reads from `dsl-definition.json`:

```json
{
  "smtp": {
    "credential_type": ["smtp"],
    ...
  }
}
```

And generates:
```python
class SmtpNode(BaseNode):
    credential_type: Optional[list[str]] = ["smtp"]  # ← Default from DSL
```

### 2. When Creating Objects (Runtime)

**Option A: Don't specify credential_type (uses default)**
```python
node = SmtpNode(
    id="node_1",
    name="Send Email",
    parameters=SmtpParameters(...)
    # credential_type not specified → automatically uses ["smtp"]
)

print(node.credential_type)  # Output: ["smtp"] ✅
```

**Option B: Explicitly specify (overrides default)**
```python
node = SmtpNode(
    id="node_1",
    name="Send Email",
    parameters=SmtpParameters(...),
    credential_type=["smtp", "custom"]  # Override default
)

print(node.credential_type)  # Output: ["smtp", "custom"] ✅
```

### 3. When Loading from JSON (Deserialization)

**If JSON has credential_type:**
```json
{
  "type": "smtp",
  "credential_type": ["smtp", "custom"],
  "parameters": {...}
}
```
→ Pydantic uses the JSON value: `["smtp", "custom"]`

**If JSON doesn't have credential_type:**
```json
{
  "type": "smtp",
  "parameters": {...}
}
```
→ Pydantic uses the default: `["smtp"]` ✅

## Complete Example

```python
# Generated code (from DSL definition)
class SmtpNode(BaseNode):
    type: Literal["smtp"] = "smtp"  # Auto-set to "smtp"
    parameters: SmtpParameters
    credential_type: Optional[list[str]] = ["smtp"]  # Auto-set to ["smtp"]
    credentials: Optional[Credential] = None  # No credential by default

# Usage in your code
# 1. Create node (credential_type automatically set to ["smtp"])
smtp_node = SmtpNode(
    id="node_1",
    name="Send Email",
    parameters=SmtpParameters(
        subject="Hello",
        body="World",
        to=["user@example.com"],
        from_="sender@example.com"
    )
    # credential_type automatically = ["smtp"] ✅
)

# 2. UI filtering logic
def get_compatible_credentials(node: BaseNode, all_credentials: list[Credential]) -> list[Credential]:
    if node.credential_type is None:
        return []  # Node doesn't need credentials
    
    # Filter: only show credentials where credential.type matches one of the allowed types
    return [
        cred for cred in all_credentials 
        if cred.type in node.credential_type  # cred.type is "smtp", node.credential_type is ["smtp"]
    ]

# 3. User selects a credential
selected_credential = Credential(
    id="cred_1",
    name="Company SMTP",
    type="smtp",  # Must be in smtp_node.credential_type (which is ["smtp"])
    values={"host": "...", "port": "587", ...}
)

# 4. Assign credential to node
smtp_node.credentials = selected_credential  # ✅ Type matches!

# 5. Validation (optional)
if smtp_node.credentials and smtp_node.credential_type:
    if smtp_node.credentials.type not in smtp_node.credential_type:
        raise ValueError(f"Credential type {smtp_node.credentials.type} not allowed for {smtp_node.type} node")
```

## Where "Automatic Setting" Happens

### In the Generator Code

```python
# dsl/generator/generate.py
def generate_python_node_class(node_type: str, node_def: dict):
    credential_type = node_def.get('credential_type')
    
    if credential_type is None:
        default_value = "None"
    elif isinstance(credential_type, list):
        # Convert ["smtp"] to Python list syntax
        default_value = f'["{", ".join(credential_type)}"]'
    else:
        default_value = f'"{credential_type}"'
    
    # Generate:
    # credential_type: Optional[list[str]] = ["smtp"]  ← Default value set here!
    return f'    credential_type: Optional[list[str]] = {default_value}'
```

### At Runtime (Pydantic)

When you create a `SmtpNode()`:
1. Pydantic sees `credential_type` has a default value `= ["smtp"]`
2. If you don't provide `credential_type`, it uses the default
3. If you do provide it, it uses your value

## Summary

| Aspect | Explanation |
|--------|-------------|
| **Type checking** | `Optional[list[str]]` tells Python this field can be `None` or a list of strings |
| **Default value** | `= ["smtp"]` automatically sets the field to `["smtp"]` if not specified |
| **Automatic setting** | Happens when creating the object (if field not provided) or loading from JSON (if field missing) |
| **Source of truth** | The DSL definition (`dsl-definition.json`) - generator reads it and sets defaults |

So yes, the `= ["smtp"]` **does automatically set it** - it's not just type checking, it's a default value that gets used when the field isn't explicitly provided!

