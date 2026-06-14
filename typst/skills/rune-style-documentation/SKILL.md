---
name: rune-style-documentation
description: Guidelines and style standards for writing the RUNE Technical Book and Thesis. Use this skill when drafting new chapters, defining system architecture, documenting services (FastAPI, Go Worker, Rust RTES, Scheduler, Archivist), explaining end-to-end message flows, or detailing the DSL.
---

# RUNE Style Documentation Guide

This skill ensures that all technical chapters, theses, and book sections drafted for RUNE conform to a cohesive, academic, human-readable format. It prevents wordy "AI slop" and enforces a high-density, simple-yet-technical engineering style.

---

## 1. Core Book/Thesis Structure

Every section or chapter added to the RUNE book must follow this sequential, top-down structure:

### Phase I: High-Level Architecture (The Gateway)
Always establish the global system topology before zooming into individual components.
- **Content:** The Master-Worker model, RabbitMQ broker interaction, PostgreSQL transactional persistence, and Redis pub/sub WebSocket synchronization.
- **Visuals:** Provide exactly one high-quality diagram showing service topologies and connection routes. Avoid cluttering this section with database schemas or low-level queue configurations.

### Phase II: The Full End-to-End Execution Flow
Show how data moves across the system in real time. This section binds all components together.
- **Flow Steps:**
  1. **User Action:** Client triggers workflow via UI or webhook.
  2. **Control Plane:** FastAPI Master validates DSL, resolves vault credentials, and publishes a `node-execution` task payload to RabbitMQ.
  3. **Message Broker:** RabbitMQ dispatches the task to the designated worker queue.
  4. **Worker Engine:** Go Worker consumes the payload, interprets node parameters, runs logic concurrently, and updates status in Redis.
  5. **Real-Time Broadcast:** Redis pub/sub triggers Rust RTES to stream execution metrics via WebSockets.
  6. **UI Render:** Next.js frontend updates the execution trace nodes in real-time.

### Phase III: Iterative Service Analysis
For every service in the stack, write a dedicated sub-section. **You must iterate over all five services:**
1. **Backend API Master (FastAPI - Python)**
2. **Worker Engine (Go)**
3. **Real-Time Execution Service / RTES (Rust)**
4. **Scheduler Service (Python)**
5. **Archivist Service (Python)**

For each service, structure the content using these headings:
- **Component Responsibilities:** Simple, active English explaining exactly what the service owns and its logical boundaries.
- **Key Features:** Clean, bulleted list of actual features, described in accessible but technically-grounded language (e.g., "AES-256 Vault storage" instead of "Safe data saving").
- **Major Architecture Decisions & Tools:** Why the specific tool/language was chosen (e.g., "Go for its concurrent goroutine execution model and small memory footprint" or "Rust for safety and memory-efficient WebSocket broadcasting").
- **Limited, High-Impact Code Snippets:** Focus snippets strictly on the core engine decisions or routing definitions (e.g., the exact structure of the Go execution loop or Rust socket channel). Avoid boilerplate code or lengthy files. Keep snippets under 25 lines.

### Phase IV: Domain-Specific Language (DSL) Architecture
Explain the internal JSON/YAML schema coordinating the workflow nodes.
- **Content:** How nodes, edges, inputs, and outputs are defined.
- **Code:** Embed a minimal, annotated DSL snippet representing a single-node task structure (not a 100-line workflow).

---

## 2. Writing Style: Eliminating "AI Slop"

To ensure the book reads like a peer-reviewed paper or a professional O'Reilly-style engineering book, follow these rules:

### A. The "Banned Words" Index
Do not let generic AI transitional structures creep into the prose.
- **Strictly Banned:** `delve into`, `testament to`, `revolutionize`, `seamlessly`, `furthermore`, `tapestry`, `beacon`, `pivotal role`, `demystify`, `journey`, `game-changer`.
- **Preambles are forbidden:** Never write *"In this section, we will explain..."* or *"As we explored in the previous chapter..."*. Dive straight into the subject matter: *"RUNE is a Master-Worker platform..."*.

### B. Tone and Clarity
- **Simple, Direct English:** Use short sentences. Use active voice where possible.
  * *Bad (AI style):* `"A connection is established by the client to the RTES server, where WebSocket connection handshakes are seamlessly completed."`
  * *Good (Human style):* `"The client establishes a WebSocket connection with RTES to receive streaming execution updates."`
- **Fact Density:** If a paragraph does not contain a concrete technical choice, data transition, or software-engineering rationale, delete it or rewrite it.

---

## 3. Image-to-Word Balance

A perfect textbook balances concise text with highly specific, non-obvious visual references.

- **The Limit:** Max 1–2 figures per major section.
- **The "No UI Clutter" Rule:** Never include screenshots of standard inputs, login screens, account profiles, or basic tables. They add zero educational value.
- **Allowed Visuals:**
  - High-level topology flowcharts.
  - Message exchange and routing sequences.
  - Real-time Redis state-machine transition charts.
- **Integration:** Every image must be wrapped in a Typst `#figure(...)` with a label, and referenced directly in the preceding prose.
