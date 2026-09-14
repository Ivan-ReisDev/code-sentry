import type { Severity } from '../rules/rule.interface.js';
import { runWithConcurrencyLimit } from './run-with-concurrency-limit.js';

export interface OsvEvent {
      introduced?: string;
      fixed?: string;
      last_affected?: string;
}

export interface OsvRange {
      type: string;
      events: OsvEvent[];
}

export interface OsvAffected {
      package: { name: string; ecosystem: string };
      ranges?: OsvRange[];
}

export interface OsvVulnerability {
      id: string;
      aliases?: string[];
      summary?: string;
      database_specific?: { severity?: string };
      affected?: OsvAffected[];
}

export interface OsvPackageQuery {
      name: string;
      version: string;
      ecosystem: string;
}

/** Identity key for a package query, scoped by ecosystem — two ecosystems can share a package name. */
export const osvPackageKey = (pkg: Pick<OsvPackageQuery, 'name' | 'version' | 'ecosystem'>): string =>
      `${pkg.ecosystem}:${pkg.name}@${pkg.version}`;

export interface OsvBatchResult<T extends OsvPackageQuery = OsvPackageQuery> {
      vulnIdsByPackage: Map<string, string[]>;
      checkedPackages: T[];
      warning?: string;
}

export interface OsvDetailsResult {
      detailsById: Map<string, OsvVulnerability>;
      warning?: string;
}

/** Narrow subset of the global `fetch` contract, so tests can inject a plain stub instead of a real `Response`. */
export type FetchLike = (
      url: string,
      init?: RequestInit,
) => Promise<{
      ok: boolean;
      status?: number;
      headers?: { get: (name: string) => string | null };
      json: () => Promise<unknown>;
}>;

const OSV_BATCH_CHUNK_SIZE = 100;
const OSV_DETAIL_CONCURRENCY = 10;
const OSV_API_BASE = 'https://api.osv.dev/v1';

const SEVERITY_MAP: Record<string, Severity> = {
      LOW: 'low',
      MODERATE: 'medium',
      HIGH: 'high',
      CRITICAL: 'critical',
};

const chunk = <T>(items: readonly T[], size: number): T[][] => {
      const chunks: T[][] = [];
      for (let i = 0; i < items.length; i += size) {
            chunks.push(items.slice(i, i + size));
      }
      return chunks;
};

interface OsvBatchResponseBody {
      results?: { vulns?: { id: string }[] }[];
}

const zipVulnIdsByPackage = <T extends OsvPackageQuery>(
      packages: T[],
      body: OsvBatchResponseBody,
): Map<string, string[]> => {
      const vulnIdsByPackage = new Map<string, string[]>();
      packages.forEach((pkg, index) => {
            // codesentry-disable-next-line security/detect-object-injection -- index comes from Array.prototype.forEach over the same-length packages array sent in the request, never an attacker-controlled key.
            const ids = body.results?.[index]?.vulns?.map((v) => v.id);
            if (ids?.length) {
                  vulnIdsByPackage.set(osvPackageKey(pkg), ids);
            }
      });
      return vulnIdsByPackage;
};

const queryBatchChunk = async <T extends OsvPackageQuery>(
      packages: T[],
      fetchImpl: FetchLike,
): Promise<{ vulnIdsByPackage: Map<string, string[]>; checkedPackages: T[]; failedCount: number }> => {
      try {
            const response = await fetchImpl(`${OSV_API_BASE}/querybatch`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                        queries: packages.map((p) => ({
                              package: { name: p.name, ecosystem: p.ecosystem },
                              version: p.version,
                        })),
                  }),
            });
            if (!response.ok) {
                  return { vulnIdsByPackage: new Map(), checkedPackages: [], failedCount: packages.length };
            }
            const body = (await response.json()) as OsvBatchResponseBody;
            return { vulnIdsByPackage: zipVulnIdsByPackage(packages, body), checkedPackages: packages, failedCount: 0 };
      } catch {
            return { vulnIdsByPackage: new Map(), checkedPackages: [], failedCount: packages.length };
      }
};

export const queryOsvBatch = async <T extends OsvPackageQuery>(
      packages: T[],
      fetchImpl: FetchLike = fetch,
): Promise<OsvBatchResult<T>> => {
      const vulnIdsByPackage = new Map<string, string[]>();
      const checkedPackages: T[] = [];
      let failedCount = 0;

      try {
            for (const packageChunk of chunk(packages, OSV_BATCH_CHUNK_SIZE)) {
                  const result = await queryBatchChunk(packageChunk, fetchImpl);
                  result.vulnIdsByPackage.forEach((ids, key) => vulnIdsByPackage.set(key, ids));
                  checkedPackages.push(...result.checkedPackages);
                  failedCount += result.failedCount;
            }
      } catch {
            failedCount += packages.length - checkedPackages.length;
      }

      return {
            vulnIdsByPackage,
            checkedPackages,
            warning:
                  failedCount > 0 ? `Não foi possível consultar o OSV.dev para ${failedCount} pacote(s).` : undefined,
      };
};

const fetchOneVulnerabilityDetail = async (
      id: string,
      fetchImpl: FetchLike,
      detailsById: Map<string, OsvVulnerability>,
): Promise<boolean> => {
      try {
            const response = await fetchImpl(`${OSV_API_BASE}/vulns/${id}`);
            if (!response.ok) {
                  return false;
            }
            detailsById.set(id, (await response.json()) as OsvVulnerability);
            return true;
      } catch {
            return false;
      }
};

export const fetchOsvVulnerabilityDetails = async (
      ids: string[],
      fetchImpl: FetchLike = fetch,
): Promise<OsvDetailsResult> => {
      const uniqueIds = [...new Set(ids)];
      const detailsById = new Map<string, OsvVulnerability>();

      let results: boolean[];
      try {
            results = await runWithConcurrencyLimit(uniqueIds, OSV_DETAIL_CONCURRENCY, (id) =>
                  fetchOneVulnerabilityDetail(id, fetchImpl, detailsById),
            );
      } catch (error) {
            throw error;
      }

      const failedCount = results.filter((ok) => !ok).length;
      return {
            detailsById,
            warning:
                  failedCount > 0
                        ? `Não foi possível obter detalhes do OSV.dev para ${failedCount} advisory(s).`
                        : undefined,
      };
};

const isMatchingPackage = (affected: OsvAffected, packageName: string, ecosystem: string): boolean =>
      affected.package.ecosystem === ecosystem && affected.package.name === packageName;

export const extractFixedVersions = (vuln: OsvVulnerability, packageName: string, ecosystem: string): string[] => {
      const fixedVersions = (vuln.affected ?? [])
            .filter((affected) => isMatchingPackage(affected, packageName, ecosystem))
            .flatMap((affected) => affected.ranges ?? [])
            .flatMap((range) => range.events)
            .map((event) => event.fixed)
            .filter((fixed): fixed is string => Boolean(fixed));
      return [...new Set(fixedVersions)];
};

export const mapOsvSeverity = (vuln: OsvVulnerability): Severity => {
      const severity = vuln.database_specific?.severity;
      if (!severity) {
            return 'medium';
      }
      // codesentry-disable-next-line security/detect-object-injection -- severity is a lookup key into a small fixed literal Record with no dangerous keys (LOW/MODERATE/HIGH/CRITICAL); unknown values just fall through to the default below.
      return SEVERITY_MAP[severity] ?? 'medium';
};
