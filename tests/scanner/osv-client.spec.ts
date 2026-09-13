import { expect, it } from 'vitest';
import {
      extractFixedVersions,
      fetchOsvVulnerabilityDetails,
      mapOsvSeverity,
      queryOsvBatch,
      type OsvVulnerability,
} from '../../src/scanner/osv-client.js';

// Trimmed real excerpt from a GET https://api.osv.dev/v1/vulns/GHSA-29mw-wpgm-hmr9 response
// (lodash ReDoS advisory), provided by the user as api.osv.json at the repo root.
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
            {
                  package: { name: 'lodash-rails', ecosystem: 'RubyGems' },
                  ranges: [{ type: 'ECOSYSTEM', events: [{ introduced: '4.0.0' }, { fixed: '4.17.21' }] }],
            },
      ],
};

it('sends one querybatch request with the npm ecosystem for the given packages', async () => {
      const requests: unknown[] = [];
      const fetchImpl = async (_url: string, init?: RequestInit) => {
            requests.push(JSON.parse(init?.body as string));
            return { ok: true, json: async () => ({ results: [{}, {}] }) };
      };

      await queryOsvBatch(
            [
                  { name: 'lodash', version: '4.17.15' },
                  { name: 'chalk', version: '6.0.0' },
            ],
            fetchImpl,
      );

      expect(requests).toEqual([
            {
                  queries: [
                        { package: { name: 'lodash', ecosystem: 'npm' }, version: '4.17.15' },
                        { package: { name: 'chalk', ecosystem: 'npm' }, version: '6.0.0' },
                  ],
            },
      ]);
});

it('chunks large package lists instead of sending one oversized request', async () => {
      const requestSizes: number[] = [];
      const fetchImpl = async (_url: string, init?: RequestInit) => {
            const body = JSON.parse(init?.body as string) as { queries: unknown[] };
            requestSizes.push(body.queries.length);
            return { ok: true, json: async () => ({ results: body.queries.map(() => ({})) }) };
      };
      const packages = Array.from({ length: 150 }, (_, i) => ({ name: `pkg-${i}`, version: '1.0.0' }));

      await queryOsvBatch(packages, fetchImpl);

      expect(requestSizes).toEqual([100, 50]);
});

it('returns vuln ids matched positionally back to their package', async () => {
      const fetchImpl = async () => ({
            ok: true,
            json: async () => ({
                  results: [{ vulns: [{ id: 'GHSA-aaaa-bbbb-cccc', modified: '2026-01-01' }] }, {}],
            }),
      });

      const { vulnIdsByPackage } = await queryOsvBatch(
            [
                  { name: 'lodash', version: '4.17.15' },
                  { name: 'chalk', version: '6.0.0' },
            ],
            fetchImpl,
      );

      expect(vulnIdsByPackage.get('lodash@4.17.15')).toEqual(['GHSA-aaaa-bbbb-cccc']);
      expect(vulnIdsByPackage.has('chalk@6.0.0')).toBe(false);
});

it('returns a warning instead of throwing when the querybatch endpoint responds non-2xx', async () => {
      const fetchImpl = async () => ({ ok: false, status: 503, json: async () => ({}) });

      const result = await queryOsvBatch([{ name: 'lodash', version: '4.17.15' }], fetchImpl);

      expect(result.vulnIdsByPackage.size).toBe(0);
      expect(result.warning).toContain('OSV.dev');
});

it('returns a warning instead of throwing when fetch itself rejects (network failure)', async () => {
      const fetchImpl = async () => {
            throw new Error('network down');
      };

      const result = await queryOsvBatch([{ name: 'lodash', version: '4.17.15' }], fetchImpl);

      expect(result.vulnIdsByPackage.size).toBe(0);
      expect(result.warning).toContain('OSV.dev');
});

it('lists every package from a successful chunk as checked, vulnerable or not', async () => {
      const fetchImpl = async () => ({
            ok: true,
            json: async () => ({ results: [{ vulns: [{ id: 'GHSA-aaaa-bbbb-cccc' }] }, {}] }),
      });

      const { checkedPackages } = await queryOsvBatch(
            [
                  { name: 'lodash', version: '4.17.15' },
                  { name: 'chalk', version: '6.0.0' },
            ],
            fetchImpl,
      );

      expect(checkedPackages).toEqual([
            { name: 'lodash', version: '4.17.15' },
            { name: 'chalk', version: '6.0.0' },
      ]);
});

it('does not list packages from a failed chunk as checked', async () => {
      const fetchImpl = async () => ({ ok: false, status: 503, json: async () => ({}) });

      const { checkedPackages } = await queryOsvBatch([{ name: 'lodash', version: '4.17.15' }], fetchImpl);

      expect(checkedPackages).toEqual([]);
});

it('accumulates checked packages across multiple chunks', async () => {
      const fetchImpl = async (_url: string, init?: RequestInit) => {
            const body = JSON.parse(init?.body as string) as { queries: unknown[] };
            return { ok: true, json: async () => ({ results: body.queries.map(() => ({})) }) };
      };
      const packages = Array.from({ length: 150 }, (_, i) => ({ name: `pkg-${i}`, version: '1.0.0' }));

      const { checkedPackages } = await queryOsvBatch(packages, fetchImpl);

      expect(checkedPackages).toHaveLength(150);
});

it('fetches vulnerability details for each distinct id via GET /v1/vulns/{id}', async () => {
      const requestedUrls: string[] = [];
      const fetchImpl = async (url: string) => {
            requestedUrls.push(url);
            return { ok: true, json: async () => lodashRedosVuln };
      };

      const { detailsById } = await fetchOsvVulnerabilityDetails(['GHSA-29mw-wpgm-hmr9'], fetchImpl);

      expect(requestedUrls).toEqual(['https://api.osv.dev/v1/vulns/GHSA-29mw-wpgm-hmr9']);
      expect(detailsById.get('GHSA-29mw-wpgm-hmr9')).toEqual(lodashRedosVuln);
});

it('dedupes ids shared by multiple packages before fetching details', async () => {
      let callCount = 0;
      const fetchImpl = async () => {
            callCount += 1;
            return { ok: true, json: async () => lodashRedosVuln };
      };

      await fetchOsvVulnerabilityDetails(['GHSA-29mw-wpgm-hmr9', 'GHSA-29mw-wpgm-hmr9'], fetchImpl);

      expect(callCount).toBe(1);
});

it('returns a warning instead of throwing when a detail fetch fails, without dropping the others', async () => {
      const fetchImpl = async (url: string) => {
            if (url.endsWith('GHSA-broken')) {
                  return { ok: false, status: 500, json: async () => ({}) };
            }
            return { ok: true, json: async () => lodashRedosVuln };
      };

      const { detailsById, warning } = await fetchOsvVulnerabilityDetails(
            ['GHSA-broken', 'GHSA-29mw-wpgm-hmr9'],
            fetchImpl,
      );

      expect(detailsById.get('GHSA-29mw-wpgm-hmr9')).toEqual(lodashRedosVuln);
      expect(detailsById.has('GHSA-broken')).toBe(false);
      expect(warning).toContain('OSV.dev');
});

it('extractFixedVersions collects the fixed version for the matching npm package', () => {
      expect(extractFixedVersions(lodashRedosVuln, 'lodash')).toEqual(['4.17.21']);
});

it('extractFixedVersions returns an empty array when OSV has not published a fix for that package', () => {
      expect(extractFixedVersions(lodashRedosVuln, 'lodash.trimend')).toEqual([]);
});

it('extractFixedVersions ignores ranges for other ecosystems even with a matching name coincidence', () => {
      expect(extractFixedVersions(lodashRedosVuln, 'lodash-rails')).toEqual([]);
});

it('mapOsvSeverity maps GHSA-style database_specific.severity values', () => {
      expect(mapOsvSeverity({ id: 'x', database_specific: { severity: 'HIGH' } })).toBe('high');
      expect(mapOsvSeverity({ id: 'x', database_specific: { severity: 'CRITICAL' } })).toBe('critical');
      expect(mapOsvSeverity({ id: 'x', database_specific: { severity: 'LOW' } })).toBe('low');
      expect(mapOsvSeverity({ id: 'x', database_specific: { severity: 'MODERATE' } })).toBe('medium');
});

it('mapOsvSeverity defaults to medium when severity is absent', () => {
      expect(mapOsvSeverity({ id: 'x' })).toBe('medium');
});
