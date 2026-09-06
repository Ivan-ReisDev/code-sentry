import type { RuleFinding, Severity } from '../rules/rule.interface.js';
import type { ScanResult } from '../scanner/scan-result.js';

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low'];
const SEVERITY_LABEL: Record<Severity, string> = {
      critical: 'Critical',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
};

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
      const lines = [`## ${SEVERITY_LABEL[severity]} (${findings.length})`, ''];
      const byRule = groupBy(findings, (f) => f.ruleId);

      for (const ruleId of [...byRule.keys()].sort()) {
            const ruleFindings = byRule.get(ruleId) ?? [];
            lines.push(`### ${ruleId} (${ruleFindings.length})`, '', ...findingsTable(ruleFindings), '');
      }

      return lines;
};

const reportHeader = (result: ScanResult, generatedAt: Date): string[] => [
      '# Relatório CodeSentry',
      '',
      `- **Gerado em:** ${generatedAt.toISOString()}`,
      `- **Arquivos analisados:** ${result.scannedFiles}`,
      ...(result.engines?.semgrep === undefined
            ? []
            : [
                    `- **Cobertura por motor:** CodeSentry ${result.engines.codesentry ?? result.scannedFiles} JS/TS; Semgrep ${result.engines.semgrep} arquivos`,
              ]),
      `- **Duração:** ${result.durationMs}ms`,
      `- **Total de problemas:** ${result.findings.length}`,
      '',
];

const summaryTable = (bySeverity: Map<string, RuleFinding[]>): string[] => {
      const lines = ['## Resumo por severidade', '', '| Severidade | Quantidade |', '| --- | --- |'];
      for (const severity of SEVERITY_ORDER) {
            lines.push(`| ${SEVERITY_LABEL[severity]} | ${(bySeverity.get(severity) ?? []).length} |`);
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

export const toMarkdownReport = (result: ScanResult, generatedAt: Date = new Date()): string => {
      const bySeverity = groupBy(result.findings, (f) => f.severity);
      return [...reportHeader(result, generatedAt), ...summaryTable(bySeverity), ...severitySections(bySeverity)].join(
            '\n',
      );
};
