import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { normalizeNvdCve } from '../../src/scanner/nvd-normalizer.js';

const fixtureCve = (name: string): unknown => {
      const raw = readFileSync(new URL(`../fixtures/nvd/${name}`, import.meta.url), 'utf-8');
      const parsed = JSON.parse(raw) as { vulnerabilities?: Array<{ cve?: unknown }> };
      return parsed.vulnerabilities?.[0]?.cve;
};

const baseCve = (metrics: Record<string, unknown> = {}) => ({
      id: 'CVE-2026-12345',
      vulnStatus: 'Analyzed',
      published: '2026-01-01T00:00:00.000',
      lastModified: '2026-01-02T00:00:00.000',
      descriptions: [
            { lang: 'pt-BR', value: 'descrição' },
            { lang: 'en', value: 'description' },
      ],
      metrics,
      weaknesses: [
            {
                  description: [
                        { lang: 'en', value: 'CWE-78' },
                        { lang: 'en', value: 'NVD-CWE-noinfo' },
                  ],
            },
            { description: [{ lang: 'en', value: 'cwe-78' }] },
      ],
      references: [
            { url: 'https://example.com/advisory', source: 'vendor', tags: ['Patch'] },
            { url: 'https://example.com/advisory', source: 'duplicate' },
      ],
});

const v31 = {
      source: 'nvd@nist.gov',
      type: 'Primary',
      cvssData: {
            version: '3.1',
            vectorString: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
            baseScore: 9.8,
            baseSeverity: 'CRITICAL',
            attackVector: 'NETWORK',
            attackComplexity: 'LOW',
            privilegesRequired: 'NONE',
            userInteraction: 'NONE',
            scope: 'UNCHANGED',
            confidentialityImpact: 'HIGH',
            integrityImpact: 'HIGH',
            availabilityImpact: 'HIGH',
      },
};

it('prefers CVSS v4 and maps its vulnerable-system impact fields without inventing scope', () => {
      const result = normalizeNvdCve(
            baseCve({
                  cvssMetricV40: [
                        {
                              source: 'vendor',
                              type: 'Secondary',
                              cvssData: {
                                    version: '4.0',
                                    vectorString: 'CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:P/VC:L/VI:H/VA:N/SC:N/SI:N/SA:N',
                                    baseScore: 8.2,
                                    baseSeverity: 'HIGH',
                                    attackVector: 'NETWORK',
                                    attackComplexity: 'LOW',
                                    privilegesRequired: 'NONE',
                                    userInteraction: 'PASSIVE',
                                    vulnConfidentialityImpact: 'LOW',
                                    vulnIntegrityImpact: 'HIGH',
                                    vulnAvailabilityImpact: 'NONE',
                              },
                        },
                  ],
                  cvssMetricV31: [v31],
            }),
            'CVE-2026-12345',
      );

      expect(result?.cvss).toMatchObject({ version: '4.0', score: 8.2, integrityImpact: 'HIGH' });
      expect(result?.cvss).not.toHaveProperty('scope');
});

it('selects the NVD primary metric within a version and normalizes descriptive fields', () => {
      const secondary = { ...v31, source: 'vendor', type: 'Secondary', cvssData: { ...v31.cvssData, baseScore: 5 } };
      const result = normalizeNvdCve(baseCve({ cvssMetricV31: [secondary, v31] }), 'CVE-2026-12345');

      expect(result).toMatchObject({
            id: 'CVE-2026-12345',
            vulnerabilityStatus: 'Analyzed',
            description: 'description',
            descriptionLanguage: 'en',
            cwes: ['CWE-78'],
      });
      expect(result?.cvss).toMatchObject({ version: '3.1', score: 9.8, severity: 'CRITICAL', source: 'nvd@nist.gov' });
      expect(result?.references).toHaveLength(1);
});

it('uses CVSS v3.0 when no newer metric exists', () => {
      const result = normalizeNvdCve(
            baseCve({
                  cvssMetricV30: [
                        {
                              source: 'vendor',
                              type: 'Primary',
                              cvssData: {
                                    ...v31.cvssData,
                                    version: '3.0',
                                    vectorString: 'CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
                                    baseScore: 8.8,
                                    baseSeverity: 'HIGH',
                              },
                        },
                  ],
            }),
            'CVE-2026-12345',
      );

      expect(result?.cvss).toMatchObject({ version: '3.0', score: 8.8, severity: 'HIGH' });
});

it('derives a missing severity from the score but does not reinterpret unknown or NONE values', () => {
      const metricWithoutSeverity = { ...v31, cvssData: { ...v31.cvssData, baseSeverity: undefined } };
      const unknownMetric = { ...v31, cvssData: { ...v31.cvssData, baseSeverity: 'FUTURE' } };
      const noneMetric = { ...v31, cvssData: { ...v31.cvssData, baseSeverity: 'NONE' } };

      expect(
            normalizeNvdCve(baseCve({ cvssMetricV31: [metricWithoutSeverity] }), 'CVE-2026-12345')?.cvss?.severity,
      ).toBe('CRITICAL');
      expect(normalizeNvdCve(baseCve({ cvssMetricV31: [unknownMetric] }), 'CVE-2026-12345')?.cvss).not.toHaveProperty(
            'severity',
      );
      expect(normalizeNvdCve(baseCve({ cvssMetricV31: [noneMetric] }), 'CVE-2026-12345')?.cvss).not.toHaveProperty(
            'severity',
      );
});

it('prefers an English variant and otherwise falls back to the first available description', () => {
      const englishVariant = normalizeNvdCve(
            {
                  ...baseCve(),
                  descriptions: [
                        { lang: 'pt-BR', value: 'pt' },
                        { lang: 'en-US', value: 'en-US' },
                  ],
            },
            'CVE-2026-12345',
      );
      const fallback = normalizeNvdCve(
            {
                  ...baseCve(),
                  descriptions: [
                        { lang: 'es', value: 'es' },
                        { lang: 'pt-BR', value: 'pt' },
                  ],
            },
            'CVE-2026-12345',
      );

      expect(englishVariant).toMatchObject({ description: 'en-US', descriptionLanguage: 'en-US' });
      expect(fallback).toMatchObject({ description: 'es', descriptionLanguage: 'es' });
});

it('uses CVSS v2 as fallback and preserves its distinct impact vocabulary', () => {
      const result = normalizeNvdCve(
            baseCve({
                  cvssMetricV2: [
                        {
                              source: 'nvd@nist.gov',
                              type: 'Primary',
                              baseSeverity: 'HIGH',
                              userInteractionRequired: true,
                              cvssData: {
                                    version: '2.0',
                                    vectorString: 'AV:N/AC:M/Au:N/C:C/I:P/A:N',
                                    baseScore: 7.5,
                                    accessVector: 'NETWORK',
                                    accessComplexity: 'MEDIUM',
                                    confidentialityImpact: 'COMPLETE',
                                    integrityImpact: 'PARTIAL',
                                    availabilityImpact: 'NONE',
                              },
                        },
                  ],
            }),
            'CVE-2026-12345',
      );

      expect(result?.cvss).toMatchObject({
            version: '2.0',
            attackVector: 'NETWORK',
            attackComplexity: 'MEDIUM',
            userInteraction: 'REQUIRED',
            confidentialityImpact: 'COMPLETE',
            integrityImpact: 'PARTIAL',
      });
      expect(result?.cvss).not.toHaveProperty('privilegesRequired');
});

it('keeps a CVE without metrics as a valid record and extracts CISA KEV and SSVC data', () => {
      const result = normalizeNvdCve(
            {
                  ...baseCve(),
                  cisaExploitAdd: '2026-02-01',
                  cisaActionDue: '2026-02-20',
                  cisaRequiredAction: 'Apply update.',
                  cisaVulnerabilityName: 'Example vulnerability',
                  metrics: {
                        ssvcV203: [
                              {
                                    ssvcData: {
                                          role: 'CISA Coordinator',
                                          timestamp: '2026-02-02T00:00:00Z',
                                          options: [
                                                { exploitation: 'active' },
                                                { automatable: 'yes' },
                                                { technicalImpact: 'total' },
                                          ],
                                    },
                              },
                        ],
                  },
            },
            'CVE-2026-12345',
      );

      expect(result?.cvss).toBeUndefined();
      expect(result?.cisa).toEqual({
            kev: {
                  addedAt: '2026-02-01',
                  actionDue: '2026-02-20',
                  requiredAction: 'Apply update.',
                  vulnerabilityName: 'Example vulnerability',
            },
            ssvc: {
                  exploitation: 'active',
                  automatable: 'yes',
                  technicalImpact: 'total',
                  timestamp: '2026-02-02T00:00:00Z',
            },
      });
});

it('rejects a response entry whose id does not match the requested CVE', () => {
      expect(normalizeNvdCve(baseCve(), 'CVE-2026-99999')).toBeUndefined();
});

it.each([
      ['cvss-v4.json', 'CVE-2026-10004', '4.0'],
      ['cvss-v31.json', 'CVE-2026-10031', '3.1'],
      ['cvss-v30.json', 'CVE-2026-10030', '3.0'],
      ['cvss-v2.json', 'CVE-2026-10020', '2.0'],
] as const)('normalizes the reduced %s API fixture', (name, cveId, version) => {
      expect(normalizeNvdCve(fixtureCve(name), cveId)?.cvss?.version).toBe(version);
});

it('normalizes the reduced no-metrics/CISA fixture', () => {
      const result = normalizeNvdCve(fixtureCve('no-metrics-cisa.json'), 'CVE-2026-10999');

      expect(result?.cvss).toBeUndefined();
      expect(result?.cisa?.kev?.actionDue).toBe('2026-01-31');
      expect(result?.cisa?.ssvc?.exploitation).toBe('active');
});
