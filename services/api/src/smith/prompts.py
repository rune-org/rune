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
            "(ALL THREE FIELDS REQUIRED)",
        },
        "outputs": ["case 1", "case 2", "...", "fallback"],
        "edge_note": "Rule at index 0 maps to 'case 1', index 1 to 'case 2', etc. Use 'fallback' for default/else.",
    },
}

SMITH_GREETING = """Hello! I'm Smith - I help you build workflows.

Describe what you want to automate and I'll create it.

Examples:
- "Fetch data from an API and email me the results"
- "Check if a site is up, alert me if it's down"

What would you like to build?"""
