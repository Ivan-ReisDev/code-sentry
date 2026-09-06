import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { resolveBundledSemgrepRuntime, unsupportedRuntimeMessage } from '../../src/scanner/semgrep-runtime.js';

const fixtureManifest = resolve(import.meta.dirname, '../fixtures/semgrep-runtime/runtime.json');
const missingBinaryManifest = resolve(import.meta.dirname, '../fixtures/semgrep-runtime-missing-binary/runtime.json');

it('explains when the bundled Semgrep runtime is unavailable for a platform', () => {
      expect(unsupportedRuntimeMessage('darwin', 'arm64')).toContain('darwin-arm64');
      expect(unsupportedRuntimeMessage('darwin', 'arm64')).toContain('Linux x64 e Windows x64');
});

it('fails clearly when the compatible runtime package was not installed', () => {
      expect(() =>
            resolveBundledSemgrepRuntime('linux', 'x64', () => {
                  throw new Error('module not found');
            }),
      ).toThrow('Não foi possível carregar o runtime Semgrep embutido');
});

it('resolves the bundled semgrep executable path from the platform package manifest', () => {
      const runtime = resolveBundledSemgrepRuntime('linux', 'x64', () => fixtureManifest);

      expect(runtime.semgrep).toBe(resolve(import.meta.dirname, '../fixtures/semgrep-runtime/bin/semgrep'));
});

it('fails clearly when the manifest points to an executable that does not exist on disk', () => {
      expect(() => resolveBundledSemgrepRuntime('linux', 'x64', () => missingBinaryManifest)).toThrow(
            'Não foi possível carregar o runtime Semgrep embutido',
      );
});
