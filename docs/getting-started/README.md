# Getting Started

Welcome to Rune! This section will help you get up and running with the platform quickly.

---

## 📚 In This Section

| Guide | Description |
|-------|-------------|
| [Installation](./installation.md) | Install and configure Rune |
| [Quick Start](./quick-start.md) | Get running in 5 minutes |
| [First Workflow](./first-workflow.md) | Create your first automation |
| [Core Concepts](./core-concepts.md) | Understand the fundamentals |

---

## 🚀 Quick Start (5 Minutes)

The fastest way to get Rune running is with Docker:

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- Git installed

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/rune-org/rune.git
cd rune

# 2. Copy environment file
cp .env.example .env

# 3. Start all services
make up

# 4. Open your browser
#    Frontend: http://localhost:3000
#    API Docs: http://localhost:8000/docs
```

That's it! You now have a fully functional Rune instance running locally.

---

## 🎯 What's Next?

After installation, we recommend following this learning path:

### 1️⃣ Explore the Interface
Open `http://localhost:3000` and familiarize yourself with:
- The workflow editor
- Template gallery
- Run history

### 2️⃣ Create Your First Workflow
Follow our [First Workflow Tutorial](./first-workflow.md) to:
- Create a simple HTTP request workflow
- Add logging and conditional logic
- Execute and monitor the workflow

### 3️⃣ Understand Core Concepts
Read about [Core Concepts](./core-concepts.md) to learn:
- How workflows are structured
- What nodes are and how they work
- How data flows between nodes

### 4️⃣ Dive Deeper
Once comfortable with basics:
- Explore the [Node Reference](../nodes/README.md) for all available operations
- Learn about [Credentials](../concepts/credentials.md) for secure integrations
- Check out [Templates](../concepts/templates.md) to reuse patterns

---

## 💡 Tips for Success

### Start Simple
Begin with simple, linear workflows before adding branching logic. This helps build intuition for how data flows through nodes.

### Use Logging
Add log nodes liberally during development. They help you understand what data is available at each step.

### Check the API Docs
The interactive API documentation at `http://localhost:8000/docs` lets you test endpoints directly and see request/response formats.

### Join the Community
Have questions? Check [GitHub Discussions](https://github.com/rune-org/rune/discussions) or open an issue.

---

## 🆘 Need Help?

- **Installation Issues**: See [Troubleshooting](./troubleshooting.md)
- **Common Questions**: Check our [FAQ](./faq.md)
- **Bug Reports**: Open a [GitHub Issue](https://github.com/rune-org/rune/issues/new)

---

[← Back to Docs Home](../README.md) | [Installation →](./installation.md)
