# Rune

Rune is a low‑code workflow automation platform.

## Repository Structure
- `apps/web` – Next.js web application (frontend)
- `services` – backend services (planned)
- `packages/*` – shared libraries (planned)

## Requirements
- Node.js 20
- pnpm 9 (via Corepack or manual install)

## Setup
1) Use Node 20
   - `nvm use` (or install Node 20 if needed)
2) Enable pnpm
   - Preferred (Corepack):
     - `corepack enable`
     - `corepack prepare pnpm@9.0.0 --activate`
   - Or install manually: `npm i -g pnpm@9.0.0`
3) Install dependencies inside the web app:
   - `cd apps/web && pnpm install`

## Common Commands (web)
- Dev: `cd apps/web && pnpm dev`
- Build: `cd apps/web && pnpm build`
- Start: `cd apps/web && pnpm start`
- Lint: `cd apps/web && pnpm lint`
- Typecheck: `cd apps/web && pnpm typecheck`
- Test: `cd apps/web && pnpm test`
