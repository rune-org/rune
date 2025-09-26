# Rune

Rune is a low‑code workflow automation platform.

## Repository Structure
- `apps/web` – Next.js web application (frontend)
- `services` – backend services (planned)
- `packages/*` – shared libraries (planned)

## Requirements
- Node.js 20 (see `.nvmrc`)
- pnpm 9 (via Corepack or manual install)

## Setup
1) Use Node 20
   - `nvm use` (or install Node 20 if needed)
2) Enable pnpm
   - Preferred (Corepack):
     - `corepack enable`
     - `corepack prepare pnpm@9.0.0 --activate`
   - Or install manually: `npm i -g pnpm@9.0.0`
3) Install deps at the repo root (creates the root lockfile):
   - `pnpm install`

## Common Commands
- Install dependencies (root):
  - `pnpm install`
- Run the web app (choose one):
  - From root: `pnpm --filter web dev`
  - From app: `cd apps/web && pnpm dev`
- Lint all packages: `pnpm lint`
- Typecheck all packages: `pnpm typecheck`
- Build all packages: `pnpm build`
- Test all packages: `pnpm test`

See the Makefile for shorthand targets.
