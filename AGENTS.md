# Global Codex Workflow Rules

1. After completing requested code/document changes, unless explicitly told otherwise:
- run relevant tests/type-check if available,
- create a local git commit with a clear message,
- do not push by default.

2. Only push when explicitly requested, for example "push", "推到雲端", or "push 到 origin".

3. If push is rejected due to remote updates, and only when push was explicitly requested:
- run `git pull --rebase origin <current-branch>`,
- resolve conflicts conservatively,
- push again.

4. Do not include unrelated untracked files in commits unless explicitly requested.

5. Before commit/push, summarize what will be committed.

6. Shortcut command behavior:
- If the user sends exactly `git` or `/git`, treat it as a workflow trigger.
- Summarize changes, stage relevant files only, and commit with a clear message.
- Do not push unless explicitly requested.

7. V3test publishing:
- For an explicit publish request, use `npm run publish:v3test` instead of calling `git push` directly.
- The publish command requires a clean `V3test` worktree, runs the same dependency audit as CI, type-check and core tests, updates the dated service-worker cache revision, commits only `public/sw.js`, and pushes `origin/V3test`.
- If any precondition or verification fails, stop without publishing.
- Routine V3test publishing does not require creating or updating release notes.
- Immediately before merging into `main`, update and commit `src/data/releaseNotes.ts` for the user-facing changes not yet in `main`, following the Release Notes rules below. Set the entry date to the merge/release date. Update the first entry if it has not yet been merged to `main`; otherwise start a new first entry.

# Release Notes

- Write for users in Settings → About. Apply four principles: concise, clear, accurate and honest. Describe what changed in natural language; do not turn entries into commit summaries, feature inventories or operating instructions.
- Include meaningful user-visible changes only. Skip tests, refactors and internal tooling. Use `new` for a newly available capability, `improved` for a change to existing behavior, and `fixed` for a correction to incorrect behavior. Moving an existing feature to a new entry point does not make the feature itself new.
- Keep each item focused on one coherent change or problem. Combine repeated fixes and overlapping descriptions of the same change; separate unrelated topics. Choose detail by its value to the reader, without fixed item counts or length quotas.
- Name the affected feature or game when needed to identify the change. Keep conditions and consequences that materially affect expectations, such as a required action, manual versus automatic behavior, or replacement of existing data. Do not add exhaustive scope lists or routine caveats to every item.
- Check claims against the relevant implementation and change history. For historical dates, version names, counts and original availability, use evidence from that release or its announcement; current behavior and commit dates alone do not establish what was released when. Omit unsupported details rather than inventing them.
- Avoid unverified guarantees, completeness claims and comparisons. State the behavior or specific fix instead of asserting that everything works or that results are better without evidence. Keep a supported fix direct; do not replace precise wording with vague hedging.
- Write short zh-TW and en items with the same meaning, scope, conditions and certainty. Use natural wording in each language, and check that neither translation adds or substitutes a capability.
- Keep formal release dates, historical version names and service-worker cache revisions distinct. Routine V3test publishes need no release-note update; prepare the first entry before merging into `main`. Correct published entries only when supported by evidence, preserving their historical context.

# Project-Specific Testing Notes

For `C:\board-game-score-pad`:
- Type-check with `npx tsc --noEmit`.
- For the core test suite, prefer `npx vitest run --exclude "{src/components/session/SessionUI.test.tsx,src/utils/ui-consistency.test.ts}"` instead of `npm test` in this Codex environment. The current Vitest CLI rejects repeated `--exclude` flags when invoked through the package script, even though the project files were not changed by the current task.
- For UI, i18n, visible text, dashboard panel, modal, button-label, or copy changes, also run `powershell -ExecutionPolicy Bypass -File scripts\scan-hardcoded-chinese.ps1`.
- For focused AI simple-generator work, also run `npx vitest run src/features/ai-generator/hooks/useAiSimpleGenerator.test.tsx`.
- Treat failures of `npm test` caused by repeated `--exclude` parsing as an environment/script invocation issue, not as evidence that the touched feature failed, unless package scripts or dependency versions were changed in the current work.

# Proportionate Verification

- Handle small text, style, or display changes directly, without sub-agents; run only relevant checks. Documentation-only changes need no application tests.
- Reserve delegated simulations and broad regression testing for multiplayer, asynchronous races, data persistence, or other high-risk changes.
- Keep required publishing checks, but do not separately repeat the full test suite before the publishing script for unchanged code.

# Local Verification Constraints

- Do not open a browser or run browser-based visual verification unless the user explicitly asks for it.

# Production Code Size and Refactoring

- Keep each TypeScript/JavaScript file implementing core functionality or UI at 600 physical lines or fewer, including comments and blank lines. Tests, static datasets, and translation dictionaries are excluded; executable logic is not exempt merely because it is under a data directory.
- Split by cohesive responsibilities. Do not compress formatting, remove useful documentation, or introduce a new framework just to meet the limit.
- Preserve runtime ownership, Hook/effect ordering, DOM nesting, reconciliation keys, gesture handlers, and cleanup. A file split must not introduce extra database/network reads, repeated calculations, observers, timers, or animation loops.
- Recheck source-file lengths, relevant tests, type-check, and production build after refactoring.

# User-Selected Color Contract

- Preserve user-selected foreground RGB and alpha in standard UI and photo-sharing exports. Resolve contrast with outlines, shadows, or backing treatments, not by lightening/darkening the selected ink, replacing it with a fixed color, or blending it into the background.
- Use normal font weight for user-selected ink on light UI surfaces and non-dark photo name plates. Do not reset typography globally or change dark/texture rendering as part of this rule.
- Standard UI text outlines honor `COLOR_TONES` first. Unregistered colors use Oklab L thresholds calibrated to the existing 17-color classification (dark: about <0.596, light: about >0.815; see `textColorTone.ts`). Do not replace this with foreground/background contrast thresholds without explicit approval. Keep semantic UI and image-scoreboard texture policies unchanged.
- On light/sage UI, the existing three light player inks use the approved treatments: white gets four orthogonal, zero-blur shadows at 1px with 100% black; yellow and skin get no shadow. Apply the same treatment to their exact raw RGB/HEX equivalents. Do not add new light-color categories or change other unregistered-color fallback rules as part of this adjustment.
- Photo-sharing custom names follow fixed scoreboard styles: clearly dark photos select the dark grid base (15,23,42) with a 12.549% player-color wash and existing dark ink treatment; other photos select the near-white base (251,250,247) with a 4.5% wash, normal font weight, and shared light-ink treatment. Use the existing photo dark-surface threshold on the sampled identity surface solely to select between these styles. Name backing hues never follow the photo or current app theme; do not restore the former lightness-gap background search. Scale the shared `COLOR_TONES`/Oklab shadow/edge to export pixels; never change selected RGB/alpha. Preserve both the score's existing photo-derived foreground and its backing below the header, plus default/anonymous identity paint. Individual winner crowns sit inset at the header's top right, with warm gold and a fine dark edge instead of a separate backing patch.
- Automatic black/white text on a user-selected button background is a separate policy when no foreground color was selected.
- Image-based scoreboards are a separate feature. Preserve their existing texture-specific ink and blending behavior; do not change it as part of standard UI or photo-sharing color work unless explicitly requested.

# Sub-Agent Delegation Rules

- When invoking sub-agents via `invoke_subagent` or defining sub-agents via `define_subagent`, always explicitly set `Model` to `"flash"` (or `"flash_lite"`) for routine or background tasks (e.g., searching, reading files, generating boilerplate, running unit tests) unless deep complex reasoning is strictly required.
- Avoid leaving `Model` as `"inherit"` by default, ensuring sub-agents execute fast and cost-effectively without inheriting the main agent's model.
