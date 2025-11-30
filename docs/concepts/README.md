# Concepts

This section covers the core concepts you need to understand to build effective workflows in Rune.

---

## 📚 In This Section

| Guide | Description |
|-------|-------------|
| [Workflows](./workflows.md) | Understanding workflow structure and execution |
| [Nodes](./nodes.md) | Working with different node types |
| [Credentials](./credentials.md) | Securely storing and using API keys |
| [Templates](./templates.md) | Creating and using reusable workflow templates |
| [Error Handling](./error-handling.md) | Handling failures gracefully |
| [Data Flow](./data-flow.md) | How data moves between nodes |

---

## Quick Overview

### What is a Workflow?

A **workflow** is an automated sequence of operations (nodes) connected together. When triggered, Rune executes each node in order, passing data from one to the next.

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│  Node 1 │────▶│  Node 2 │────▶│  Node 3 │
└─────────┘     └─────────┘     └─────────┘
     │               │               │
   Output ──────▶ Input ──────▶ Input
```

### What is a Node?

A **node** is a single operation within a workflow. Each node:
- Has a specific type (HTTP, Log, Conditional, etc.)
- Takes input parameters
- Produces output data
- Can access data from previous nodes

### What are Credentials?

**Credentials** are secure storage for sensitive data like:
- API keys
- OAuth tokens
- Database passwords
- SMTP settings

Credentials are encrypted at rest and only decrypted when a workflow runs.

### What are Templates?

**Templates** are reusable workflow patterns. You can:
- Save your workflows as templates
- Share templates with your team
- Use public templates as starting points

---

## How It All Fits Together

```
┌────────────────────────────────────────────────────────────────┐
│                        YOUR WORKFLOW                            │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌───────────┐      ┌───────────┐      ┌───────────┐         │
│   │  HTTP     │      │ Condition │      │   Log     │         │
│   │  Node     │─────▶│   Node    │─────▶│   Node    │         │
│   └─────┬─────┘      └───────────┘      └───────────┘         │
│         │                                                       │
│         │ Uses                                                  │
│         ▼                                                       │
│   ┌───────────┐                                                │
│   │Credential │  (API Key for external service)                │
│   └───────────┘                                                │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│   Can be saved as TEMPLATE for reuse                           │
└────────────────────────────────────────────────────────────────┘
```

---

## Next Steps

Start with the concept most relevant to you:

- **New to Rune?** → Start with [Workflows](./workflows.md)
- **Connecting to APIs?** → Read [Credentials](./credentials.md)
- **Building reusable patterns?** → Check [Templates](./templates.md)

---

[← Back to Docs Home](../README.md) | [Workflows →](./workflows.md)
