import type { ScanResult } from '../scanner/scan-result.js';

export const toJsonReport = (result: ScanResult): string => {
      return JSON.stringify(result, null, 2);
};
