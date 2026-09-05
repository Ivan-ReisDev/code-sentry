import type { RuleFinding } from '../rules/rule.interface.js';

export interface ScanResult {
  scannedFiles: number;
  findings: RuleFinding[];
  durationMs: number;
}
