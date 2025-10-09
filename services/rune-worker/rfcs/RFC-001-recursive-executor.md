```
RFC 001: Recursive Node-by-Node Workflow Executor
Author: Seif Elwarwary
Status: PROPOSED
Created: 2025-10-09
Updated: 2025-10-09
```

# RFC 001: Recursive Node-by-Node Workflow Executor

## Abstract

This document specifies a message-driven architecture for workflow execution in the rune-worker service. The design enables distributed, asynchronous node execution using RabbitMQ message queues, providing horizontal scalability, fault tolerance, and real-time execution monitoring. Each workflow node executes independently in response to a dedicated message, with execution state accumulated across node boundaries and progress updates streamed to users in real-time.

## Status of This Memo

This document specifies a proposed architecture for the rune-worker service and requests discussion and suggestions for improvements. Distribution of this memo is unlimited.

## Table of Contents

1. [Introduction](#1-introduction)
2. [Terminology](#2-terminology)
3. [Current System Limitations](#3-current-system-limitations)
4. [Design Goals](#4-design-goals)
5. [Architecture Overview](#5-architecture-overview)
6. [Message Specifications](#6-message-specifications)
7. [Execution Protocol](#7-execution-protocol)
8. [Queue Topology](#8-queue-topology)
9. [Error Handling](#9-error-handling)
10. [Security Considerations](#10-security-considerations)
11. [Performance Considerations](#11-performance-considerations)
12. [Implementation Requirements](#12-implementation-requirements)
13. [References](#13-references)

---

## 1. Introduction

### 1.1 Purpose

This RFC proposes a transformation of the workflow execution model from synchronous, monolithic processing to asynchronous, recursive message-driven execution. The primary objectives are:

- Enable horizontal scaling of workflow execution across multiple worker instances
- Provide granular fault tolerance and retry capabilities at the node level
- Deliver real-time execution progress updates to end users
- Support long-running workflows without timeout constraints
- Enable parallel execution of independent workflow branches

### 1.2 Scope

This specification covers:

- Message format definitions for execution coordination
- Queue topology and routing semantics
- Execution protocol and state management
- Error handling and recovery mechanisms
- Real-time status update delivery

This specification does NOT cover:

- Workflow definition language (see DSL specification)
- Individual node implementation details
- Credential resolution mechanisms
- Master service integration specifics

### 1.3 Applicability

This design applies to all workflow types executed by the rune-worker service, including:

- HTTP request workflows
- Email notification workflows  
- Conditional branching workflows
- Data transformation pipelines
- Multi-step automation workflows

---

## 2. Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in RFC 2119.

**Workflow**: A directed acyclic graph (DAG) of executable nodes connected by edges.

**Node**: A single executable unit within a workflow that performs a specific operation.

**Trigger Node**: A special node type that initiates workflow execution (executed in master service).

**Execution Node**: A standard node that performs work (executed in worker service).

**Accumulated Context**: A key-value store containing outputs from all previously executed nodes in a workflow instance.

**Node Execution Message**: A message consumed by workers to execute a single node.

**Node Status Message**: A message published by workers to report execution progress.

**Worker Instance**: A single process capable of consuming execution messages and executing nodes.

**Master Service**: The orchestration service that manages workflow definitions and triggers.

---

## 3. Current System Limitations

The existing implementation exhibits the following constraints:

### 3.1 Sequential Processing

The current executor processes entire workflows synchronously within a single message handler. This design:

- Blocks the queue consumer for the duration of workflow execution
- Prevents concurrent execution of independent nodes
- Creates artificial serialization of parallel-eligible operations

### 3.2 Limited Scalability

Because workflows execute as atomic units:

- Adding worker instances does not increase intra-workflow parallelism
- Long-running workflows monopolize worker capacity
- Resource utilization is suboptimal for workflows with mixed node durations

### 3.3 Coarse-Grained Fault Tolerance

Workflow-level failure handling provides insufficient granularity:

- Individual node failures cause entire workflow restart
- Retry logic applies to complete workflows, not individual operations
- Partial progress is lost on failure

### 3.4 Timeout Constraints

Synchronous execution imposes timeout limitations:

- RabbitMQ consumer timeouts constrain workflow duration
- Long-running nodes (e.g., batch processing) may fail due to timeouts
- Timeout tuning requires workflow-specific configuration

### 3.5 Observability Gaps

The current design provides limited visibility:

- Users receive results only upon complete workflow execution
- Intermediate progress is not available
- Debugging requires log correlation across long execution periods

---

## 4. Design Goals

This proposal aims to achieve the following objectives:

### 4.1 Fine-Grained Execution

**REQUIRED**: The system MUST execute workflows at node-level granularity, with each node execution represented by a single message.

**RATIONALE**: Node-level execution enables independent scaling, retry, and monitoring of individual operations.

### 4.2 Horizontal Scalability

**REQUIRED**: The system MUST support linear scalability by adding worker instances.

**RATIONALE**: Different worker instances should be able to execute different nodes of the same workflow concurrently.

### 4.3 Fault Isolation

**REQUIRED**: Node execution failures MUST NOT propagate to other nodes unless explicitly specified by error handling configuration.

**RATIONALE**: Independent failure domains enable precise retry and recovery strategies.

### 4.4 Real-Time Progress Reporting

**REQUIRED**: The system MUST publish execution status updates after each node execution.

**RATIONALE**: Users require visibility into workflow progress for long-running operations.

### 4.5 State Accumulation

**REQUIRED**: The system MUST maintain execution context across node boundaries, making previous node outputs available to subsequent nodes.

**RATIONALE**: Nodes often require access to data produced by earlier workflow stages.

### 4.6 Timeout Independence

**REQUIRED**: Individual node executions MUST NOT be constrained by workflow-level timeouts.

**RATIONALE**: Workflows may contain a mix of fast and slow operations with different timeout requirements.

---

## 5. Architecture Overview

### 5.1 System Components

```
┌─────────────────────┐
│   Master Service    │
│  (Orchestration)    │
└──────────┬──────────┘
           │ Publishes initial execution message
           │ Consumes status & completion messages
           ▼
┌──────────────────────────────────────┐
│         RabbitMQ Broker              │
│  ┌────────────────────────────────┐  │
│  │ Queue: workflow.execution      │  │
│  │ (Worker-to-Worker)             │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │ Queue: workflow.node.status    │  │
│  │ (Worker-to-Master)             │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │ Queue: workflow.completion     │  │
│  │ (Worker-to-Master)             │  │
│  └────────────────────────────────┘  │
└──────────┬───────────────────────────┘
           │ Workers consume & publish messages
           ▼
┌──────────────────────┐
│   Worker Instance    │
│  ┌────────────────┐  │
│  │  Executor      │  │
│  │  Registry      │  │
│  │  Publisher     │  │
│  └────────────────┘  │
└──────────────────────┘
```

### 5.2 Execution Flow

```
1. Master publishes NodeExecutionMessage(node=first_node)
           ↓
2. Worker_A consumes message
           ↓
3. Worker_A publishes NodeStatusMessage(status=running)
           ↓
4. Worker_A executes node logic
           ↓
5. Worker_A publishes NodeStatusMessage(status=success, output=data)
           ↓
6. Worker_A determines next_nodes from graph
           ↓
7. Worker_A publishes NodeExecutionMessage(node=next_node) for each
           ↓
8. Worker_B consumes next message (recursive)
           ↓
9. Repeat steps 3-8 until no next nodes
           ↓
10. Worker_N publishes CompletionMessage(status=completed)
```

### 5.3 State Management

Execution state is maintained through message payload propagation:

- **Accumulated Context**: Carried in each NodeExecutionMessage, containing all prior node outputs
- **Workflow Definition**: Included in each message to enable graph traversal decisions
- **Execution Identity**: `workflow_id` and `execution_id` pair uniquely identifies an execution instance

---

## 6. Message Specifications

### 6.1 NodeExecutionMessage

**Purpose**: Instructs a worker to execute a specific node.

**Queue**: `workflow.execution`

**Direction**: Worker → Worker (via RabbitMQ)

**Format**:

```json
{
  "workflow_id": string,          // REQUIRED. Workflow definition identifier
  "execution_id": string,         // REQUIRED. Unique execution instance identifier  
  "current_node": string,         // REQUIRED. Node ID to execute
  "workflow_definition": object,  // REQUIRED. Complete workflow graph
  "accumulated_context": object   // REQUIRED. Outputs from all prior nodes
}
```

**Fields**:

- `workflow_id`: Identifies the workflow definition. Format: `^[a-zA-Z0-9_-]+$`
- `execution_id`: Uniquely identifies this execution instance. Format: `^[a-zA-Z0-9_-]+$`
- `current_node`: The node ID to execute. MUST reference a valid node in `workflow_definition.nodes`
- `workflow_definition`: Complete workflow structure including nodes and edges
- `accumulated_context`: Object with keys of format `$<node_id>` mapping to node outputs

**Example**:

```json
{
  "workflow_id": "wf_email_notification",
  "execution_id": "exec_20251009_123456",
  "current_node": "http_fetch_user",
  "workflow_definition": {
    "nodes": [...],
    "edges": [...]
  },
  "accumulated_context": {
    "$trigger": {
      "user_id": "user_123",
      "timestamp": "2025-10-09T12:34:56Z"
    }
  }
}
```

### 6.2 NodeStatusMessage

**Purpose**: Reports node execution progress and results.

**Queue**: `workflow.node.status`

**Direction**: Worker → Master

**Format**:

```json
{
  "workflow_id": string,      // REQUIRED
  "execution_id": string,     // REQUIRED
  "node_id": string,          // REQUIRED
  "status": string,           // REQUIRED. One of: "running", "success", "failed"
  "output": object | null,    // OPTIONAL. Present when status="success"
  "error": object | null,     // OPTIONAL. Present when status="failed"
  "executed_at": string,      // REQUIRED. ISO 8601 timestamp
  "duration_ms": integer      // REQUIRED. Execution duration in milliseconds
}
```

**Status Values**:

- `running`: Node execution has started
- `success`: Node completed successfully, `output` contains results
- `failed`: Node execution failed, `error` contains details

**Error Object**:

```json
{
  "message": string,        // REQUIRED. Human-readable error description
  "code": string,          // REQUIRED. Machine-readable error code
  "details": object        // OPTIONAL. Additional error context
}
```

**Example (Success)**:

```json
{
  "workflow_id": "wf_email_notification",
  "execution_id": "exec_20251009_123456",
  "node_id": "http_fetch_user",
  "status": "success",
  "output": {
    "status": 200,
    "body": {"name": "John Doe", "email": "john@example.com"},
    "headers": {"content-type": "application/json"}
  },
  "error": null,
  "executed_at": "2025-10-09T12:35:01Z",
  "duration_ms": 234
}
```

**Example (Failure)**:

```json
{
  "workflow_id": "wf_email_notification",
  "execution_id": "exec_20251009_123456",
  "node_id": "http_fetch_user",
  "status": "failed",
  "output": null,
  "error": {
    "message": "Connection timeout after 30s",
    "code": "HTTP_TIMEOUT",
    "details": {"url": "https://api.example.com/users/123"}
  },
  "executed_at": "2025-10-09T12:35:30Z",
  "duration_ms": 30000
}
```

### 6.3 CompletionMessage

**Purpose**: Signals workflow execution completion or termination.

**Queue**: `workflow.completion`

**Direction**: Worker → Master

**Format**:

```json
{
  "workflow_id": string,          // REQUIRED
  "execution_id": string,         // REQUIRED
  "status": string,               // REQUIRED. One of: "completed", "failed", "halted"
  "final_context": object,        // REQUIRED. Complete accumulated context
  "completed_at": string,         // REQUIRED. ISO 8601 timestamp
  "total_duration_ms": integer    // REQUIRED. Total execution time
}
```

**Status Values**:

- `completed`: All nodes executed successfully
- `failed`: Workflow failed due to unrecoverable error
- `halted`: Workflow stopped due to halt error handling

**Example**:

```json
{
  "workflow_id": "wf_email_notification",
  "execution_id": "exec_20251009_123456",
  "status": "completed",
  "final_context": {
    "$trigger": {...},
    "$http_fetch_user": {...},
    "$smtp_send_email": {
      "sent": true,
      "message_id": "msg_abc123"
    }
  },
  "completed_at": "2025-10-09T12:35:45Z",
  "total_duration_ms": 4523
}
```

---

## 7. Execution Protocol

### 7.1 Message Consumption

Workers MUST:

1. Consume messages from `workflow.execution` queue with manual acknowledgment
2. Parse and validate message structure before execution
3. Acknowledge message only after publishing all successor messages or completion
4. Reject invalid messages to dead-letter queue

### 7.2 Node Execution Sequence

For each consumed NodeExecutionMessage, workers MUST execute the following sequence:

```
1. PARSE workflow definition
2. LOOKUP node by current_node ID
3. VALIDATE node exists and is executable
4. PUBLISH NodeStatusMessage(status=running)
5. RESOLVE credentials if node requires them
6. BUILD ExecutionContext from accumulated_context
7. EXECUTE node logic with ExecutionContext
8. IF execution successful:
     a. PUBLISH NodeStatusMessage(status=success, output=result)
     b. ACCUMULATE result into context as $<node_id>
     c. DETERMINE next nodes via graph traversal
     d. IF next nodes exist:
          FOR EACH next_node:
            PUBLISH NodeExecutionMessage(current_node=next_node)
        ELSE:
          PUBLISH CompletionMessage(status=completed)
9. IF execution failed:
     a. PUBLISH NodeStatusMessage(status=failed, error=details)
     b. APPLY error handling strategy (halt|ignore|branch)
     c. PUBLISH appropriate next message or completion
```

### 7.3 Graph Traversal

Workers MUST determine next nodes using the following algorithm:

```
FUNCTION determine_next_nodes(workflow, current_node, execution_output):
  edges = workflow.get_outgoing_edges(current_node.id)
  
  SWITCH current_node.type:
    CASE "conditional":
      result = evaluate_condition(current_node.parameters, execution_output)
      IF result == true:
        RETURN [get_node_by_edge(current_node.parameters.true_edge_id)]
      ELSE:
        RETURN [get_node_by_edge(current_node.parameters.false_edge_id)]
    
    CASE "split":
      // Parallel execution - return all destinations
      RETURN [get_node_by_edge(edge.dst) FOR edge IN edges]
    
    DEFAULT:
      // Regular node - return success edges only
      RETURN [get_node_by_edge(edge.dst) FOR edge IN edges WHERE edge.is_error != "error"]
```

### 7.4 Context Accumulation

Workers MUST:

1. Preserve all existing keys in `accumulated_context`
2. Add new node output with key format `$<node_id>`
3. Ensure context is serializable to JSON
4. Include updated context in all published NodeExecutionMessages

Example accumulation:

```
Initial context:
  {
    "$trigger": {"user_id": "123"}
  }

After http_node execution:
  {
    "$trigger": {"user_id": "123"},
    "$http_node": {"status": 200, "body": {...}}
  }

After conditional_node execution:
  {
    "$trigger": {"user_id": "123"},
    "$http_node": {"status": 200, "body": {...}},
    "$conditional_node": {"result": true}
  }
```

---

## 8. Queue Topology

### 8.1 Execution Queue

**Name**: `workflow.execution`

**Purpose**: Coordinate node execution across workers

**Properties**:
- Durable: Yes
- Auto-delete: No
- Exclusive: No
- Message TTL: 24 hours
- Max Priority: 10
- Dead Letter Exchange: `workflow.execution.dlx`

**Access Pattern**: Multiple producers (workers), multiple consumers (workers)

**Message Routing**: Round-robin across available workers

### 8.2 Status Queue

**Name**: `workflow.node.status`

**Purpose**: Deliver real-time execution updates to master service

**Properties**:
- Durable: No (ephemeral status updates)
- Auto-delete: No
- Exclusive: No
- Message TTL: 1 hour
- Max Priority: 10

**Access Pattern**: Multiple producers (workers), single consumer (master)

**Message Routing**: Master service binds with prefetch=100 for batch processing

### 8.3 Completion Queue

**Name**: `workflow.completion`

**Purpose**: Signal workflow termination to master service

**Properties**:
- Durable: Yes
- Auto-delete: No
- Exclusive: No
- Message TTL: 7 days
- Max Priority: 10

**Access Pattern**: Multiple producers (workers), single consumer (master)

**Message Routing**: Master service processes completion messages sequentially

---

## 9. Error Handling

### 9.1 Node-Level Error Handling

Each node MAY specify an error handling strategy:

**Halt**: Stop workflow execution immediately

```
1. PUBLISH NodeStatusMessage(status=failed)
2. PUBLISH CompletionMessage(status=failed)
3. STOP
```

**Ignore**: Continue to next node despite error

```
1. PUBLISH NodeStatusMessage(status=failed)
2. DETERMINE next nodes (ignore error)
3. PUBLISH NodeExecutionMessage for each next node
```

**Branch**: Follow designated error edge

```
1. PUBLISH NodeStatusMessage(status=failed)
2. DETERMINE error edge from node.error.error_edge
3. PUBLISH NodeExecutionMessage(current_node=error_edge.dst)
```

### 9.2 System-Level Error Handling

For errors outside node execution (e.g., queue failures, invalid messages):

Workers MUST:

1. Log error with full context
2. Reject message to dead-letter queue
3. Continue processing other messages
4. NOT publish completion message

### 9.3 Retry Semantics

RabbitMQ-level retry is configured via dead-letter exchange with TTL:

```
workflow.execution → (failure) → workflow.execution.dlx
                                         ↓ (TTL expires)
                                  workflow.execution.retry
                                         ↓ (republish)
                                  workflow.execution
```

Retry policy:
- Max retries: 3
- Initial delay: 5 seconds
- Backoff: Exponential (5s, 25s, 125s)

---

## 10. Security Considerations

### 10.1 Message Integrity

All messages SHOULD be validated against JSON schema before processing to prevent:

- Injection attacks via malformed messages
- Resource exhaustion via extremely large contexts
- Workflow definition tampering

### 10.2 Credential Isolation

Credentials MUST NOT be included in message payloads. Workers MUST:

1. Extract credential reference from node definition
2. Resolve actual credentials from secure credential store
3. Pass credentials to node execution context
4. Ensure credentials never appear in logs or status messages

### 10.3 Access Control

Queue access MUST be restricted:

- Workers: Read/write `workflow.execution`, write `workflow.node.status`, write `workflow.completion`
- Master: Write `workflow.execution`, read `workflow.node.status`, read `workflow.completion`
- External: No access

---

## 11. Performance Considerations

### 11.1 Message Size

Large accumulated contexts may impact performance:

- **Recommended**: Keep context under 1MB per message
- **Maximum**: 10MB (RabbitMQ default max)
- **Mitigation**: Store large payloads in object storage, pass references in context

### 11.2 Queue Depth

High-volume workflows may cause queue buildup:

- **Monitoring**: Track queue depth metrics
- **Alerting**: Trigger when depth exceeds threshold
- **Scaling**: Auto-scale worker instances based on queue depth

### 11.3 Message Throughput

Expected throughput per worker:

- Simple nodes: 100-500 messages/second
- HTTP nodes: 10-50 messages/second (network-bound)
- Complex nodes: 1-10 messages/second

### 11.4 Context Size Growth

Context grows linearly with workflow size:

- 10 nodes × 10KB average = ~100KB context
- 100 nodes × 10KB average = ~1MB context
- Large workflows may require context pruning strategy

---

## 12. Implementation Requirements

### 12.1 Worker Service

**MUST** implement:

- [ ] NodeExecutionMessage parser and validator
- [ ] Node executor with registry pattern
- [ ] RabbitMQ publisher for all message types
- [ ] Graph traversal algorithm
- [ ] Context accumulation logic
- [ ] Error handling strategies (halt/ignore/branch)
- [ ] Credential resolution integration

**SHOULD** implement:

- [ ] Message schema validation
- [ ] Execution metrics collection
- [ ] Distributed tracing support
- [ ] Graceful shutdown with message completion

### 12.2 Master Service

**MUST** implement:

- [ ] NodeStatusMessage consumer
- [ ] CompletionMessage consumer
- [ ] Real-time status delivery to users (WebSocket/SSE)
- [ ] Workflow state persistence

**SHOULD** implement:

- [ ] Status message batching
- [ ] User notification throttling
- [ ] Execution history storage

### 12.3 Infrastructure

**MUST** configure:

- [ ] RabbitMQ queues with specified properties
- [ ] Dead-letter exchanges for retries
- [ ] Queue monitoring and alerting

**SHOULD** configure:

- [ ] Auto-scaling policies based on queue depth
- [ ] Message TTL policies
- [ ] Queue mirroring for high availability

---

## 13. References

### 13.1 Normative References

[RFC2119] Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997.

[AMQP] OASIS, "Advanced Message Queuing Protocol (AMQP) Version 1.0", October 2012.

[JSON] Bray, T., "The JavaScript Object Notation (JSON) Data Interchange Format", RFC 8259, December 2017.

### 13.2 Informative References

[RabbitMQ] Pivotal Software, "RabbitMQ Documentation", https://www.rabbitmq.com/documentation.html

[DAG] Wikipedia, "Directed Acyclic Graph", https://en.wikipedia.org/wiki/Directed_acyclic_graph

---

## Appendix A: Message Flow Examples

### A.1 Simple Linear Workflow

```
Workflow: Trigger → HTTP → SMTP

Message Flow:
1. Master → workflow.execution: {current_node: "http_1"}
2. Worker → workflow.node.status: {node_id: "http_1", status: "running"}
3. Worker → workflow.node.status: {node_id: "http_1", status: "success", output: {...}}
4. Worker → workflow.execution: {current_node: "smtp_1"}
5. Worker → workflow.node.status: {node_id: "smtp_1", status: "running"}
6. Worker → workflow.node.status: {node_id: "smtp_1", status: "success", output: {...}}
7. Worker → workflow.completion: {status: "completed"}
```

### A.2 Conditional Workflow

```
Workflow: Trigger → HTTP → Conditional → [SMTP_Success | SMTP_Failure]

Message Flow:
1. Master → workflow.execution: {current_node: "http_1"}
2. Worker → workflow.node.status: {node_id: "http_1", status: "success"}
3. Worker → workflow.execution: {current_node: "conditional_1"}
4. Worker → workflow.node.status: {node_id: "conditional_1", status: "success", output: {result: true}}
5. Worker → workflow.execution: {current_node: "smtp_success"}
6. Worker → workflow.node.status: {node_id: "smtp_success", status: "success"}
7. Worker → workflow.completion: {status: "completed"}
```

---

## Appendix B: Migration Strategy

### B.1 Phased Rollout

**Phase 1**: Implement new executor alongside existing
**Phase 2**: Deploy workers with feature flag
**Phase 3**: Route test workflows to new executor
**Phase 4**: Gradually migrate production workflows
**Phase 5**: Deprecate old executor

### B.2 Compatibility

During migration, both executors MUST coexist:

- Old executor consumes `workflow.started` queue
- New executor consumes `workflow.execution` queue
- Master determines routing based on workflow configuration

---

**Author's Address**

Seif Elwarwary  
Rune Workflow Engine  
Email: seif@rune-org

---

**End of RFC 001**
