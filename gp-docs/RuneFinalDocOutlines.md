# RUNE — Semester 2 / Graduation Thesis Outline

Standalone full thesis (restate + highlight new). Hybrid engineering core + academic chapters. Per-member contribution appendix. Three-level outline.

Legend:
- **[NEW]** — did not exist in Semester-1 document; defensible Sem-2 contribution
- **[EXPAND]** — existed in Sem-1 but has substantial new material this semester

---

## Front Matter
- Title page (update to Academic Year 2025–2026, semester 2; advance date)
- Abstract — rewrite to foreground graduation-year contributions: versioning, SSO, integration framework, agent-based execution, scheduler/archivist services, template ecosystem
- Dedications / Acknowledgments
- Table of Contents, List of Figures, List of Tables, List of Acronyms **[NEW]**
- Notation: "Sem-1 / Sem-2" tags used throughout to mark provenance of each subsystem

---

## Part I — Foundations

### 1. Introduction
- 1.1 Background and Motivation — restate Sem-1 motivation; add the "year-2 problem": moving from a working prototype to a graduation-quality platform
- 1.2 Problem Statement — explicitly add: trust (auth/SSO), governance (versioning, RBAC), extensibility (integration & node framework), reachability (webhooks, scheduler), shareability (templates)
- 1.3 Project Objectives — split into Sem-1 objectives (achieved baseline) and Sem-2 objectives (new) **[EXPAND]**
- 1.4 Project Scope — what was added, what is deliberately deferred (multi-region orchestration, custom model training)
- 1.5 Summary of Contributions **[NEW]** — bulleted list of Sem-2 deliverables; doubles as a roadmap of the thesis

### 2. Background and Related Work **[NEW — academic chapter]**
- 2.1 Workflow Automation Landscape
  - 2.1.1 Commercial systems (Zapier, Make.com, Workato) — UX-first, closed
  - 2.1.2 Open-source systems (n8n, Activepieces, Windmill, Node-RED, Apache Airflow, Temporal) — comparison along low-code, AI-native, self-hostable axes
  - 2.1.3 Positioning matrix for RUNE
- 2.2 Domain-Specific Languages for Workflows — JSON/YAML DSLs, BPMN, code-as-config; trade-offs that motivate RUNE's typed JSON DSL
- 2.3 AI Agents and Tool-Use Frameworks — ReAct, LangChain/LangGraph, Google ADK, MCP; relevance to Agent node and Smith
- 2.4 Identity Federation in SaaS Platforms — SAML 2.0, OIDC, OAuth2 authorization-code flow; basis for Sem-2 SSO chapter
- 2.5 Real-Time Execution UIs — survey of execution visualization patterns (Airflow Graph View, Temporal UI, n8n)
- 2.6 Gaps the Project Addresses — explicit gap analysis bridging into Sem-2 contributions

### 3. Requirements and Methodology **[NEW]**
- 3.1 Functional Requirements — versioning, SSO, scheduling, integrations, templates, webhook triggers, agent execution
- 3.2 Non-Functional Requirements — latency budgets, durability, multi-tenant isolation, observability, accessibility
- 3.3 Engineering Process — RFC-driven design (cite `services/rune-worker/rfcs/` and `dsl/RFC-DSL-GENERATOR.md`), conventional commits, PR-title CI, Renovate-managed dependency hygiene
- 3.4 Tooling for Multi-Person Development — Hivemind dev runner, generated-code boundaries, CodeQL, golangci-lint, ruff, vitest
- 3.5 Sprint Cadence and Issue Tracking — short narrative of the semester's milestones

---

## Part II — System Architecture (engineering core)

### 4. System Architecture
- 4.1 High-Level Architecture **[EXPAND]** — refreshed diagram to add Scheduler, Archivist, Webhook ingress, SSO/OAuth2 flows, Templates bundle, Docs (Nextra) and CLI as first-class citizens
- 4.2 Components Overview — updated component list with Sem-2 additions tagged
- 4.3 Technology Stack
  - 4.3.1 Why FastAPI / Go / Rust / RabbitMQ / Postgres / Redis — carry over from Sem-1
  - 4.3.2 New stack additions **[NEW]** — `uv` toolchain, MongoDB (RTES persistence), Google ADK Go, LangChain/LiteLLM (Smith), Nextra docs, Bubble Tea (CLI)
- 4.4 Communication Flow **[EXPAND]** — refreshed with webhook trigger entry, scheduler trigger entry, OAuth2 token refresh interactions, RTES live execution history
- 4.5 Design Principles — stateless workers, generated contracts, RFC-driven node changes, single-responsibility services
- 4.6 Repository and Monorepo Layout **[NEW]** — Makefile-orchestrated targets, generated-code boundaries (`src/client/`, `dsl/generated/`, `template.schema.json`)

### 5. Workflow DSL and Type System
- 5.1 DSL Definition and Versioning — `dsl/dsl-definition.json` as canonical schema
- 5.2 Core DSL Components — workflow, node, edge (carry over from Sem-1)
- 5.3 Supported Node Types **[EXPAND]** — original 12 plus: `agent`, `datetime` family (split), `log`, list-operation family, integration framework nodes, `webhook` trigger
- 5.4 Parameter Resolution and Expression Evaluation — Goja sandbox semantics, `$node.path` references, `{{ ... }}` expressions
- 5.5 Error Handling Strategies — halt/ignore/branch, error_edge semantics
- 5.6 Schema Validation — JSON schema validation, modular validator pipeline **[EXPAND]**
- 5.7 The DSL Generator **[NEW]**
  - 5.7.1 Motivation — drift between TS/Python/Go types
  - 5.7.2 Generator design (`dsl/generator/`)
  - 5.7.3 Generated TypeScript / Python / Go types and how they are consumed
  - 5.7.4 Integration with API and Worker (referencing `feat(worker): replace manual types with generated DSL package`)
  - 5.7.5 CI checks for drift

### 6. Backend API (FastAPI Master)
- 6.1 Overview and Responsibilities
- 6.2 Domain Modules — auth, users, credentials, workflows, executions, templates, scryb, smith, scheduler, webhook, oauth, permissions, internal, setup
- 6.3 Workflow Lifecycle (high level) **[EXPAND]** — add publish/version cutover, webhook ingress path, scheduler internal-run path
- 6.4 Database Layer
  - 6.4.1 SQLModel / async SQLAlchemy patterns
  - 6.4.2 Alembic migration discipline **[NEW]** — `make db-revision`, `make db-upgrade`, startup auto-migration warning
- 6.5 Queueing Layer
  - 6.5.1 Publisher modules (`workflow/queue.py`)
  - 6.5.2 NodeExecutionMessage contract
  - 6.5.3 Completion and token publishers
- 6.6 Internal Endpoints **[NEW]** — `X-Internal-Key`-protected `/internal/workflows/{id}/run` consumed by scheduler
- 6.7 Migration from pip/venv to `uv` **[NEW]** — rationale and impact on CI/dev-loop

### 7. Worker Engine (Go)
- 7.1 Overview and Recursive Executor (RFC-001)
- 7.2 Node Registry and Resolver — `pkg/registry`, `pkg/resolver`
- 7.3 Control-Flow Nodes — switch, split/aggregate, merge, wait, conditional (RFC-003..006)
- 7.4 Data-Transformation Nodes — edit, list-operation family (RFC-007/008) **[EXPAND]**
- 7.5 DateTime Family **[NEW]** — RFC-009 and the `refactor!: split datetime node into typed family` redesign
- 7.6 Integration Node Framework **[NEW]** — RFC-010
  - 7.6.1 Framework design (`pkg/integrations`)
  - 7.6.2 Gmail tooling
  - 7.6.3 Google Sheets (ReadRange)
  - 7.6.4 Microsoft Outlook
  - 7.6.5 Provider qualification model
- 7.7 Agent Node **[NEW]** — Gemini via Google ADK Go (PR #579)
  - 7.7.1 Architecture and tool-use binding
  - 7.7.2 Streaming, cancellation, cost guards
- 7.8 MCP Support **[NEW, status note]** — initial integration (PR #584) and its subsequent revert; lessons learned, current direction
- 7.9 Observability Hooks in the Worker

### 8. RTES (Rust)
- 8.1 Overview and Responsibilities
- 8.2 Architecture and Module Decomposition **[EXPAND]** — large-file refactor (PR #345)
- 8.3 MongoDB Execution Store
- 8.4 Token Store and Authorization Flow
- 8.5 WebSocket Streaming — load-then-live, history replay
- 8.6 Multi-Execution and Multi-Workflow Subscription **[NEW]** — list-of-IDs support (PR #345)
- 8.7 Known Limitations — split-node executions

### 9. Archivist Service **[NEW chapter]**
- 9.1 Purpose — durable completion recording
- 9.2 Topic Exchange Binding (`workflows` / `workflow.completion`)
- 9.3 Schema Compatibility with API Execution Model
- 9.4 Failure Modes and Idempotency

### 10. Scheduler Service **[NEW chapter]**
- 10.1 Motivation — replacing in-process timers; durability across restarts
- 10.2 Polling Loop and SQL Design (`src/db.py`)
- 10.3 Internal API Client (`src/client.py`)
- 10.4 `next_run_at` Advancement Semantics — chosen before-vs-after trade-off
- 10.5 Comparison with Sem-1 Wait Trigger Approach (cross-ref §6 of Sem-1 doc)

### 11. Webhook Trigger Subsystem **[NEW chapter]**
- 11.1 Ingress Endpoint (`webhook` API module)
- 11.2 Canvas-Side Webhook Trigger Node (PR #598)
- 11.3 Authentication and Replay Protection
- 11.4 Payload Shape and Resolution into `$input`

### 12. Data Flow and Execution Lifecycle
- 12.1 Overview (refreshed from Sem-1)
- 12.2 High-Level Execution Flow — including new trigger paths (manual, scheduled, webhook)
- 12.3 Message and Data Lifecycles
- 12.4 Wait / Resume Semantics — relationship to Scheduler service
- 12.5 Error Handling and Retry Behavior
- 12.6 Real-Time Updates via RTES
- 12.7 Observability and Auditing

---

## Part III — Frontend & User Experience

### 13. Frontend Application
- 13.1 Stack and Conventions — Next.js, route groups, generated client, `src/features/`, `src/components/`
- 13.2 Home, Dashboard, Canvas Pages **[EXPAND]** — updated screenshots and feature lists
- 13.3 Canvas Workflow Builder
  - 13.3.1 Node Libraries and Centralized Metadata Registry **[NEW]** — PR #291
  - 13.3.2 Drag-and-drop and Click-to-Connect **[NEW]** — PR #452
  - 13.3.3 Keyboard Shortcuts for Node Placement **[NEW]** — PR #314
  - 13.3.4 Library Pane Behavior (auto-collapse, viewport-center insert)
  - 13.3.5 Node Inspector Revamp **[EXPAND]** — execution inspectors PR #378, agent inspector polish PR #602, variable picker PR #542
  - 13.3.6 Rename-Variable Propagation **[NEW]** — PR #390
  - 13.3.7 Workflow Name in Toolbar **[NEW]** — PR #632
  - 13.3.8 Onboarding Tour **[NEW]** — PR #605
- 13.4 Execution Visualization
  - 13.4.1 Historical Workflow Graph Snapshots **[NEW]** — PR #379
  - 13.4.2 Execution Deep-Linking via URL **[NEW]** — PR #442
  - 13.4.3 Real-time Execution Viewer (carry over, refreshed)
- 13.5 Dashboard and Workflow Management
  - 13.5.1 Bulk Actions and Quick Actions **[NEW]** — PRs #444, #403
  - 13.5.2 User-Scoped Executions View **[NEW]** — PR #411
  - 13.5.3 Workflow Status & Inactive Workflows **[NEW]**
  - 13.5.4 Workflow Description Edit **[NEW]**
- 13.6 Templates UI
  - 13.6.1 Template Library Page Redesign **[NEW]**
  - 13.6.2 Tag-based Discoverability **[NEW]**
  - 13.6.3 Delete Templates with Confirmation **[NEW]**
- 13.7 Auth and Identity Surfaces
  - 13.7.1 SSO Entry Point on Sign-in **[NEW]** — PR #454
  - 13.7.2 SAML Callback Flow **[NEW]** — PR #429
  - 13.7.3 SSO-Only Account Guard **[NEW]** — PR #448
  - 13.7.4 Cross-Tab Session Sync **[NEW]** — PR #629
- 13.8 Admin Surfaces
  - 13.8.1 Admin SAML Settings UI **[NEW]** — PR #382
  - 13.8.2 User Activation UI **[NEW]** — PR #377
  - 13.8.3 Admin Guard Hardening **[NEW]** — PR #458
- 13.9 Light Mode and Visual Theming **[NEW]** — PR #511 and notebook-paper styling
- 13.10 Frontend Architecture Improvements **[NEW]**
  - 13.10.1 FlowCanvas Decomposition — PR #318
  - 13.10.2 Shared Confirmation Dialog and Standardized Error Handling — PRs #351, #366
  - 13.10.3 DialogContent ergonomic upgrades — PR #623
  - 13.10.4 Loading / Error Boundaries per Route Group — PR #332
  - 13.10.5 Centralized State Management Patterns
- 13.11 Frontend Testing Environment **[NEW]** — Vitest + RTL setup (PR #466) and coverage push (PR #574)

### 14. Documentation Site **[NEW chapter]**
- 14.1 Nextra Integration in App Router (PR #371)
- 14.2 Content Organization
- 14.3 In-Product Discoverability Links

### 15. CLI (RUNE CLI) **[NEW chapter]**
- 15.1 Motivation — local automation, ops tasks
- 15.2 Bubble Tea TUI Architecture
- 15.3 Database Management Endpoints
- 15.4 File Architecture and Styles
- 15.5 Roadmap

---

## Part IV — Cross-Cutting Concerns

### 16. Identity, Access, and Federation **[NEW chapter — major Sem-2 work]**
- 16.1 Authentication Model Refresher — password/token/validator module split (PR #333)
- 16.2 SAML 2.0 SSO **[NEW]**
  - 16.2.1 Protocol summary
  - 16.2.2 IdP-initiated and SP-initiated flows
  - 16.2.3 Admin configuration surface
  - 16.2.4 Callback exchange and session minting
- 16.3 OAuth2 BYO Client **[NEW]** — PR #568
  - 16.3.1 Authorization-code flow with user-provided client
  - 16.3.2 Refresh handling and HTTP Bearer use in integrations
  - 16.3.3 Execution-error UX
- 16.4 Role-Based Access Control **[NEW]** — PR #258
  - 16.4.1 Role model and permission helpers
  - 16.4.2 Frontend gating
  - 16.4.3 Admin overrides and visibility warning (PR #512)
- 16.5 Credential Storage and Dependency Tracking **[EXPAND]**
  - 16.5.1 Encryption-at-rest (Sem-1 carryover)
  - 16.5.2 Usage Tracking and Safe Delete **[NEW]** — PR #562

### 17. Workflow Versioning **[NEW chapter — major Sem-2 work]**
- 17.1 Motivation — reproducibility, rollback, safe iteration
- 17.2 Backend Cutover (PR #396) — schema, draft vs. published, migration plan
- 17.3 Frontend Versioning (PR #424) — history view, snapshot navigation
- 17.4 Execution Pinning to Versions
- 17.5 Historical Graph Replay in Canvas (PR #379)
- 17.6 Interaction with Templates and Export

### 18. Templates Ecosystem **[NEW chapter]**
- 18.1 Template Model and Storage
- 18.2 Official + Community Bundle Architecture — `rune-templates` submodule, `services/api/templates_bundle/`
- 18.3 Schema Contract — `TemplateBundleEntry` ↔ `template.schema.json`; drift detection via `make api-check-template-schema`
- 18.4 Seeder Logic — `src/templates/seeder.py`, `external_id` upsert, official vs. community routing
- 18.5 Credential Stripping on Global Export (PR `9351f37`)
- 18.6 Lifecycle — create, share, delete (admin override semantics)

### 19. AI Capabilities
- 19.1 Smith (Workflow Generator) **[EXPAND]** — LangChain refactor (PR #284), prompt structure, guardrails
- 19.2 Scryb (Documentation Generator) — carryover with current router prefix (PR #348)
- 19.3 Agent Node in Workflows **[NEW]** — see §7.7; this section frames it from an AI-features perspective
- 19.4 Model Selection, Cost, and Safety
- 19.5 Roadmap toward MCP-native Tool Use

### 20. Workflow Validation **[NEW chapter]**
- 20.1 Modular Validation System (PR-c1dc6f3)
- 20.2 Multi-Error Collection (PR `2d053dc`)
- 20.3 Validation Touchpoints — save, publish, execute, import
- 20.4 Error Surface in the Canvas

### 21. Reliability, Concurrency, and Operations
- 21.1 Save Deduplication and Concurrent Save Prevention (PR `9eedad9`)
- 21.2 Workflow Status Lifecycle and Computation
- 21.3 RabbitMQ Tuning and Pool Configuration
- 21.4 Migration Bootstrap at API Startup (PR #451)
- 21.5 Failure Modes Catalog — webhook ingress, scheduler triggers, agent timeouts

### 22. Security
- 22.1 Authentication and Authorization (refreshed; see §16)
- 22.2 Secrets and Credentials Handling (refreshed; see §16.5)
- 22.3 Workflow Runtime Protections — Goja sandbox, integration scopes
- 22.4 Sharing Strategies and Credential-Safe Export **[EXPAND]**
- 22.5 Supply-Chain Security **[NEW]** — Renovate, CodeQL (PR #463), Dependabot, pinned actions (PR #462), `minimumReleaseAge` policy
- 22.6 Threat Model Summary

### 23. Testing Strategy
- 23.1 Frontend Testing — Vitest + RTL, fixture and render conventions (PRs #466, #574)
- 23.2 API Testing — pytest, async fixtures
- 23.3 Worker Testing — unit / integration / e2e via `scripts/run_tests.py` (PRs #606 etc.)
- 23.4 RTES Testing
- 23.5 DSL Generator Tests
- 23.6 AI Component Testing — golden prompts, evaluation harness
- 23.7 CI/CD Test Orchestration — conventional-commit PR title check, golangci-lint, ruff, format checks

### 24. Deployment and DevOps
- 24.1 Containerization and Compose Files
- 24.2 Hivemind Dev Runner **[NEW]** — single-command startup (PR #418)
- 24.3 Makefile as Orchestrator **[EXPAND]** — archivist (PR #412), Alembic targets (PR #388), api-test (PR #248)
- 24.4 Nginx Reverse Proxy
- 24.5 CI/CD Pipelines — client regen attribution (PR #447), API client gen (PR #445), web format check (PR #439)
- 24.6 Observability Stack — OpenTelemetry collector, OpenObserve
- 24.7 Building (Prereqs, Env, Makefile, Compose, Cleanup) — refresh from Sem-1
- 24.8 Production Deployment Considerations

---

## Part V — Evaluation and Reflection **[NEW academic part]**

### 25. Evaluation
- 25.1 Evaluation Methodology — what we measured and how
- 25.2 Functional Coverage — node-type matrix, integration matrix vs. n8n baseline
- 25.3 Performance Measurements — end-to-end execution latency, queue throughput, RTES WebSocket fan-out, agent-node latency
- 25.4 Reliability Measurements — recovery from worker kill, RabbitMQ redelivery, scheduler misfire
- 25.5 Usability Study — onboarding-tour completion, time-to-first-workflow, template-driven workflows
- 25.6 Security Posture — CodeQL findings remediated, dependency-update SLA
- 25.7 Comparative Discussion — RUNE vs. n8n, Activepieces, Make.com on chosen axes

### 26. Discussion and Limitations
- 26.1 Architectural Trade-offs Made This Year
- 26.2 What Worked Well
- 26.3 Pain Points and Known Bugs (e.g., split-node executions in RTES)
- 26.4 Reverted Work and What We Learned (MCP first attempt)

### 27. Future Work
- 27.1 Multi-tenant Hardening, Quotas, Per-org Isolation
- 27.2 Distributed Worker Orchestration
- 27.3 Custom Model Selection per Workflow
- 27.4 Marketplace for Templates and Integrations
- 27.5 Plugin SDK for Third-Party Nodes
- 27.6 Mobile / Embedded Canvas
- 27.7 Compliance Posture (SOC2, GDPR data residency)

### 28. Conclusion
- 28.1 Summary of Sem-2 Contributions
- 28.2 Reflection on the Two-Semester Arc
- 28.3 Closing Remarks

---

## Part VI — References and Appendices

### 29. References
- 29.1 Project Resources
- 29.2 Core Technologies
- 29.3 Development Tools
- 29.4 Observability and Monitoring
- 29.5 Academic and Industry References **[NEW]** — papers/standards cited in §2 and §16

### Appendix A — Per-Member Contributions **[NEW]**
- A.1 Shehab Mahmoud — primary areas, key PRs, lines-of-code summary
- A.2 Abdelrahman Hany — ditto
- A.3 Youssef Shahean — ditto
- A.4 Seif Tamer — ditto
- A.5 Seif Elwarwary — ditto
- A.6 Omar Mamon — ditto
- A.7 Habiba El Sayed — ditto
- A.8 Zeynat Haytham — ditto
- A.9 Shahd Ashraf — ditto
- A.10 Contribution Matrix — table mapping each member to feature areas / PRs / chapters
- A.11 Collaboration Practices — RFCs, code review, pair-programming notes

### Appendix B — API Reference (refreshed from OpenAPI)

### Appendix C — Message Schemas
- NodeExecutionMessage, CompletionMessage, ExecutionToken — refreshed from current code

### Appendix D — DSL Schema **[NEW]** — pretty-printed from `dsl/dsl-definition.json`

### Appendix E — Database Schema and Migration Timeline **[NEW]**

### Appendix F — Configuration Reference (env vars, secrets, queues)

### Appendix G — Deployment Guide (refreshed)

### Appendix H — Glossary and Acronyms

---

## Notes on using this outline
- Every subsection is tagged — during writing, sort by `[NEW]` to surface the defensible Sem-2 contribution list when the committee asks "what did you do this semester?"
- §2 (Related Work) and §25 (Evaluation) are the chapters that move this from "engineering report" to "graduation thesis"; budget the most writing time there — they aren't represented in Sem-1.
- Appendix A is empty on purpose. Seed it from a member→PR mapping, or run `git log --author=...` per teammate to populate.
