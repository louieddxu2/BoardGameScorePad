# Service Worker Strategy

## Goals
- Prevent stale/corrupted cached assets across environments.
- Keep local dev predictable (no hidden SW state).
- Keep production update flow stable on Vercel.

## Environment Rules
1. `DEV (localhost)`
- Do not keep SW registrations.
- Always unregister legacy workers to avoid HMR/cache conflicts.

2. `IDE Preview / Sandbox-like environments`
- Default to no SW registration unless explicitly enabled.
- Avoid accidental caching during rapid UI iteration.

3. `PROD (Vercel)`
- Register SW once from a single runtime entry.
- Call `registration.update()` after register.
- Use versioned `CACHE_NAME` in `public/sw.js`.

## Single Ownership Rule
- Runtime SW registration should live in one place only (`src/registerSW.ts`).
- `index.html` should only keep fallback UI logic for resource-load failure.

## Cache Safety
- Cache only same-origin `GET` requests.
- Exclude dev/internal paths (`/@`, `node_modules`, `__vercel`).
- Keep a strict core asset pre-cache list.

## Rollout Plan
1. Keep behavior unchanged and document current workflow.
2. Remove duplicate registration block from `index.html`.
3. Validate in three targets:
- local dev (`npm run dev`)
- preview environment
- production deployment
4. Add regression checklist for updates, offline mode, and recovery UI.
