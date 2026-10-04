import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const severityRank = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const exception = {
  package: 'braces',
  version: '3.0.3',
  url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm',
  expiresAt: '2026-11-03T00:00:00.000Z',
};

// Temporary risk acceptance, NOT a vulnerability fix. This dependency only
// processes fixed build/watch globs. Its suggested Tailwind 4 upgrade would
// drop older mobile browser support. Reassess the advisory by the fixed expiry;
// do not extend the date automatically or exempt braces from other advisories.
export function evaluateAuditReport(report, lockfile, now = new Date()) {
  if (report?.error || report?.auditReportVersion !== 2
    || !report.vulnerabilities || typeof report.vulnerabilities !== 'object'
    || Array.isArray(report.vulnerabilities) || !lockfile?.packages
    || !Number.isFinite(now.getTime())) {
    throw new Error('Missing or invalid npm audit/lockfile data.');
  }

  const vulnerabilities = report.vulnerabilities;
  const isBuildOnly = vulnerability => Array.isArray(vulnerability.nodes)
    && vulnerability.nodes.length > 0
    && vulnerability.nodes.every(node => typeof node === 'string'
      && lockfile.packages[node]?.dev === true);

  const getCauses = (name, visiting = new Set()) => {
    const vulnerability = vulnerabilities[name];
    if (visiting.has(name) || !vulnerability || !Array.isArray(vulnerability.via)
      || vulnerability.via.length === 0) {
      throw new Error(`Cannot resolve audit causes for ${name}.`);
    }
    const next = new Set(visiting).add(name);
    return vulnerability.via.flatMap(cause => {
      if (typeof cause === 'string') return getCauses(cause, next);
      if (!cause || !Object.hasOwn(severityRank, cause.severity)
        || typeof cause.url !== 'string') {
        throw new Error(`Invalid advisory for ${name}.`);
      }
      return [{ advisory: cause, vulnerability }];
    });
  };

  const isAccepted = ({ advisory, vulnerability }) =>
    now.getTime() < Date.parse(exception.expiresAt)
    && advisory.url === exception.url
    && advisory.name === exception.package
    && advisory.dependency === exception.package
    && advisory.severity === 'high'
    && vulnerability.name === exception.package
    && isBuildOnly(vulnerability)
    && vulnerability.nodes.every(node => lockfile.packages[node].version === exception.version);

  const blocking = [];
  const acceptedPackages = [];
  for (const [name, vulnerability] of Object.entries(vulnerabilities)) {
    if (!vulnerability || !Object.hasOwn(severityRank, vulnerability.severity)) {
      throw new Error(`Invalid vulnerability severity for ${name}.`);
    }
    if (severityRank[vulnerability.severity] < severityRank.moderate) continue;

    const causes = getCauses(name).filter(({ advisory }) =>
      severityRank[advisory.severity] >= severityRank.moderate);
    if (causes.length > 0 && vulnerability.severity !== 'critical'
      && isBuildOnly(vulnerability) && causes.every(isAccepted)) {
      acceptedPackages.push(name);
    } else {
      blocking.push({ name, severity: vulnerability.severity,
        advisories: [...new Set(causes.map(({ advisory }) => advisory.url))] });
    }
  }
  return { blocking, acceptedPackages, expiresAt: exception.expiresAt };
}

function main() {
  // npm supplies its CLI path on both Windows and Linux. Running through Node
  // avoids a shell and the cross-platform npm.cmd/ENOENT trap.
  if (!process.env.npm_execpath) throw new Error('Run this check with npm run audit:ci.');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const audit = spawnSync(process.execPath,
    [process.env.npm_execpath, 'audit', '--json', '--audit-level=moderate'],
    { cwd: root, encoding: 'utf8', timeout: 60_000, maxBuffer: 10 * 1024 * 1024 });
  if (audit.error || audit.signal || ![0, 1].includes(audit.status)) {
    throw new Error('npm audit did not complete successfully.');
  }
  const report = JSON.parse(audit.stdout);
  const lockfile = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
  const result = evaluateAuditReport(report, lockfile);
  if (result.blocking.length > 0) {
    for (const item of result.blocking) {
      console.error(`${item.name}: ${item.severity} — ${item.advisories.join(', ')}`);
    }
    process.exitCode = 1;
    return;
  }
  if (result.acceptedPackages.length > 0) {
    console.log(`Known build-only advisory temporarily accepted until ${result.expiresAt}: ${exception.url}`);
  }
  console.log('Dependency audit passed; all other moderate-or-higher advisories remain blocking.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(`Dependency audit failed: ${error.message}`);
    process.exitCode = 1;
  }
}
