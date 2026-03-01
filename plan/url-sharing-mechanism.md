# URL Sharing Mechanism (Current Version)

This document reflects the implemented behavior in `V3test`.

## Scope
- Only built-in scoreboards are shareable by URL in the current phase.
- Shared link opens the built-in scoreboard setup modal (not direct session start).
- User can still choose player count and location before starting.

## URL Format
- Hash format:
  - `#v=1&src=builtin&id=<shortId>`
- Example:
  - `#v=1&src=builtin&id=Agricola`
- `id` uses short ID (without `Built-in-` prefix) to keep URL shorter.

## Runtime Flow
1. App boot parses `window.location.hash`.
2. If hash matches `v=1 + src=builtin + id`, resolve built-in template by short ID.
3. If found, open setup modal for that built-in template.
4. If invalid or not found, stay on dashboard and show warning (not-found case).
5. Hash is cleared after handling (success/failure/invalid) to avoid repeated triggering.

## UI Change
- Built-in library cards no longer use the JSON copy button.
- For built-in cards, the button is replaced with "copy share link".

## Why hash is cleared
- Prevents repeated deep-link side effects on refresh/back.
- Avoids users getting stuck with bad links.
- Treats deep link as one-time action input, not persistent screen state.

## Test Level
- Unit tests:
  - deep link parse/build/ID conversion utilities.
- Integration tests (`App` level):
  - valid link opens setup modal.
  - valid-but-missing template shows warning + stays dashboard.
  - invalid hash is ignored + stays dashboard.
  - hash is cleared in all handled cases.

## Future Extensions (Not implemented yet)
- `src=packed` for compressed custom template payload.
- `src=cloud` for cloud shared template ID.
- Optional explicit short-code map for built-ins if naming changes are expected.
