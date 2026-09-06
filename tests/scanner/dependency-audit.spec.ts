import { expect, it } from 'vitest';
import { mapAuditReportToFindings, type NpmAuditReport } from '../../src/scanner/dependency-audit.js';

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
