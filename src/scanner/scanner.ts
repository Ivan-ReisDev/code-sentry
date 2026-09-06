import { readFile } from 'node:fs/promises';
import type { Rule, RuleFinding } from '../rules/rule.interface.js';
import { findFiles } from './file-finder.js';
import { runWithConcurrencyLimit } from './run-with-concurrency-limit.js';
import type { ScanResult } from './scan-result.js';

export const DEFAULT_SCAN_CONCURRENCY = 10;

const scanFile = async (filePath: string, rules: Rule[]): Promise<RuleFinding[]> => {
  try {
    const content = await readFile(filePath, 'utf-8');
    return rules.flatMap((rule) => rule.check(filePath, content));
  } catch (error) {
    throw new Error(`Não foi possível analisar o arquivo "${filePath}".`, { cause: error });
  }
};

export const runScan = async (
  targetDir: string,
  rules: Rule[],
  concurrency: number = DEFAULT_SCAN_CONCURRENCY,
): Promise<ScanResult> => {
  try {
    const startedAt = Date.now();
    const files = await findFiles(targetDir);
    const findings = (
      await runWithConcurrencyLimit(files, concurrency, (filePath) => scanFile(filePath, rules))
    ).flat();

    return {
      scannedFiles: files.length,
      findings,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    throw new Error(`Não foi possível concluir a análise de "${targetDir}".`, { cause: error });
  }
};
