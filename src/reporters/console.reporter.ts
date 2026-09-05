import chalk from 'chalk';
import Table from 'cli-table3';
import type { Severity } from '../rules/rule.interface.js';
import type { ScanResult } from '../scanner/scan-result.js';

const SEVERITY_COLOR: Record<Severity, (text: string) => string> = {
  low: (text) => chalk.gray(text),
  medium: (text) => chalk.yellow(text),
  high: (text) => chalk.red(text),
  critical: (text) => chalk.bgRed.white(text),
};

export const printConsoleReport = (result: ScanResult): void => {
  if (result.findings.length === 0) {
    console.log(chalk.green(`Nenhum problema encontrado (${result.scannedFiles} arquivos analisados).`));
    return;
  }

  const table = new Table({
    head: ['Severity', 'Rule', 'File', 'Line', 'Message'],
  });

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

  console.log(table.toString());
  console.log(
    chalk.bold(
      `\n${result.findings.length} problema(s) encontrado(s) em ${result.scannedFiles} arquivo(s) (${result.durationMs}ms).`,
    ),
  );
};
