import { expect, it } from 'vitest';
import type { LockedPackage } from '../../src/scanner/lockfiles/locked-package.js';
import type { OsvVulnerability } from '../../src/scanner/osv-client.js';
import {
      auditPackagesWithOsv,
      mapAuditReportToFindings,
      mapOsvFindingsToRuleFindings,
      normalizeNpmAuditReport,
      type NpmAuditReport,
} from '../../src/scanner/dependency-audit.js';

const npmPkg = (name: string, version: string): LockedPackage => ({
      name,
      version,
      ecosystem: 'npm',
      lockfile: 'package-lock.json',
});

const pypiPkg = (name: string, version: string): LockedPackage => ({
      name,
      version,
      ecosystem: 'PyPI',
      lockfile: 'poetry.lock',
});

it('maps a vulnerability from an npm audit report to a finding', () => {
      const report: NpmAuditReport = {
            vulnerabilities: {
                  lodash: {
                        name: 'lodash',
                        severity: 'high',
                        range: '<4.17.21',
                        fixAvailable: true,
                        via: [{ title: 'Prototype Pollution in lodash' }],
                  },
            },
      };

      const findings = mapAuditReportToFindings(report);

      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
            ruleId: 'dependency-audit',
            file: 'package.json',
            line: 1,
            severity: 'high',
      });
      expect(findings[0].message).toContain('lodash');
      expect(findings[0].message).toContain('Prototype Pollution in lodash');
});

it('maps npm audit severities to the project severity scale', () => {
      const report: NpmAuditReport = {
            vulnerabilities: {
                  a: { name: 'a', severity: 'info', range: '*', fixAvailable: false, via: [] },
                  b: { name: 'b', severity: 'low', range: '*', fixAvailable: false, via: [] },
                  c: { name: 'c', severity: 'moderate', range: '*', fixAvailable: false, via: [] },
                  d: { name: 'd', severity: 'high', range: '*', fixAvailable: false, via: [] },
                  e: { name: 'e', severity: 'critical', range: '*', fixAvailable: false, via: [] },
            },
      };

      const findings = mapAuditReportToFindings(report);
      const severityByPackage = Object.fromEntries(
            findings.map((finding) => [finding.message.match(/^Dependência vulnerável: (\w+)/)?.[1], finding.severity]),
      );

      expect(severityByPackage).toMatchObject({
            a: 'low',
            b: 'low',
            c: 'medium',
            d: 'high',
            e: 'critical',
      });
});

it('returns no findings when there are no vulnerabilities', () => {
      const findings = mapAuditReportToFindings({ vulnerabilities: {} });

      expect(findings).toHaveLength(0);
});

it('suggests updating to the exact package@version npm audit recommends', () => {
      const report: NpmAuditReport = {
            vulnerabilities: {
                  lodash: {
                        name: 'lodash',
                        severity: 'high',
                        range: '<4.17.21',
                        fixAvailable: { name: 'lodash', version: '4.17.21' },
                        via: [{ title: 'Prototype Pollution in lodash' }],
                  },
            },
      };

      expect(mapAuditReportToFindings(report)[0].message).toContain('atualize para lodash@4.17.21');
});

it('suggests updating out of the vulnerable range when npm audit only confirms a fix exists', () => {
      const report: NpmAuditReport = {
            vulnerabilities: {
                  lodash: { name: 'lodash', severity: 'high', range: '<4.17.21', fixAvailable: true, via: [] },
            },
      };

      expect(mapAuditReportToFindings(report)[0].message).toContain('<4.17.21');
});

it('is honest that there is no fix yet when npm audit reports fixAvailable: false', () => {
      const report: NpmAuditReport = {
            vulnerabilities: {
                  lodash: { name: 'lodash', severity: 'high', range: '*', fixAvailable: false, via: [] },
            },
      };

      expect(mapAuditReportToFindings(report)[0].message).toContain('sem correção disponível ainda');
});

it('normalizeNpmAuditReport keeps a valid npm audit report unchanged', () => {
      const raw = {
            vulnerabilities: {
                  lodash: { name: 'lodash', severity: 'high', range: '*', fixAvailable: false, via: [] },
            },
      };

      const { report, warning } = normalizeNpmAuditReport(raw);

      expect(report.vulnerabilities).toBe(raw.vulnerabilities);
      expect(warning).toBeUndefined();
});

it('normalizeNpmAuditReport turns a failed npm audit response into an empty report with a warning', () => {
      const raw = { error: { code: 'E404', summary: 'audit endpoint returned an error' } };

      const { report, warning } = normalizeNpmAuditReport(raw);

      expect(report.vulnerabilities).toEqual({});
      expect(warning).toContain('npm audit');
      expect(warning).toContain('audit endpoint returned an error');
});

it('normalizeNpmAuditReport turns a report with vulnerabilities: null into an empty report with a warning', () => {
      const { report, warning } = normalizeNpmAuditReport({ vulnerabilities: null });

      expect(report.vulnerabilities).toEqual({});
      expect(warning).toBeDefined();
});

const lodashRedosVuln: OsvVulnerability = {
      id: 'GHSA-29mw-wpgm-hmr9',
      summary: 'Regular Expression Denial of Service (ReDoS) in lodash',
      database_specific: { severity: 'MODERATE' },
      affected: [
            {
                  package: { name: 'lodash', ecosystem: 'npm' },
                  ranges: [{ type: 'SEMVER', events: [{ introduced: '4.0.0' }, { fixed: '4.17.21' }] }],
            },
            {
                  package: { name: 'lodash.trimend', ecosystem: 'npm' },
                  ranges: [{ type: 'SEMVER', events: [{ introduced: '4.0.0' }, { last_affected: '4.5.1' }] }],
            },
      ],
};

it('keeps OSV findings even when npm audit also flagged the package, because OSV is primary', () => {
      const findings = mapOsvFindingsToRuleFindings(
            [npmPkg('lodash', '4.17.15')],
            new Map([['npm:lodash@4.17.15', ['GHSA-29mw-wpgm-hmr9']]]),
            new Map([['GHSA-29mw-wpgm-hmr9', lodashRedosVuln]]),
            new Set(['lodash']),
      );

      expect(findings).toHaveLength(1);
});

it('deduplicates a npm advisory only when its canonical id matches OSV for the same package', () => {
      const report: NpmAuditReport = {
            vulnerabilities: {
                  lodash: {
                        name: 'lodash',
                        severity: 'high',
                        range: '<4.17.21',
                        fixAvailable: true,
                        via: [
                              {
                                    title: 'Prototype Pollution GHSA-aaaa-bbbb-cccc',
                                    url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc',
                              },
                              { title: 'A distinct npm advisory without a canonical id' },
                        ],
                  },
            },
      };

      const findings = mapAuditReportToFindings(report, new Map([['npm:lodash', new Set(['GHSA-AAAA-BBBB-CCCC'])]]));

      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain('distinct npm advisory');
});

it('does not duplicate equivalent npm advisory entries or render transitive via strings beside structured advisories', () => {
      const advisory = {
            title: 'Prototype Pollution CVE-2026-12345',
            url: 'https://example.com/CVE-2026-12345',
      };
      const report: NpmAuditReport = {
            vulnerabilities: {
                  lodash: {
                        name: 'lodash',
                        severity: 'high',
                        range: '*',
                        fixAvailable: false,
                        via: [advisory, { ...advisory }, 'transitive-package'],
                  },
            },
      };

      const findings = mapAuditReportToFindings(report);

      expect(findings).toHaveLength(1);
      expect(findings[0].dependency?.advisory.id).toBe('CVE-2026-12345');
});

it('keeps OSV findings for packages npm audit did not flag, with the fix version from OSV itself', () => {
      const findings = mapOsvFindingsToRuleFindings(
            [npmPkg('lodash', '4.17.15')],
            new Map([['npm:lodash@4.17.15', ['GHSA-29mw-wpgm-hmr9']]]),
            new Map([['GHSA-29mw-wpgm-hmr9', lodashRedosVuln]]),
            new Set(),
      );

      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
            ruleId: 'dependency-audit',
            file: 'package-lock.json',
            line: 1,
            severity: 'medium',
      });
      expect(findings[0].message).toContain('GHSA-29mw-wpgm-hmr9');
      expect(findings[0].message).toContain('lodash@4.17.15');
      expect(findings[0].message).toContain('atualize para 4.17.21');
});

it('normalizes and deduplicates CVE aliases while preserving non-CVE aliases', () => {
      const vulnerability: OsvVulnerability = {
            ...lodashRedosVuln,
            aliases: [' cve-2026-12345 ', 'CVE-2026-12345', 'GHSA-29mw-wpgm-hmr9'],
      };
      const findings = mapOsvFindingsToRuleFindings(
            [npmPkg('lodash', '4.17.15')],
            new Map([['npm:lodash@4.17.15', [vulnerability.id]]]),
            new Map([[vulnerability.id, vulnerability]]),
      );

      expect(findings[0].dependency?.advisory.aliases).toEqual(['CVE-2026-12345', 'GHSA-29mw-wpgm-hmr9']);
});

it('falls back to an honest "no fix published" message when OSV has no fixed event for that package', () => {
      const findings = mapOsvFindingsToRuleFindings(
            [npmPkg('lodash.trimend', '4.5.1')],
            new Map([['npm:lodash.trimend@4.5.1', ['GHSA-29mw-wpgm-hmr9']]]),
            new Map([['GHSA-29mw-wpgm-hmr9', lodashRedosVuln]]),
            new Set(),
      );

      expect(findings[0].message).toContain('nenhuma versão corrigida publicada pelo OSV.dev ainda');
});

it('attributes an OSV finding to the lockfile and ecosystem of the package it came from', () => {
      const requestsVuln: OsvVulnerability = {
            id: 'GHSA-requests-pypi',
            summary: 'Example PyPI advisory',
            affected: [{ package: { name: 'requests', ecosystem: 'PyPI' }, ranges: [] }],
      };
      const findings = mapOsvFindingsToRuleFindings(
            [pypiPkg('requests', '2.28.0')],
            new Map([['PyPI:requests@2.28.0', ['GHSA-requests-pypi']]]),
            new Map([['GHSA-requests-pypi', requestsVuln]]),
      );

      expect(findings).toHaveLength(1);
      expect(findings[0].file).toBe('poetry.lock');
      expect(findings[0].dependency?.package.ecosystem).toBe('PyPI');
});

it('does not let a PyPI OSV match dedupe an npm-audit finding of the same package name', () => {
      const report: NpmAuditReport = {
            vulnerabilities: {
                  requests: {
                        name: 'requests',
                        severity: 'high',
                        range: '*',
                        fixAvailable: false,
                        via: [{ title: 'npm advisory GHSA-shared-id', url: 'https://example.com/GHSA-shared-id' }],
                  },
            },
      };
      // Same canonical id, but indexed under the PyPI package of the same name — must not cross-dedupe.
      const osvIdsByPackage = new Map([['PyPI:requests', new Set(['GHSA-SHARED-ID'])]]);

      const findings = mapAuditReportToFindings(report, osvIdsByPackage);

      expect(findings).toHaveLength(1);
});

it('auditPackagesWithOsv queries OSV for the locked packages and merges details into findings', async () => {
      const lockedPackages: LockedPackage[] = [npmPkg('lodash', '4.17.15')];
      const fetchImpl = async (url: string) => {
            if (url.includes('querybatch')) {
                  return { ok: true, json: async () => ({ results: [{ vulns: [{ id: 'GHSA-29mw-wpgm-hmr9' }] }] }) };
            }
            return { ok: true, json: async () => lodashRedosVuln };
      };

      const { findings, warning } = await auditPackagesWithOsv(lockedPackages, new Set(), fetchImpl);

      expect(warning).toBeUndefined();
      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain('GHSA-29mw-wpgm-hmr9');
});

it('auditPackagesWithOsv surfaces a warning instead of throwing when OSV is unreachable', async () => {
      const fetchImpl = async () => {
            throw new Error('network down');
      };

      const { findings, warning } = await auditPackagesWithOsv([npmPkg('lodash', '4.17.15')], new Set(), fetchImpl);

      expect(findings).toHaveLength(0);
      expect(warning).toContain('OSV.dev');
});

it('auditPackagesWithOsv reports every successfully queried package as checked', async () => {
      const lockedPackages: LockedPackage[] = [npmPkg('lodash', '4.17.15'), npmPkg('chalk', '6.0.0')];
      const fetchImpl = async (url: string) => {
            if (url.includes('querybatch')) {
                  return {
                        ok: true,
                        json: async () => ({ results: [{ vulns: [{ id: 'GHSA-29mw-wpgm-hmr9' }] }, {}] }),
                  };
            }
            return { ok: true, json: async () => lodashRedosVuln };
      };

      const { checkedPackages } = await auditPackagesWithOsv(lockedPackages, new Set(), fetchImpl);

      expect(checkedPackages).toEqual(lockedPackages);
});

it('auditPackagesWithOsv reports no checked packages when the OSV batch query fails entirely', async () => {
      const fetchImpl = async () => ({ ok: false, status: 503, json: async () => ({}) });

      const { checkedPackages } = await auditPackagesWithOsv([npmPkg('lodash', '4.17.15')], new Set(), fetchImpl);

      expect(checkedPackages).toEqual([]);
});
