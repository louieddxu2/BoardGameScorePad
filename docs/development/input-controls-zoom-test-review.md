# Input-control zoom test review

## 2026-10-04: isolated-failure redundancy follow-up

This approved follow-up removes eight cases from five files: the focused scope goes from 118 to 110, and the core suite from 979 to 971 in the same 128 files. Each removed case either repeats the same input or implementation branch, or cannot distinguish the behavior it claims to verify. The preceding audit found no meaningful isolated failure for these candidates under the current implementation; that is a pruning rationale, not proof about all future implementations. No production code, styles, dependencies, CI, database, service worker or built-in templates change.

| Reviewed file | Severity | Before / after | Finding and disposition |
| --- | --- | ---: | --- |
| `src/components/shared/InputControls.zoom.test.tsx` | Low, addressed | 9 / 5 | Keep one maximum-zoom case per list/grid fallback branch and one fixed digit/minus case at maximum zoom; remove four repeated zoom permutations. Keep multiline bounds and the separate +/- case. Actual zoom limits remain covered by sizing tests. |
| `src/components/shared/NumericKeypad.test.tsx` | Low, addressed | 19 / 18 | Remove only the negative nonzero style row: it shares typography/theme with positive nonzero input. The separate negative sign-activation test still checks the +/- label and resulting positive payload. Keep decimal, negative-zero and both product-factor cases. |
| `src/components/shared/QuickButtonPad.sizing.test.tsx` | Low, addressed | 43 / 42 | Remove only the full-layout four-column 375px fixture. Panel width is an arithmetic-model input, not a production prop or actual viewport. The retained 320/768px four-column cases cover width-bound and height-bound sizes; both layouts, column counts and zoom limits remain represented. |
| `src/components/shared/quickButtonTypography.test.ts` | Low, addressed | 38 / 37 | Merge the exact duplicate two-paragraph table row into its comparison test. Move the original text and width assertions there; keep the unbroken-paragraph control and per-paragraph line-count assertion. |
| `src/hooks/useMobileZoom.test.tsx` | Low, addressed | 9 / 8 | Remove saved zoom 1, which also passes with restoration disabled because the initial value is already 1. Keep saved 0.75/1.3, which distinguish restoration, and all gesture ownership, photo-editor and cleanup cases. |

### Readability

Replace unused zoom permutations with one named maximum-zoom fixture and update the representative-case comments. The saved-zoom test explains why its inputs must differ from the initial value.

### Reliability

The final 110-case scope passed three independent Vitest runs with zero skipped cases and unhandled errors. Per-test JSON timing was captured; the slowest cases were approximately 90ms, 88ms and 124ms. Existing DOM, localStorage, root-style and listener cleanup is unchanged.

### Diagnostic value

The consolidated paragraph test retains every assertion from the removed row, so an incorrect display string, uncapped width or combined paragraph remainder still fails. Negative sign activation remains independently tested. No test is skipped or excluded by a name filter.

### Design

Only redundant case registration changes. Narrow/wide geometry is still checked against the real components' spacing declarations; it is not a device measurement. Default zoom initialization remains exercised by normal hook use and the photo-editor isolation case. Gesture, memoization and the positive iOS parent-height contract are not weakened or redesigned.

### AI-generated

The exact edited scope was verified with thirteen targeted faults using the installed Vitest/Vite API. Faults were applied only to in-memory module inputs, including matching regular and raw inputs; none was saved to production files. Each fault run executed all 110 cases with zero skipped cases or unhandled errors.

| Injected fault | Retained failing cases |
| --- | ---: |
| List fallback text becomes fixed pixels | 1 |
| Grid fallback text becomes fixed pixels | 1 |
| Keypad's fixed font becomes zoom-dependent | 5 |
| Negative nonzero input loses the +/- label | 1 |
| Minimum zoom becomes 50% instead of 75% | 12 |
| Maximum zoom becomes 150% instead of 130% | 18 |
| Quick-option padding starts scaling | 12 |
| Input-layout padding starts scaling | 8 |
| Container-font app zoom factor is removed | 16 |
| Long paragraphs incorrectly share line remainders | 1 |
| Label width is no longer capped by line capacity | 7 |
| Text analysis is no longer memoized | 1 |
| Saved zoom is never restored | 6 |

All thirteen sampled faults remain detected (13/13), as in the preceding pre-pruning audit. This is targeted evidence, not an exhaustive mutation score or a guarantee of equivalent detection for every possible bug. The temporary verification harness was removed; no additional framework, dependency, CI gate or recurring check is warranted.

### Coverage

The full core suite passed 971/971 cases in 128 files; type-check and diff checks passed. Unicode, manual-line boundaries, negative-zero decimals, pinch completion, rapid genuine taps, drag/drop, scoring, persistence, multiplayer, toolbox history and the actual 100% parent-height chain retain their existing regression checks. Browser/device verification was not run. Application behavior and runtime performance are unchanged because this follow-up edits only tests and this review record.

## 2026-10-04: behavior-focused pruning and the iOS parent-height contract

This test-only change reduces the core suite from 1016 to 979 cases in the same 128 files. It removes equivalent display/theme combinations and stale implementation blacklists, not scoring, persistence, multiplayer, drag/drop, or browser-history behaviors. No application code, dependencies, CI, database version, service worker, or built-in templates change.

| Reviewed file | Severity | Before / after | Finding and disposition |
| --- | --- | ---: | --- |
| `src/components/shared/QuickButtonPad.test.tsx` | Medium, addressed | 44 / 29 | Keep list/grid label-only actions, all 13 contrast inputs, both contrast branches in the second theme, and live theme switching. Remove the value-sign/layout product and eleven repeated second-theme color cases. |
| `src/components/shared/InputControls.pinch.test.tsx` | Medium, addressed | 59 / 47 | Standard and label-only modes share `QuickActionButton` and its touch handlers. Keep the full matrix for quick buttons, keypad and score cells, plus two label-only release-order/next-tap checks. Keep cancellation, touch replacement, click-source variants, rapid taps and retargeted clicks. |
| `src/components/shared/InputControls.zoom.test.tsx` | Medium, addressed | 15 / 9 | Keep list/grid fallback labels and badges at both zoom limits, multiline scroll bounds, keypad digits/minus at all zoom levels, and +/- at maximum zoom. Remove the same fallback-label class tested again without a badge and two duplicate fixed +/- sizes. |
| `src/utils/fullHeightLayout.test.ts` | Medium, addressed | 6 / 3 | Replace four broad historical child-class blacklists with the actual root-height chain: compile the production root's 100% fallback and dynamic viewport declaration, then check full-height positioned AppWorkspace and SessionView roots. Keep app-surface overlays and safe-area actions. |
| `src/utils/sessionViewport.test.ts` | Low, addressed | 4 / 3 | Remove the duplicate idle-iOS assertion. The remaining non-keyboard viewport-delta case exercises the same function and branch; real keyboard compensation remains separate. |
| `src/components/session/parts/InputPanelLayout.test.tsx` | Low, addressed | 3 / 3 | Use a full-height content parent and retain bounded compact/full layout plus sidebar checks. Remove the blanket prohibition on `h-full`; percentage height is not inherently incorrect. |
| `src/components/session/SessionView.toolboxScroll.test.tsx` | Low, addressed | 37 / 37 | Replace removed toolbar-reserve marker checks with the full-height session surface and shared positioning ancestor for the input panel and totals. Preserve platform dock, bottom-fill, touch navigation, keyboard and toolbox history cases. |
| `src/components/shared/QuickButtonPad.sizing.test.tsx` | Low | 43 / 43 | Unchanged. Preserve real spacing-chain three/four-column regressions in both input layouts, per-column capacities, manual lines and memoization. |

### Readability

Representative tables and comments explain the shared implementation branch being pruned. Historical `100svh` and guessed-toolbar experiments were already reverted in `77c909d`; tests must protect definite parent sizing, not treat all percentage-height descendants as invalid.

### Reliability

The eight-file review scope passed 174/174 cases in three independent runs with no skipped cases. The slowest cases were approximately 124ms, 126ms and 129ms. A draft assertion incorrectly required the totals bar's immediate DOM parent to be the session root; it was corrected to its nearest positioned ancestor before these runs, without changing production code. Existing timer, localStorage and root-style isolation remains in place.

### Diagnostic value

Retained tests check callback counts/payloads, root-relative font units, production spacing declarations and actual DOM relationships. The new parent-chain contract uses class tokens rather than exact class ordering and compiles only the relevant CSS root rule. It checks declared layout constraints, not rendered iOS geometry.

### Design

Cases are genuinely removed, not merged into a large loop, skipped or hidden by name filters. Display modes sharing the same event handler no longer multiply every event sequence. Different components and meaningful event orders remain separate. The positive root-height contract replaces old source-string bans that could pass after a harmless class reordering or reject legitimate 100% sizing.

### AI-generated

Ten targeted faults were applied only to Vite's in-memory module inputs using the installed Vitest API. Regular and `?raw` inputs were changed consistently. Every fault run executed its complete selected case set with zero skipped cases and zero unhandled errors.

| Injected fault | Cases run | Failing cases |
| --- | ---: | ---: |
| Remove the root's 100% height fallback | 3 | 1 |
| Remove AppWorkspace's full height | 3 | 1 |
| Remove SessionView's full height | 40 | 2 |
| Restore unbounded input layouts | 3 | 2 |
| Restore fixed-pixel fallback labels | 128 | 4 |
| Show numeric badges in label-only mode | 128 | 27 |
| Remove final-touch pinch qualification | 47 | 23 |
| Bypass compatibility-click suppression | 47 | 34 |
| Reject the next genuine touch after a handled gesture | 47 | 30 |
| Use a theme-dependent quick-button foreground | 128 | 16 |

All ten sampled faults were detected (10/10). This is not an exhaustive mutation score or a guarantee of equal detection for every future bug. The temporary harness was removed; no mutation framework, dependency or additional CI gate is warranted for this scoped pruning. Existing core CI already runs the retained regressions.

### Coverage

The full core suite passed 979/979 cases in 128 files; type-check, production build and diff checks passed. Gesture ownership, quick repeated taps, drag/drop, manual labels, scoring, persistence, multiplayer and toolbox browser history retain their independent regression protection. No production-performance change follows from these test-only edits.

Physical-device verification was not run, as it requires explicit authorization. JSDOM cannot establish real WebKit height resolution, typography, keyboard behavior or browser compatibility-click synthesis; the parent-height tests must not be presented as proof of actual iOS rendering.

## 2026-10-01: first-stage test-matrix pruning

This change removes 42 redundant cases from two existing typography regression files. It does not change application behavior, production styles, dependencies, database versions, or built-in templates. A separate 14-case color/keypad-style candidate remains deferred; no tests are skipped or hidden behind a runtime name filter.

| Reviewed file | Severity | Before / after | Finding and disposition |
| --- | --- | ---: | --- |
| `src/components/shared/InputControls.zoom.test.tsx` | Medium, addressed | 38 / 15 | Keep the list and representative grid fallback-font branches in both display modes at both zoom limits. Remove duplicate default/grid permutations and seven basic gesture cases already covered more precisely by the dedicated pinch suite. Keep multiline/scroll bounds and all three keypad font-size zoom levels. |
| `src/components/shared/QuickButtonPad.sizing.test.tsx` | Medium, addressed | 62 / 43 | Keep list/grid spacing and badge structure, every column's default formula, and list/three-column formula zoom limits. Replace the panel-width Cartesian product with nine explicit cases: narrow/wide widths for both layouts and three/four columns, plus the original full-layout four-column 375px reproduction. Keep capacity, manual-line, height, memoization, border and clipping contracts. |

### Readability

Case tables now identify the distinct structure or geometry being protected. The panel cases name compact mode, column count and width directly. Comments explain why the omitted permutations share a branch and where gesture-specific coverage lives.

### Reliability

The nine-file review scope passed 246/246 cases in three independent normal Vitest runs, with no skipped cases or unhandled errors. Per-test durations were inspected; the slowest cases were 143ms, 110ms and 115ms respectively. Existing cleanup, root font/CSS property restoration and localStorage isolation are unchanged. These runs are evidence against observed flakiness, not a guarantee of all future environments.

### Diagnostic value

Retained cases keep their existing exact size, callback-count and payload assertions. This is actual case removal, not bundling the deleted parameter combinations into one large test or disabling them. Production-component and generated-Tailwind inputs remain intact; arithmetic models still do not measure rendered font metrics.

### Design

Only test registration and representative case selection change. Distinct list/grid structures, both display modes, all column capacities, both input layouts and zoom boundaries remain represented. All 43 dedicated pinch cases and nine zoom-hook cases are unchanged, including cross-target ownership and the next genuine tap. No testing framework, production fitting loop or additional CI gate is introduced.

### AI-generated

Five targeted faults were injected only in memory in separate Vitest contexts, using the existing runner and Vite transform API. Regular and `?raw` component inputs were transformed consistently. None was written to disk; every fault run had zero skipped cases and unhandled errors.

| Injected fault | Cases run | Failing cases |
| --- | ---: | ---: |
| Restore fixed-pixel fallback text | 58 | 6 |
| Remove the container-font app zoom factor | 58 | 17 |
| Restore zoom-dependent option padding | 58 | 13 |
| Remove touchend pinch ownership | 67 | 13 |
| Replace fixed foreground with a theme-dependent token | 44 | 15 |

All five sampled faults were detected after pruning (5/5). This is a targeted fault-detection result, not an exhaustive Stryker mutation score or proof that every conceivable future change has equivalent coverage.

### Coverage

The core suite now passes 887 cases in the same 117 files (previously 929). Type-check, production build and `git diff --check` passed. The 38 Unicode/line-capacity helper cases, numeric-input behavior, scoring and SessionView integration regressions are unchanged. Only the approved first-stage 42 cases were removed.

Browser/device rendering remains unverified: project rules require explicit permission for browser verification. JSDOM event simulation and CSS arithmetic cannot establish real iOS compatibility-click synthesis or exact font wrapping. No runtime-performance claim follows from a smaller test count; production code is unchanged.

## 2026-10-01: pinch completion must not activate input

A stationary finger could begin on an input control while the other finger started on a different element. The control's local handlers never saw that second `touchstart`, and the global zoom hook released ownership on the first lift. The local `touchend` could therefore invoke the input callback directly; canceling browser defaults alone did not prevent it. This also affected score-cell activation, not just the visible input panel.

The existing App-owned touch listeners now run in capture and retain multitouch ownership until every finger leaves, including cancellation and finger replacement. A sequence counter lets a control reject the final lift even after the global listener has cleared the active flag. Touch-origin compatibility clicks remain blocked until a fresh single-finger gesture; mouse, pen, keyboard and assistive activation remain eligible. No new per-control window listeners, timers, observers, layout measurements or runtime dependencies were added. Photo crop editors still handle their own gestures without app-zoom default cancellation.

The new production-component regressions cover standard and label-only quick options, the numeric keypad and score cells: separate/same targets, both lift orders, stationary/small movement, stopped bubbling, partial cancellation, finger replacement, retargeted compatibility clicks, and the next genuine tap without duplicate activation. The initial 37-case run against the old implementation failed 29 cases. The completed file has 43 cases; the zoom hook has nine, including residual-finger ownership and listener cleanup.

Final verification: 929 core tests passed in 117 files. Type-check, production build, the hardcoded-Chinese UI scan and `git diff --check` passed. Event simulation does not establish actual iOS browser click synthesis; physical-device verification remains outstanding. No database, service-worker, package or built-in-template changes are required for this local fix; publishing remains a separate explicit request.

## 2026-10-01: label-aware line-capacity sizing

The new 100%-zoom line-capacity contract is two columns / five full-width equivalents, three / four, and four / three. Single-column list mode uses the previously proposed eight-character baseline. Labels shorter than the capacity use their own estimated width instead of a universal four-character divisor. Longer labels use the capacity and a theoretical wrapped-line count. Standard and label-only options share the same sizing rule; omitting a stacked value badge increases the available nominal height.

`quickButtonTypography.ts` calculates conservative equivalent widths in integer twentieths of an em. Full-width characters count as one unit; ASCII widths vary by character class. Grapheme segmentation prevents emoji sequences and combining marks from being counted as multiple visible characters; a feature-detected code-point fallback requires no polyfill. Soft hyphens and zero-width controls have no width. These estimates do not measure a loaded font and cannot guarantee exact Latin word wrapping.

Manual paragraphs are evaluated separately, with CRLF/CR normalized to LF for display only. Leading and intermediate empty lines remain in both the display string and the line budget. Only a final empty segment after a terminal newline is excluded from the estimated line count, following the existing `pre-wrap` renderer's [preserved-break processing](https://www.w3.org/TR/css-text-3/#white-space-property) and [phantom-line-box rule](https://www.w3.org/TR/css-inline-3/#phantom-line-boxes). Stored action labels and callbacks are unchanged.

The font calculation now fits width and estimated lines against the 100%-zoom nominal height, then applies the app zoom factor exactly once. The old fixed 28px cap is removed. A 16px preferred height floor lets existing auto-growing rows and scrolling handle many lines rather than shrinking indefinitely; the final width bound may still yield a smaller font on narrow screens. All option padding and gaps remain fixed pixels. NumericKeypad is unchanged.

Text analysis and existing hyphenation are memoized together per button by label and column count. Selection/value changes and pinch zoom do not reparse text. No new state, observers, layout measurements, gesture handlers, fitting loops, or runtime dependencies were added. The width container still excludes a side-by-side value badge, and content-grown heights never feed back into font size.

Regression coverage includes capacity boundaries, short-label enlargement, mixed-width/combining/emoji text, invisible characters, blank/manual lines, newline normalization, old-browser fallback, memo invalidation, default-zoom height budgets, and 75%/130% pinch behavior in both input layouts. Sizing tests use production CSS/Tailwind declarations but model arithmetic rather than browser layout. The pre-implementation contract run failed all five new sizing cases, confirming the prior behavior did not satisfy the new contract.

Final verification: 882 core tests passed in 116 files, including 38 typography-helper cases and 62 sizing cases. `npx tsc --noEmit`, the production build, the hardcoded-Chinese UI scan, and `git diff --check` passed. No database, service-worker, package, or built-in-template version/content changes are required for this local implementation; publishing remains a separate explicit request.

Browser/device rendering remains unverified: project rules require explicit permission for browser verification. In particular, assess mixed-script line breaks and long manual labels in iOS Safari after release; passing arithmetic tests is not a device-fit claim.

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
