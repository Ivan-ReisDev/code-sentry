import type {
      NvdCisaInformation,
      NvdCvss,
      NvdLookupResult,
      NvdVulnerabilityData,
      RuleFinding,
      Severity,
} from '../rules/rule.interface.js';
import { DEPENDENCY_AUDIT_NOTE, type ScanResult } from '../scanner/scan-result.js';

const LOGO_URL = 'https://raw.githubusercontent.com/Ivan-ReisDev/code-sentry/main/docs/assets/logo.png';

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low'];
const SEVERITY_LABEL = new Map<Severity, string>([
      ['critical', 'Critical'],
      ['high', 'High'],
      ['medium', 'Medium'],
      ['low', 'Low'],
]);
const SEVERITY_EMOJI = new Map<Severity, string>([
      ['critical', '🔴'],
      ['high', '🟠'],
      ['medium', '🟡'],
      ['low', '🔵'],
]);

const severityLabel = (severity: Severity): string => SEVERITY_LABEL.get(severity) ?? severity;
const severityBadge = (severity: Severity): string =>
      `${SEVERITY_EMOJI.get(severity) ?? ''} ${severityLabel(severity)}`;

const escapeCell = (text: string): string => text.replaceAll('|', '\\|');

const groupBy = <T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> => {
      const map = new Map<string, T[]>();
      for (const item of items) {
            const key = keyOf(item);
            map.set(key, [...(map.get(key) ?? []), item]);
      }
      return map;
};

const findingsTable = (findings: RuleFinding[]): string[] => {
      const sorted = [...findings].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
      const lines = ['| Arquivo | Linha | Mensagem |', '| --- | --- | --- |'];
      for (const f of sorted) {
            lines.push(`| ${escapeCell(f.file)} | ${f.line} | ${escapeCell(f.message)} |`);
      }
      return lines;
};

const severitySection = (severity: Severity, findings: RuleFinding[]): string[] => {
      const lines = [`## ${severityBadge(severity)} (${findings.length})`, ''];
      const byRule = groupBy(findings, (f) => f.ruleId);

      for (const ruleId of [...byRule.keys()].sort()) {
            const ruleFindings = byRule.get(ruleId) ?? [];
            lines.push(`### ${ruleId} (${ruleFindings.length})`, '', ...findingsTable(ruleFindings), '');
      }

      return lines;
};

const semgrepCoverageLine = (result: ScanResult): string[] =>
      result.engines?.semgrep === undefined
            ? []
            : [
                    `- **Cobertura por motor:** CodeSentry ${result.engines.codesentry ?? result.scannedFiles} JS/TS; Semgrep ${result.engines.semgrep} arquivos`,
              ];

const dependencyAuditConsideredLine = (result: ScanResult): string[] =>
      typeof result.engines?.dependencyAudit === 'number'
            ? [`- **Dependências consideradas:** ${result.engines.dependencyAudit}`]
            : [];

const nvdCoverageLine = (result: ScanResult): string[] => {
      const nvd = result.engines?.nvd;
      if (!nvd || nvd.total === 0) return [];
      return [
            `- **Cobertura NVD:** ${nvd.enriched}/${nvd.total} enriquecidos; ${nvd.notFound} sem resultado; ${nvd.failed} falhas; ${nvd.cacheHits} cache hits`,
      ];
};

const dependencyAuditNoteLine = (result: ScanResult): string[] =>
      result.engines?.dependencyAudit === false ? [`- **Nota:** ${DEPENDENCY_AUDIT_NOTE}`] : [];

const reportHeader = (result: ScanResult, generatedAt: Date): string[] => [
      `<p align="center"><img src="${LOGO_URL}" alt="CodeSentry" width="320"></p>`,
      '',
      '# Relatório CodeSentry',
      '',
      `- **Gerado em:** ${generatedAt.toISOString()}`,
      `- **Arquivos analisados:** ${result.scannedFiles}`,
      ...semgrepCoverageLine(result),
      ...dependencyAuditConsideredLine(result),
      ...nvdCoverageLine(result),
      `- **Duração:** ${result.durationMs}ms`,
      `- **Total de problemas:** ${result.findings.length}`,
      ...dependencyAuditNoteLine(result),
      '',
];

const warningsSection = (result: ScanResult): string[] =>
      (result.warnings ?? []).length === 0
            ? []
            : ['## Avisos', '', ...(result.warnings ?? []).map((warning) => `- ${warning}`), ''];

const summaryTable = (bySeverity: Map<string, RuleFinding[]>): string[] => {
      const lines = ['## Resumo por severidade', '', '| Severidade | Quantidade |', '| --- | --- |'];
      for (const severity of SEVERITY_ORDER) {
            lines.push(`| ${severityBadge(severity)} | ${(bySeverity.get(severity) ?? []).length} |`);
      }
      lines.push('');
      return lines;
};

const severitySections = (bySeverity: Map<string, RuleFinding[]>): string[] => {
      const lines: string[] = [];
      for (const severity of SEVERITY_ORDER) {
            const findings = bySeverity.get(severity) ?? [];
            if (findings.length > 0) {
                  lines.push(...severitySection(severity, findings));
            }
      }
      return lines;
};

type LabeledValue = [string, string | undefined];

const labeledLines = (pairs: LabeledValue[], format: (label: string, value: string) => string): string[] =>
      pairs.filter((pair): pair is [string, string] => Boolean(pair[1])).map(([label, value]) => format(label, value));

const mdCvssMetricLines = (cvss: NvdCvss): string[] =>
      labeledLines(
            [
                  ['Attack Vector', cvss.attackVector],
                  ['Attack Complexity', cvss.attackComplexity],
                  ['Privileges Required', cvss.privilegesRequired],
                  ['User Interaction', cvss.userInteraction],
                  ['Scope', cvss.scope],
                  ['Confidentiality', cvss.confidentialityImpact],
                  ['Integrity', cvss.integrityImpact],
                  ['Availability', cvss.availabilityImpact],
            ],
            (key, value) => `${key}=${value}`,
      );

const mdCvssLines = (cvss: NvdCvss): string[] => {
      const lines = [
            `- **CVSS:** ${cvss.score} (${cvss.severity ?? 'sem severidade'}), versão ${cvss.version}`,
            `- **Vetor:** \`${cvss.vectorString}\``,
      ];
      const metrics = mdCvssMetricLines(cvss);
      return metrics.length ? [...lines, `- **Métricas:** ${metrics.join('; ')}`] : lines;
};

const mdCvssBlock = (data: NvdVulnerabilityData): string[] =>
      data.cvss ? mdCvssLines(data.cvss) : ['- **CVSS:** registro encontrado, ainda sem métrica CVSS'];

const mdMetadataLines = (data: NvdVulnerabilityData, summary?: string): string[] =>
      labeledLines(
            [
                  ['CWE', data.cwes.join(', ') || undefined],
                  ['Descrição NVD', data.description !== summary ? data.description : undefined],
                  ['Publicado', data.published],
                  ['Modificado', data.lastModified],
            ],
            (label, value) => `- **${label}:** ${value}`,
      );

const mdCisaKevLines = (kev: NonNullable<NvdCisaInformation['kev']>): string[] => [
      `- **CISA KEV:** ⚠️ incluído em ${kev.addedAt}`,
      ...labeledLines(
            [
                  ['Nome CISA', kev.vulnerabilityName],
                  ['Prazo CISA', kev.actionDue],
                  ['Ação requerida', kev.requiredAction],
            ],
            (label, value) => `- **${label}:** ${value}`,
      ),
];

const mdCisaSsvcLines = (ssvc: NonNullable<NvdCisaInformation['ssvc']>): string[] => {
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
            (label, value) => `- **${label}:** ${value}`,
      );
};

const mdCisaLines = (cisa: NvdCisaInformation | undefined): string[] => [
      ...(cisa?.kev ? mdCisaKevLines(cisa.kev) : []),
      ...(cisa?.ssvc ? mdCisaSsvcLines(cisa.ssvc) : []),
];

const mdReferencesBlock = (references: NvdVulnerabilityData['references']): string[] =>
      references.length
            ? [
                    '',
                    '**Referências:**',
                    '',
                    ...references.map((reference) => {
                          const metadata = [reference.source, ...reference.tags].filter(Boolean);
                          return `- ${reference.url}${metadata.length ? ` — ${metadata.join(', ')}` : ''}`;
                    }),
              ]
            : [];

const nvdHttpStatusSuffix = (httpStatus?: number): string => (httpStatus ? `, HTTP ${httpStatus}` : '');

const nvdMarkdown = (result: NvdLookupResult, advisorySummary?: string): string[] => {
      if (result.status === 'not-found') return [`- **${result.cveId}:** sem resultado no NVD`];
      if (result.status === 'error') {
            return [
                  `- **${result.cveId}:** falha ao consultar (${result.error.kind}${nvdHttpStatusSuffix(result.error.httpStatus)})`,
            ];
      }
      const { data } = result;
      return [
            `#### ${result.cveId}`,
            '',
            `- **Status NVD:** ${data.vulnerabilityStatus ?? 'não informado'}`,
            ...mdCvssBlock(data),
            ...mdMetadataLines(data, advisorySummary),
            ...mdCisaLines(data.cisa),
            ...mdReferencesBlock(data.references),
      ];
};

const mdSourcesLabel = (source: 'osv' | 'npm', foundNvd: boolean): string =>
      source === 'osv' ? `OSV${foundNvd ? ', NVD' : ''}` : 'npm';

const ecosystemSuffix = (ecosystem: string | undefined): string =>
      ecosystem && ecosystem !== 'npm' ? ` (${ecosystem})` : '';

const packageLabel = (dependency: NonNullable<RuleFinding['dependency']>): string =>
      `${dependency.package.name}@${dependency.package.installedVersion}${ecosystemSuffix(dependency.package.ecosystem)}`;

const mdSummaryLine = (summary: string | undefined): string[] =>
      summary ? [`- **Descrição OSV/npm:** ${summary}`] : [];

type DependencyDetails = NonNullable<RuleFinding['dependency']>;

const firstCvssScore = (nvd: NvdLookupResult[] | undefined): string => {
      const withCvss = (nvd ?? []).find(
            (result): result is Extract<NvdLookupResult, { status: 'found' }> =>
                  result.status === 'found' && Boolean(result.data.cvss),
      );
      return withCvss?.data.cvss ? `${withCvss.data.cvss.score}` : '—';
};

const dependencySummaryRow = (finding: RuleFinding, dependency: DependencyDetails): string =>
      `| ${packageLabel(dependency)} | ${severityBadge(finding.severity)} | ${dependency.advisory.id ?? '—'} | ${dependency.advisory.aliases.join(', ') || '—'} | ${firstCvssScore(dependency.nvd)} | ${dependency.package.fixedVersions.join(' ou ') || '—'} |`;

const dependencySummaryTable = (findings: RuleFinding[]): string[] => {
      const rows = findings
            .filter((finding): finding is RuleFinding & { dependency: DependencyDetails } =>
                  Boolean(finding.dependency),
            )
            .map((finding) => dependencySummaryRow(finding, finding.dependency));
      if (!rows.length) return [];
      return [
            '| Pacote | Severidade | Advisory | CVE(s) | CVSS | Corrigir para |',
            '| --- | --- | --- | --- | --- | --- |',
            ...rows,
            '',
      ];
};

const dependencySection = (finding: RuleFinding): string[] => {
      const dependency = finding.dependency;
      if (!dependency) return [];
      const foundNvd = (dependency.nvd ?? []).some((result) => result.status === 'found');
      return [
            '<details>',
            `<summary>${severityBadge(finding.severity)} <strong>${packageLabel(dependency)}</strong></summary>`,
            '',
            `- **Fonte principal:** ${dependency.advisory.source.toUpperCase()}`,
            `- **Advisory:** ${dependency.advisory.id ?? 'não informado'}`,
            `- **Aliases:** ${dependency.advisory.aliases.join(', ') || 'nenhum'}`,
            `- **Versões corrigidas:** ${dependency.package.fixedVersions.join(' ou ') || 'não informadas'}`,
            `- **Fontes:** ${mdSourcesLabel(dependency.advisory.source, foundNvd)}`,
            ...mdSummaryLine(dependency.advisory.summary),
            ...(dependency.nvd ?? []).flatMap((result) => ['', ...nvdMarkdown(result, dependency.advisory.summary)]),
            '',
            '</details>',
            '',
      ];
};

const dependencySections = (findings: RuleFinding[]): string[] => {
      const dependencies = findings.filter((finding) => finding.dependency);
      if (dependencies.length === 0) return [];
      return [
            '## Dependências vulneráveis',
            '',
            ...dependencySummaryTable(findings),
            ...dependencies.flatMap(dependencySection),
      ];
};

const osvCheckedSection = (result: ScanResult): string[] => {
      const { osvCheckedPackages } = result;
      if (!osvCheckedPackages || osvCheckedPackages.length === 0) {
            return [];
      }
      const checked = result.engines?.osv?.checked ?? osvCheckedPackages.length;
      const total = result.engines?.osv?.total ?? osvCheckedPackages.length;
      return [
            `## Dependências verificadas no OSV.dev (${checked}/${total})`,
            '',
            '<details>',
            '<summary>Ver lista completa</summary>',
            '',
            ...osvCheckedPackages.map((pkg) => `- ${pkg}`),
            '',
            '</details>',
            '',
      ];
};

export const toMarkdownReport = (result: ScanResult, generatedAt: Date = new Date()): string => {
      const codeFindings = result.findings.filter((finding) => !finding.dependency);
      const bySeverity = groupBy(result.findings, (f) => f.severity);
      const codeBySeverity = groupBy(codeFindings, (f) => f.severity);
      return [
            ...reportHeader(result, generatedAt),
            ...warningsSection(result),
            ...summaryTable(bySeverity),
            ...severitySections(codeBySeverity),
            ...dependencySections(result.findings),
            ...osvCheckedSection(result),
      ].join('\n');
};
