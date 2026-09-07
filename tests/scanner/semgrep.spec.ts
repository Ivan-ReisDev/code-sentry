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

const EXPECTED_SEMGREP_ARGS = [
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
      '--exclude',
      'tests',
      '--exclude',
      'test',
      '--exclude',
      '__tests__',
      '--exclude',
      '*.spec.*',
      '--exclude',
      '*.test.*',
];

const assertDirectSemgrepInvocation = (executable: string, args: string[], cwd: string): void => {
      expect(executable).toBe('/runtime/bin/semgrep');
      expect(cwd).toBe('some/relative/dir');
      expect(args.at(-1)).toBe('.');
      expect(args).not.toContain('some/relative/dir');
      expect(args).toEqual(expect.arrayContaining(EXPECTED_SEMGREP_ARGS));
      expect(args).toContain('tests');
      expect(args).not.toContain('-m');
      expect(args.join(' ')).not.toContain('semgrep.dev');
};

it('invokes the bundled semgrep executable directly, not via the deprecated "python -m semgrep" form', async () => {
      const invocation = { executable: '', args: [] as string[], cwd: '' };
      const execute = (file: string, receivedArgs: string[], options: { cwd: string }) => {
            invocation.executable = file;
            invocation.args = receivedArgs;
            invocation.cwd = options.cwd;
            return Promise.resolve({ stdout: JSON.stringify({ results: [], paths: { scanned: [] } }) });
      };

      await runBundledSemgrep('some/relative/dir', { semgrep: '/runtime/bin/semgrep' }, '/local/owasp.yml', execute);

      assertDirectSemgrepInvocation(invocation.executable, invocation.args, invocation.cwd);
});

it('omits the test-file/test-directory excludes when includeTests is true, but keeps the always-ignored ones', async () => {
      const invocation = { args: [] as string[] };
      const execute = (_file: string, receivedArgs: string[]) => {
            invocation.args = receivedArgs;
            return Promise.resolve({ stdout: JSON.stringify({ results: [], paths: { scanned: [] } }) });
      };

      await runBundledSemgrep(
            'some/relative/dir',
            { semgrep: '/runtime/bin/semgrep' },
            '/local/owasp.yml',
            execute,
            true,
      );

      expect(invocation.args.at(-1)).toBe('.');
      expect(invocation.args).toEqual(
            expect.arrayContaining([
                  '--exclude',
                  'node_modules',
                  '--exclude',
                  '.git',
                  '--exclude',
                  'dist',
                  '--exclude',
                  '.next',
            ]),
      );
      expect(invocation.args).not.toContain('tests');
      expect(invocation.args).not.toContain('__tests__');
      expect(invocation.args).not.toContain('*.spec.*');
      expect(invocation.args).not.toContain('*.test.*');
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

it("also puts the runtime's parent directory on PATH, in case the interpreter lives one level up", async () => {
      let receivedEnv: NodeJS.ProcessEnv | undefined;
      const execute = (_file: string, _args: string[], options: { env?: NodeJS.ProcessEnv }) => {
            receivedEnv = options.env;
            return Promise.resolve({ stdout: JSON.stringify({ results: [], paths: { scanned: [] } }) });
      };

      // Windows layout: runtime/python/python.exe alongside runtime/python/Scripts/{semgrep,pysemgrep}.exe.
      // "#!python.exe" in the launcher only finds it if this parent directory is on PATH too — otherwise
      // it silently picks up some *other* python.exe from the rest of PATH, one without semgrep installed.
      await runBundledSemgrep('.', { semgrep: '/runtime/python/Scripts/semgrep' }, '/local/owasp.yml', execute);

      const segments = receivedEnv?.PATH?.split(delimiter) ?? [];
      expect(segments).toContain('/runtime/python/Scripts');
      expect(segments).toContain('/runtime/python');
});

it('falls back to standard system directories on PATH, in case the parent process stripped them', async () => {
      // Reproduces what "npx codesentry" does: it replaces PATH with only
      // node_modules/.bin entries, dropping /usr/bin and /bin. Semgrep shells
      // out to system tools like git internally, and silently reports zero
      // scanned files (no error) when it can't find them.
      const originalPath = process.env.PATH;
      process.env.PATH = '/home/user/project/node_modules/.bin';
      let receivedEnv: NodeJS.ProcessEnv | undefined;
      const execute = (_file: string, _args: string[], options: { env?: NodeJS.ProcessEnv }) => {
            receivedEnv = options.env;
            return Promise.resolve({ stdout: JSON.stringify({ results: [], paths: { scanned: [] } }) });
      };

      try {
            await runBundledSemgrep('.', { semgrep: '/runtime/bin/semgrep' }, '/local/owasp.yml', execute);
      } finally {
            process.env.PATH = originalPath;
      }

      const segments = receivedEnv?.PATH?.split(delimiter) ?? [];
      expect(segments).toContain('/usr/local/bin');
      expect(segments).toContain('/usr/bin');
      expect(segments).toContain('/bin');
});
