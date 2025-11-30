# Your First Workflow

In this tutorial, you'll build a complete workflow that fetches user data from an API, checks if the user is active, and takes different actions based on the result.

---

## What You'll Learn

- Creating workflows with the visual editor
- Using HTTP nodes to call external APIs
- Adding conditional logic with branching
- Using log nodes for debugging
- Understanding data flow between nodes
- Running and monitoring workflows

---

## Prerequisites

- Rune installed and running ([Installation Guide](./installation.md))
- Logged into the Rune dashboard

---

## The Workflow We'll Build

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ Fetch User   │────▶│ Check if Active │────▶│ Welcome Message  │
│ (HTTP GET)   │     │ (Conditional)   │     │ (Log - Active)   │
└──────────────┘     └────────┬────────┘     └──────────────────┘
                              │
                              │ (if inactive)
                              ▼
                     ┌──────────────────┐
                     │ Alert Admin      │
                     │ (Log - Inactive) │
                     └──────────────────┘
```

---

## Step 1: Create a New Workflow

1. Open the Rune dashboard at `http://localhost:3000`
2. Click the **"+ New Workflow"** button
3. Enter the name: **"User Status Check"**
4. Add an optional description: "Check user status and route accordingly"
5. Click **Create**

You'll now see the visual workflow editor with an empty canvas.

---

## Step 2: Add the HTTP Node

### 2.1 Add the Node
1. From the node palette on the left, drag an **HTTP** node onto the canvas
2. Click on the node to open its configuration panel

### 2.2 Configure the Node
Set the following properties:

| Property | Value |
|----------|-------|
| **Node ID** | `fetch_user` |
| **Node Name** | `Fetch User Data` |
| **Method** | `GET` |
| **URL** | `https://jsonplaceholder.typicode.com/users/1` |

### 2.3 Understanding the Output
This HTTP call returns data like:

```json
{
  "id": 1,
  "name": "Leanne Graham",
  "username": "Bret",
  "email": "Sincere@april.biz",
  "phone": "1-770-736-8031 x56442"
}
```

The full response will be available as:
```
$fetch_user.status_code  → 200
$fetch_user.body.name    → "Leanne Graham"
$fetch_user.body.email   → "Sincere@april.biz"
```

---

## Step 3: Add a Conditional Node

Now we'll add branching logic. For this example, we'll check if the user ID is greater than 0 (simulating an "active" check).

### 3.1 Add the Node
1. Drag a **Conditional** node onto the canvas
2. Position it to the right of the HTTP node

### 3.2 Configure the Node
Set the following properties:

| Property | Value |
|----------|-------|
| **Node ID** | `check_status` |
| **Node Name** | `Check User Status` |
| **Condition** | `{{$fetch_user.body.id}} > 0` |
| **True Edge ID** | `to_welcome` |
| **False Edge ID** | `to_alert` |

### 3.3 Connect the Nodes
1. Click and drag from the output port of `fetch_user`
2. Connect it to the input port of `check_status`

---

## Step 4: Add the Success Path (Log Node)

### 4.1 Add the Node
1. Drag a **Log** node onto the canvas
2. Position it to the right and slightly above the conditional node

### 4.2 Configure the Node

| Property | Value |
|----------|-------|
| **Node ID** | `welcome_message` |
| **Node Name** | `Send Welcome` |
| **Level** | `info` |
| **Message** | `Welcome back, {{$fetch_user.body.name}}! Your email is {{$fetch_user.body.email}}` |

### 4.3 Connect the Nodes
Create an edge from `check_status` to `welcome_message`:
- **Edge ID**: `to_welcome`
- **Label**: `Active User`

---

## Step 5: Add the Failure Path (Log Node)

### 5.1 Add the Node
1. Drag another **Log** node onto the canvas
2. Position it to the right and slightly below the conditional node

### 5.2 Configure the Node

| Property | Value |
|----------|-------|
| **Node ID** | `alert_admin` |
| **Node Name** | `Alert Admin` |
| **Level** | `warn` |
| **Message** | `Inactive user detected: User ID {{$fetch_user.body.id}}` |

### 5.3 Connect the Nodes
Create an edge from `check_status` to `alert_admin`:
- **Edge ID**: `to_alert`
- **Label**: `Inactive User`

---

## Step 6: Review Your Workflow

Your completed workflow should look like this:

```json
{
  "nodes": [
    {
      "id": "fetch_user",
      "name": "Fetch User Data",
      "type": "http",
      "parameters": {
        "method": "GET",
        "url": "https://jsonplaceholder.typicode.com/users/1"
      }
    },
    {
      "id": "check_status",
      "name": "Check User Status",
      "type": "conditional",
      "parameters": {
        "condition": "{{$fetch_user.body.id}} > 0",
        "true_edge_id": "to_welcome",
        "false_edge_id": "to_alert"
      }
    },
    {
      "id": "welcome_message",
      "name": "Send Welcome",
      "type": "log",
      "parameters": {
        "level": "info",
        "message": "Welcome back, {{$fetch_user.body.name}}! Your email is {{$fetch_user.body.email}}"
      }
    },
    {
      "id": "alert_admin",
      "name": "Alert Admin",
      "type": "log",
      "parameters": {
        "level": "warn",
        "message": "Inactive user detected: User ID {{$fetch_user.body.id}}"
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "src": "fetch_user",
      "dst": "check_status"
    },
    {
      "id": "to_welcome",
      "src": "check_status",
      "dst": "welcome_message",
      "label": "Active User"
    },
    {
      "id": "to_alert",
      "src": "check_status",
      "dst": "alert_admin",
      "label": "Inactive User"
    }
  ]
}
```

---

## Step 7: Save and Run

### 7.1 Save the Workflow
Click the **Save** button in the toolbar.

### 7.2 Run the Workflow
Click the **Run** button to execute the workflow.

### 7.3 Watch the Execution
You'll see:
1. The `fetch_user` node turn green (success)
2. The `check_status` node evaluate the condition
3. The `welcome_message` node execute (since id > 0)

---

## Step 8: View the Results

### Run History
Navigate to the **Run History** tab to see:
- Execution start and end times
- Status of each node
- Duration of each step

### Node Outputs
Click on any completed node to see its output:

**fetch_user output:**
```json
{
  "status_code": 200,
  "headers": {
    "content-type": "application/json; charset=utf-8"
  },
  "body": {
    "id": 1,
    "name": "Leanne Graham",
    "username": "Bret",
    "email": "Sincere@april.biz"
  },
  "duration_ms": 245
}
```

**welcome_message output:**
```json
{
  "logged": true,
  "message": "Welcome back, Leanne Graham! Your email is Sincere@april.biz",
  "level": "info",
  "timestamp": "2025-12-01T10:30:00Z"
}
```

---

## Understanding Data Flow

### How Variables Work

Each node's output becomes available to subsequent nodes using the `$` prefix:

```
$node_id.field.nested_field
```

Examples:
- `{{$fetch_user.status_code}}` → HTTP status code
- `{{$fetch_user.body.name}}` → User's name from response body
- `{{$check_status.result}}` → Boolean result of condition

### The Context Object

As the workflow executes, Rune builds a context object:

```json
{
  "$input": {
    // Initial trigger data
  },
  "$fetch_user": {
    "status_code": 200,
    "body": { "id": 1, "name": "Leanne Graham", ... }
  },
  "$check_status": {
    "condition": "{{$fetch_user.body.id}} > 0",
    "result": true,
    "edge_taken": "to_welcome"
  },
  "$welcome_message": {
    "logged": true,
    "message": "Welcome back, Leanne Graham!..."
  }
}
```

---

## Extending the Workflow

### Adding Error Handling

Modify the HTTP node to handle failures:

```json
{
  "id": "fetch_user",
  "type": "http",
  "parameters": {
    "method": "GET",
    "url": "https://jsonplaceholder.typicode.com/users/1",
    "timeout": 30,
    "retry": 3,
    "retry_delay": 1000
  },
  "error": {
    "type": "branch",
    "error_edge": "to_error_handler"
  }
}
```

### Adding Input Parameters

Make the user ID dynamic:

```json
{
  "parameters": {
    "url": "https://jsonplaceholder.typicode.com/users/{{$input.userId}}"
  }
}
```

Then trigger with:
```json
{
  "userId": 5
}
```

### Chaining More Operations

Add a node to send an actual email using an HTTP call to an email service:

```json
{
  "id": "send_email",
  "type": "http",
  "parameters": {
    "method": "POST",
    "url": "https://api.emailservice.com/send",
    "headers": {
      "Authorization": "Bearer {{$credential.email_api_key}}"
    },
    "body": {
      "to": "{{$fetch_user.body.email}}",
      "subject": "Welcome back!",
      "body": "Hello {{$fetch_user.body.name}}"
    }
  }
}
```

---

## Troubleshooting

### Workflow Won't Save
- Check all required fields are filled
- Ensure node IDs are unique
- Verify all edges reference valid node IDs

### HTTP Request Fails
- Verify the URL is correct
- Check if the API requires authentication
- Look at the error message in run history

### Condition Always Returns Same Result
- Check the template syntax: `{{$node.field}}`
- Verify the field exists in the previous node's output
- Use log nodes to debug intermediate values

### Data Not Available in Later Nodes
- Ensure nodes are properly connected
- Check that the source node completed successfully
- Verify the exact field path (case-sensitive)

---

## Next Steps

Congratulations! You've built your first Rune workflow. Here's what to explore next:

- **[Core Concepts](./core-concepts.md)** - Deeper understanding of how Rune works
- **[Node Reference](../nodes/README.md)** - All available node types
- **[Credentials](../concepts/credentials.md)** - Securely store API keys
- **[Templates](../concepts/templates.md)** - Save and reuse workflows

---

[← Back to Quick Start](./quick-start.md) | [Core Concepts →](./core-concepts.md)
