import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { findFiles } from '../../src/scanner/file-finder.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'codesentry-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

it('finds .tsx and .jsx files alongside .ts and .js', async () => {
  await writeFile(join(dir, 'a.ts'), 'const a = 1;');
  await writeFile(join(dir, 'b.js'), 'const b = 1;');
  await writeFile(join(dir, 'Component.tsx'), 'export const x = 1;');
  await writeFile(join(dir, 'Component.jsx'), 'export const y = 1;');
  await writeFile(join(dir, 'README.md'), '# not code');

  const files = await findFiles(dir);

  expect(files).toHaveLength(4);
  expect(files.some((f) => f.endsWith('Component.tsx'))).toBe(true);
  expect(files.some((f) => f.endsWith('Component.jsx'))).toBe(true);
});

it('still ignores node_modules, .git and dist for .tsx/.jsx files', async () => {
  await mkdir(join(dir, 'node_modules'), { recursive: true });
  await writeFile(join(dir, 'node_modules', 'lib.tsx'), 'export const z = 1;');
  await writeFile(join(dir, 'App.tsx'), 'export const app = 1;');

  const files = await findFiles(dir);

  expect(files).toHaveLength(1);
  expect(files[0]).toContain('App.tsx');
});
