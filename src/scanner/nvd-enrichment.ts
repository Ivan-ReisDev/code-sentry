import type { NvdLookupResult } from '../rules/rule.interface.js';
import type { LockedPackage } from './package-lock-parser.js';
import type { NvdClient } from './nvd-client.js';
import type { OsvVulnerability } from './osv-client.js';

const CVE_PATTERN = /^CVE-\d{4}-\d{4,}$/;

export interface OsvAdvisoryMatch {
      pkg: LockedPackage;
      vuln: OsvVulnerability;
      fixedVersions: string[];
}

export interface EnrichedOsvAdvisoryMatch extends OsvAdvisoryMatch {
      cveIds: string[];
      nvd: NvdLookupResult[];
}

export interface NvdCoverage {
      total: number;
      enriched: number;
      notFound: number;
      failed: number;
      cacheHits: number;
}

export interface NvdEnrichmentResult {
      matches: EnrichedOsvAdvisoryMatch[];
      coverage: NvdCoverage;
      warnings: string[];
}

export const extractCveAliases = (aliases: string[] | undefined): string[] => {
      const cves = (aliases ?? [])
            .map((alias) => alias.trim().toUpperCase())
            .filter((alias) => CVE_PATTERN.test(alias));
      return [...new Set(cves)];
};

const coverageFrom = (results: NvdLookupResult[]): NvdCoverage => ({
      total: results.length,
      enriched: results.filter((result) => result.status === 'found').length,
      notFound: results.filter((result) => result.status === 'not-found').length,
      failed: results.filter((result) => result.status === 'error').length,
      cacheHits: results.filter((result) => result.status !== 'error' && result.fromCache).length,
});

interface LookupResolution {
      resolved: Map<string, NvdLookupResult>;
      unexpectedFailure: boolean;
}

const resolveLookups = async (lookups: Map<string, Promise<NvdLookupResult>>): Promise<LookupResolution> => {
      const resolved = new Map<string, NvdLookupResult>();
      let unexpectedFailure = false;
      try {
            await Promise.all(
                  [...lookups].map(async ([cveId, lookup]) => {
                        try {
                              resolved.set(cveId, await lookup);
                        } catch {
                              resolved.set(cveId, { status: 'error', cveId, error: { kind: 'unavailable' } });
                        }
                  }),
            );
      } catch {
            unexpectedFailure = true;
      }
      return { resolved, unexpectedFailure };
};

const enrichMatch = (
      match: OsvAdvisoryMatch,
      cveIds: string[],
      resolved: Map<string, NvdLookupResult>,
): EnrichedOsvAdvisoryMatch => ({
      ...match,
      cveIds,
      nvd: cveIds.map((cveId) => resolved.get(cveId)).filter((item): item is NvdLookupResult => item !== undefined),
});

const enrichmentWarnings = (client: NvdClient, coverage: NvdCoverage, unexpectedFailure: boolean): string[] => [
      ...client.consumeWarnings(),
      ...(coverage.failed > 0
            ? [`Não foi possível consultar o NVD para ${coverage.failed} CVE(s); os findings OSV foram preservados.`]
            : []),
      ...(unexpectedFailure
            ? [
                    'Falha interna inesperada ao consolidar as consultas do NVD; alguns CVEs podem não ter sido enriquecidos.',
              ]
            : []),
];

export const enrichOsvMatchesWithNvd = async (
      matches: OsvAdvisoryMatch[],
      client: NvdClient,
): Promise<NvdEnrichmentResult> => {
      const cveIdsByMatch = matches.map((match) => extractCveAliases(match.vuln.aliases));
      const uniqueCveIds = [...new Set(cveIdsByMatch.flat())];
      const lookups = new Map<string, Promise<NvdLookupResult>>(
            uniqueCveIds.map((cveId) => [cveId, client.lookupCve(cveId)]),
      );
      let resolution: LookupResolution;
      try {
            resolution = await resolveLookups(lookups);
      } catch {
            resolution = { resolved: new Map(), unexpectedFailure: true };
      }
      const { resolved, unexpectedFailure } = resolution;
      const results = uniqueCveIds
            .map((cveId) => resolved.get(cveId))
            .filter((item): item is NvdLookupResult => Boolean(item));
      const coverage = coverageFrom(results);
      return {
            matches: matches.map((match, index) =>
                  // codesentry-disable-next-line security/detect-object-injection -- index originates from map over the same cveIdsByMatch array.
                  enrichMatch(match, cveIdsByMatch[index] ?? [], resolved),
            ),
            coverage,
            warnings: enrichmentWarnings(client, coverage, unexpectedFailure),
      };
};
