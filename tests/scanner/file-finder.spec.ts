import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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

it('ignores dependency, VCS and build-output folders for .tsx/.jsx files', async () => {
      await mkdir(join(dir, 'node_modules'), { recursive: true });
      await mkdir(join(dir, '.next', 'static'), { recursive: true });
      await writeFile(join(dir, 'node_modules', 'lib.tsx'), 'export const z = 1;');
      await writeFile(join(dir, '.next', 'static', 'generated.js'), 'export const generated = 1;');
      await writeFile(join(dir, 'App.tsx'), 'export const app = 1;');

      const files = await findFiles(dir);

      expect(files).toHaveLength(1);
      expect(files[0]).toContain('App.tsx');
});

it('ignores test directories, whose intentionally unsafe fixtures are not application code', async () => {
      await mkdir(join(dir, 'tests', 'fixtures'), { recursive: true });
      await writeFile(join(dir, 'tests', 'fixtures', 'unsafe.ts'), 'document.write(location.hash);');
      await writeFile(join(dir, 'App.tsx'), 'export const app = 1;');

      const files = await findFiles(dir);

      expect(files).toHaveLength(1);
      expect(files[0]).toContain('App.tsx');
});

it('ignores "test" and "__tests__" directories too, at any depth', async () => {
      await mkdir(join(dir, 'src', '__tests__'), { recursive: true });
      await mkdir(join(dir, 'test'), { recursive: true });
      await writeFile(join(dir, 'src', '__tests__', 'unsafe.ts'), 'document.write(location.hash);');
      await writeFile(join(dir, 'test', 'unsafe.ts'), 'document.write(location.hash);');
      await writeFile(join(dir, 'App.tsx'), 'export const app = 1;');

      const files = await findFiles(dir);

      expect(files).toHaveLength(1);
      expect(files[0]).toContain('App.tsx');
});

it('ignores .spec. and .test. files anywhere, not just inside test directories', async () => {
      await writeFile(join(dir, 'Component.spec.tsx'), 'export const x = 1;');
      await writeFile(join(dir, 'utils.test.ts'), 'export const y = 1;');
      await writeFile(join(dir, 'App.tsx'), 'export const app = 1;');

      const files = await findFiles(dir);

      expect(files).toHaveLength(1);
      expect(files[0]).toContain('App.tsx');
});

it('includes test directories and .spec./.test. files when includeTests is true', async () => {
      await mkdir(join(dir, 'tests'), { recursive: true });
      await writeFile(join(dir, 'tests', 'fixture.ts'), 'export const f = 1;');
      await writeFile(join(dir, 'Component.spec.tsx'), 'export const x = 1;');
      await writeFile(join(dir, 'App.tsx'), 'export const app = 1;');

      const files = await findFiles(dir, true);

      expect(files).toHaveLength(3);
});

it('still ignores node_modules even when includeTests is true', async () => {
      await mkdir(join(dir, 'node_modules'), { recursive: true });
      await writeFile(join(dir, 'node_modules', 'lib.ts'), 'export const z = 1;');
      await writeFile(join(dir, 'App.tsx'), 'export const app = 1;');

      const files = await findFiles(dir, true);

      expect(files).toHaveLength(1);
      expect(files[0]).toContain('App.tsx');
});

it('never reads inside an ignored test directory, so unreadable content there cannot fail the scan', async () => {
      await mkdir(join(dir, 'tests'), { recursive: true });
      await writeFile(join(dir, 'tests', 'fixture.ts'), 'export const f = 1;');
      await writeFile(join(dir, 'App.tsx'), 'export const app = 1;');
      await chmod(join(dir, 'tests'), 0o000);

      try {
            const files = await findFiles(dir);
            expect(files).toHaveLength(1);
            expect(files[0]).toContain('App.tsx');
      } finally {
            await chmod(join(dir, 'tests'), 0o755);
      }
});

it('never reads inside an ignored directory, so unreadable content there cannot fail the scan', async () => {
      await mkdir(join(dir, 'node_modules'), { recursive: true });
      await writeFile(join(dir, 'node_modules', 'lib.tsx'), 'export const z = 1;');
      await writeFile(join(dir, 'App.tsx'), 'export const app = 1;');
      // Removing read+execute from node_modules makes readdir() on it throw EACCES.
      // findFiles must never attempt that call in the first place, mirroring how a
      // broken/too-long path inside node_modules on Windows should not fail the scan.
      await chmod(join(dir, 'node_modules'), 0o000);

      try {
            const files = await findFiles(dir);
            expect(files).toHaveLength(1);
            expect(files[0]).toContain('App.tsx');
      } finally {
            await chmod(join(dir, 'node_modules'), 0o755);
      }
});
