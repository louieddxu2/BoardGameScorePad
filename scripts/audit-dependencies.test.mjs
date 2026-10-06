import { describe, expect, it } from 'vitest';
import { evaluateAuditReport } from './audit-dependencies.mjs';

const knownUrl = 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm';
const selectorUrl = 'https://github.com/advisories/GHSA-rj75-hqrm-r3gf';
const withinException = new Date('2026-10-06T00:00:00Z');
const fixture = () => {
  const via = {
    braces: [{ name: 'braces', dependency: 'braces', severity: 'high', url: knownUrl }],
    chokidar: ['braces'], micromatch: ['braces'], 'fast-glob': ['micromatch'],
    'postcss-selector-parser': [{ name: 'postcss-selector-parser', dependency: 'postcss-selector-parser', severity: 'moderate', url: selectorUrl }],
    'postcss-nested': ['postcss-selector-parser'],
    tailwindcss: ['chokidar', 'fast-glob', 'micromatch', 'postcss-nested', 'postcss-selector-parser'],
  };
  const versions = { braces: '3.0.3', 'postcss-selector-parser': '6.1.4' };
  return {
    report: { auditReportVersion: 2, vulnerabilities: Object.fromEntries(
      Object.entries(via).map(([name, causes]) => [name,
        { name, severity: name.startsWith('postcss-') ? 'moderate' : 'high', via: causes, nodes: [`node_modules/${name}`] }]),
    ) },
    lockfile: { packages: Object.fromEntries(Object.keys(via).map(name =>
      [`node_modules/${name}`, { version: versions[name] ?? '1.0.0', dev: true }])) },
  };
};

describe('reviewed build dependency audit exceptions', () => {
  it('accepts reviewed advisories and dependents with multiple reviewed causes', () => {
    const { report, lockfile } = fixture();
    const result = evaluateAuditReport(report, lockfile, withinException);
    expect(result.blocking).toEqual([]);
    expect(result.acceptedPackages.sort()).toEqual(['braces', 'chokidar', 'fast-glob', 'micromatch', 'postcss-nested', 'postcss-selector-parser', 'tailwindcss']);
    expect(result.acceptedAdvisories.map(item => item.url)).toEqual([knownUrl, selectorUrl]);
  });

  it('blocks the same findings at the expiry boundary', () => {
    const { report, lockfile } = fixture();
    expect(evaluateAuditReport(report, lockfile, new Date('2026-11-03T00:00:00Z')).blocking).toHaveLength(7);
  });

  it.each(['braces', 'postcss-selector-parser'])('does not hide a new advisory on %s or its dependents', name => {
    const { report, lockfile } = fixture();
    report.vulnerabilities[name].via.push({ name, dependency: name, severity: 'moderate', url: 'https://github.com/advisories/GHSA-other' });
    const result = evaluateAuditReport(report, lockfile, withinException);
    expect(result.blocking.map(item => item.name)).toEqual(name === 'braces'
      ? ['braces', 'chokidar', 'micromatch', 'fast-glob', 'tailwindcss']
      : ['postcss-selector-parser', 'postcss-nested', 'tailwindcss']);
    expect(result.acceptedAdvisories.map(item => item.package)).not.toContain(name);
  });

  it.each(['braces', 'postcss-selector-parser', 'tailwindcss'])('blocks %s if it becomes a production dependency', name => {
    const { report, lockfile } = fixture();
    lockfile.packages[`node_modules/${name}`].dev = false;
    expect(evaluateAuditReport(report, lockfile, withinException).blocking.map(item => item.name)).toContain(name);
  });

  it.each(['braces', 'postcss-selector-parser'])('requires every installed %s copy to be the reviewed version', name => {
    const { report, lockfile } = fixture();
    const node = `node_modules/other/node_modules/${name}`;
    report.vulnerabilities[name].nodes.push(node);
    lockfile.packages[node] = { version: '0.0.0', dev: true };
    const blocked = evaluateAuditReport(report, lockfile, withinException).blocking.map(item => item.name);
    expect(blocked).toContain(name);
    expect(blocked).toContain('tailwindcss');
  });

  it('blocks critical findings even if their underlying causes were reviewed', () => {
    const { report, lockfile } = fixture();
    report.vulnerabilities.tailwindcss.severity = 'critical';
    expect(evaluateAuditReport(report, lockfile, withinException).blocking.map(item => item.name))
      .toEqual(['tailwindcss']);
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
