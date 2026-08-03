# Touch diagnostics

The session view has an opt-in touch audit. It does not change score-cell behavior. When enabled, it records:

- `touchstart`, `touchend`, `pointerdown`, `pointerup`, cancellation, and `click` events;
- the event target and the element under the touch coordinate;
- the matched score-cell identifier, pointer details, and UI state;
- whether a touch ended without a follow-up compatibility `click`;
- whether the score handler accepted or rejected the click.

## Enable on a real device

Open the session page, then run this in the browser console before reproducing the issue:

```js
localStorage.setItem('scorepad_touch_diagnostics', '1');
location.reload();
```

Alternatively, add `?debugTouch=1` to the page URL.

After the issue occurs, export the evidence:

```js
copy(window.__scorePadTouchDiagnostics.exportJson());
```

If `copy` is unavailable, use:

```js
window.__scorePadTouchDiagnostics.exportJson();
```

The most important records are `tap-without-click`, `click`, and `score-handler`. A `tap-without-click` means the browser delivered the touch end but did not deliver a compatibility click within 900 ms. A `score-handler` with `rejected:*` means the click arrived but application state or permissions rejected it.

Clear the evidence after sending it:

```js
window.__scorePadTouchDiagnostics.clear();
window.__scorePadTouchDiagnostics.disable();
```
