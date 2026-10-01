# Pinch activation contract

The app observes Touch Events once in `useMobileZoom`. `touchGestureGuard`
owns activation qualification independently of the zoom calculation. The
existing App click-capture entry and `useTouchAction` use that same policy.

## Required behavior

- A round starts when the first finger lands after zero touches. Any multitouch
  or touch cancellation invalidates that round until every finger leaves.
- Lifting either finger first, replacing a finger, hitting a zoom limit, or
  moving to another component cannot requalify the remaining finger.
- A truly new single-finger tap works immediately. There is no timeout,
  debounce, or cooldown. Keep synchronous `touchend` activation: browsers can
  omit the compatibility click after scrolling, and rapid input must not wait.
- A handled touch does not activate again through compatibility clicks,
  including unannotated clicks with `detail=0` and retargeted clicks.
- Do not suppress touchend/cancel propagation: panel, toolbox and drag cleanup
  must still run. Their action commits separately check the round qualification.
- Keyboard, genuine mouse/pen and explicit non-pointing activation remain
  usable. A touch-generated mouse event is not evidence of genuine mouse input.
- Accepted synchronous callbacks can launch programmatic actions. The global
  gate also preserves specific untrusted file-input/download-link clicks,
  including asynchronous exports, without whitelisting all synthetic clicks.
- Photo/crop `data-mobile-zoom-ignore` only opts out of app font zoom, not the
  activation policy. Their own movement/cleanup events remain available.

## Correlation and limits

The current round, pending rejected click and rejected touch pointer ids are
separate. Landing a new finger does not clear the previous click rejection;
its valid touchend may qualify immediately. Previous rejected pointer ids
remain distinguishable after a new native tap. Each id set is bounded to 16;
ids reused by a new pointerdown are requalified for the new round.

For events without any source metadata, qualification uses the latest touch
context rather than `detail`. An old click and a fresh native click with
identical missing metadata cannot always be distinguished after a new native
tap. Likewise, legacy assistive clicks without source metadata or keyboard
events need real-device validation. JSDOM cannot prove Safari/VoiceOver event
provenance. Explicit non-pointing PointerEvent metadata and actual activation
keys are covered, but should not be presented as universal device verification.

## Regression coverage

- `touchGesture.test.ts`: qualification, pending clicks, pointer id reuse,
  cancellation, keyboard/non-pointing input, programmatic default actions.
- `InputControls.pinch.test.tsx`: real input controls, cross-target ownership,
  replacement/cancel, missing-source clicks, twenty rapid consecutive taps
  both with and without compatibility clicks.
- `TotalsBar.pinch.test.tsx`: actual total/reset controls, both lift orders,
  stopped bubbling, synchronous rapid input and duplicate suppression.
- `App.deeplink.test.tsx`: actual App capture boundary with a raw React click
  action, fresh rapid native taps and keyboard activation.
- Session panel, toolbox and column-drag tests protect action cancellation,
  fresh-gesture recovery and timer cleanup.

No new framework, package, database/template version or per-control window
listener is needed. Qualification uses ordinary state/refs, not a React
subscription, and adds no layout reads/storage writes to touch movement.
