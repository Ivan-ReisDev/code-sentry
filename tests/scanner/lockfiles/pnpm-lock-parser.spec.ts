import { expect, it } from 'vitest';
import { parsePnpmLock } from '../../../src/scanner/lockfiles/pnpm-lock-parser.js';

const npmEntry = (name: string, version: string) => ({
      name,
      version,
      ecosystem: 'npm',
      lockfile: 'pnpm-lock.yaml',
});

it('parses lockfileVersion 9.0 packages (bare name@version keys)', () => {
      const raw = `
lockfileVersion: '9.0'
packages:
  chalk@5.3.0:
    resolution: {integrity: sha512-aaaa}
  '@babel/core@8.0.1':
    resolution: {integrity: sha512-bbbb}
`;

      expect(parsePnpmLock(raw)).toEqual(
            expect.arrayContaining([npmEntry('chalk', '5.3.0'), npmEntry('@babel/core', '8.0.1')]),
      );
});

it('parses lockfileVersion 6.0 packages (leading-slash name@version keys)', () => {
      const raw = `
lockfileVersion: '6.0'
packages:
  /chalk@5.3.0:
    resolution: {integrity: sha512-aaaa}
  /@babel/core@8.0.1:
    resolution: {integrity: sha512-bbbb}
`;

      expect(parsePnpmLock(raw)).toEqual(
            expect.arrayContaining([npmEntry('chalk', '5.3.0'), npmEntry('@babel/core', '8.0.1')]),
      );
});

it('strips peer-dependency suffixes from lockfileVersion 6.0 keys', () => {
      const raw = `
lockfileVersion: '6.0'
packages:
  /foo@1.0.0(react-dom@18.2.0)(react@18.2.0):
    resolution: {integrity: sha512-aaaa}
`;

      expect(parsePnpmLock(raw)).toEqual([npmEntry('foo', '1.0.0')]);
});

it('parses lockfileVersion 5.4 packages (leading-slash name/version keys)', () => {
      const raw = `
lockfileVersion: 5.4
packages:
  /chalk/5.3.0:
    resolution: {integrity: sha512-aaaa}
  /@babel/core/8.0.1:
    resolution: {integrity: sha512-bbbb}
`;

      expect(parsePnpmLock(raw)).toEqual(
            expect.arrayContaining([npmEntry('chalk', '5.3.0'), npmEntry('@babel/core', '8.0.1')]),
      );
});

it('returns an empty array (no throw) for an unrecognized lockfileVersion', () => {
      const raw = `
lockfileVersion: '99.0'
packages:
  chalk@5.3.0:
    resolution: {integrity: sha512-aaaa}
`;

      expect(parsePnpmLock(raw)).toEqual([]);
});

it('returns an empty array (no throw) when there is no packages section', () => {
      expect(parsePnpmLock("lockfileVersion: '9.0'\n")).toEqual([]);
});

it('throws a clear error for malformed YAML', () => {
      expect(() => parsePnpmLock('packages:\n  - not: [valid\n')).toThrow();
});
