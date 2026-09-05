import { readFile } from 'node:fs/promises';
import type { Rule, RuleFinding } from '../rules/rule.interface.js';
import { findFiles } from './file-finder.js';
import type { ScanResult } from './scan-result.js';

export const runScan = async (targetDir: string, rules: Rule[]): Promise<ScanResult> => {
  const startedAt = Date.now();
  const files = await findFiles(targetDir);
  const findings: RuleFinding[] = [];

  for (const filePath of files) {
    const content = await readFile(filePath, 'utf-8');
    for (const rule of rules) {
      findings.push(...rule.check(filePath, content));
    }
  }

  return {
    scannedFiles: files.length,
    findings,
    durationMs: Date.now() - startedAt,
  };
};
