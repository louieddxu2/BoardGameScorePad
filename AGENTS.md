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

# Project-Specific Testing Notes

For `C:\board-game-score-pad`:
- Type-check with `npx tsc --noEmit`.
- For the core test suite, prefer `npx vitest run --exclude "{src/components/session/SessionUI.test.tsx,src/utils/ui-consistency.test.ts}"` instead of `npm test` in this Codex environment. The current Vitest CLI rejects repeated `--exclude` flags when invoked through the package script, even though the project files were not changed by the current task.
- For UI, i18n, visible text, dashboard panel, modal, button-label, or copy changes, also run `powershell -ExecutionPolicy Bypass -File scripts\scan-hardcoded-chinese.ps1`.
- For focused AI simple-generator work, also run `npx vitest run src/features/ai-generator/hooks/useAiSimpleGenerator.test.tsx`.
- Treat failures of `npm test` caused by repeated `--exclude` parsing as an environment/script invocation issue, not as evidence that the touched feature failed, unless package scripts or dependency versions were changed in the current work.

# Local Verification Constraints

- Do not open a browser or run browser-based visual verification unless the user explicitly asks for it.
