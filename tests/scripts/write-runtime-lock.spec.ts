import { expect, it } from 'vitest';
import { buildRuntimeLock } from '../../scripts/write-runtime-lock.mjs';

it('writes a versioned runtime provenance schema', () => {
      expect(
            buildRuntimeLock({
                  semgrepVersion: '1.145.0',
                  pythonVersion: '3.12',
                  runtimeSha256: '715a248ce89d6a2ff53cf39c136ed25b01f623b4cf99748a9d9e6fcb7aad8582',
            }),
      ).toEqual({
            schemaVersion: 1,
            semgrepVersion: '1.145.0',
            pythonVersion: '3.12',
            runtimeSha256: '715a248ce89d6a2ff53cf39c136ed25b01f623b4cf99748a9d9e6fcb7aad8582',
      });
});
