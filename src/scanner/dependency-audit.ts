import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { RuleFinding, Severity } from '../rules/rule.interface.js';
import type { ScanResult } from './scan-result.js';

const execFileAsync = promisify(execFile);

type NpmAuditSeverity = 'info' | 'low' | 'moderate' | 'high' | 'critical';

interface NpmAuditVulnerability {
      name: string;
      severity: NpmAuditSeverity;
      range: string;
      fixAvailable: boolean | { name: string; version: string };
      via: Array<string | { title?: string }>;
}

export interface NpmAuditReport {
      vulnerabilities: Record<string, NpmAuditVulnerability>;
}

const SEVERITY_MAP: Record<NpmAuditSeverity, Severity> = {
      info: 'low',
      low: 'low',
      moderate: 'medium',
      high: 'high',
      critical: 'critical',
};

const vulnerabilityTitle = (vulnerability: NpmAuditVulnerability): string => {
      const firstVia = vulnerability.via[0];
      if (typeof firstVia === 'object' && firstVia?.title) {
            return firstVia.title;
      }
      return 'ver "npm audit" para detalhes';
};

export const mapAuditReportToFindings = (report: NpmAuditReport): RuleFinding[] => {
      return Object.values(report.vulnerabilities).map((vulnerability) => ({
            ruleId: 'dependency-audit',
            message: `Dependência vulnerável: ${vulnerability.name} (${vulnerability.severity}) — ${vulnerabilityTitle(vulnerability)}`,
            file: 'package.json',
            line: 1,
            severity: SEVERITY_MAP[vulnerability.severity],
      }));
};

export const runDependencyAudit = async (targetDir: string): Promise<ScanResult> => {
      const startedAt = Date.now();
      let stdout: string;

      try {
            ({ stdout } = await execFileAsync('npm', ['audit', '--json'], {
                  cwd: targetDir,
                  maxBuffer: 10 * 1024 * 1024,
            }));
      } catch (error) {
            const stdoutFromError = (error as { stdout?: string }).stdout;
            if (!stdoutFromError) {
                  throw new Error(`Não foi possível executar "npm audit" em "${targetDir}".`, { cause: error });
            }
            stdout = stdoutFromError;
      }

      const report = JSON.parse(stdout) as NpmAuditReport;
      return {
            scannedFiles: 1,
            findings: mapAuditReportToFindings(report),
            durationMs: Date.now() - startedAt,
      };
};
