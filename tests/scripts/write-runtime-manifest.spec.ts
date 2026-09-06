import { expect, it } from 'vitest';
import { buildRuntimeManifest } from '../../scripts/write-runtime-manifest.mjs';

it('sets the semgrep executable path on the manifest', () => {
      expect(buildRuntimeManifest({}, 'runtime/python/install/Scripts/semgrep.exe')).toEqual({
            semgrep: 'runtime/python/install/Scripts/semgrep.exe',
      });
});

it('preserves other existing manifest fields', () => {
      expect(buildRuntimeManifest({ foo: 'bar' }, 'runtime/python/bin/semgrep')).toEqual({
            foo: 'bar',
            semgrep: 'runtime/python/bin/semgrep',
      });
});

it('overwrites a previously recorded semgrep path', () => {
      expect(buildRuntimeManifest({ semgrep: 'stale/path' }, 'runtime/python/bin/semgrep')).toEqual({
            semgrep: 'runtime/python/bin/semgrep',
      });
});
