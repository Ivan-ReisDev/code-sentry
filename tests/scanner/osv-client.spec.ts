import { expect, it } from 'vitest';
import {
      extractFixedVersions,
      fetchOsvVulnerabilityDetails,
      mapOsvSeverity,
      osvPackageKey,
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

// Same name+version, two different ecosystems — used to assert nothing collides between them.
const crossEcosystemVuln: OsvVulnerability = {
      id: 'GHSA-cross-ecosystem',
      summary: 'Same package name published on two ecosystems',
      affected: [
            {
                  package: { name: 'requests', ecosystem: 'npm' },
                  ranges: [{ type: 'SEMVER', events: [{ introduced: '0.0.0' }, { fixed: '1.0.0' }] }],
            },
            {
                  package: { name: 'requests', ecosystem: 'PyPI' },
                  ranges: [{ type: 'ECOSYSTEM', events: [{ introduced: '0' }, { fixed: '2.28.1' }] }],
            },
      ],
};

it('sends one querybatch request with each package tagged by its own ecosystem', async () => {
      const requests: unknown[] = [];
      const fetchImpl = async (_url: string, init?: RequestInit) => {
            requests.push(JSON.parse(init?.body as string));
            return { ok: true, json: async () => ({ results: [{}, {}, {}] }) };
      };

      await queryOsvBatch(
            [
                  { name: 'lodash', version: '4.17.15', ecosystem: 'npm' },
                  { name: 'chalk', version: '6.0.0', ecosystem: 'npm' },
                  { name: 'requests', version: '2.28.0', ecosystem: 'PyPI' },
            ],
            fetchImpl,
      );

      expect(requests).toEqual([
            {
                  queries: [
                        { package: { name: 'lodash', ecosystem: 'npm' }, version: '4.17.15' },
                        { package: { name: 'chalk', ecosystem: 'npm' }, version: '6.0.0' },
                        { package: { name: 'requests', ecosystem: 'PyPI' }, version: '2.28.0' },
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
      const packages = Array.from({ length: 150 }, (_, i) => ({
            name: `pkg-${i}`,
            version: '1.0.0',
            ecosystem: 'npm',
      }));

      await queryOsvBatch(packages, fetchImpl);

      expect(requestSizes).toEqual([100, 50]);
});

it('returns vuln ids matched positionally back to their package, keyed by ecosystem', async () => {
      const fetchImpl = async () => ({
            ok: true,
            json: async () => ({
                  results: [{ vulns: [{ id: 'GHSA-aaaa-bbbb-cccc', modified: '2026-01-01' }] }, {}],
            }),
      });

      const { vulnIdsByPackage } = await queryOsvBatch(
            [
                  { name: 'lodash', version: '4.17.15', ecosystem: 'npm' },
                  { name: 'chalk', version: '6.0.0', ecosystem: 'npm' },
            ],
            fetchImpl,
      );

      expect(vulnIdsByPackage.get('npm:lodash@4.17.15')).toEqual(['GHSA-aaaa-bbbb-cccc']);
      expect(vulnIdsByPackage.has('npm:chalk@6.0.0')).toBe(false);
});

it('does not let same-name-different-ecosystem packages collide in vulnIdsByPackage', async () => {
      const fetchImpl = async (_url: string, init?: RequestInit) => {
            const body = JSON.parse(init?.body as string) as { queries: { package: { ecosystem: string } }[] };
            return {
                  ok: true,
                  json: async () => ({
                        results: body.queries.map((q) => ({
                              vulns: [{ id: q.package.ecosystem === 'npm' ? 'NPM-VULN' : 'PYPI-VULN' }],
                        })),
                  }),
            };
      };

      const { vulnIdsByPackage } = await queryOsvBatch(
            [
                  { name: 'requests', version: '2.28.0', ecosystem: 'npm' },
                  { name: 'requests', version: '2.28.0', ecosystem: 'PyPI' },
            ],
            fetchImpl,
      );

      expect(vulnIdsByPackage.get('npm:requests@2.28.0')).toEqual(['NPM-VULN']);
      expect(vulnIdsByPackage.get('PyPI:requests@2.28.0')).toEqual(['PYPI-VULN']);
});

it('osvPackageKey combines ecosystem, name and version', () => {
      expect(osvPackageKey({ name: 'chalk', version: '6.0.0', ecosystem: 'npm' })).toBe('npm:chalk@6.0.0');
});

it('returns a warning instead of throwing when the querybatch endpoint responds non-2xx', async () => {
      const fetchImpl = async () => ({ ok: false, status: 503, json: async () => ({}) });

      const result = await queryOsvBatch([{ name: 'lodash', version: '4.17.15', ecosystem: 'npm' }], fetchImpl);

      expect(result.vulnIdsByPackage.size).toBe(0);
      expect(result.warning).toContain('OSV.dev');
});

it('returns a warning instead of throwing when fetch itself rejects (network failure)', async () => {
      const fetchImpl = async () => {
            throw new Error('network down');
      };

      const result = await queryOsvBatch([{ name: 'lodash', version: '4.17.15', ecosystem: 'npm' }], fetchImpl);

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
                  { name: 'lodash', version: '4.17.15', ecosystem: 'npm' },
                  { name: 'chalk', version: '6.0.0', ecosystem: 'npm' },
            ],
            fetchImpl,
      );

      expect(checkedPackages).toEqual([
            { name: 'lodash', version: '4.17.15', ecosystem: 'npm' },
            { name: 'chalk', version: '6.0.0', ecosystem: 'npm' },
      ]);
});

it('does not list packages from a failed chunk as checked', async () => {
      const fetchImpl = async () => ({ ok: false, status: 503, json: async () => ({}) });

      const { checkedPackages } = await queryOsvBatch(
            [{ name: 'lodash', version: '4.17.15', ecosystem: 'npm' }],
            fetchImpl,
      );

      expect(checkedPackages).toEqual([]);
});

it('accumulates checked packages across multiple chunks', async () => {
      const fetchImpl = async (_url: string, init?: RequestInit) => {
            const body = JSON.parse(init?.body as string) as { queries: unknown[] };
            return { ok: true, json: async () => ({ results: body.queries.map(() => ({})) }) };
      };
      const packages = Array.from({ length: 150 }, (_, i) => ({
            name: `pkg-${i}`,
            version: '1.0.0',
            ecosystem: 'npm',
      }));

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
      expect(extractFixedVersions(lodashRedosVuln, 'lodash', 'npm')).toEqual(['4.17.21']);
});

it('extractFixedVersions returns an empty array when OSV has not published a fix for that package', () => {
      expect(extractFixedVersions(lodashRedosVuln, 'lodash.trimend', 'npm')).toEqual([]);
});

it('extractFixedVersions ignores ranges for other ecosystems even with a matching name coincidence', () => {
      expect(extractFixedVersions(lodashRedosVuln, 'lodash-rails', 'npm')).toEqual([]);
});

it('extractFixedVersions keeps npm and PyPI fixed versions separate for the same package name', () => {
      expect(extractFixedVersions(crossEcosystemVuln, 'requests', 'npm')).toEqual(['1.0.0']);
      expect(extractFixedVersions(crossEcosystemVuln, 'requests', 'PyPI')).toEqual(['2.28.1']);
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
