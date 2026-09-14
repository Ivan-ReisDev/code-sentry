import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { parsePoetryLock } from '../../../src/scanner/lockfiles/poetry-lock-parser.js';

const pypiEntry = (name: string, version: string) => ({
      name,
      version,
      ecosystem: 'PyPI',
      lockfile: 'poetry.lock',
});

const packageBlock = (name: string, version: string, source?: string): string => `
[[package]]
name = "${name}"
version = "${version}"
description = ""
optional = false
python-versions = "*"
files = []
${source ?? ''}
`;

it('parses normal [[package]] entries into name+version pairs', () => {
      const raw = packageBlock('requests', '2.31.0');

      expect(parsePoetryLock(raw)).toEqual([pypiEntry('requests', '2.31.0')]);
});

it('normalizes the package name per PEP 503', () => {
      const raw = packageBlock('Zope.Interface', '5.5.2');

      expect(parsePoetryLock(raw)).toEqual([pypiEntry('zope-interface', '5.5.2')]);
});

it('skips packages sourced from a local directory', () => {
      const raw = packageBlock('local-pkg', '0.1.0', '\n[package.source]\ntype = "directory"\nurl = "../local-pkg"\n');

      expect(parsePoetryLock(raw)).toEqual([]);
});

it('skips packages sourced from git', () => {
      const raw = packageBlock(
            'git-pkg',
            '1.0.0',
            '\n[package.source]\ntype = "git"\nurl = "https://github.com/example/git-pkg.git"\n',
      );

      expect(parsePoetryLock(raw)).toEqual([]);
});

it('skips packages sourced from a direct URL', () => {
      const raw = packageBlock(
            'url-pkg',
            '1.0.0',
            '\n[package.source]\ntype = "url"\nurl = "https://example.com/pkg.tar.gz"\n',
      );

      expect(parsePoetryLock(raw)).toEqual([]);
});

it('keeps packages sourced from a legacy (private mirror) index', () => {
      const raw = packageBlock(
            'mirrored-pkg',
            '3.0.0',
            '\n[package.source]\ntype = "legacy"\nurl = "https://private.example.com/simple"\nreference = "private"\n',
      );

      expect(parsePoetryLock(raw)).toEqual([pypiEntry('mirrored-pkg', '3.0.0')]);
});

it('parses multiple packages and preserves encounter order', () => {
      const raw = packageBlock('aaa', '1.0.0') + packageBlock('bbb', '2.0.0');

      expect(parsePoetryLock(raw)).toEqual([pypiEntry('aaa', '1.0.0'), pypiEntry('bbb', '2.0.0')]);
});

it('throws a clear error for malformed TOML', () => {
      expect(() => parsePoetryLock('[[package\nname = ')).toThrow();
});

it('parses a realistic poetry.lock fixture without throwing', () => {
      const raw = readFileSync(resolve('tests/fixtures/lockfiles/poetry.lock'), 'utf-8');

      const packages = parsePoetryLock(raw);

      expect(packages).toEqual(
            expect.arrayContaining([expect.objectContaining({ name: 'requests', version: '2.31.0' })]),
      );
      expect(packages.some((p) => p.name === 'local-pkg')).toBe(false);
      expect(packages.some((p) => p.name === 'git-pkg')).toBe(false);
});
