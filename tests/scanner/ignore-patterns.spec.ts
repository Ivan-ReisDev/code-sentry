import { describe, expect, it } from 'vitest';
import { isIgnoredDirName, isTestFileName } from '../../src/scanner/ignore-patterns.js';

describe('isIgnoredDirName', () => {
      it('always ignores dependency, VCS and build-output directories, regardless of includeTests', () => {
            for (const name of ['node_modules', '.git', 'dist', '.next']) {
                  expect(isIgnoredDirName(name)).toBe(true);
                  expect(isIgnoredDirName(name, true)).toBe(true);
            }
      });

      it('ignores common test directory names by default', () => {
            for (const name of ['tests', 'test', '__tests__']) {
                  expect(isIgnoredDirName(name)).toBe(true);
            }
      });

      it('stops ignoring test directory names when includeTests is true', () => {
            for (const name of ['tests', 'test', '__tests__']) {
                  expect(isIgnoredDirName(name, true)).toBe(false);
            }
      });

      it('does not ignore directories that merely resemble a test directory name', () => {
            for (const name of ['src', 'test-utils', 'latest', 'contests']) {
                  expect(isIgnoredDirName(name)).toBe(false);
                  expect(isIgnoredDirName(name, true)).toBe(false);
            }
      });
});

describe('isTestFileName', () => {
      it('matches files with a .spec. or .test. segment', () => {
            for (const name of ['Component.spec.tsx', 'a.test.js', 'utils.spec.ts', 'App.test.tsx']) {
                  expect(isTestFileName(name)).toBe(true);
            }
      });

      it('does not match files that merely contain "spec" or "test" as a substring', () => {
            for (const name of ['spec.ts', 'my.specs.ts', 'latest.ts', 'contest.js']) {
                  expect(isTestFileName(name)).toBe(false);
            }
      });
});
