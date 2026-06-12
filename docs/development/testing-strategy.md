# Testing Strategy

## Test Layers
1. Unit/logic tests (`vitest`)
- Fast, deterministic, run on every PR.

2. Integration-lite tests
- Run only when target paths change (e.g. `src/components/session/**`).

3. Full UI/E2E tests
- Run before release or on nightly schedule.

## Current Policy
- `npm test` / `npm run test:core`: daily checks for regular changes.
- `npm run test:release`: full pre-release validation (includes high-cost UI suites).
- In this Codex environment, prefer `npx vitest run --exclude "{src/components/session/SessionUI.test.tsx,src/utils/ui-consistency.test.ts}"` for the core suite.
- For UI, i18n, visible text, modal, button-label, or dashboard panel changes, also run `powershell -ExecutionPolicy Bypass -File scripts\scan-hardcoded-chinese.ps1`.
- Do not open browser-based visual verification unless the user explicitly asks for it.

## Recommended CI Gates
1. Required on every PR:
- `npx tsc --noEmit`
- `npm test`

2. Conditional:
- UI integration suite if session/dashboard critical paths changed.

3. Release gate:
- Full regression checklist (session flow, cloud sync, SW update behavior).
