# Testing Strategy

## Test Layers
1. Unit/logic tests (`vitest`)
- Fast, deterministic, run on every PR.

2. Integration-lite tests
- Run only when target paths change (e.g. `src/components/session/**`).

3. Full UI/E2E tests
- Run before release or on nightly schedule.

## Current Policy
- `npm test` remains default developer check.
- High-cost UI suites should be controlled by env flag (example: `RUN_UI_TESTS=1`).

## Recommended CI Gates
1. Required on every PR:
- `npx tsc --noEmit`
- `npm test`

2. Conditional:
- UI integration suite if session/dashboard critical paths changed.

3. Release gate:
- Full regression checklist (session flow, cloud sync, SW update behavior).
