import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { scanAndReport } from '../../src/commands/scan/scan-runner.js';
import { runDependencyAudit } from '../../src/scanner/dependency-audit.js';
import type { Rule, RuleFinding } from '../../src/rules/rule.interface.js';

vi.mock('../../src/scanner/dependency-audit.js', () => ({ runDependencyAudit: vi.fn() }));

const manyFindingsRule = (count: number): Rule => ({
      id: 'fake-rule',
      description: 'Reports a fixed number of findings, for testing purposes',
      check: (filePath: string): RuleFinding[] =>
            Array.from({ length: count }, (_, i) => ({
                  ruleId: 'fake-rule',
                  message: `finding ${i}`,
                  file: filePath,
                  line: i + 1,
                  severity: 'medium',
            })),
});

let dir: string;

beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), 'codesentry-'));
      await writeFile(join(dir, 'a.ts'), 'const a = 1;');
      vi.mocked(runDependencyAudit).mockReset();
});

afterEach(async () => {
      await rm(dir, { recursive: true, force: true });
});

it('writes a markdown report file when findings exceed the threshold', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      await scanAndReport(dir, [manyFindingsRule(21)], 'test', {});

      const files = await readdir(dir);
      const reportFile = files.find((f) => /^codesentry-report-.*\.md$/.test(f));
      expect(reportFile).toBeDefined();
});

it('does not write a markdown report when findings are at or below the threshold', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      await scanAndReport(dir, [manyFindingsRule(20)], 'test', {});

      const files = await readdir(dir);
      expect(files.some((f) => /^codesentry-report-.*\.md$/.test(f))).toBe(false);
});

it('logs the path of the generated report', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await scanAndReport(dir, [manyFindingsRule(21)], 'test', {});

      expect(logSpy.mock.calls.flat().join('\n')).toContain('Relatório detalhado gerado em');
});

it('does not count test files as scanned by default', async () => {
      await writeFile(join(dir, 'a.spec.ts'), 'const a = 1;');
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const logSpy = vi.spyOn(console, 'log');
      await scanAndReport(dir, [], 'test', { json: true });

      const output = logSpy.mock.calls.flat().join('\n');
      expect(output).toContain('"scannedFiles": 1');
});

it('counts test files as scanned when tests option is true', async () => {
      await writeFile(join(dir, 'a.spec.ts'), 'const a = 1;');
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await scanAndReport(dir, [], 'test', { json: true, tests: true });

      const output = logSpy.mock.calls.flat().join('\n');
      expect(output).toContain('"scannedFiles": 2');
});

it('surfaces the root cause of a scan failure instead of only a generic wrapper message', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await scanAndReport('/this/path/does/not/exist/at/all', [], 'test', {});

      const loggedError = errorSpy.mock.calls.flat().join('\n');
      expect(loggedError).toContain('ENOENT');
});

it('does not run the dependency audit when deps is not requested', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await scanAndReport(dir, [], 'test', { json: true });

      expect(runDependencyAudit).not.toHaveBeenCalled();
      const output = logSpy.mock.calls.flat().join('\n');
      expect(output).toContain('"dependencyAudit": false');
});

it('runs the dependency audit and merges its findings when deps is requested', async () => {
      vi.mocked(runDependencyAudit).mockResolvedValue({
            scannedFiles: 1,
            findings: [
                  {
                        ruleId: 'dependency-audit',
                        message: 'vulnerável',
                        file: 'package.json',
                        line: 1,
                        severity: 'high',
                  },
            ],
            durationMs: 5,
            engines: { dependencyAudit: 3 },
      });
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await scanAndReport(dir, [], 'test', { json: true, deps: true });

      expect(runDependencyAudit).toHaveBeenCalledWith(dir, { nvdEnabled: true });
      const output = logSpy.mock.calls.flat().join('\n');
      expect(output).toContain('vulnerável');
      expect(output).toContain('"dependencyAudit": 3');
});

it('passes the disabled NVD option to the dependency audit', async () => {
      vi.mocked(runDependencyAudit).mockResolvedValue({
            scannedFiles: 1,
            findings: [],
            durationMs: 5,
            engines: { dependencyAudit: 3, nvd: false },
      });
      vi.spyOn(console, 'log').mockImplementation(() => {});

      await scanAndReport(dir, [], 'test', { json: true, deps: true, nvd: false });

      expect(runDependencyAudit).toHaveBeenCalledWith(dir, { nvdEnabled: false });
});

it('turns a dependency audit failure into a warning instead of failing the whole scan', async () => {
      vi.mocked(runDependencyAudit).mockRejectedValue(new Error('npm ausente'));
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await scanAndReport(dir, [], 'test', { json: true, deps: true });

      expect(errorSpy).not.toHaveBeenCalled();
      const output = logSpy.mock.calls.flat().join('\n');
      expect(output).toContain('Auditoria de dependências falhou: npm ausente.');
});
