# Input-control zoom test review

## 2026-10-01: narrow-column zoom cancellation

Reproduction scope: label-only quick options with three or four columns, app zoom from 100% to 130%, in the existing full or compact input layout. The user confirmed that fewer columns already enlarged. At a 375px panel width with four columns, the old spacing chain reduced the label width from 38.8125px to 29.9625px; the width-derived font therefore changed from 9.315px to just 9.3483px despite 130% zoom. These are declared CSS/grid calculations, not measurements from the user's device.

The user's requirement is that padding must not enlarge. Quick-option padding, badge padding/margins, option-grid gaps, and both input-layout variants now use their existing 100%-zoom pixel values. Row minimum heights and text still use the existing zoom mechanism. The nominal label-height budget now subtracts the actual fixed 16px button padding; a stacked badge reserves `1.3125rem + 8px` (line height plus fixed padding/gap). No observers, measurements, event handlers, runtime dependencies, or new framework were added. NumericKeypad's internal spacing and fixed 32px digit typography are unchanged.

Scope: existing sizing, fallback-zoom, and zoom-hook tests; the related production spacing declarations.

| Reviewed file | Severity | Finding and disposition |
| --- | --- | --- |
| `src/components/shared/QuickButtonPad.sizing.test.tsx` | High, addressed | Fixed-width fixtures masked zoom-dependent width loss and omitted four columns. Added production-spacing geometry cases for both layouts, three/four columns, 320/375/430/768px panels, and both zoom boundaries. |
| `src/components/shared/InputControls.zoom.test.tsx` | Low, addressed | Added four-column fallback and pinch-without-activation coverage. Its claims remain limited to JSDOM fallback CSS, not container-query rendering. |
| `src/hooks/useMobileZoom.test.tsx` | Low | The real zoom-factor contract remains covered; no hook changes are needed. |

### Readability

The new cases distinguish a declared geometry model from a browser measurement. Panel width, column count, layout variant, and zoom are explicit; failure messages identify the spacing property or column/zoom combination.

### Reliability

All three regression files passed three independent runs after the correction: 98/98 cases each time. Per-test JSON timings were captured; the slowest case was 37ms (34ms and 36ms in the subsequent runs). Root font size, CSS zoom factor, and local storage are restored after every case. No sleeps or external services are used.

### Diagnostic value

Tailwind generates spacing rules from the actual production components. The geometry model resolves those declarations at each root font size, rather than assuming the label keeps a constant width. The new contract tests failed 24 of 55 sizing cases against the old production code before the fix.

### Design

The tests render QuickButtonPad inside the actual InputPanelLayout and run the real zoom hook and pinch handlers. Only callbacks are spies. They verify that horizontal space stays constant while text scales and gestures do not activate options; the existing wrapping/scroll and height-cap contracts remain covered.

### AI-generated

Five targeted mutations were applied only in memory in separate Vitest contexts. Each run executed all 55 sizing cases with zero unhandled errors:

| Mutation | Failing cases |
| --- | ---: |
| Restore option rem padding/gaps | 24 |
| Restore input-layout rem padding/gaps | 16 |
| Remove label-only zoom factor | 26 |
| Restore badge rem spacing | 4 |
| Restore obsolete rem height reserves | 11 |

Targeted mutation score: 5/5 (100%), not an exhaustive component score. No mutant was written to disk.

### Coverage

The sizing file has 55 cases and fallback-zoom file has 38 cases. The full core suite passed 837 tests in 115 files. Type-check, production build, and the UI text scan also passed. Existing core CI includes these regression files, so no additional framework or lint/mutation gate is needed.

Browser/device rendering remains unverified in this run: browser verification requires explicit permission under the project rules. The calculation tests establish the corrected spacing/zoom contract, not exact Safari font metrics or line breaks.

## Historical reviews

This records the original `03de2b6` review (28 cases). In the subsequent keypad-format correction, the regression file has 30 cases: `-` and `+/-` now share the digits' fixed 32px typography at all three zoom levels. The original mutation results below concern the quick-option font change, not this later keypad correction. Real-device layout verification is still required.

The available-space typography follow-up adds `QuickButtonPad.sizing.test.tsx`. It checks the real CSS declaration and the custom properties rendered by the component for one, two, and three columns at 75%, 100%, and 130% root font sizes. Its explicit container-width fixtures model CSS arithmetic, not measured layout. The existing zoom tests now name their label checks as fallback typography: JSDOM does not apply the supported container-query branch.

The label flex item is an inline-size query container, so a side-by-side badge excludes its actual width from the label slot. Stacked badges instead reserve their line height, padding, and gap against the unchanged nominal row height. The CSS cap uses that nominal height, never content-driven height units; long labels retain wrapping and scrolling. No observers, resize handlers, font-fitting loops, database changes, or new runtime dependencies were added. Check narrow-screen Safari with badges and label-only options on a real device before treating visual fit as verified.

The earlier label-only refinement kept standard label/badge sizing unchanged. Four full-width glyphs were intended as a 100%-zoom baseline, not a requirement at every zoom level. The width-derived term was `calc(24cqi * var(--app-zoom-level, 1))`, alongside the existing nominal-height cap and `1.75rem` cap (28px at 100% zoom). The hook published the same factor used for the root font size. Its model tests used saved zoom and pinch gestures across three column counts, with fixed 48–160px width fixtures. Those fixtures did not account for growing rem spacing shrinking the actual label container, so they could not establish the intended narrow-column enlargement. The correction and expanded coverage are recorded above.

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
