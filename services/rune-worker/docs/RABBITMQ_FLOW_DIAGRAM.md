# RabbitMQ Message Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RUNE WORKER SERVICE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐                                        ┌──────────────┐    │
│  │  Publisher  │                                        │   Consumer   │    │
│  │             │                                        │              │    │
│  │ - Executor  │                                        │ - Messaging  │    │
│  │ - Messaging │                                        │   Layer      │    │
│  └──────┬──────┘                                        └──────▲───────┘    │
│         │                                                      │             │
│         │ Publish                                              │ Consume     │
│         │                                                      │             │
└─────────┼──────────────────────────────────────────────────────┼─────────────┘
          │                                                      │
          │                                                      │
          ▼                                                      │
┌─────────────────────────────────────────────────────────────────────────────┐
│                              RABBITMQ                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                     ┌────────────────────────┐                              │
│                     │   workflows Exchange   │                              │
│                     │                        │                              │
│                     │   Type: topic          │                              │
│                     │   Durable: true        │                              │
│                     │   Auto-delete: false   │                              │
│                     └───────────┬────────────┘                              │
│                                 │                                            │
│                    ┌────────────┼────────────┐                              │
│                    │            │            │                              │
│         ┌──────────▼──────┐ ┌──▼──────────┐ ┌▼────────────────┐            │
│         │ Queue: workflow  │ │ Queue:      │ │ Queue: workflow │            │
│         │  .execution      │ │  workflow   │ │  .completion    │            │
│         │                  │ │  .node      │ │                 │            │
│         │ Routing Key:     │ │  .status    │ │ Routing Key:    │            │
│         │  workflow        │ │             │ │  workflow       │            │
│         │  .execution      │ │ Routing Key:│ │  .completion    │            │
│         │                  │ │  workflow   │ │                 │            │
│         │ Durable: true    │ │  .node      │ │ Durable: true   │            │
│         │                  │ │  .status    │ │                 │            │
│         │                  │ │             │ │                 │            │
│         │                  │ │ Durable:    │ │                 │            │
│         │                  │ │  true       │ │                 │            │
│         └──────────────────┘ └─────────────┘ └─────────────────┘            │
│                 ▲                    ▲                 ▲                     │
│                 │                    │                 │                     │
└─────────────────┼────────────────────┼─────────────────┼─────────────────────┘
                  │                    │                 │
                  │                    │                 │
         ┌────────┴────────┐  ┌────────┴────────┐ ┌─────┴──────┐
         │   Consumer for  │  │   Consumer for  │ │  Executor  │
         │   workflow.     │  │   workflow.node │ │  publishes │
         │   execution     │  │   .status       │ │  status &  │
         │                 │  │                 │ │  completion│
         │   (Main Worker) │  │   (Status       │ │            │
         │                 │  │    Monitor)     │ │            │
         └─────────────────┘  └─────────────────┘ └────────────┘


MESSAGE FLOW EXAMPLE:
═══════════════════

1. Master Service publishes workflow execution request:
   ┌─────────────────────────────────────────────────────┐
   │ Routing Key: "workflow.execution"                   │
   │ Exchange: "workflows"                               │
   │ {                                                   │
   │   "workflow_id": "wf_123",                         │
   │   "execution_id": "exec_456",                      │
   │   "node_id": "node_1",                             │
   │   "workflow": { ... }                              │
   │ }                                                   │
   └─────────────────────────────────────────────────────┘
                          │
                          ▼
              workflows exchange routes via
              routing key "workflow.execution"
                          │
                          ▼
                 workflow.execution queue
                          │
                          ▼
              Consumer picks up message
                          │
                          ▼
              Executor processes node
                          │
             ┌────────────┴────────────┐
             │                         │
             ▼                         ▼
   2. Publish status        3. Publish completion
      to workflow.node         to workflow.completion
      .status queue            queue (if final node)


AUTOMATIC CREATION:
══════════════════

On Service Startup:
├── Publisher declares:
│   └── Exchange "workflows" (if not exists)
│
└── Consumer declares:
    ├── Exchange "workflows" (if not exists)
    ├── Queue (if not exists)
    └── Binding: Queue → Exchange with routing key


DURABILITY GUARANTEES:
═════════════════════

✓ Exchange survives RabbitMQ restarts
✓ Queues survive RabbitMQ restarts  
✓ Bindings survive RabbitMQ restarts
✓ Messages survive RabbitMQ restarts (persistent delivery)
✓ Unacknowledged messages return to queue on consumer crash


CONFIGURATION:
═════════════

Publisher:
- Exchange: workflows
- Type: topic
- Durable: true
- Messages: persistent
- Mandatory routing: true

Consumer:
- Exchange: workflows
- Queue: durable
- Prefetch: 10 (configurable)
- Concurrency: 1 (configurable)
- Auto-ack: false (manual acknowledgment)
```

## Key Benefits

1. **Zero Configuration Deployment**
   - No manual RabbitMQ setup required
   - Service creates all infrastructure automatically
   - Idempotent declarations (safe to run multiple times)

2. **High Availability**
   - Durable exchange, queues, and messages
   - Survives broker restarts
   - At-least-once delivery semantics

3. **Scalability**
   - Multiple consumers can process from same queue
   - Topic exchange enables advanced routing patterns
   - Horizontal scaling ready

4. **Reliability**
   - Manual acknowledgments ensure message processing
   - Mandatory routing ensures messages reach queues
   - Failed messages can be requeued

5. **Observability**
   - RabbitMQ Management UI shows all components
   - Message rates and queue depths visible
   - Easy to monitor and debug
