# RFCs (Request for Comments)

This directory contains design documents, proposals, and architectural specifications for the rune-worker service.

## Documents

### [ISSUE_RECURSIVE_EXECUTOR.md](./ISSUE_RECURSIVE_EXECUTOR.md)
**Status**: Proposed  
**Title**: Implement Recursive Node-by-Node Executor with RabbitMQ

Proposes a message-driven architecture for workflow execution where:
- Each node executes independently via RabbitMQ messages
- Real-time status updates sent to master service
- Horizontal scaling and fault tolerance built-in
- Recursive execution pattern for complex workflows

**Key Features**:
- Dual-queue pattern (execution + status messages)
- One message = one node execution
- Context accumulation across nodes
- Support for conditional routing and parallel branches

---

### [MESSAGE_FLOW.md](./MESSAGE_FLOW.md)
**Status**: Supporting Documentation  
**Title**: Message Flow Architecture

Detailed visual documentation of the message flow patterns in the recursive executor:
- Queue topology diagrams
- Message lifecycle phases
- Execution flow with status updates
- Horizontal scaling model
- Benefits and trade-offs

---

## RFC Process

1. **Proposal**: Create RFC document with problem statement and proposed solution
2. **Review**: Team reviews and provides feedback
3. **Revision**: Update based on feedback
4. **Approval**: Mark as approved and begin implementation
5. **Implementation**: Reference RFC during development
6. **Archive**: Mark as implemented when complete

## Document Template

When creating a new RFC, include:

- **Title**: Clear, descriptive title
- **Status**: Proposed / Approved / Implemented / Rejected
- **Overview**: High-level summary
- **Problem Statement**: What problem does this solve?
- **Proposed Solution**: Detailed technical approach
- **Architecture**: Diagrams and flows
- **Implementation Tasks**: Breakdown of work
- **Benefits**: Why this approach?
- **Trade-offs**: What are the costs?
- **Acceptance Criteria**: Definition of done
- **Dependencies**: What else needs to exist?
- **Testing Strategy**: How to validate?

## Contributing

To propose a new design or architectural change:

1. Create a new RFC document in this folder
2. Follow the template structure above
3. Open a PR with the RFC for team review
4. Discuss in PR comments or team meetings
5. Update based on feedback
6. Merge when approved

## Status Definitions

- **Proposed**: Under review, not yet approved
- **Approved**: Accepted for implementation
- **In Progress**: Currently being implemented
- **Implemented**: Complete and deployed
- **Rejected**: Not moving forward
- **Superseded**: Replaced by another RFC
