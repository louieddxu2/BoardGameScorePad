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
- Each ecosystem's version-update PR limit is one. The single cross-ecosystem
  group, rather than two independent limits, combines both ecosystems into one
  routine update proposal. There are no ungrouped dependency patterns.
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
security fixes promptly on `V3test`; production dependency security checks remain
part of CI there.

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
   installation, production dependency audit, type-check, core tests, visible
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
