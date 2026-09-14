import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { NvdLookupResult, RuleFinding, Severity } from '../rules/rule.interface.js';
import { createNvdClient, type NvdClient } from './nvd-client.js';
import { createNvdCache, type NvdCache } from './nvd-cache.js';
import {
      enrichOsvMatchesWithNvd,
      extractCveAliases,
      type EnrichedOsvAdvisoryMatch,
      type NvdCoverage,
      type OsvAdvisoryMatch,
} from './nvd-enrichment.js';
import {
      extractFixedVersions,
      fetchOsvVulnerabilityDetails,
      mapOsvSeverity,
      osvPackageKey,
      queryOsvBatch,
      type FetchLike,
      type OsvVulnerability,
} from './osv-client.js';
import { discoverLockedPackages, SUPPORTED_LOCKFILES, type LockfileDiscovery } from './lockfiles/lockfile-discovery.js';
import type { LockedPackage } from './lockfiles/locked-package.js';
import type { ScanResult } from './scan-result.js';

const execFileAsync = promisify(execFile);
type NpmAuditSeverity = 'info' | 'low' | 'moderate' | 'high' | 'critical';

interface NpmAuditAdvisory {
      source?: string | number;
      name?: string;
      dependency?: string;
      title?: string;
      url?: string;
      severity?: NpmAuditSeverity;
      cwe?: string[];
      range?: string;
}

interface NpmAuditVulnerability {
      name: string;
      severity: NpmAuditSeverity;
      range: string;
      fixAvailable: boolean | { name: string; version: string };
      via: Array<string | NpmAuditAdvisory>;
}

export interface NpmAuditReport {
      vulnerabilities: Record<string, NpmAuditVulnerability>;
}

export interface DependencyAuditOptions {
      fetchImpl?: FetchLike;
      nvdEnabled?: boolean;
      nvdClient?: NvdClient;
      nvdCache?: NvdCache;
      nvdApiKey?: string;
      npmAuditRunner?: (targetDir: string) => Promise<unknown>;
}

const SEVERITY_MAP: Record<NpmAuditSeverity, Severity> = {
      info: 'low',
      low: 'low',
      moderate: 'medium',
      high: 'high',
      critical: 'critical',
};
const NVD_SEVERITY_MAP: Record<string, Severity> = {
      LOW: 'low',
      MEDIUM: 'medium',
      HIGH: 'high',
      CRITICAL: 'critical',
};
const SEVERITY_WEIGHT: Record<Severity, number> = { low: 0, medium: 1, high: 2, critical: 3 };
const CANONICAL_ADVISORY_PATTERN = /(?:CVE-\d{4}-\d{4,}|GHSA-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4})/gi;

const npmFixSuggestion = (vulnerability: NpmAuditVulnerability): string => {
      const { fixAvailable } = vulnerability;
      if (fixAvailable === false) return 'sem correção disponível ainda';
      if (fixAvailable === true)
            return `atualize para uma versão fora do intervalo vulnerável (${vulnerability.range})`;
      return `atualize para ${fixAvailable.name}@${fixAvailable.version}`;
};

const canonicalIdsFrom = (...values: (string | number | undefined)[]): string[] => [
      ...new Set(
            values
                  .flatMap((value) => String(value ?? '').match(CANONICAL_ADVISORY_PATTERN) ?? [])
                  .map((id) => id.toUpperCase()),
      ),
];

const npmAdvisoryTitle = (advisory: NpmAuditAdvisory | string | undefined): string => {
      if (typeof advisory === 'object' && advisory.title) return advisory.title;
      if (typeof advisory === 'string') return `vulnerabilidade transitiva via ${advisory}`;
      return 'ver "npm audit" para detalhes';
};

const npmFixedVersions = (fixAvailable: NpmAuditVulnerability['fixAvailable']): string[] =>
      typeof fixAvailable === 'object' ? [fixAvailable.version] : [];

const npmFinding = (
      vulnerability: NpmAuditVulnerability,
      advisory: NpmAuditAdvisory | string | undefined,
      ids: string[],
): RuleFinding => {
      const title = npmAdvisoryTitle(advisory);
      return {
            ruleId: 'dependency-audit',
            message: `Dependência vulnerável: ${vulnerability.name} (${vulnerability.severity}) — ${title} — ${npmFixSuggestion(vulnerability)}`,
            file: 'package.json',
            line: 1,
            // codesentry-disable-next-line security/detect-object-injection -- vulnerability.severity is npm audit's own NpmAuditSeverity union, not attacker input; unknown values just look up as undefined.
            severity: SEVERITY_MAP[vulnerability.severity],
            dependency: {
                  package: {
                        name: vulnerability.name,
                        installedVersion: 'não informada pelo npm audit',
                        fixedVersions: npmFixedVersions(vulnerability.fixAvailable),
                  },
                  advisory: { source: 'npm', id: ids[0], aliases: ids.slice(1), summary: title },
            },
      };
};

const advisoryIds = (advisory: NpmAuditAdvisory | string | undefined): string[] =>
      typeof advisory === 'object'
            ? canonicalIdsFrom(advisory.source, advisory.url, advisory.title)
            : canonicalIdsFrom(advisory);

const advisoryIdentity = (advisory: NpmAuditAdvisory | string | undefined, ids: string[]): string => {
      if (ids.length) return `ids:${[...ids].sort().join(',')}`;
      if (typeof advisory === 'object')
            return `fields:${advisory.source ?? ''}|${advisory.url ?? ''}|${advisory.title ?? ''}`;
      return `via:${advisory ?? 'unknown'}`;
};

const npmAdvisoryEntries = (vulnerability: NpmAuditVulnerability): Array<NpmAuditAdvisory | string | undefined> => {
      const structured = vulnerability.via.filter(
            (advisory): advisory is NpmAuditAdvisory => typeof advisory === 'object',
      );
      const candidates: Array<NpmAuditAdvisory | string | undefined> = structured.length
            ? structured
            : [vulnerability.via.find((advisory): advisory is string => typeof advisory === 'string')];
      const seen = new Set<string>();
      return candidates.filter((advisory) => {
            const identity = advisoryIdentity(advisory, advisoryIds(advisory));
            if (seen.has(identity)) return false;
            seen.add(identity);
            return true;
      });
};

export const mapAuditReportToFindings = (
      report: NpmAuditReport,
      osvIdsByPackage: ReadonlyMap<string, ReadonlySet<string>> = new Map(),
): RuleFinding[] =>
      Object.values(report.vulnerabilities).flatMap((vulnerability) => {
            const osvIds = osvIdsByPackage.get(`npm:${vulnerability.name}`) ?? new Set<string>();
            return npmAdvisoryEntries(vulnerability).flatMap((advisory) => {
                  const ids = advisoryIds(advisory);
                  return ids.some((id) => osvIds.has(id)) ? [] : [npmFinding(vulnerability, advisory, ids)];
            });
      });

const osvFixSuggestion = (fixedVersions: string[]): string =>
      fixedVersions.length
            ? `atualize para ${fixedVersions.join(' ou ')}`
            : 'nenhuma versão corrigida publicada pelo OSV.dev ainda';

const normalizeOsvAliases = (aliases: string[] | undefined): string[] => {
      const normalized = new Map<string, string>();
      for (const alias of aliases ?? []) {
            const trimmed = alias.trim();
            if (!trimmed) continue;
            const value = extractCveAliases([trimmed])[0] ?? trimmed;
            const key = value.toUpperCase();
            if (!normalized.has(key)) normalized.set(key, value);
      }
      return [...normalized.values()];
};

const highestNvdSeverity = (results: NvdLookupResult[]): Severity | undefined =>
      results
            .filter((result): result is Extract<NvdLookupResult, { status: 'found' }> => result.status === 'found')
            .map((result) => result.data.cvss?.severity)
            .filter((severity): severity is NonNullable<typeof severity> => severity !== undefined)
            // codesentry-disable-next-line security/detect-object-injection -- severity is NVD's own NvdSeverity enum, already validated by pickEnum() in nvd-normalizer.ts.
            .map((severity) => NVD_SEVERITY_MAP[severity])
            .filter((severity): severity is Severity => severity !== undefined)
            // codesentry-disable-next-line security/detect-object-injection -- a/b are Severity values already narrowed by the filter above, not attacker input.
            .sort((a, b) => SEVERITY_WEIGHT[b] - SEVERITY_WEIGHT[a])[0];

const buildOsvFinding = (match: EnrichedOsvAdvisoryMatch): RuleFinding => ({
      ruleId: 'dependency-audit',
      message: `OSV ${match.vuln.id}: ${match.pkg.name}@${match.pkg.version} — ${match.vuln.summary ?? 'ver OSV.dev para detalhes'} — ${osvFixSuggestion(match.fixedVersions)}`,
      file: match.pkg.lockfile,
      line: 1,
      severity: highestNvdSeverity(match.nvd) ?? mapOsvSeverity(match.vuln),
      dependency: {
            package: {
                  name: match.pkg.name,
                  installedVersion: match.pkg.version,
                  fixedVersions: match.fixedVersions,
                  ecosystem: match.pkg.ecosystem,
            },
            advisory: {
                  source: 'osv',
                  id: match.vuln.id,
                  aliases: normalizeOsvAliases(match.vuln.aliases),
                  summary: match.vuln.summary,
            },
            nvd: match.nvd,
      },
});

const unenrichedMatch = (match: OsvAdvisoryMatch): EnrichedOsvAdvisoryMatch => ({
      ...match,
      cveIds: extractCveAliases(match.vuln.aliases),
      nvd: [],
});

const collectMatches = (
      lockedPackages: LockedPackage[],
      vulnIdsByPackage: Map<string, string[]>,
      detailsById: Map<string, OsvVulnerability>,
): OsvAdvisoryMatch[] =>
      lockedPackages.flatMap((pkg) =>
            [...new Set(vulnIdsByPackage.get(osvPackageKey(pkg)) ?? [])]
                  .map((id) => detailsById.get(id))
                  .filter((vuln): vuln is OsvVulnerability => vuln !== undefined)
                  .map((vuln) => ({ pkg, vuln, fixedVersions: extractFixedVersions(vuln, pkg.name, pkg.ecosystem) })),
      );

export const mapOsvFindingsToRuleFindings = (
      lockedPackages: LockedPackage[],
      vulnIdsByPackage: Map<string, string[]>,
      detailsById: Map<string, OsvVulnerability>,
      _legacyNpmFlaggedNames?: Set<string>,
): RuleFinding[] =>
      collectMatches(lockedPackages, vulnIdsByPackage, detailsById).map((match) =>
            buildOsvFinding(unenrichedMatch(match)),
      );

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : 'erro desconhecido');

const hasVulnerabilitiesRecord = (
      value: unknown,
): value is { vulnerabilities: Record<string, NpmAuditVulnerability> } =>
      typeof value === 'object' &&
      value !== null &&
      typeof (value as { vulnerabilities?: unknown }).vulnerabilities === 'object' &&
      (value as { vulnerabilities?: unknown }).vulnerabilities !== null;

export const normalizeNpmAuditReport = (raw: unknown): { report: NpmAuditReport; warning?: string } => {
      if (hasVulnerabilitiesRecord(raw)) return { report: { vulnerabilities: raw.vulnerabilities } };
      const errorSummary =
            typeof raw === 'object' && raw !== null && 'error' in raw
                  ? ((raw as { error?: { summary?: string } }).error?.summary ?? 'formato de resposta inesperado')
                  : 'formato de resposta inesperado';
      return {
            report: { vulnerabilities: {} },
            warning: `"npm audit" não retornou um relatório válido: ${errorSummary}.`,
      };
};

interface OsvCollection {
      matches: OsvAdvisoryMatch[];
      checkedPackages: LockedPackage[];
      warnings: string[];
}

const collectOsvMatches = async (lockedPackages: LockedPackage[], fetchImpl: FetchLike): Promise<OsvCollection> => {
      try {
            const {
                  vulnIdsByPackage,
                  checkedPackages,
                  warning: batchWarning,
            } = await queryOsvBatch(lockedPackages, fetchImpl);
            const ids = [...new Set([...vulnIdsByPackage.values()].flat())];
            const detailResult = ids.length
                  ? await fetchOsvVulnerabilityDetails(ids, fetchImpl)
                  : { detailsById: new Map<string, OsvVulnerability>(), warning: undefined };
            return {
                  matches: collectMatches(lockedPackages, vulnIdsByPackage, detailResult.detailsById),
                  checkedPackages,
                  warnings: [batchWarning, detailResult.warning].filter((warning): warning is string =>
                        Boolean(warning),
                  ),
            };
      } catch (error) {
            return {
                  matches: [],
                  checkedPackages: [],
                  warnings: [`Não foi possível consultar o OSV.dev: ${errorMessage(error)}.`],
            };
      }
};

export const auditPackagesWithOsv = async (
      lockedPackages: LockedPackage[],
      _legacyNpmFlaggedNames: Set<string>,
      fetchImpl: FetchLike = fetch,
): Promise<{ findings: RuleFinding[]; checkedPackages: LockedPackage[]; warning?: string }> => {
      try {
            const collected = await collectOsvMatches(lockedPackages, fetchImpl);
            return {
                  findings: collected.matches.map((match) => buildOsvFinding(unenrichedMatch(match))),
                  checkedPackages: collected.checkedPackages,
                  warning: collected.warnings.length ? collected.warnings.join(' ') : undefined,
            };
      } catch {
            return { findings: [], checkedPackages: [], warning: 'Não foi possível consultar o OSV.dev.' };
      }
};

const runNpmAudit = async (targetDir: string): Promise<unknown> => {
      let stdout: string;
      try {
            ({ stdout } = await execFileAsync('npm', ['audit', '--json'], {
                  cwd: targetDir,
                  maxBuffer: 10 * 1024 * 1024,
            }));
      } catch (error) {
            const stdoutFromError = (error as { stdout?: string }).stdout;
            if (!stdoutFromError)
                  throw new Error(`Não foi possível executar "npm audit" em "${targetDir}".`, { cause: error });
            stdout = stdoutFromError;
      }
      return JSON.parse(stdout) as unknown;
};

const NPM_AUDIT_LOCKFILES = ['package-lock.json', 'npm-shrinkwrap.json'];

const fileExists = async (targetDir: string, filename: string): Promise<boolean> => {
      try {
            // codesentry-disable-next-line security/detect-non-literal-fs-filename -- filename comes from the fixed NPM_AUDIT_LOCKFILES list, never attacker input.
            await access(join(targetDir, filename));
            return true;
      } catch {
            return false;
      }
};

const hasNpmAuditLockfile = async (targetDir: string): Promise<boolean> => {
      try {
            const checks = await Promise.all(NPM_AUDIT_LOCKFILES.map((filename) => fileExists(targetDir, filename)));
            return checks.some(Boolean);
      } catch {
            return false;
      }
};

const skippedNpmAuditResult = (targetDir: string): { report: NpmAuditReport; warning: string; ran: false } => ({
      report: { vulnerabilities: {} },
      warning: `"npm audit" foi ignorado: "${targetDir}" não tem package-lock.json/npm-shrinkwrap.json (npm audit exige o lockfile do npm). A auditoria seguiu apenas com o OSV.dev.`,
      ran: false,
});

const runNpmAuditIfLockfilePresent = async (
      targetDir: string,
      npmAuditRunner: (targetDir: string) => Promise<unknown>,
): Promise<{ report: NpmAuditReport; warning?: string; ran: boolean }> => {
      try {
            if (!(await hasNpmAuditLockfile(targetDir))) return skippedNpmAuditResult(targetDir);
            const { report, warning } = normalizeNpmAuditReport(await npmAuditRunner(targetDir));
            return { report, warning, ran: true };
      } catch (error) {
            return {
                  report: { vulnerabilities: {} },
                  warning: `Não foi possível executar "npm audit": ${errorMessage(error)}.`,
                  ran: false,
            };
      }
};

const osvIdentityIndex = (matches: OsvAdvisoryMatch[]): Map<string, ReadonlySet<string>> => {
      const index = new Map<string, Set<string>>();
      matches.forEach((match) => {
            const key = `${match.pkg.ecosystem}:${match.pkg.name}`;
            const ids = index.get(key) ?? new Set<string>();
            [match.vuln.id, ...(match.vuln.aliases ?? [])].forEach((id) => ids.add(id.trim().toUpperCase()));
            index.set(key, ids);
      });
      return index;
};

interface LockfileAuditResult {
      findings: RuleFinding[];
      matches: OsvAdvisoryMatch[];
      packagesAudited: number | false;
      osvChecked?: { checked: number; total: number };
      osvCheckedPackages?: string[];
      nvd?: false | NvdCoverage;
      warnings: string[];
}

type ResolvedAuditOptions = DependencyAuditOptions & { fetchImpl: FetchLike; nvdEnabled: boolean };

interface NvdEnrichmentOutcome {
      matches: EnrichedOsvAdvisoryMatch[];
      nvd: false | NvdCoverage;
      warnings: string[];
}

const emptyNvdCoverage = (total: number, failed: number): NvdCoverage => ({
      total,
      enriched: 0,
      notFound: 0,
      failed,
      cacheHits: 0,
});

const resolveNvdClient = (options: ResolvedAuditOptions): NvdClient =>
      options.nvdClient ??
      createNvdClient({
            fetchImpl: options.fetchImpl,
            apiKey: options.nvdApiKey ?? process.env.NVD_API_KEY,
            cache: options.nvdCache ?? createNvdCache(),
      });

const enrichWithNvdIfEnabled = async (
      collected: OsvCollection,
      options: ResolvedAuditOptions,
): Promise<NvdEnrichmentOutcome> => {
      if (!options.nvdEnabled) {
            return { matches: collected.matches.map(unenrichedMatch), nvd: false, warnings: [] };
      }
      const uniqueCveIds = new Set(collected.matches.flatMap((match) => extractCveAliases(match.vuln.aliases)));
      if (uniqueCveIds.size === 0) {
            return { matches: collected.matches.map(unenrichedMatch), nvd: emptyNvdCoverage(0, 0), warnings: [] };
      }
      try {
            const enrichment = await enrichOsvMatchesWithNvd(collected.matches, resolveNvdClient(options));
            return { matches: enrichment.matches, nvd: enrichment.coverage, warnings: enrichment.warnings };
      } catch {
            const total = uniqueCveIds.size;
            return {
                  matches: collected.matches.map(unenrichedMatch),
                  nvd: emptyNvdCoverage(total, total),
                  warnings: [
                        `Não foi possível consultar o NVD para ${total} CVE(s); os findings OSV foram preservados.`,
                  ],
            };
      }
};

const checkedPackageLabel = (pkg: LockedPackage): string =>
      pkg.ecosystem === 'npm' ? `${pkg.name}@${pkg.version}` : `${pkg.name}@${pkg.version} (${pkg.ecosystem})`;

const successfulLockfileAudit = (
      lockedPackages: LockedPackage[],
      collected: OsvCollection,
      enrichment: NvdEnrichmentOutcome,
): LockfileAuditResult => ({
      findings: enrichment.matches.map(buildOsvFinding),
      matches: collected.matches,
      packagesAudited: lockedPackages.length,
      osvChecked: { checked: collected.checkedPackages.length, total: lockedPackages.length },
      osvCheckedPackages: collected.checkedPackages.map(checkedPackageLabel).sort(),
      nvd: enrichment.nvd,
      warnings: [...collected.warnings, ...enrichment.warnings],
});

const NO_LOCKFILES_WARNING = `Nenhum lockfile suportado foi encontrado (${SUPPORTED_LOCKFILES.map((source) => source.filename).join(', ')}).`;

const emptyLockfileAuditResult = (discovery: LockfileDiscovery): LockfileAuditResult => ({
      findings: [],
      matches: [],
      packagesAudited: false,
      warnings: [...discovery.warnings, NO_LOCKFILES_WARNING],
});

const failedLockfileAudit = (
      discovery: LockfileDiscovery,
      options: ResolvedAuditOptions,
      error: unknown,
): LockfileAuditResult => ({
      findings: [],
      matches: [],
      packagesAudited: false,
      nvd: options.nvdEnabled ? { total: 0, enriched: 0, notFound: 0, failed: 0, cacheHits: 0 } : false,
      warnings: [...discovery.warnings, `Não foi possível checar o OSV.dev: ${errorMessage(error)}.`],
});

const auditPackagesFromLockfile = async (
      targetDir: string,
      options: ResolvedAuditOptions,
): Promise<LockfileAuditResult> => {
      let discovery: LockfileDiscovery = { packages: [], lockfilesFound: [], warnings: [] };
      try {
            discovery = await discoverLockedPackages(targetDir);
            if (discovery.lockfilesFound.length === 0) return emptyLockfileAuditResult(discovery);
            const collected = await collectOsvMatches(discovery.packages, options.fetchImpl);
            const enrichment = await enrichWithNvdIfEnabled(collected, options);
            const result = successfulLockfileAudit(discovery.packages, collected, enrichment);
            return { ...result, warnings: [...discovery.warnings, ...result.warnings] };
      } catch (error) {
            return failedLockfileAudit(discovery, options, error);
      }
};

const normalizeOptions = (optionsOrFetch: DependencyAuditOptions | FetchLike | undefined): DependencyAuditOptions =>
      typeof optionsOrFetch === 'function' ? { fetchImpl: optionsOrFetch } : (optionsOrFetch ?? {});

const dependencyAuditCount = (
      npmReport: NpmAuditReport,
      npmAuditRan: boolean,
      osv: LockfileAuditResult,
): number | false => {
      if (osv.packagesAudited !== false) return osv.packagesAudited;
      return npmAuditRan ? Object.keys(npmReport.vulnerabilities).length : false;
};

const buildDependencyAuditResult = (
      startedAt: number,
      npmReport: NpmAuditReport,
      npmAuditRan: boolean,
      npmWarning: string | undefined,
      osv: LockfileAuditResult,
): ScanResult => {
      const npmFindings = mapAuditReportToFindings(npmReport, osvIdentityIndex(osv.matches));
      const warnings = [npmWarning, ...osv.warnings].filter((warning): warning is string => Boolean(warning));
      return {
            scannedFiles: 1,
            findings: [...npmFindings, ...osv.findings],
            durationMs: Date.now() - startedAt,
            engines: {
                  dependencyAudit: dependencyAuditCount(npmReport, npmAuditRan, osv),
                  osv: osv.osvChecked,
                  nvd: osv.nvd,
            },
            osvCheckedPackages: osv.osvCheckedPackages,
            warnings: warnings.length ? warnings : undefined,
      };
};

export const runDependencyAudit = async (
      targetDir: string,
      optionsOrFetch?: DependencyAuditOptions | FetchLike,
): Promise<ScanResult> => {
      const startedAt = Date.now();
      const supplied = normalizeOptions(optionsOrFetch);
      const options: ResolvedAuditOptions = {
            ...supplied,
            fetchImpl: supplied.fetchImpl ?? fetch,
            nvdEnabled: supplied.nvdEnabled ?? true,
      };
      try {
            const {
                  report: npmReport,
                  warning: npmWarning,
                  ran: npmAuditRan,
            } = await runNpmAuditIfLockfilePresent(targetDir, options.npmAuditRunner ?? runNpmAudit);
            const osv = await auditPackagesFromLockfile(targetDir, options);
            return buildDependencyAuditResult(startedAt, npmReport, npmAuditRan, npmWarning, osv);
      } catch (error) {
            throw new Error(`Não foi possível auditar dependências em "${targetDir}".`, { cause: error });
      }
};
