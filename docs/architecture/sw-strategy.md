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

## Cache Naming

Use the following format for `CACHE_NAME`:

```text
boardgame-scorepad-cache-YYYY-MM-DD-NN
```

- `YYYY-MM-DD` is the date the cache namespace is introduced.
- `NN` is a two-digit cache revision for that date, starting at `01`.
- `NN` is not a global release or deployment counter.
- Increment `NN` only when a deployed asset or Service Worker behavior requires old cached assets to be discarded.
- Keep the previous cache namespace out of the new value so the activation handler removes it automatically.

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
