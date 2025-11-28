# RFC-003: Switch Node Implementation

## Summary
This RFC defines the implementation and usage of the **Switch Node** in the Rune Worker system. The Switch Node enables multi-path conditional routing within workflows, allowing execution to branch into one of several paths based on evaluated rules.

## Motivation
Complex workflows often require decision-making logic beyond simple true/false conditions. While the `conditional` node handles binary branching, a `switch` node provides a cleaner and more efficient way to handle multiple potential outcomes (e.g., routing based on status: "pending", "approved", "rejected").

## Detailed Design

### Node Type
The node type identifier is `switch`.

### Parameters
The Switch Node accepts the following parameters:

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `rules` | `[]Rule` | An ordered list of rules to evaluate. |
| `routes` | `[]string` | An ordered list of Edge IDs corresponding to the rules, plus one optional fallback edge. |

#### Rule Structure
Each rule in the `rules` list is an object with:

| Field | Type | Description |
| :--- | :--- | :--- |
| `value` | `string` | The left-hand side value to check. Supports dynamic references (e.g., `$input.status`). Resolved values (e.g. numbers) are automatically converted to strings. |
| `operator` | `string` | The comparison operator. Supported: `==`, `!=`, `>`, `<`, `>=`, `<=`, `contains`. |
| `compare` | `string` | The right-hand side value to compare against. Supports literals and references. |

### Routing Logic
1. The executor evaluates the `rules` in order (index 0 to N).
2. The **first** rule that evaluates to `true` determines the output path.
3. The index of the matching rule corresponds to the index in the `routes` list.
   - If Rule 0 matches, the workflow follows the Edge ID at `routes[0]`.
   - If Rule 1 matches, the workflow follows the Edge ID at `routes[1]`.
4. **Fallback**: If **no** rules match, the workflow follows the Edge ID at `routes[len(rules)]`.
   - This means `routes` must have a length of `len(rules) + 1` to support a fallback.
   - If `routes` has the same length as `rules`, there is no fallback path, and execution for this branch stops if no rules match.

## Walkthrough Example

### Scenario
We want to route a request based on the `target` field in the input:
1. If `target` == "google", route to Google Node.
2. If `target` == "yahoo", route to Yahoo Node.
3. Otherwise, route to a Fallback Node.

### Workflow Definition

**Nodes:**
- `switch-node`: Type `switch`
- `node-google`: Type `http`
- `node-yahoo`: Type `http`
- `node-fallback`: Type `http`

**Edges:**
- `edge-google`: From `switch-node` to `node-google`
- `edge-yahoo`: From `switch-node` to `node-yahoo`
- `edge-fallback`: From `switch-node` to `node-fallback`

### Switch Node Configuration

```json
{
  "id": "switch-node",
  "type": "switch",
  "parameters": {
    "rules": [
      {
        "value": "$input.target",
        "operator": "==",
        "compare": "google"
      },
      {
        "value": "$input.target",
        "operator": "==",
        "compare": "yahoo"
      }
    ],
    "routes": [
      "edge-google",   // Index 0: Matches Rule 0 (google)
      "edge-yahoo",    // Index 1: Matches Rule 1 (yahoo)
      "edge-fallback"  // Index 2: Fallback (no match)
    ]
  }
}
```

### Execution Example

**Input Context:**
```json
{
  "$input": {
    "target": "yahoo"
  }
}
```

**Evaluation:**
1. **Rule 0**: `$input.target` ("yahoo") == "google"? -> **False**
2. **Rule 1**: `$input.target` ("yahoo") == "yahoo"? -> **True**

**Result:**
- Match found at Index 1.
- Executor selects route at Index 1: `edge-yahoo`.
- Next node to execute: `node-yahoo`.

### Full Message Payload

```json
{
  "workflow_id": "demo-workflow",
  "execution_id": "exec-001",
  "current_node": "switch-node",
  "workflow_definition": {
    "workflow_id": "demo-workflow",
    "execution_id": "exec-001",
    "nodes": [
      {
        "id": "switch-node",
        "name": "Router",
        "type": "switch",
        "parameters": {
          "rules": [
            { "value": "$input.target", "operator": "==", "compare": "google" },
            { "value": "$input.target", "operator": "==", "compare": "yahoo" }
          ],
          "routes": ["edge-google", "edge-yahoo", "edge-fallback"]
        }
      },
      { "id": "node-google", "type": "http", "name": "Google" },
      { "id": "node-yahoo", "type": "http", "name": "Yahoo" },
      { "id": "node-fallback", "type": "http", "name": "Fallback" }
    ],
    "edges": [
      { "id": "edge-google", "src": "switch-node", "dst": "node-google" },
      { "id": "edge-yahoo", "src": "switch-node", "dst": "node-yahoo" },
      { "id": "edge-fallback", "src": "switch-node", "dst": "node-fallback" }
    ]
  },
  "accumulated_context": {
    "$input": {
      "target": "yahoo"
    }
  }
}
```
