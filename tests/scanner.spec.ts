import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import type { Rule, RuleFinding } from '../src/rules/rule.interface.js';
import { runScan } from '../src/scanner/scanner.js';

const fakeRule: Rule = {
  id: 'fake-rule',
  description: 'Always reports one finding per file, for testing purposes',
  check(filePath: string): RuleFinding[] {
    return [
      {
        ruleId: 'fake-rule',
        message: 'fake finding',
        file: filePath,
        line: 1,
        severity: 'low',
      },
    ];
  },
};

const throwOnBrokenContentRule: Rule = {
  id: 'throw-on-broken',
  description: 'Throws for files containing BROKEN, simulating a parser failure on one file',
  check(_filePath: string, content: string): RuleFinding[] {
    if (content.includes('BROKEN')) {
      throw new SyntaxError('Unexpected token');
    }
    return [];
  },
};

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'codesentry-'));
  await writeFile(join(dir, 'a.ts'), 'const a = 1;');
  await writeFile(join(dir, 'b.ts'), 'const b = 2;');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

it('applies every rule to every scanned file', async () => {
  const result = await runScan(dir, [fakeRule]);

  expect(result.scannedFiles).toBe(2);
  expect(result.findings).toHaveLength(2);
});

it('returns no findings when there are no rules', async () => {
  const result = await runScan(dir, []);

  expect(result.scannedFiles).toBe(2);
  expect(result.findings).toHaveLength(0);
});

it('produces the same result with a custom (serialized) concurrency', async () => {
  const result = await runScan(dir, [fakeRule], 1);

  expect(result.scannedFiles).toBe(2);
  expect(result.findings).toHaveLength(2);
});

it('uses a sensible default concurrency when none is provided', async () => {
  const result = await runScan(dir, [fakeRule]);

  expect(result.scannedFiles).toBe(2);
  expect(result.findings).toHaveLength(2);
});

it('reports a finding instead of aborting the whole scan when a rule throws for one file', async () => {
  await writeFile(join(dir, 'broken.ts'), 'BROKEN');

  const result = await runScan(dir, [fakeRule, throwOnBrokenContentRule]);

  expect(result.scannedFiles).toBe(3);
  expect(result.findings.filter((f) => f.ruleId === 'fake-rule')).toHaveLength(3);

  const parseErrors = result.findings.filter((f) => f.ruleId === 'parse-error');
  expect(parseErrors).toHaveLength(1);
  expect(parseErrors[0].file).toBe(join(dir, 'broken.ts'));
  expect(parseErrors[0].severity).toBe('low');
});
