# API Wrapper Conventions

## Purpose

- Provide stable, human‑readable names over the generated [SDK](../../client/sdk.gen.ts).
- Make imports consistent: `import { auth, workflows, users } from '@/lib/api'`.

## Structure

- `auth.ts`: login, refreshAccessToken, logout, getMyProfile, adminCreateUser, firstAdminSignup, checkFirstTimeSetup.
- `workflows.ts`: listWorkflows, getWorkflowById, createWorkflow, updateWorkflowName, updateWorkflowStatus, deleteWorkflow, runWorkflow.
- `users.ts`: admin list/get/create/update/delete + self‑service profile get/update.
- `index.ts`: barrel export.

## Usage

- Auth example:
  - `import { auth } from '@/lib/api'`
  - `const { data, error } = await auth.login(email, password)`
- Workflows example:
  - `import { workflows } from '@/lib/api'`
  - `const { data, error } = await workflows.listWorkflows()`
- Users example:
  - `import { users } from '@/lib/api'`
  - `const { data, error } = await users.getMyProfile()`

Error Handling Pattern

- SDK functions return `{ data, error, response }`.
- Recommended helper:
  - `function assertOk<T>(r: { data?: T; error?: any }): T { if (r && 'error' in r && r.error) throw r.error; return r.data as T; }`
  - Use: `const profile = assertOk(await users.getMyProfile())`.
- Alternatively, continue branching on `error`.

401 → Refresh → Retry (see [`setupClientInterceptors.ts`](./setupClientInterceptors.ts))

- Behavior: on any 401 (excluding `/auth/*` endpoints), the client will:
  1. Refresh the access token once (using `auth:refresh_token`).
  2. Retry the original request once (guarded by `x-retried: 1`).
  3. If refresh fails, clear auth and redirect to `/sign-in`.

### Notes

- Interceptor skips `/auth/*` routes to avoid loops.
- Concurrency is deduped so only one refresh runs if multiple requests 401 simultaneously.

## Adding New Wrappers

- Create a new file under `apps/web/src/lib/api/` (e.g., `integrations.ts`).
- Import the generated function(s) from `@/client` and re‑export clear names:
  ```ts
  import { someOperationFooBarGet } from "@/client";
  export const getFooBar = () => someOperationFooBarGet();
  ```
- Export types from `@/client/types.gen` as needed.
- Add to `index.ts` for easy imports.

## Generated Code & Naming

- Do not edit files in `apps/web/src/client/*` directly, use the wrapper pattern above.
- Keep wrapper function names clear for maintainability.
