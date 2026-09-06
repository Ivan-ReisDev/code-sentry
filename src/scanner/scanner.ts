import { readFile } from 'node:fs/promises';
import type { Rule, RuleFinding } from '../rules/rule.interface.js';
import { findFiles } from './file-finder.js';
import type { ScanResult } from './scan-result.js';

const scanFile = async (filePath: string, rules: Rule[]): Promise<RuleFinding[]> => {
  try {
    const content = await readFile(filePath, 'utf-8');
    return rules.flatMap((rule) => rule.check(filePath, content));
  } catch (error) {
    throw new Error(`Não foi possível analisar o arquivo "${filePath}".`, { cause: error });
  }
};

export const runScan = async (targetDir: string, rules: Rule[]): Promise<ScanResult> => {
  try {
    const startedAt = Date.now();
    const files = await findFiles(targetDir);
    const findings = (await Promise.all(files.map((filePath) => scanFile(filePath, rules)))).flat();

    return {
      scannedFiles: files.length,
      findings,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    throw new Error(`Não foi possível concluir a análise de "${targetDir}".`, { cause: error });
  }
};
