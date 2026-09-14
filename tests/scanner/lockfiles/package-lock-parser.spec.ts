import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { parsePackageLock } from '../../../src/scanner/lockfiles/package-lock-parser.js';

const lockJson = (packages: Record<string, unknown>, lockfileVersion = 3): string =>
      JSON.stringify({ lockfileVersion, packages });

const npmEntry = (name: string, version: string) => ({
      name,
      version,
      ecosystem: 'npm',
      lockfile: 'package-lock.json',
});

it('parses a lockfileVersion 3 packages map into name+version pairs, excluding the root entry', () => {
      const raw = lockJson({
            '': { name: 'my-app', version: '1.0.0' },
            'node_modules/chalk': { version: '6.0.0', resolved: 'https://registry.npmjs.org/chalk/-/chalk-6.0.0.tgz' },
      });

      expect(parsePackageLock(raw)).toEqual([npmEntry('chalk', '6.0.0')]);
});

it('derives scoped package names correctly from nested node_modules paths', () => {
      const raw = lockJson({
            'node_modules/@babel/core': {
                  version: '8.0.1',
                  resolved: 'https://registry.npmjs.org/@babel/core/-/core-8.0.1.tgz',
            },
            'node_modules/foo/node_modules/@babel/core': {
                  version: '7.0.0',
                  resolved: 'https://registry.npmjs.org/@babel/core/-/core-7.0.0.tgz',
            },
      });

      expect(parsePackageLock(raw)).toEqual(
            expect.arrayContaining([npmEntry('@babel/core', '8.0.1'), npmEntry('@babel/core', '7.0.0')]),
      );
});

it("prefers the entry's own name field over the folder-derived name (npm aliases)", () => {
      const raw = lockJson({
            'node_modules/real-name': {
                  name: 'real-name',
                  version: '1.2.3',
                  resolved: 'https://registry.npmjs.org/real-name/-/real-name-1.2.3.tgz',
            },
      });

      expect(parsePackageLock(raw)).toEqual([npmEntry('real-name', '1.2.3')]);
});

it('skips entries whose key is not under node_modules/ (root and local workspace source paths)', () => {
      const raw = lockJson({
            '': { name: 'my-app', version: '1.0.0', workspaces: ['packages/semgrep-rules'] },
            'packages/semgrep-rules': { name: 'codesentry-semgrep-rules', version: '0.1.11' },
            'node_modules/chalk': { version: '6.0.0' },
      });

      expect(parsePackageLock(raw)).toEqual([npmEntry('chalk', '6.0.0')]);
});

it('skips link:true workspace entries', () => {
      const raw = lockJson({
            'node_modules/codesentry-semgrep-rules': { resolved: 'packages/semgrep-rules', link: true },
            'node_modules/chalk': { version: '6.0.0' },
      });

      expect(parsePackageLock(raw)).toEqual([npmEntry('chalk', '6.0.0')]);
});

it('skips entries whose resolved field points to a git or file source', () => {
      const raw = lockJson({
            'node_modules/from-git': { version: '1.0.0', resolved: 'git+https://github.com/some/repo.git' },
            'node_modules/from-file': { version: '1.0.0', resolved: 'file:../local-pkg' },
            'node_modules/chalk': { version: '6.0.0', resolved: 'https://registry.npmjs.org/chalk/-/chalk-6.0.0.tgz' },
      });

      expect(parsePackageLock(raw)).toEqual([npmEntry('chalk', '6.0.0')]);
});

it('dedupes identical name+version pairs from multiple nested copies', () => {
      const raw = lockJson({
            'node_modules/chalk': { version: '6.0.0' },
            'node_modules/foo/node_modules/chalk': { version: '6.0.0' },
      });

      expect(parsePackageLock(raw)).toEqual([npmEntry('chalk', '6.0.0')]);
});

it('throws a clear error for lockfileVersion 1', () => {
      const raw = lockJson({}, 1);

      expect(() => parsePackageLock(raw)).toThrow(/lockfileVersion 1/);
});

it('throws a clear error for invalid JSON', () => {
      expect(() => parsePackageLock('{ not json')).toThrow();
});

it("parses this repository's own package-lock.json without throwing", () => {
      const raw = readFileSync(resolve('package-lock.json'), 'utf-8');

      const packages = parsePackageLock(raw);

      expect(packages.length).toBeGreaterThan(300);
      expect(packages).toEqual(
            expect.arrayContaining([
                  expect.objectContaining({ name: 'chalk', ecosystem: 'npm', lockfile: 'package-lock.json' }),
            ]),
      );
      expect(packages.some((p) => p.name === 'codesentry-semgrep-rules')).toBe(false);
});
