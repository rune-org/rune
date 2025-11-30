# Quick Start Guide

Get Rune running and create your first workflow in under 5 minutes.

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- Git installed
- A terminal/command prompt

---

## Step 1: Clone and Start (2 minutes)

```bash
# Clone the repository
git clone https://github.com/rune-org/rune.git
cd rune

# Copy environment file
cp .env.example .env

# Start all services
make up
```

Wait for all services to start (about 30-60 seconds).

---

## Step 2: Access the Platform

Open your browser and navigate to:

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | Rune Web Application |
| http://localhost:8000/docs | API Documentation |

---

## Step 3: Log In

Use the default credentials:

- **Email**: `admin@example.com`
- **Password**: `admin123`

> 🔒 Change these credentials after your first login!

---

## Step 4: Create Your First Workflow

### Using the Visual Editor

1. Click **"New Workflow"** in the dashboard
2. Give it a name: "My First Workflow"
3. Drag an **HTTP node** onto the canvas
4. Configure it:
   - **Method**: GET
   - **URL**: `https://jsonplaceholder.typicode.com/users/1`
5. Add a **Log node** and connect it after the HTTP node
6. Configure the log:
   - **Message**: `Fetched user: {{$http_1.body.name}}`
7. Click **Save** and then **Run**

### Using the API

Alternatively, create a workflow via the API:

```bash
# Login and get token
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' \
  | jq -r '.data.access_token')

# Create workflow
curl -X POST http://localhost:8000/workflows/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "My First Workflow",
    "workflow_data": {
      "nodes": [
        {
          "id": "fetch_user",
          "name": "Fetch User",
          "type": "http",
          "parameters": {
            "method": "GET",
            "url": "https://jsonplaceholder.typicode.com/users/1"
          }
        },
        {
          "id": "log_result",
          "name": "Log Result",
          "type": "log",
          "parameters": {
            "message": "Fetched user: {{$fetch_user.body.name}}"
          }
        }
      ],
      "edges": [
        {"id": "e1", "src": "fetch_user", "dst": "log_result"}
      ]
    }
  }'
```

---

## Step 5: Run and Monitor

1. Navigate to your workflow
2. Click the **Run** button
3. Watch the execution in real-time
4. Check the **Run History** for detailed logs

---

## What's Happening?

When you run a workflow, Rune:

1. **API** receives the run request and validates the workflow
2. **API** publishes an execution message to RabbitMQ
3. **Worker** picks up the message and starts execution
4. **Worker** executes each node sequentially
5. **Worker** stores results and publishes status updates
6. **Frontend** displays real-time progress

```
Frontend → API → RabbitMQ → Worker → External APIs
                    ↓           ↓
                 Status    Execution
                Updates      Results
```

---

## Common Operations

### Managing Workflows

```bash
# List all workflows
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/workflows/

# Get workflow details
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/workflows/1

# Delete workflow
curl -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:8000/workflows/1
```

### Checking Service Status

```bash
# Container status
make status

# View logs
make logs

# API-only logs
make logs-api
```

### Stopping Services

```bash
# Stop all services
make down

# Stop and clean volumes (resets database)
make docker-clean
```

---

## Next Steps

You've successfully set up Rune and created your first workflow! Here's what to explore next:

### Learn the Fundamentals
- [Core Concepts](./core-concepts.md) - Understand workflows, nodes, and edges
- [Node Types](../nodes/README.md) - All available node types

### Build More Complex Workflows
- [First Workflow Tutorial](./first-workflow.md) - Step-by-step tutorial
- [Conditional Logic](../concepts/conditionals.md) - Add branching to workflows
- [Error Handling](../concepts/error-handling.md) - Handle failures gracefully

### Integrate with External Services
- [Credentials](../concepts/credentials.md) - Securely store API keys
- [HTTP Node](../nodes/http.md) - Make API calls

### Production Deployment
- [Configuration](../configuration/README.md) - Environment setup
- [Deployment Guide](../deployment/README.md) - Production deployment

---

## Need Help?

- 📖 [Full Documentation](../README.md)
- 🐛 [Report Issues](https://github.com/rune-org/rune/issues)
- 💬 [Community Discussions](https://github.com/rune-org/rune/discussions)

---

[← Back to Getting Started](./README.md) | [Your First Workflow →](./first-workflow.md)
