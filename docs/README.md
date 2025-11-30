# Rune Documentation

Welcome to the official documentation for **Rune** — a low-code workflow automation platform that enables users to create, manage, and execute complex workflows through a visual interface.

<p align="center">
  <img src="../apps/web/public/images/logo.png" alt="Rune Logo" width="200" />
</p>

---

## 📚 Documentation Overview

| Section | Description |
|---------|-------------|
| [Getting Started](./getting-started/README.md) | Quick start guides and installation instructions |
| [Concepts](./concepts/README.md) | Core concepts and workflow fundamentals |
| [API Reference](./api-reference/README.md) | Complete REST API documentation |
| [Workflow DSL](./workflow-dsl/README.md) | Workflow definition language specification |
| [Node Reference](./nodes/README.md) | Available node types and configurations |
| [Deployment](./deployment/README.md) | Production deployment guides |
| [Configuration](./configuration/README.md) | Environment and service configuration |
| [Architecture](./architecture/README.md) | System architecture and design decisions |

---

## 🚀 Quick Links

### For Users
- [Creating Your First Workflow](./getting-started/first-workflow.md)
- [Understanding Nodes](./concepts/nodes.md)
- [Using Templates](./concepts/templates.md)
- [Managing Credentials](./concepts/credentials.md)

### For Developers
- [API Authentication](./api-reference/authentication.md)
- [Workflow API](./api-reference/workflows.md)
- [Extending Rune](./architecture/extending.md)
- [Custom Nodes](./nodes/custom-nodes.md)

### For DevOps
- [Docker Deployment](./deployment/docker.md)
- [Environment Variables](./configuration/environment-variables.md)
- [Production Checklist](./deployment/production-checklist.md)
- [Monitoring & Logging](./deployment/monitoring.md)

---

## 🏗️ Platform Overview

Rune consists of three main components:

```
┌─────────────────────────────────────────────────────────────────┐
│                         RUNE PLATFORM                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │    Frontend     │  │      API        │  │     Worker      │ │
│  │   (Next.js)     │  │   (FastAPI)     │  │      (Go)       │ │
│  │                 │  │                 │  │                 │ │
│  │ • Visual Editor │  │ • REST API      │  │ • Execution     │ │
│  │ • Run History   │  │ • Auth/Users    │  │ • Node Engine   │ │
│  │ • Templates     │  │ • Workflows     │  │ • Messaging     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│           │                    │                    │           │
│           └────────────────────┼────────────────────┘           │
│                                │                                 │
│  ┌─────────────────────────────┴───────────────────────────────┐│
│  │                     INFRASTRUCTURE                           ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    ││
│  │  │PostgreSQL│  │  Redis   │  │ RabbitMQ │  │  MinIO   │    ││
│  │  │ Database │  │  Cache   │  │  Queue   │  │ Storage  │    ││
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘    ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📖 What is Rune?

Rune is a **low-code workflow automation platform** designed to help teams automate complex business processes without extensive programming. Key features include:

### Visual Workflow Designer
Build multi-step automations using a drag-and-drop interface. Connect nodes to create sophisticated workflows with branching logic, error handling, and retry policies.

### Reusable Integration Blocks
Pre-built nodes for common operations like HTTP requests, conditional logic, logging, and more. Combine these blocks to create powerful automations in minutes.

### Observability First
Central run history, live logs, and per-step metrics help you debug production runs without diving into logs manually.

### Secure Credential Management
Store and manage API keys, tokens, and other secrets securely. Credentials are encrypted at rest and resolved only at execution time.

### Template Library
Share and reuse workflow patterns across your organization with the built-in template system.

---

## 🛠️ Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | Next.js 15, React, TypeScript | Visual workflow builder and UI |
| **API** | FastAPI, Python 3.13 | REST API and business logic |
| **Worker** | Go 1.25 | Workflow execution engine |
| **Database** | PostgreSQL | Persistent data storage |
| **Cache** | Redis | Session and context caching |
| **Message Queue** | RabbitMQ | Async job processing |

---

## 📋 Requirements

### System Requirements
- **Operating System**: Linux, macOS, or Windows
- **Memory**: 4GB RAM minimum (8GB recommended)
- **Storage**: 10GB available disk space

### Software Requirements
- Docker Desktop (or Docker Engine + Docker Compose)
- Git

### For Local Development
- Node.js 22+ and pnpm 9 (Frontend)
- Python 3.13+ (API)
- Go 1.25+ (Worker)

---

## 🤝 Contributing

We welcome contributions! Please read our [Contributing Guide](../CONTRIBUTING.md) for details on:
- Development workflow
- Coding standards
- Commit message conventions
- Pull request process

---

## 📄 License

Rune is open source software. See the [LICENSE](../LICENSE) file for details.

---

## 🔗 Resources

- **GitHub Repository**: [github.com/rune-org/rune](https://github.com/rune-org/rune)
- **Issue Tracker**: [GitHub Issues](https://github.com/rune-org/rune/issues)
- **Discussions**: [GitHub Discussions](https://github.com/rune-org/rune/discussions)

---

<p align="center">
  Built with ❤️ by the Rune Team
</p>
