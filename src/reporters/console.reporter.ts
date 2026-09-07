import chalk from 'chalk';
import Table from 'cli-table3';
import type { Severity } from '../rules/rule.interface.js';
import { DEPENDENCY_AUDIT_NOTE, type ScanResult } from '../scanner/scan-result.js';

const SEVERITY_COLOR: Record<Severity, (text: string) => string> = {
      low: (text) => chalk.gray(text),
      medium: (text) => chalk.yellow(text),
      high: (text) => chalk.red(text),
      critical: (text) => chalk.bgRed.white(text),
};

const coverageText = (result: ScanResult): string =>
      result.engines?.semgrep === undefined
            ? ''
            : ` CodeSentry: ${result.engines.codesentry ?? result.scannedFiles} JS/TS; Semgrep: ${result.engines.semgrep} arquivo(s).`;

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

const findingsTable = (result: ScanResult) => {
      const table = new Table({ head: ['Severity', 'Rule', 'File', 'Line', 'Message'] });
      for (const finding of result.findings) {
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

const printFindingsReport = (result: ScanResult, coverage: string): void => {
      console.log(findingsTable(result).toString());
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
