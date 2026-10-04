import { describe, expect, it } from 'vitest';
import { evaluateAuditReport } from './audit-dependencies.mjs';

const knownUrl = 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm';
const withinException = new Date('2026-10-04T00:00:00Z');
const fixture = () => {
  const via = {
    braces: [{ name: 'braces', dependency: 'braces', severity: 'high', url: knownUrl }],
    chokidar: ['braces'], micromatch: ['braces'], 'fast-glob': ['micromatch'],
    tailwindcss: ['chokidar', 'fast-glob', 'micromatch'],
  };
  return {
    report: { auditReportVersion: 2, vulnerabilities: Object.fromEntries(
      Object.entries(via).map(([name, causes]) => [name,
        { name, severity: 'high', via: causes, nodes: [`node_modules/${name}`] }]),
    ) },
    lockfile: { packages: Object.fromEntries(Object.keys(via).map(name =>
      [`node_modules/${name}`, { version: name === 'braces' ? '3.0.3' : '1.0.0', dev: true }])) },
  };
};

describe('temporary build dependency audit exception', () => {
  it('accepts only the known advisory and its propagated build-only findings', () => {
    const { report, lockfile } = fixture();
    const result = evaluateAuditReport(report, lockfile, withinException);
    expect(result.blocking).toEqual([]);
    expect(result.acceptedPackages.sort()).toEqual(['braces', 'chokidar', 'fast-glob', 'micromatch', 'tailwindcss']);
  });

  it('blocks the same findings at the expiry boundary', () => {
    const { report, lockfile } = fixture();
    expect(evaluateAuditReport(report, lockfile, new Date('2026-11-03T00:00:00Z')).blocking).toHaveLength(5);
  });

  it('does not hide a new advisory on the exempted dependency', () => {
    const { report, lockfile } = fixture();
    report.vulnerabilities.braces.via.push({ name: 'braces', dependency: 'braces', severity: 'moderate', url: 'https://github.com/advisories/GHSA-other' });
    const result = evaluateAuditReport(report, lockfile, withinException);
    expect(result.blocking).toHaveLength(5);
    expect(result.acceptedPackages).toEqual([]);
  });

  it.each(['braces', 'tailwindcss'])('blocks %s if it becomes a production dependency', name => {
    const { report, lockfile } = fixture();
    lockfile.packages[`node_modules/${name}`].dev = false;
    expect(evaluateAuditReport(report, lockfile, withinException).blocking.map(item => item.name)).toContain(name);
  });

  it('requires every installed braces copy to be the reviewed dev-only version', () => {
    const { report, lockfile } = fixture();
    const node = 'node_modules/other/node_modules/braces';
    report.vulnerabilities.braces.nodes.push(node);
    lockfile.packages[node] = { version: '3.0.2', dev: true };
    expect(evaluateAuditReport(report, lockfile, withinException).blocking).toHaveLength(5);
  });

  it.each(['moderate', 'critical'])('keeps unrelated %s advisories blocking', severity => {
    const { report, lockfile } = fixture();
    report.vulnerabilities.other = { name: 'other', severity, nodes: ['node_modules/other'],
      via: [{ name: 'other', severity, url: 'https://github.com/advisories/GHSA-other' }] };
    expect(evaluateAuditReport(report, lockfile, withinException).blocking)
      .toEqual([{ name: 'other', severity, advisories: ['https://github.com/advisories/GHSA-other'] }]);
  });

  it.each(['network error', 'unknown report version', 'missing cause', 'cycle'])('fails closed for %s', kind => {
    const { report, lockfile } = fixture();
    if (kind === 'network error') report.error = { code: 'ENETUNREACH' };
    if (kind === 'unknown report version') report.auditReportVersion = 3;
    if (kind === 'missing cause') report.vulnerabilities.braces.via = ['missing'];
    if (kind === 'cycle') report.vulnerabilities.braces.via = ['tailwindcss'];
    expect(() => evaluateAuditReport(report, lockfile, withinException)).toThrow();
  });

  it('passes a clean audit even after the exception expires', () => {
    expect(evaluateAuditReport({ auditReportVersion: 2, vulnerabilities: {} }, { packages: {} }, new Date('2027-01-01')).blocking).toEqual([]);
  });
});
