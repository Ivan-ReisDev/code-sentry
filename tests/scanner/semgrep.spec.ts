import { delimiter } from 'node:path';
import { expect, it } from 'vitest';
import {
      mapSemgrepReportToFindings,
      parseSemgrepReport,
      runBundledSemgrep,
      type SemgrepReport,
} from '../../src/scanner/semgrep.js';

it('maps a Semgrep finding to the CodeSentry report format', () => {
      const report: SemgrepReport = {
            results: [
                  {
                        check_id: 'javascript.lang.security.audit.xss.template-string',
                        path: 'src/render.ts',
                        start: { line: 12 },
                        extra: { message: 'Potential XSS', severity: 'ERROR' },
                  },
            ],
      };

      expect(mapSemgrepReportToFindings(report)).toEqual([
            {
                  ruleId: 'semgrep/javascript.lang.security.audit.xss.template-string',
                  message: 'Potential XSS',
                  file: 'src/render.ts',
                  line: 12,
                  severity: 'high',
            },
      ]);
});

it('maps Semgrep severities to the CodeSentry severity scale', () => {
      const report: SemgrepReport = {
            results: [
                  { check_id: 'info', path: 'a.ts', start: { line: 1 }, extra: { message: 'a', severity: 'INFO' } },
                  {
                        check_id: 'warning',
                        path: 'a.ts',
                        start: { line: 2 },
                        extra: { message: 'b', severity: 'WARNING' },
                  },
                  { check_id: 'error', path: 'a.ts', start: { line: 3 }, extra: { message: 'c', severity: 'ERROR' } },
            ],
      };

      expect(mapSemgrepReportToFindings(report).map((finding) => finding.severity)).toEqual(['low', 'medium', 'high']);
});

it('returns no findings when Semgrep reports no matches', () => {
      expect(mapSemgrepReportToFindings({ results: [] })).toEqual([]);
});

it('preserves the scanned paths reported by Semgrep', () => {
      const report: SemgrepReport = {
            results: [],
            paths: { scanned: ['src/app.ts', 'api/server.py'] },
      };

      expect(parseSemgrepReport(JSON.stringify(report))).toMatchObject({
            paths: { scanned: ['src/app.ts', 'api/server.py'] },
      });
});

it('rejects invalid Semgrep JSON instead of treating it as a clean scan', () => {
      expect(() => parseSemgrepReport('not-json')).toThrow('JSON inválido');
});

it('keeps findings when Semgrep exits non-zero with a valid JSON report', async () => {
      const report = JSON.stringify({
            results: [
                  {
                        check_id: 'owasp.rule',
                        path: 'app.py',
                        start: { line: 3 },
                        extra: { message: 'unsafe', severity: 'ERROR' },
                  },
            ],
            paths: { scanned: ['app.py'] },
      });
      const execute = () => Promise.reject({ stdout: report });

      await expect(
            runBundledSemgrep('.', { semgrep: '/runtime/bin/semgrep' }, '/rules/owasp.yml', execute),
      ).resolves.toMatchObject({
            scannedFiles: 1,
            findings: [{ ruleId: 'semgrep/owasp.rule', severity: 'high' }],
      });
});

it('invokes the bundled semgrep executable directly, not via the deprecated "python -m semgrep" form', async () => {
      let executable = '';
      let args: string[] = [];
      const execute = (file: string, receivedArgs: string[]) => {
            executable = file;
            args = receivedArgs;
            return Promise.resolve({ stdout: JSON.stringify({ results: [], paths: { scanned: [] } }) });
      };

      await runBundledSemgrep('.', { semgrep: '/runtime/bin/semgrep' }, '/local/owasp.yml', execute);

      expect(executable).toBe('/runtime/bin/semgrep');
      expect(args).toEqual(
            expect.arrayContaining([
                  'scan',
                  '--config',
                  '/local/owasp.yml',
                  '--metrics=off',
                  '--json',
                  '--quiet',
                  '--exclude',
                  'node_modules',
                  '--exclude',
                  '.git',
                  '--exclude',
                  'dist',
                  '--exclude',
                  '.next',
                  '.',
            ]),
      );
      expect(args).not.toContain('-m');
      expect(args.join(' ')).not.toContain('semgrep.dev');
});

it('puts the runtime\'s own directory first on PATH, since Semgrep execs a "pysemgrep" helper by bare name', async () => {
      let receivedEnv: NodeJS.ProcessEnv | undefined;
      const execute = (_file: string, _args: string[], options: { env?: NodeJS.ProcessEnv }) => {
            receivedEnv = options.env;
            return Promise.resolve({ stdout: JSON.stringify({ results: [], paths: { scanned: [] } }) });
      };

      await runBundledSemgrep('.', { semgrep: '/runtime/bin/semgrep' }, '/local/owasp.yml', execute);

      expect(receivedEnv?.PATH?.split(delimiter)[0]).toBe('/runtime/bin');
});
