import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { scanAndReport } from '../../src/commands/scan/scan-runner.js';
import type { Rule, RuleFinding } from '../../src/rules/rule.interface.js';

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
