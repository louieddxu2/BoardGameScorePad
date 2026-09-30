# Input-control zoom test review

This records the original `03de2b6` review (28 cases). In the subsequent keypad-format correction, the regression file has 30 cases: `-` and `+/-` now share the digits' fixed 32px typography at all three zoom levels. The original mutation results below concern the quick-option font change, not this later keypad correction. Real-device layout verification is still required.

The available-space typography follow-up adds `QuickButtonPad.sizing.test.tsx`. It checks the real CSS declaration and the custom properties rendered by the component for one, two, and three columns at 75%, 100%, and 130% root font sizes. Its explicit container-width fixtures model CSS arithmetic, not measured layout. The existing zoom tests now name their label checks as fallback typography: JSDOM does not apply the supported container-query branch.

The label flex item is an inline-size query container, so a side-by-side badge excludes its actual width from the label slot. Stacked badges instead reserve their line height, padding, and gap against the unchanged nominal row height. The CSS cap uses that nominal height, never content-driven height units; long labels retain wrapping and scrolling. No observers, resize handlers, font-fitting loops, database changes, or new runtime dependencies were added. Check narrow-screen Safari with badges and label-only options on a real device before treating visual fit as verified.

The label-only refinement keeps standard label/badge sizing unchanged. Supported browsers cap label-only text at `1.75rem` (28px at 100% zoom) and `24cqi`, leaving 4% of the label slot after four nominal 1em full-width glyph advances. The existing nominal-height cap still applies. Wide labels follow the root-relative cap; narrow labels prioritize the four-glyph width budget rather than growing past the slot when zoom increases. Nine additional model cases cover all three column counts and root sizes with 48–160px width fixtures. These verify the declared arithmetic, not real font metrics or rendered line breaks; fallback typography and multiline wrapping remain unchanged.

Scope: `src/components/shared/InputControls.zoom.test.tsx` and the two font-unit changes in `QuickButtonPad.tsx`.

| Reviewed file | Severity | Finding and disposition |
| --- | --- | --- |
| `src/components/shared/InputControls.zoom.test.tsx` | Low | No blocking test smells found. JSDOM verifies CSS contracts, not rendered Safari geometry; real-device layout verification remains necessary. |

## Readability

Named zoom boundaries and minimal control fixtures make the relevant conditions explicit. Cases cover one, two, and three button columns.

## Reliability

The tests restore the root font size and saved zoom, unmount controls, and remove generated styles. They use no sleeps or external services. Three independent normal test runs passed; per-test timing was captured, with the slowest observed case taking 33 ms.

## Diagnostic value

Assertions compare exact root font sizes and computed font units. Tailwind generates the font rules from the actual production sources, rather than a separately maintained test stylesheet. JSDOM returns `rem` declarations without resolving them to rendered pixels; the tests do not claim to measure final text dimensions.

## Design

The real zoom hook, controls, and touch handlers run together. Only action callbacks are spies. Existing panel-height, wrapping, and scroll contracts remain unchanged. No new shared test framework or runtime measurement logic was introduced.

## AI-generated

The tests were written before the implementation change: the old fixed-font implementation failed 18 of 28 cases. Three targeted mutations were subsequently run in separate processes, modifying the component and its raw CSS input only in memory:

| Mutation | Expected font-assertion failures | Actual failures |
| --- | ---: | ---: |
| Restore fixed-pixel option labels | 18 | 18 |
| Restore fixed-pixel numeric badges | 9 | 9 |
| Change the original 100% label sizes | 18 | 18 |

All runs executed 28 tests without unhandled errors. The targeted mutation score is 3/3 (100%); this is not an exhaustive mutation score for the component. No mutation was saved to disk.

## Coverage

The 28 cases cover 75%, 100%, and 130% app zoom; standard and label-only options; multiline labels; existing scroll bounds; pinch gestures that must not select options or type digits; and the unchanged keypad's fixed digit/minus sizes and root-relative `+/-` text.

The full core suite passed 752 tests. Type-check, production build, and UI text scan passed. No recurring smell warrants an additional lint, CI, or general mutation gate; the existing core test command already includes this regression file.

## Remaining verification

After deployment, verify long option labels in iOS Safari at maximum app zoom, including a narrow viewport and numeric badges. The automated tests do not establish that those layouts fit on a real device. Keypad digit sizes, panel height, column counts, database versions, and service-worker revision are not changed by this task.
