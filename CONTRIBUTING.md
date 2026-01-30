# Contributing to Rune

Thank you for investing time into improving Rune. This document covers the expectations for filing issues, opening pull requests, and meeting the project's quality bar.

## Ways to Contribute

- **Report bugs** by opening a GitHub issue with clear reproduction steps and logs.
- **Request features** with context on the desired workflow and business need.
- **Triage issues** by helping confirm bugs, reproductions, or suggesting solutions.
- **Contribute code or docs** through pull requests that follow the workflow below.

## Development Workflow

1. **Discuss first**: Comment on an existing issue or open a new one so maintainers can help scope the work.
2. **Create a branch** from `main` using a descriptive name such as `feat/composable-workflows` or `fix/api-race`.
3. **Set up your environment**:
   ```bash
   make install        # Install dependencies for all services
   make dev-infra-up   # Start infrastructure (Postgres, Redis, RabbitMQ, MongoDB)
   ```
   Then start individual services with `make web-dev`, `make api-dev`, `make worker-dev`, or run everything with `make up`.
4. **Make focused changes**; keep each PR tightly scoped and update documentation/configuration when behavior changes.
5. **Run the quality checks** described below before pushing.
6. **Open a pull request** that references the related issue and summarizes the change along with any trade-offs.

## Conventional Commits

Rune uses the [Conventional Commits](https://www.conventionalcommits.org/) spec for all commits. Every commit message should follow the structure `type(scope?): short summary` where:

- `type` communicates the intent of the change:
  - `feat` – new user-facing functionality
  - `fix` – bug fixes
  - `docs` – documentation-only updates
  - `style` – formatting, missing semi-colons, etc.
  - `refactor` – code changes that neither fix bugs nor add features
  - `test` – adding or correcting tests
  - `build` – build system, dependencies, Docker, Makefile
  - `ci` – CI/CD changes
  - `perf` – performance improvements
  - `chore` – maintenance tasks that do not affect production code
  - `revert` – revert a previous commit
- `scope` is optional but helps clarify what area changed (e.g., `api`, `web`, `worker`, `rtes`, `canvas`, `auth`).
- The summary is imperative, 50 characters or fewer, and written in lower case.

Examples:

```
feat(web): add workflow timeline view
fix(worker): guard nil pointer in scheduler
feat(canvas): add split and merge nodes
fix(rtes): handle websocket reconnection
docs: update quick start guide
```

## Testing and Quality

Always run the relevant checks locally before pushing:

```bash
make test       # Run frontend and worker tests
make lint       # Run all linters (ESLint, Ruff, go vet)
make typecheck  # TypeScript type checking for frontend
make format     # Auto-format all code (Prettier, Ruff, go fmt)
```

Service-scoped commands for faster iteration:

| Service | Commands |
|---------|----------|
| Frontend (`apps/web`) | `make web-test`, `make web-lint`, `make web-typecheck`, `make web-format` |
| API (`services/api`) | `make api-lint`, `make api-format` |
| Worker (`services/rune-worker`) | `make worker-test`, `make worker-lint`, `make worker-format` |
| RTES (`services/rtes`) | `cargo test`, `cargo clippy`, `cargo fmt` |

If your change affects infrastructure or documentation, verify Docker Compose still starts (`make up`) and that Markdown renders correctly.

## Pull Request Checklist

- [ ] The PR description references the related issue or clearly states the purpose.
- [ ] Tests, lint, and typecheck pass locally for all affected services.
- [ ] Documentation, configs, or example files are updated when behavior changes.
- [ ] Screenshots or recordings are attached for UI-impacting changes.
- [ ] Commits follow the Conventional Commits format.

## Questions?

If you are unsure about anything, open a GitHub issue or tag a maintainer in your PR. We are happy to help you land your contribution.
