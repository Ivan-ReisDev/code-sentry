import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

describe('runScan', () => {
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
});
