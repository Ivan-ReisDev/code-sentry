import chalk from 'chalk';
import Table from 'cli-table3';
import type {
      NvdCisaInformation,
      NvdCvss,
      NvdLookupResult,
      NvdVulnerabilityData,
      RuleFinding,
      Severity,
} from '../rules/rule.interface.js';
import { DEPENDENCY_AUDIT_NOTE, type ScanResult } from '../scanner/scan-result.js';

const SEVERITY_COLOR: Record<Severity, (text: string) => string> = {
      low: (text) => chalk.gray(text),
      medium: (text) => chalk.yellow(text),
      high: (text) => chalk.red(text),
      critical: (text) => chalk.bgRed.white(text),
};

const semgrepCoverage = (result: ScanResult): string | undefined =>
      result.engines?.semgrep === undefined
            ? undefined
            : `CodeSentry: ${result.engines.codesentry ?? result.scannedFiles} JS/TS; Semgrep: ${result.engines.semgrep} arquivo(s)`;

const dependencyAuditCoverage = (result: ScanResult): string | undefined =>
      typeof result.engines?.dependencyAudit === 'number'
            ? `Dependency audit: ${result.engines.dependencyAudit} pacote(s) considerado(s)`
            : undefined;

const osvCoverage = (result: ScanResult): string | undefined =>
      result.engines?.osv
            ? `OSV.dev: ${result.engines.osv.checked}/${result.engines.osv.total} verificados`
            : undefined;

const nvdCoverage = (result: ScanResult): string | undefined => {
      const nvd = result.engines?.nvd;
      if (!nvd || nvd.total === 0) return undefined;
      return `NVD: ${nvd.total} CVE(s); ${nvd.enriched} enriquecido(s); ${nvd.notFound} sem resultado; ${nvd.failed} falha(s); ${nvd.cacheHits} cache hit(s)`;
};

const coverageParts = (result: ScanResult): string[] =>
      [semgrepCoverage(result), dependencyAuditCoverage(result), osvCoverage(result), nvdCoverage(result)].filter(
            (part): part is string => part !== undefined,
      );

const coverageText = (result: ScanResult): string => {
      const parts = coverageParts(result);
      return parts.length ? ` ${parts.join('; ')}.` : '';
};

const printNotes = (result: ScanResult): void => {
      if (result.engines?.dependencyAudit === false) {
            console.log(chalk.cyan(DEPENDENCY_AUDIT_NOTE));
      }
      for (const warning of result.warnings ?? []) {
            console.log(chalk.yellow(`Aviso: ${warning}`));
      }
};

const printCleanReport = (result: ScanResult, coverage: string): void => {
      console.log(chalk.green(`Nenhum problema encontrado (${result.scannedFiles} arquivos analisados).${coverage}`));
      printNotes(result);
};

const findingsTable = (findings: RuleFinding[]) => {
      const table = new Table({ head: ['Severity', 'Rule', 'File', 'Line', 'Message'] });
      for (const finding of findings) {
            const colorize = SEVERITY_COLOR[finding.severity];
            table.push([
                  colorize(finding.severity),
                  finding.ruleId,
                  finding.file,
                  String(finding.line),
                  finding.message,
            ]);
      }
      return table;
};

const titleCaseMetric = (value: string): string =>
      value
            .toLowerCase()
            .split('_')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');

type LabeledValue = [string, string | undefined];

const labeledLines = (pairs: LabeledValue[], format: (label: string, value: string) => string): string[] =>
      pairs.filter((pair): pair is [string, string] => Boolean(pair[1])).map(([label, value]) => format(label, value));

const cvssMetricLines = (cvss: NvdCvss): string[] =>
      labeledLines(
            [
                  ['Vetor de ataque', cvss.attackVector],
                  ['Complexidade', cvss.attackComplexity],
                  ['Privilégios necessários', cvss.privilegesRequired],
                  ['Interação do usuário', cvss.userInteraction],
                  ['Escopo', cvss.scope],
                  ['Confidentiality', cvss.confidentialityImpact],
                  ['Integrity', cvss.integrityImpact],
                  ['Availability', cvss.availabilityImpact],
            ],
            (label, value) => `  ${label}: ${titleCaseMetric(value)}`,
      );

const cvssLines = (cvss: NvdCvss): string[] => [
      `  Severidade: ${cvss.severity ?? 'não informada'}`,
      `  CVSS: ${cvss.score}`,
      `  Versão CVSS: ${cvss.version}`,
      `  Vetor: ${cvss.vectorString}`,
      ...cvssMetricLines(cvss),
];

const cvssBlock = (data: NvdVulnerabilityData): string[] =>
      data.cvss ? cvssLines(data.cvss) : ['  CVSS: registro encontrado, ainda sem métrica CVSS'];

const metadataLines = (data: NvdVulnerabilityData, summary?: string): string[] =>
      labeledLines(
            [
                  ['CWE', data.cwes.join(', ') || undefined],
                  ['Descrição NVD', data.description !== summary ? data.description : undefined],
                  ['Publicado', data.published],
                  ['Modificado', data.lastModified],
            ],
            (label, value) => `  ${label}: ${value}`,
      );

const cisaKevLines = (kev: NonNullable<NvdCisaInformation['kev']>): string[] => [
      `  CISA KEV desde: ${kev.addedAt}`,
      ...labeledLines(
            [
                  ['Nome CISA', kev.vulnerabilityName],
                  ['Prazo CISA', kev.actionDue],
                  ['Ação CISA', kev.requiredAction],
            ],
            (label, value) => `  ${label}: ${value}`,
      ),
];

const cisaSsvcLines = (ssvc: NonNullable<NvdCisaInformation['ssvc']>): string[] => {
      const parts = labeledLines(
            [
                  ['exploração', ssvc.exploitation],
                  ['automatizável', ssvc.automatable],
                  ['impacto técnico', ssvc.technicalImpact],
            ],
            (label, value) => `${label}=${value}`,
      );
      return labeledLines(
            [
                  ['CISA SSVC', parts.length > 0 ? parts.join('; ') : undefined],
                  ['CISA SSVC atualizado', ssvc.timestamp],
            ],
            (label, value) => `  ${label}: ${value}`,
      );
};

const cisaLines = (cisa: NvdCisaInformation | undefined): string[] => [
      ...(cisa?.kev ? cisaKevLines(cisa.kev) : []),
      ...(cisa?.ssvc ? cisaSsvcLines(cisa.ssvc) : []),
];

const referencesLines = (references: NvdVulnerabilityData['references']): string[] => {
      const shown = references.slice(0, 5);
      const extraCount = references.length - shown.length;
      return labeledLines(
            [
                  ['Referências', shown.length > 0 ? shown.map((reference) => reference.url).join(', ') : undefined],
                  ['Referências adicionais', extraCount > 0 ? `${extraCount}` : undefined],
            ],
            (label, value) => `  ${label}: ${value}`,
      );
};

const foundNvdLines = (result: Extract<NvdLookupResult, { status: 'found' }>, summary?: string): string[] => {
      const { data } = result;
      return [
            `  CVE: ${result.cveId}`,
            `  Status NVD: ${data.vulnerabilityStatus ?? 'não informado'}`,
            ...cvssBlock(data),
            ...metadataLines(data, summary),
            ...cisaLines(data.cisa),
            ...referencesLines(data.references),
      ];
};

const httpStatusSuffix = (httpStatus?: number): string => (httpStatus ? ` HTTP ${httpStatus}` : '');

const nvdLines = (result: NvdLookupResult, summary?: string): string[] => {
      if (result.status === 'found') return foundNvdLines(result, summary);
      if (result.status === 'not-found') return [`  CVE: ${result.cveId}`, '  NVD: sem resultado'];
      return [
            `  CVE: ${result.cveId}`,
            `  NVD: falha ao consultar (${result.error.kind}${httpStatusSuffix(result.error.httpStatus)})`,
      ];
};

const aliasesLine = (aliases: string[]): string[] => (aliases.length > 0 ? [`Aliases: ${aliases.join(', ')}`] : []);

const summaryLine = (summary: string | undefined, label: string): string[] => (summary ? [`${label}: ${summary}`] : []);

const nvdResultLines = (results: NvdLookupResult[] | undefined, summary?: string): string[] =>
      (results ?? []).flatMap((result) => ['', ...nvdLines(result, summary)]);

const sourcesLabel = (source: 'osv' | 'npm', foundNvd: boolean): string =>
      source === 'osv' ? `OSV${foundNvd ? ', NVD' : ''}` : 'npm';

const dependencyBlock = (finding: RuleFinding): string => {
      const dependency = finding.dependency;
      if (!dependency) return '';
      const foundNvd = (dependency.nvd ?? []).some((result) => result.status === 'found');
      const lines = [
            `Pacote: ${dependency.package.name}`,
            `Versão instalada: ${dependency.package.installedVersion}`,
            `Versão corrigida: ${dependency.package.fixedVersions.join(' ou ') || 'não informada'}`,
            `${dependency.advisory.source.toUpperCase()}: ${dependency.advisory.id ?? 'identificador não informado'}`,
            ...aliasesLine(dependency.advisory.aliases),
            `Severidade do finding: ${finding.severity.toUpperCase()}`,
            ...summaryLine(dependency.advisory.summary, 'Descrição OSV/npm'),
            ...nvdResultLines(dependency.nvd, dependency.advisory.summary),
            `Fontes: ${sourcesLabel(dependency.advisory.source, foundNvd)}`,
      ];
      return lines.join('\n');
};

const printDependencyFindings = (findings: RuleFinding[]): void => {
      if (findings.length === 0) return;
      console.log(chalk.bold('\nDependências vulneráveis'));
      console.log(findings.map(dependencyBlock).join('\n\n'));
};

const printFindingsReport = (result: ScanResult, coverage: string): void => {
      const codeFindings = result.findings.filter((finding) => !finding.dependency);
      const dependencyFindings = result.findings.filter((finding) => finding.dependency);
      if (codeFindings.length) console.log(findingsTable(codeFindings).toString());
      printDependencyFindings(dependencyFindings);
      console.log(
            chalk.bold(
                  `\n${result.findings.length} problema(s) encontrado(s) em ${result.scannedFiles} arquivo(s) (${result.durationMs}ms).${coverage}`,
            ),
      );
      printNotes(result);
};

export const printConsoleReport = (result: ScanResult): void => {
      const coverage = coverageText(result);
      if (result.findings.length === 0) {
            printCleanReport(result, coverage);
            return;
      }
      printFindingsReport(result, coverage);
};
