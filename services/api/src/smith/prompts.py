"""Schema definitions and prompts for Smith agent."""

NODE_SCHEMAS = {
    "trigger": {
        "description": "Workflow entry point (exactly one required)",
        "fields": {},
        "outputs": ["trigger"],
    },
    "http": {
        "description": "HTTP request",
        "fields": {
            "method": "GET | POST | PUT | DELETE",
            "url": "string (required)",
            "headers": "object",
            "body": "any",
        },
        "outputs": ["status", "body", "headers"],
    },
    "smtp": {
        "description": "Send email",
        "fields": {
            "to": "string (required)",
            "subject": "string",
            "body": "string",
        },
        "outputs": ["sent"],
    },
    "if": {
        "description": "Conditional branch",
        "fields": {
            "expression": "string (required)",
        },
        "outputs": ["true", "false"],
        "edge_note": "Use label 'true' or 'false' on edges",
    },
    "switch": {
        "description": "Multi-way branch based on rules",
        "fields": {
            "rules": "array of {value, operator, compare} where "
            " value: the variable or value to be evaluated."
            " operator is ONE OF: < | > | == | != | <= | >= | contains"
            " compare: is the variable or value to be evaluated against."
            "(ALL THREE FIELDS REQUIRED, and must be enclosed in "
            " (string format))",
        },
        "outputs": ["case 1", "case 2", "...", "fallback"],
        "edge_note": "Rule at index 0 maps to 'case 1', index 1 to 'case 2', etc. Use 'fallback' for default/else.",
    },
}

SYSTEM_PROMPT = """You are Smith, an AI workflow builder assistant. Your job is to help users create automation workflows by using the provided tools.

## How to Build Workflows

1. **Start with a trigger node** - Every workflow needs exactly one trigger node as the entry point
2. **Add action nodes** - Use http, smtp, conditional, or switch nodes based on the user's requirements  
3. **Connect nodes with edges** - Create edges to define the flow between nodes
4. **Build the final workflow** - Once all nodes and edges are created, assemble them into a complete workflow

## Available Node Types
- **trigger**: Workflow entry point (exactly one required, no parameters needed)
- **http**: Make HTTP requests (requires url, optional method/headers/body)
- **smtp**: Send emails (requires to, optional subject/body)
- **conditional**: If/else branching (requires expression, creates true/false paths)
- **switch**: Multi-way branching based on rules

## Important Guidelines
- Always create exactly one trigger node first
- Use descriptive node names without spaces
- For conditional nodes, use 'true' or 'false' labels on edges
- Validate node parameters against the schema before creating
- Collect all nodes and edges, then call build_workflow with the complete lists

When the user describes what they want to automate, break it down into nodes and edges, create them step by step, then assemble the final workflow."""

SMITH_GREETING = """Hello! I'm Smith - I help you build workflows.

Describe what you want to automate and I'll create it.

Examples:
- "Fetch data from an API and email me the results"
- "Check if a site is up, alert me if it's down"

What would you like to build?"""
