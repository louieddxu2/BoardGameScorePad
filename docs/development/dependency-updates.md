# Dependency maintenance and release verification

Dependabot and CI were introduced together in commit `c53857a` on 2026-09-04.
The maintenance policy keeps regular update proposals and verifies dependency
compatibility on `V3test` before a production release.

## Routine updates

- npm dependencies are checked weekly, on Monday at 02:00 Asia/Taipei.
- GitHub Actions are checked monthly.
- Both ecosystems inspect manifests on `V3test` and open PRs targeting `V3test`.
- Major version updates are excluded from routine proposals. Development
  dependency minor and patch updates retain their existing group.
- PR limits remain five for npm and three for GitHub Actions.

GitHub reads `.github/dependabot.yml` from the repository's default branch,
currently `main`. A configuration change on `V3test` must be reviewed and
validated there, but GitHub's hosted Dependabot adopts it only after the
configuration reaches the default branch. `target-branch: V3test` controls the
dependency manifests inspected and the destination of version-update PRs.

Dependabot security-update PRs are a separate repository setting and target the
default branch. They are currently disabled; changing this file does not enable
them. Production dependency security checks remain part of CI on `V3test`.

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
