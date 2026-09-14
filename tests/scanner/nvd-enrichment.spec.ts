import { expect, it, vi } from 'vitest';
import type { NvdClient } from '../../src/scanner/nvd-client.js';
import { enrichOsvMatchesWithNvd, extractCveAliases } from '../../src/scanner/nvd-enrichment.js';

const clientWith = (lookup: NvdClient['lookupCve']): NvdClient => ({ lookupCve: lookup, consumeWarnings: () => [] });
const match = (aliases?: string[]) => ({
      pkg: { name: 'example', version: '1.0.0', ecosystem: 'npm' as const, lockfile: 'package-lock.json' },
      vuln: { id: 'GHSA-aaaa-bbbb-cccc', aliases, summary: 'Example vulnerability' },
      fixedVersions: ['1.0.1'],
});

it('extracts, canonicalizes and deduplicates only valid CVE aliases', () => {
      expect(extractCveAliases([' GHSA-aaaa-bbbb-cccc ', ' cve-2026-12345 ', 'CVE-invalid', 'CVE-2026-12345'])).toEqual(
            ['CVE-2026-12345'],
      );
      expect(extractCveAliases(undefined)).toEqual([]);
});

it('does not call NVD when OSV has no CVE alias', async () => {
      const lookup = vi.fn();
      const result = await enrichOsvMatchesWithNvd([match(['GHSA-aaaa-bbbb-cccc'])], clientWith(lookup));

      expect(lookup).not.toHaveBeenCalled();
      expect(result.coverage.total).toBe(0);
      expect(result.matches[0].nvd).toEqual([]);
});

it('queries each distinct CVE once and reattaches it to every matching dependency', async () => {
      const lookup = vi.fn(async (cveId: string) => ({
            status: 'found' as const,
            cveId,
            data: {
                  id: cveId,
                  cvss: { version: '3.1' as const, score: 9.8, severity: 'CRITICAL' as const, vectorString: 'vector' },
                  cwes: [],
                  references: [],
            },
      }));
      const result = await enrichOsvMatchesWithNvd(
            [
                  match(['CVE-2026-12345']),
                  {
                        ...match(['CVE-2026-12345']),
                        pkg: {
                              name: 'other',
                              version: '2.0.0',
                              ecosystem: 'npm' as const,
                              lockfile: 'package-lock.json',
                        },
                  },
            ],
            clientWith(lookup),
      );

      expect(lookup).toHaveBeenCalledTimes(1);
      expect(result.matches.every((item) => item.nvd[0]?.status === 'found')).toBe(true);
      expect(result.coverage).toEqual({ total: 1, enriched: 1, notFound: 0, failed: 0, cacheHits: 0 });
});

it('counts found, not-found, errors and cache hits separately', async () => {
      const lookup = async (cveId: string) => {
            if (cveId.endsWith('1')) {
                  return {
                        status: 'found' as const,
                        cveId,
                        fromCache: true,
                        data: { id: cveId, cwes: [], references: [] },
                  };
            }
            if (cveId.endsWith('2')) return { status: 'not-found' as const, cveId };
            return { status: 'error' as const, cveId, error: { kind: 'timeout' as const } };
      };
      const result = await enrichOsvMatchesWithNvd(
            [match(['CVE-2026-10001', 'CVE-2026-10002', 'CVE-2026-10003'])],
            clientWith(lookup),
      );

      expect(result.coverage).toEqual({ total: 3, enriched: 1, notFound: 1, failed: 1, cacheHits: 1 });
});
