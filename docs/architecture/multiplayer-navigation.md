# Multiplayer Navigation Boundary

## Invariant

The existence of an active `GameSession`, a persisted multiplayer room, a
background reconnect, or a remote bootstrap must never navigate the application
to `AppView.ACTIVE_SESSION`.

The only valid entry sources are:

- `qr-join`: the user has just opened a room QR URL.
- `resume-active-session`: the user selected an active game from the dashboard.
- `start-new-session`: the user started a new game or saved a template as a game.

All other multiplayer work is background work. It may restore a transport,
update the local session snapshot, or update a room manager, but it must not
change the visible App view.

## Implementation Rule

Use `navigateToActiveSession` or the `enterActiveSession` callback for every
transition into the active score sheet. Do not call `setView(AppView.ACTIVE_SESSION)`
from a reconnect callback, `useEffect` that watches session data, room manager
subscription, remote bootstrap handler, or Service Worker event.

The QR `room` query is a one-time join intent. It is consumed before the
handshake begins. A normal page reload, opening the PWA, or returning to the
dashboard must not treat a persisted room as a navigation request. Explicit
resume from the dashboard is the only way to reattach a persisted room after
leaving the score sheet.
