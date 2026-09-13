import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { NvdCache } from '../../src/scanner/nvd-cache.js';
import { runDependencyAudit } from '../../src/scanner/dependency-audit.js';

let directory: string;

beforeEach(async () => {
      directory = await mkdtemp(join(tmpdir(), 'codesentry-nvd-integration-'));
      await writeFile(
            join(directory, 'package-lock.json'),
            JSON.stringify({
                  lockfileVersion: 3,
                  packages: {
                        '': { name: 'app', version: '1.0.0' },
                        'node_modules/example': { version: '1.0.0' },
                  },
            }),
      );
});

afterEach(async () => {
      await rm(directory, { recursive: true, force: true });
});

const memoryCache = (): NvdCache => ({
      get: async () => undefined,
      set: async () => undefined,
      consumeWarnings: () => [],
});

const osvDetail = {
      id: 'GHSA-aaaa-bbbb-cccc',
      aliases: ['CVE-2026-12345'],
      summary: 'Example vulnerability',
      database_specific: { severity: 'HIGH' },
      affected: [
            {
                  package: { name: 'example', ecosystem: 'npm' },
                  ranges: [{ type: 'SEMVER', events: [{ introduced: '0' }, { fixed: '1.0.2' }] }],
            },
      ],
};

it('enriches an OSV finding, uses NVD severity and deduplicates the matching npm advisory', async () => {
      const fetchImpl = vi.fn(async (url: string) => {
            if (url.includes('querybatch')) {
                  return {
                        ok: true,
                        status: 200,
                        json: async () => ({ results: [{ vulns: [{ id: osvDetail.id }] }] }),
                  };
            }
            if (url.includes('api.osv.dev')) return { ok: true, status: 200, json: async () => osvDetail };
            return {
                  ok: true,
                  status: 200,
                  json: async () => ({
                        totalResults: 1,
                        vulnerabilities: [
                              {
                                    cve: {
                                          id: 'CVE-2026-12345',
                                          vulnStatus: 'Analyzed',
                                          descriptions: [{ lang: 'en', value: 'NVD description' }],
                                          references: [],
                                          metrics: {
                                                cvssMetricV31: [
                                                      {
                                                            source: 'nvd@nist.gov',
                                                            type: 'Primary',
                                                            cvssData: {
                                                                  version: '3.1',
                                                                  vectorString: 'CVSS:3.1/example',
                                                                  baseScore: 9.8,
                                                                  baseSeverity: 'CRITICAL',
                                                            },
                                                      },
                                                ],
                                          },
                                    },
                              },
                        ],
                  }),
            };
      });
      const npmAuditRunner = async () => ({
            vulnerabilities: {
                  example: {
                        name: 'example',
                        severity: 'high',
                        range: '<1.0.2',
                        fixAvailable: true,
                        via: [
                              {
                                    title: 'GHSA-aaaa-bbbb-cccc',
                                    url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc',
                              },
                        ],
                  },
            },
      });

      const result = await runDependencyAudit(directory, {
            fetchImpl,
            npmAuditRunner,
            nvdCache: memoryCache(),
      });

      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]).toMatchObject({
            severity: 'critical',
            dependency: {
                  advisory: { source: 'osv', id: 'GHSA-aaaa-bbbb-cccc' },
                  nvd: [{ status: 'found', cveId: 'CVE-2026-12345' }],
            },
      });
      expect(result.engines?.nvd).toEqual({ total: 1, enriched: 1, notFound: 0, failed: 0, cacheHits: 0 });
});

it('preserves the OSV finding when NVD fails', async () => {
      const fetchImpl = async (url: string) => {
            if (url.includes('querybatch')) {
                  return {
                        ok: true,
                        status: 200,
                        json: async () => ({ results: [{ vulns: [{ id: osvDetail.id }] }] }),
                  };
            }
            return { ok: true, status: 200, json: async () => osvDetail };
      };
      const nvdClient = {
            lookupCve: async (cveId: string) => ({
                  status: 'error' as const,
                  cveId,
                  error: { kind: 'timeout' as const },
            }),
            consumeWarnings: () => [],
      };
      const result = await runDependencyAudit(directory, {
            fetchImpl,
            nvdClient,
            npmAuditRunner: async () => ({ vulnerabilities: {} }),
      });

      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].dependency?.nvd).toEqual([
            { status: 'error', cveId: 'CVE-2026-12345', error: { kind: 'timeout' } },
      ]);
      expect(result.warnings?.join(' ')).toContain('findings OSV foram preservados');
});

it('does not initialize NVD when enrichment is disabled', async () => {
      const fetchImpl = vi.fn(async (url: string) => {
            if (url.includes('querybatch')) {
                  return {
                        ok: true,
                        status: 200,
                        json: async () => ({ results: [{ vulns: [{ id: osvDetail.id }] }] }),
                  };
            }
            return { ok: true, status: 200, json: async () => osvDetail };
      });
      const nvdClient = {
            lookupCve: vi.fn(),
            consumeWarnings: vi.fn(() => []),
      };

      const result = await runDependencyAudit(directory, {
            fetchImpl,
            nvdEnabled: false,
            nvdClient,
            npmAuditRunner: async () => ({ vulnerabilities: {} }),
      });

      expect(result.engines?.nvd).toBe(false);
      expect(nvdClient.lookupCve).not.toHaveBeenCalled();
      expect(result.findings[0].dependency?.nvd).toEqual([]);
});

it('keeps OSV data and never exposes an unexpected NVD client error', async () => {
      const fetchImpl = async (url: string) => {
            if (url.includes('querybatch')) {
                  return {
                        ok: true,
                        status: 200,
                        json: async () => ({ results: [{ vulns: [{ id: osvDetail.id }] }] }),
                  };
            }
            return { ok: true, status: 200, json: async () => osvDetail };
      };
      const nvdClient = {
            lookupCve: () => {
                  throw new Error('NVD_API_KEY=top-secret');
            },
            consumeWarnings: () => [],
      };

      const result = await runDependencyAudit(directory, {
            fetchImpl,
            nvdClient,
            npmAuditRunner: async () => ({ vulnerabilities: {} }),
      });

      expect(result.findings).toHaveLength(1);
      expect(result.engines?.nvd).toMatchObject({ total: 1, failed: 1 });
      expect(JSON.stringify(result)).not.toContain('top-secret');
});

it('uses the highest NVD severity when an OSV advisory has multiple CVEs', async () => {
      const detail = { ...osvDetail, aliases: ['CVE-2026-10001', 'CVE-2026-10002'] };
      const fetchImpl = async (url: string) => {
            if (url.includes('querybatch')) {
                  return { ok: true, status: 200, json: async () => ({ results: [{ vulns: [{ id: detail.id }] }] }) };
            }
            return { ok: true, status: 200, json: async () => detail };
      };
      const nvdClient = {
            lookupCve: async (cveId: string) => ({
                  status: 'found' as const,
                  cveId,
                  data: {
                        id: cveId,
                        cwes: [],
                        references: [],
                        cvss: {
                              score: cveId.endsWith('1') ? 3.1 : 9.8,
                              severity: cveId.endsWith('1') ? ('LOW' as const) : ('CRITICAL' as const),
                              version: '3.1' as const,
                              vectorString: 'CVSS:3.1/example',
                        },
                  },
            }),
            consumeWarnings: () => [],
      };

      const result = await runDependencyAudit(directory, {
            fetchImpl,
            nvdClient,
            npmAuditRunner: async () => ({ vulnerabilities: {} }),
      });

      expect(result.findings[0].severity).toBe('critical');
      expect(result.findings[0].dependency?.nvd).toHaveLength(2);
      expect(result.engines?.nvd).toMatchObject({ total: 2, enriched: 2 });
});
