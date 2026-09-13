import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import {
      loadBundledOwaspRulesetMetadata,
      loadBundledSemgrepRuntimeMetadata,
} from '../../src/engines/engine-metadata.js';

const fixture = (file: string): string => resolve(import.meta.dirname, '../fixtures/engine-metadata', file);

it('loads the Semgrep runtime provenance for the active platform package', () => {
      const metadata = loadBundledSemgrepRuntimeMetadata('linux', 'x64', () => fixture('runtime.lock.json'));

      expect(metadata).toEqual({
            packageName: 'codesentry-semgrep-linux-x64',
            semgrepVersion: '1.145.0',
            pythonVersion: '3.12',
            runtimeSha256: '715a248ce89d6a2ff53cf39c136ed25b01f623b4cf99748a9d9e6fcb7aad8582',
      });
});

it('loads an immutable OWASP ruleset snapshot with its provenance', () => {
      const metadata = loadBundledOwaspRulesetMetadata(() => fixture('ruleset.lock.json'));

      expect(metadata).toMatchObject({
            packageVersion: '0.1.12',
            ruleset: 'p/owasp-top-ten',
            upstreamRevision: 'registry-revision-42',
      });
});

it('rejects incomplete provenance manifests instead of reporting an unknown engine as current', () => {
      expect(() =>
            loadBundledSemgrepRuntimeMetadata('linux', 'x64', () => fixture('invalid-runtime.lock.json')),
      ).toThrow('manifesto de versão inválido');
});

it('reports an unsupported platform explicitly', () => {
      expect(() => loadBundledSemgrepRuntimeMetadata('darwin', 'arm64')).toThrow('darwin-arm64');
});
