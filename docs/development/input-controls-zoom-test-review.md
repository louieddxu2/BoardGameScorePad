# Input-control zoom test review

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
