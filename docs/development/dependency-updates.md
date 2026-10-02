# Dependency maintenance and release verification

Dependabot and CI were introduced together in commit `c53857a` on 2026-09-04.
The maintenance policy keeps regular update proposals and verifies dependency
compatibility on `V3test` before a production release.

## Routine updates

- npm dependencies and GitHub Actions share the native multi-ecosystem group
  `routine-v3test`, checked weekly on Monday at 02:00 Asia/Taipei. GitHub Actions
  now follows the same weekly cadence instead of a separate monthly schedule.
- Both ecosystems include all dependencies in that one group. Runtime and
  development dependencies are not split into separate proposals.
- The group inspects manifests on `V3test` and opens its consolidated PR targeting
  `V3test`. Its target branch and schedule are set at group level, not repeated
  in the ecosystem entries.
- The shared group's version-update PR limit is one, set at group level rather
  than in the ecosystem entries. Both ecosystems use that same limit and combine
  into one routine update proposal. There are no ungrouped dependency patterns.
- Major version updates remain excluded from routine proposals.

Use Dependabot's built-in grouping; do not add an automatic merge or a custom
branch-reuse workflow. "One branch" means one active routine update proposal,
not a permanent branch name. Remove its head branch after it is merged or closed.
Existing PRs and old head branches are not cleaned up by changing this file;
review and close obsolete proposals separately.

GitHub reads `.github/dependabot.yml` from the repository's default branch,
currently `main`. A configuration change on `V3test` must be reviewed and
validated there, but GitHub's hosted Dependabot adopts it only after the
configuration reaches the default branch. `target-branch: V3test` controls the
dependency manifests inspected and the destination of version-update PRs.

Dependabot security-update PRs are a separate repository setting, target the
default branch, and are not bound by the version-update PR limits. Keep automatic
security-update PRs and auto-triage rules that open PRs disabled to preserve the
one-proposal, `V3test`-only policy. Changing this file does not enforce those
repository settings. Keep vulnerability alerts enabled and handle necessary
security fixes promptly on `V3test`; runtime and development dependency security
checks remain part of CI there.

After the verified configuration reaches `main`, confirm the `routine-v3test`
group appears in GitHub's Dependency graph / Dependabot view. Check its first
scheduled proposal for a `V3test` base branch and consolidated updates before
considering the hosted configuration verified.

GitHub's native multi-ecosystem configuration and option restrictions are
documented in [multi-ecosystem updates](https://docs.github.com/en/code-security/concepts/supply-chain-security/multi-ecosystem-updates)
and [configuring multi-ecosystem updates](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configuring-multi-ecosystem-updates).

## Major upgrades

Plan major upgrades manually on `V3test`, including related packages and
configuration changes. For example, review Dexie with `dexie-react-hooks`, Vite
with `@vitejs/plugin-react`, and Tailwind with its PostCSS integration. Ignoring
routine major updates is not a reason to defer a required security fix.

## Release verification

1. Make dependency and configuration changes on `V3test` or in a PR targeting it.
2. CI validates PRs targeting `V3test` and pushes to `V3test`: locked dependency
   installation, full dependency audit, type-check, core tests, visible
   Chinese text scan, and production build.
3. After publishing `V3test`, confirm CI and the Vercel preview deployment succeed
   for the release commit before merging it into `main`.
4. Resolve any integration conflicts on `V3test` and repeat verification before
   release. Do not introduce dependency or configuration fixes directly on `main`.
5. Merge the verified release into `main` for production deployment. The CI
   verification workflow does not run again on `main`; Vercel still builds the
   production deployment.

Use the existing `npm run publish:v3test` command for an explicitly requested
`V3test` publication. Its local checks do not replace confirming CI and the
preview deployment before the production release.

## Security maintenance decisions

- Vite 6 and Vitest 4 are deliberate, patched major upgrades rather than routine
  version bumps. Keep the existing Rollup/esbuild build and thread-based test
  pool; verify type-checks, the core suite, and the production bundle together.
  Vitest 3 remains affected by the redirect-mock file-read advisory; use at least
  Vitest 4.1.11 for its fix.
- jsdom 27.4 replaces its deprecated encoding dependency with `@exodus/bytes`.
  This changes only the simulated DOM used by tests, not the browser bundle.
  CI and local maintenance use Node.js 24, which meets its engine requirement.
- SheetJS (`xlsx`) is installed from the pinned official 0.20.3 tarball. The
  public npm package remains on the vulnerable 0.18.5 release. Keep the lockfile
  integrity hash and compare the offline data-sync output when updating it.
  See the [official Node.js installation guide](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/).
- Lifecycle approval is restricted to the exact locked esbuild version in
  `allowScripts`; update that entry together with esbuild, not with a wildcard.
  npm 11.8 does not expose `install-scripts`; use a compatible newer npm for that
  read-only approval check. This change was also verified with a clean install
  using npm 11.21, without changing the globally installed CLI.
- Audit all dependencies in the existing CI job so build, test, and offline
  tooling warnings are not hidden by `--omit=dev`; moderate-or-higher findings
  fail that check. No second scheduled check or automatic merge is added.
- Lucide's broad 0.x icon update is deferred; user-event stays unchanged because
  the project does not currently use it. A routine PR is a proposal, not a reason
  to accept every package change. Review them separately if there is a concrete
  need, including visual checks for changed icons.
