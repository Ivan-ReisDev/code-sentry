import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { discoverLockedPackages } from '../../../src/scanner/lockfiles/lockfile-discovery.js';

let directory: string;

beforeEach(async () => {
      directory = await mkdtemp(join(tmpdir(), 'codesentry-lockfile-discovery-'));
});

afterEach(async () => {
      await rm(directory, { recursive: true, force: true });
});

const packageLockJson = (packages: Record<string, unknown>): string => JSON.stringify({ lockfileVersion: 3, packages });

it('returns nothing when the directory has no supported lockfile', async () => {
      const result = await discoverLockedPackages(directory);

      expect(result).toEqual({ packages: [], lockfilesFound: [], warnings: [] });
});

it('discovers an npm-only project', async () => {
      await writeFile(
            join(directory, 'package-lock.json'),
            packageLockJson({ 'node_modules/chalk': { version: '5.3.0' } }),
      );

      const result = await discoverLockedPackages(directory);

      expect(result.lockfilesFound).toEqual(['package-lock.json']);
      expect(result.packages).toEqual([
            { name: 'chalk', version: '5.3.0', ecosystem: 'npm', lockfile: 'package-lock.json' },
      ]);
      expect(result.warnings).toEqual([]);
});

it('discovers a Python-only project', async () => {
      await writeFile(
            join(directory, 'poetry.lock'),
            '[[package]]\nname = "requests"\nversion = "2.31.0"\nfiles = []\n',
      );

      const result = await discoverLockedPackages(directory);

      expect(result.lockfilesFound).toEqual(['poetry.lock']);
      expect(result.packages).toEqual([
            { name: 'requests', version: '2.31.0', ecosystem: 'PyPI', lockfile: 'poetry.lock' },
      ]);
});

it('discovers and merges a polyglot project (npm + Python)', async () => {
      await writeFile(
            join(directory, 'package-lock.json'),
            packageLockJson({ 'node_modules/chalk': { version: '5.3.0' } }),
      );
      await writeFile(
            join(directory, 'poetry.lock'),
            '[[package]]\nname = "requests"\nversion = "2.31.0"\nfiles = []\n',
      );

      const result = await discoverLockedPackages(directory);

      expect(result.lockfilesFound.sort()).toEqual(['package-lock.json', 'poetry.lock']);
      expect(result.packages).toEqual(
            expect.arrayContaining([
                  { name: 'chalk', version: '5.3.0', ecosystem: 'npm', lockfile: 'package-lock.json' },
                  { name: 'requests', version: '2.31.0', ecosystem: 'PyPI', lockfile: 'poetry.lock' },
            ]),
      );
      expect(result.packages).toHaveLength(2);
});

it('collapses the same package found in two coexisting JS lockfiles', async () => {
      await writeFile(
            join(directory, 'package-lock.json'),
            packageLockJson({ 'node_modules/chalk': { version: '5.3.0' } }),
      );
      await writeFile(
            join(directory, 'yarn.lock'),
            '# yarn lockfile v1\n\nchalk@^5.3.0:\n  version "5.3.0"\n  resolved "https://registry.yarnpkg.com/chalk/-/chalk-5.3.0.tgz#x"\n',
      );

      const result = await discoverLockedPackages(directory);

      expect(result.lockfilesFound.sort()).toEqual(['package-lock.json', 'yarn.lock']);
      expect(result.packages).toEqual([
            { name: 'chalk', version: '5.3.0', ecosystem: 'npm', lockfile: 'package-lock.json' },
      ]);
});

it('warns about a corrupt lockfile without dropping the others', async () => {
      await writeFile(join(directory, 'poetry.lock'), '[[package\nnot valid toml');
      await writeFile(
            join(directory, 'package-lock.json'),
            packageLockJson({ 'node_modules/chalk': { version: '5.3.0' } }),
      );

      const result = await discoverLockedPackages(directory);

      expect(result.packages).toEqual([
            { name: 'chalk', version: '5.3.0', ecosystem: 'npm', lockfile: 'package-lock.json' },
      ]);
      expect(result.lockfilesFound).toEqual(['package-lock.json']);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('poetry.lock');
});
