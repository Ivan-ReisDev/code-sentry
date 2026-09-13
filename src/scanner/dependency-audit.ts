import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { RuleFinding, Severity } from '../rules/rule.interface.js';
import {
      extractFixedVersions,
      fetchOsvVulnerabilityDetails,
      mapOsvSeverity,
      queryOsvBatch,
      type FetchLike,
      type OsvVulnerability,
} from './osv-client.js';
import { parsePackageLock, type LockedPackage } from './package-lock-parser.js';
import type { ScanResult } from './scan-result.js';

const execFileAsync = promisify(execFile);

type NpmAuditSeverity = 'info' | 'low' | 'moderate' | 'high' | 'critical';

interface NpmAuditVulnerability {
      name: string;
      severity: NpmAuditSeverity;
      range: string;
      fixAvailable: boolean | { name: string; version: string };
      via: Array<string | { title?: string }>;
}

export interface NpmAuditReport {
      vulnerabilities: Record<string, NpmAuditVulnerability>;
}

const SEVERITY_MAP: Record<NpmAuditSeverity, Severity> = {
      info: 'low',
      low: 'low',
      moderate: 'medium',
      high: 'high',
      critical: 'critical',
};

const vulnerabilityTitle = (vulnerability: NpmAuditVulnerability): string => {
      const firstVia = vulnerability.via[0];
      if (typeof firstVia === 'object' && firstVia?.title) {
            return firstVia.title;
      }
      return 'ver "npm audit" para detalhes';
};

const npmFixSuggestion = (vulnerability: NpmAuditVulnerability): string => {
      const { fixAvailable } = vulnerability;
      if (fixAvailable === false) {
            return 'sem correção disponível ainda';
      }
      if (fixAvailable === true) {
            return `atualize para uma versão fora do intervalo vulnerável (${vulnerability.range})`;
      }
      return `atualize para ${fixAvailable.name}@${fixAvailable.version}`;
};

export const mapAuditReportToFindings = (report: NpmAuditReport): RuleFinding[] => {
      return Object.values(report.vulnerabilities).map((vulnerability) => ({
            ruleId: 'dependency-audit',
            message: `Dependência vulnerável: ${vulnerability.name} (${vulnerability.severity}) — ${vulnerabilityTitle(vulnerability)} — ${npmFixSuggestion(vulnerability)}`,
            file: 'package.json',
            line: 1,
            severity: SEVERITY_MAP[vulnerability.severity],
      }));
};

const osvFixSuggestion = (fixedVersions: string[]): string =>
      fixedVersions.length
            ? `atualize para ${fixedVersions.join(' ou ')}`
            : 'nenhuma versão corrigida publicada pelo OSV.dev ainda';

const buildOsvFinding = (pkg: LockedPackage, vuln: OsvVulnerability): RuleFinding => {
      const fixedVersions = extractFixedVersions(vuln, pkg.name);
      return {
            ruleId: 'dependency-audit',
            message: `OSV ${vuln.id}: ${pkg.name}@${pkg.version} (${mapOsvSeverity(vuln)}) — ${vuln.summary ?? 'ver OSV.dev para detalhes'} — ${osvFixSuggestion(fixedVersions)}`,
            file: 'package-lock.json',
            line: 1,
            severity: mapOsvSeverity(vuln),
      };
};

const findingsForLockedPackage = (
      pkg: LockedPackage,
      vulnIdsByPackage: Map<string, string[]>,
      detailsById: Map<string, OsvVulnerability>,
): RuleFinding[] => {
      const ids = vulnIdsByPackage.get(`${pkg.name}@${pkg.version}`) ?? [];
      return ids
            .map((id) => detailsById.get(id))
            .filter((vuln): vuln is OsvVulnerability => vuln !== undefined)
            .map((vuln) => buildOsvFinding(pkg, vuln));
};

export const mapOsvFindingsToRuleFindings = (
      lockedPackages: LockedPackage[],
      vulnIdsByPackage: Map<string, string[]>,
      detailsById: Map<string, OsvVulnerability>,
      npmFlaggedNames: Set<string>,
): RuleFinding[] =>
      lockedPackages
            .filter((pkg) => !npmFlaggedNames.has(pkg.name))
            .flatMap((pkg) => findingsForLockedPackage(pkg, vulnIdsByPackage, detailsById));

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : 'erro desconhecido');

const hasVulnerabilitiesRecord = (
      value: unknown,
): value is { vulnerabilities: Record<string, NpmAuditVulnerability> } =>
      typeof value === 'object' &&
      value !== null &&
      typeof (value as { vulnerabilities?: unknown }).vulnerabilities === 'object' &&
      (value as { vulnerabilities?: unknown }).vulnerabilities !== null;

export const normalizeNpmAuditReport = (raw: unknown): { report: NpmAuditReport; warning?: string } => {
      if (hasVulnerabilitiesRecord(raw)) {
            return { report: { vulnerabilities: raw.vulnerabilities } };
      }
      const errorSummary =
            typeof raw === 'object' && raw !== null && 'error' in raw
                  ? ((raw as { error?: { summary?: string } }).error?.summary ?? 'formato de resposta inesperado')
                  : 'formato de resposta inesperado';
      return {
            report: { vulnerabilities: {} },
            warning: `"npm audit" não retornou um relatório válido: ${errorSummary}.`,
      };
};

const combineWarnings = (...warnings: (string | undefined)[]): string | undefined => {
      const present = warnings.filter((warning): warning is string => Boolean(warning));
      return present.length ? present.join(' ') : undefined;
};

const fetchDetailsForIds = (
      ids: string[],
      fetchImpl: FetchLike,
): Promise<{ detailsById: Map<string, OsvVulnerability>; warning?: string }> =>
      ids.length
            ? fetchOsvVulnerabilityDetails(ids, fetchImpl)
            : Promise.resolve({ detailsById: new Map(), warning: undefined });

export const auditPackagesWithOsv = async (
      lockedPackages: LockedPackage[],
      npmFlaggedNames: Set<string>,
      fetchImpl: FetchLike = fetch,
): Promise<{ findings: RuleFinding[]; checkedPackages: LockedPackage[]; warning?: string }> => {
      try {
            return await collectOsvAuditResult(lockedPackages, npmFlaggedNames, fetchImpl);
      } catch (error) {
            return {
                  findings: [],
                  checkedPackages: [],
                  warning: `Não foi possível consultar o OSV.dev: ${errorMessage(error)}.`,
            };
      }
};

const collectOsvAuditResult = async (
      lockedPackages: LockedPackage[],
      npmFlaggedNames: Set<string>,
      fetchImpl: FetchLike,
): Promise<{ findings: RuleFinding[]; checkedPackages: LockedPackage[]; warning?: string }> => {
      try {
            const {
                  vulnIdsByPackage,
                  checkedPackages,
                  warning: batchWarning,
            } = await queryOsvBatch(lockedPackages, fetchImpl);
            const ids = [...new Set([...vulnIdsByPackage.values()].flat())];
            const { detailsById, warning: detailsWarning } = await fetchDetailsForIds(ids, fetchImpl);
            return {
                  findings: mapOsvFindingsToRuleFindings(
                        lockedPackages,
                        vulnIdsByPackage,
                        detailsById,
                        npmFlaggedNames,
                  ),
                  checkedPackages,
                  warning: combineWarnings(batchWarning, detailsWarning),
            };
      } catch (error) {
            throw new Error('Não foi possível consolidar os resultados do OSV.dev.', { cause: error });
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
            if (!stdoutFromError) {
                  throw new Error(`Não foi possível executar "npm audit" em "${targetDir}".`, { cause: error });
            }
            stdout = stdoutFromError;
      }
      return JSON.parse(stdout) as unknown;
};

interface LockfileAuditResult {
      findings: RuleFinding[];
      packagesAudited: number | false;
      osvChecked?: { checked: number; total: number };
      osvCheckedPackages?: string[];
      warning?: string;
}

const auditPackagesFromLockfile = async (
      targetDir: string,
      npmFlaggedNames: Set<string>,
      fetchImpl: FetchLike,
): Promise<LockfileAuditResult> => {
      try {
            // codesentry-disable-next-line security/detect-non-literal-fs-filename -- targetDir is the CLI's own path argument, same trust level as scanner/file-finder.ts.
            const raw = await readFile(join(targetDir, 'package-lock.json'), 'utf-8');
            const lockedPackages = parsePackageLock(raw);
            const osvResult = await auditPackagesWithOsv(lockedPackages, npmFlaggedNames, fetchImpl);
            return {
                  findings: osvResult.findings,
                  packagesAudited: lockedPackages.length,
                  osvChecked: { checked: osvResult.checkedPackages.length, total: lockedPackages.length },
                  osvCheckedPackages: osvResult.checkedPackages.map((pkg) => `${pkg.name}@${pkg.version}`).sort(),
                  warning: osvResult.warning,
            };
      } catch (error) {
            return {
                  findings: [],
                  packagesAudited: false,
                  warning: `Não foi possível checar o OSV.dev: ${errorMessage(error)}.`,
            };
      }
};

export const runDependencyAudit = async (targetDir: string, fetchImpl: FetchLike = fetch): Promise<ScanResult> => {
      const startedAt = Date.now();
      try {
            const { report: npmReport, warning: npmWarning } = normalizeNpmAuditReport(await runNpmAudit(targetDir));
            const npmFindings = mapAuditReportToFindings(npmReport);
            const npmFlaggedNames = new Set(Object.keys(npmReport.vulnerabilities));
            const osv = await auditPackagesFromLockfile(targetDir, npmFlaggedNames, fetchImpl);
            const warnings = combineWarnings(npmWarning, osv.warning);
            return {
                  scannedFiles: 1,
                  findings: [...npmFindings, ...osv.findings],
                  durationMs: Date.now() - startedAt,
                  engines: {
                        dependencyAudit: osv.packagesAudited === false ? npmFlaggedNames.size : osv.packagesAudited,
                        osv: osv.osvChecked,
                  },
                  osvCheckedPackages: osv.osvCheckedPackages,
                  warnings: warnings ? [warnings] : undefined,
            };
      } catch (error) {
            throw new Error(`Não foi possível auditar dependências em "${targetDir}".`, { cause: error });
      }
};
