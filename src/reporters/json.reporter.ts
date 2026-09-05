import type { ScanResult } from '../scanner/scan-result.js';

export function toJsonReport(result: ScanResult): string {
  return JSON.stringify(result, null, 2);
}
