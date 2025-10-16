# Architecture Guide

Comprehensive overview of the Rune Workflow Worker architecture, components, and design decisions.

## Table of Contents

- [System Overview](#system-overview)
- [Core Components](#core-components)
- [Message Flow](#message-flow)
- [Execution Model](#execution-model)
- [Data Flow](#data-flow)
- [Design Decisions](#design-decisions)

## System Overview

The Rune Workflow Worker is a distributed, message-driven workflow execution engine designed for reliability, scalability, and extensibility.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     RUNE WORKFLOW WORKER                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────┐         ┌──────────────┐                    │
│  │   Consumer    │────────▶│   Executor   │                    │
│  │               │         │              │                    │
│  │ - Messaging   │         │ - Recursive  │                    │
│  │   Layer       │         │   Execution  │                    │
│  │ - Message     │         │ - Context    │                    │
│  │   Handler     │         │   Mgmt       │                    │
│  └───────┬───────┘         └──────┬───────┘                    │
│          │                        │                             │
│          │                        ▼                             │
│          │              ┌─────────────────┐                    │
│          │              │  Node Registry  │                    │
│          │              │                 │                    │
│          │              │ - Auto-register │                    │
│          │              │ - Node Factory  │                    │
│          │              └────────┬────────┘                    │
│          │                       │                             │
│          │                       ▼                             │
│          │              ┌─────────────────┐                    │
│          │              │   Node Types    │                    │
│          │              │                 │                    │
│          │              │ - HTTP Node     │                    │
│          │              │ - Log Node      │                    │
│          │              │ - Conditional   │                    │
│          │              └─────────────────┘                    │
│          │                                                      │
│          └─────────────────┐                                   │
│                            ▼                                   │
│                  ┌──────────────────┐                          │
│                  │    Publisher     │                          │
│                  │                  │                          │
│                  │ - Status Msgs    │                          │
│                  │ - Next Node Msgs │                          │
│                  │ - Completion     │                          │
│                  └─────────┬────────┘                          │
│                            │                                   │
└────────────────────────────┼───────────────────────────────────┘
                             │
                             ▼
      ┌──────────────────────────────────────────────────┐
      │                  EXTERNAL SERVICES                │
      ├──────────────────────────────────────────────────┤
      │                                                   │
      │  ┌──────────────┐        ┌──────────────┐       │
      │  │   RabbitMQ   │        │    Redis     │       │
      │  │              │        │              │       │
      │  │ - Queues     │        │ - Context    │       │
      │  │ - Exchanges  │        │ - State      │       │
      │  │ - Routing    │        │ - Cache      │       │
      │  └──────────────┘        └──────────────┘       │
      │                                                   │
      └───────────────────────────────────────────────────┘
```

### Key Characteristics

- **Message-Driven**: All workflow operations are message-based
- **Recursive Execution**: Nodes execute one at a time, publishing the next node
- **Stateless Workers**: Workers don't maintain state; all state in Redis
- **Fault Tolerant**: Message acknowledgment ensures at-least-once delivery
- **Horizontally Scalable**: Add more workers to increase throughput
- **Extensible**: Plugin architecture for custom nodes

## Core Components

### 1. Consumer (`pkg/messaging/workflow_consumer.go`)

**Responsibilities:**
- Consume workflow execution messages from RabbitMQ
- Deserialize and validate messages
- Hand off to executor
- Acknowledge/nack messages based on execution result

**Key Features:**
- Prefetch control for load management
- Automatic reconnection on failure
- Graceful shutdown handling
- Message validation

**Configuration:**
```go
type ConsumerConfig struct {
    QueueName   string
    Prefetch    int
    Concurrency int
}
```

### 2. Executor (`pkg/executor/executor.go`)

**Responsibilities:**
- Execute individual workflow nodes
- Manage context accumulation
- Determine next node(s) to execute
- Handle errors according to node configuration

**Execution Flow:**
```
1. Receive node execution message
2. Load workflow definition
3. Retrieve accumulated context
4. Resolve node parameters (template interpolation)
5. Execute node via registry
6. Store node output in context
7. Publish status message
8. Determine next node
9. Publish next node execution message OR completion message
```

**Key Methods:**
```go
func (e *Executor) Execute(ctx context.Context, msg *messages.NodeExecutionMessage) error
func (e *Executor) determineNextNode(workflow *core.Workflow, currentNode *core.Node) (string, error)
func (e *Executor) accumulateContext(ctx map[string]any, nodeID string, output map[string]any) map[string]any
```

### 3. Node Registry (`pkg/registry/init_registry.go`)

**Responsibilities:**
- Auto-discover and register node types
- Provide node factory functions
- Validate node type availability

**Registration System:**
```go
// In node package init()
func init() {
    nodes.RegisterNodeType(RegisterHTTPNode)
}

// Registry collects all registrations
func InitializeRegistry() *nodes.Registry {
    reg := nodes.NewRegistry()
    for _, register := range nodes.GetRegisteredNodeTypes() {
        register(reg)
    }
    return reg
}
```

**Benefits:**
- Automatic discovery of new nodes
- No manual registration required
- Type-safe node creation
- Easy testing and mocking

### 4. Publisher (`pkg/messaging/workflow_publisher.go`)

**Responsibilities:**
- Publish status messages
- Publish next node execution messages
- Publish completion messages
- Handle message serialization

**Message Types:**
- **Status**: Node execution status (running, success, failed)
- **Execution**: Next node to execute
- **Completion**: Workflow completion (success/failed)

### 5. DSL Parser (`pkg/dsl/parser.go`)

**Responsibilities:**
- Parse workflow JSON definitions
- Validate workflow structure
- Build execution graph
- Detect cycles and orphaned nodes

**Validation:**
- All nodes referenced by edges exist
- No circular dependencies (DAG validation)
- Required fields present
- Valid node types

### 6. Resolver (`pkg/resolver/resolver.go`)

**Responsibilities:**
- Template interpolation ({{$node.field}})
- Access to context variables
- Credential resolution
- Type-safe value extraction

**Supported Patterns:**
- `{{$input.field}}` - Workflow input
- `{{$node_id.field}}` - Previous node output
- `{{$credential.field}}` - Credential values

## Message Flow

### Queue Architecture

```
workflows Exchange (topic, durable)
    │
    ├─ workflow.execution (queue)
    │   │
    │   └─ Worker consumes: Node execution messages
    │
    ├─ workflow.node.status (queue)
    │   │
    │   └─ Status Monitor consumes: Status updates
    │
    └─ workflow.completion (queue)
        │
        └─ Master Service consumes: Completion messages
```

### Message Types

**1. Node Execution Message**
```json
{
  "workflow_id": "wf_123",
  "execution_id": "exec_456",
  "current_node": "node_1",
  "workflow_definition": { /* full workflow */ },
  "accumulated_context": {
    "$input": { /* trigger data */ },
    "$node_1": { /* previous output */ }
  }
}
```

**2. Node Status Message**
```json
{
  "workflow_id": "wf_123",
  "execution_id": "exec_456",
  "node_id": "node_1",
  "node_name": "FetchUser",
  "status": "success",
  "output": { /* node output */ },
  "executed_at": "2025-10-17T12:00:00Z",
  "duration_ms": 250
}
```

**3. Completion Message**
```json
{
  "workflow_id": "wf_123",
  "execution_id": "exec_456",
  "status": "completed",
  "final_context": { /* all accumulated data */ },
  "completed_at": "2025-10-17T12:00:05Z",
  "total_duration_ms": 5000
}
```

### Complete Execution Flow

```
1. Master Service publishes initial message
   ↓
2. Worker consumes from workflow.execution
   ↓
3. Executor runs node
   ↓
4. Publish status to workflow.node.status
   ↓
5. If not last node:
   a. Publish next node to workflow.execution
   b. Go to step 2
   ↓
6. If last node:
   a. Publish completion to workflow.completion
   b. Done
```

## Execution Model

### RFC-001: Recursive Execution

The worker implements RFC-001's recursive execution model:

**Characteristics:**
- **One node at a time**: Each message represents one node execution
- **Stateless execution**: No shared state between executions
- **Context accumulation**: Results stored with `$<node_name>` prefix
- **Fault tolerance**: Message acknowledgment ensures reliability

**Example Execution:**

```
Workflow: A → B → C

Message 1: Execute A
  ├─ Run node A
  ├─ Publish status(A, success)
  └─ Publish execute(B)

Message 2: Execute B
  ├─ Run node B (can access $A)
  ├─ Publish status(B, success)
  └─ Publish execute(C)

Message 3: Execute C
  ├─ Run node C (can access $A, $B)
  ├─ Publish status(C, success)
  └─ Publish completion(workflow)
```

### Conditional Execution

Conditional nodes change the execution path:

```
Workflow: A → Conditional → B or C

Message 1: Execute A
  └─ Publish execute(Conditional)

Message 2: Execute Conditional
  ├─ Evaluate condition
  ├─ If true: Publish execute(B)
  └─ If false: Publish execute(C)

Message 3: Execute B or C
  └─ Continue execution
```

### Error Handling

**Three strategies:**

1. **Halt** (default): Stop workflow execution
2. **Ignore**: Continue to next node
3. **Branch**: Follow error edge

```
Node with error: branch
  ├─ Execute fails
  ├─ Publish status(node, failed)
  └─ Publish execute(error_handler_node)
```

## Data Flow

### Context Accumulation

```go
// Initial context
{
  "$input": {
    "userId": 123
  }
}

// After node "fetch_user"
{
  "$input": {
    "userId": 123
  },
  "$fetch_user": {
    "status_code": 200,
    "body": {
      "id": 123,
      "name": "John"
    }
  }
}

// After node "log_user"
{
  "$input": { /* ... */ },
  "$fetch_user": { /* ... */ },
  "$log_user": {
    "logged": true,
    "message": "User: John"
  }
}
```

### Template Resolution

```json
{
  "parameters": {
    "url": "https://api.example.com/users/{{$input.userId}}"
  }
}
```

Resolves to:
```
"url": "https://api.example.com/users/123"
```

## Design Decisions

### 1. Why Message-Driven?

**Pros:**
- ✅ Horizontal scalability
- ✅ Fault tolerance
- ✅ Load balancing
- ✅ Asynchronous execution
- ✅ Easy monitoring

**Cons:**
- ❌ Slightly higher latency
- ❌ Message broker dependency
- ❌ More complex debugging

**Decision**: Message-driven for scalability and reliability

### 2. Why Recursive Execution?

**Pros:**
- ✅ Simple implementation
- ✅ Easy to reason about
- ✅ Natural fault tolerance
- ✅ Fine-grained control

**Cons:**
- ❌ More messages
- ❌ Context must be passed

**Decision**: Recursive for simplicity and reliability

### 3. Why Auto-Registration?

**Pros:**
- ✅ No manual registration
- ✅ Compile-time type safety
- ✅ Easy to add nodes
- ✅ Clean separation

**Cons:**
- ❌ Implicit behavior
- ❌ Import order matters

**Decision**: Auto-registration for developer experience

### 4. Why Redis for State?

**Pros:**
- ✅ Fast in-memory storage
- ✅ TTL support
- ✅ Atomic operations
- ✅ Simple API

**Cons:**
- ❌ Additional dependency
- ❌ Memory constraints

**Decision**: Redis for performance and features

### 5. Why JSON for DSL?

**Pros:**
- ✅ Human-readable
- ✅ Easy to parse
- ✅ Wide tool support
- ✅ Familiar to developers

**Cons:**
- ❌ Verbose
- ❌ No comments
- ❌ No advanced features

**Decision**: JSON for simplicity and compatibility

## Performance Considerations

### Throughput

- **Bottleneck**: Message broker (RabbitMQ)
- **Scaling**: Add more workers
- **Optimization**: Adjust prefetch count

### Latency

- **Per-node overhead**: ~5-10ms
- **Network latency**: ~2-5ms per message
- **Total latency**: Depends on workflow complexity

### Resource Usage

- **CPU**: Low (mostly I/O bound)
- **Memory**: Moderate (context accumulation)
- **Network**: High (message passing)

## Security

### Credential Handling

- Credentials never logged
- Passed securely through messages
- Resolved by master service
- Never stored in worker memory

### Network Security

- TLS for RabbitMQ connections
- Redis authentication
- API calls over HTTPS

### Input Validation

- Workflow definitions validated
- Parameters type-checked
- Template injection prevented

---

**Related Documentation:**
- [RFC-001](../rfcs/RFC-001-recursive-executor.md) - Recursive execution specification
- [RFC-002](../rfcs/RFC-002-workflow-dsl.md) - DSL specification
- [RabbitMQ Flow Diagram](RABBITMQ_FLOW_DIAGRAM.md) - Detailed message flow
