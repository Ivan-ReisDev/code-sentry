import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { createNvdCache } from '../../src/scanner/nvd-cache.js';
import type { NvdLookupResult } from '../../src/rules/rule.interface.js';

let directory: string;
let cacheFile: string;

beforeEach(async () => {
      directory = await mkdtemp(join(tmpdir(), 'codesentry-nvd-cache-'));
      cacheFile = join(directory, 'nvd-v1.json');
});

afterEach(async () => {
      await rm(directory, { recursive: true, force: true });
});

const foundResult: NvdLookupResult = {
      status: 'found',
      cveId: 'CVE-2026-12345',
      data: { id: 'CVE-2026-12345', cwes: ['CWE-78'], references: [] },
};

it('stores a found result and returns it as a cache hit in another instance', async () => {
      const now = () => 1_000;
      const writer = createNvdCache({ filePath: cacheFile, now });
      await writer.set(foundResult);

      const reader = createNvdCache({ filePath: cacheFile, now });
      expect(await reader.get('CVE-2026-12345')).toEqual({ ...foundResult, fromCache: true });
});

it('shares the initial disk load between concurrent cache lookups', async () => {
      const second: NvdLookupResult = {
            status: 'found',
            cveId: 'CVE-2026-54321',
            data: { id: 'CVE-2026-54321', cwes: [], references: [] },
      };
      const writer = createNvdCache({ filePath: cacheFile, now: () => 1_000 });
      await writer.set(foundResult);
      await writer.set(second);

      const reader = createNvdCache({ filePath: cacheFile, now: () => 1_000 });
      const [firstHit, secondHit] = await Promise.all([reader.get('CVE-2026-12345'), reader.get('CVE-2026-54321')]);

      expect(firstHit).toMatchObject({ status: 'found', fromCache: true });
      expect(secondHit).toMatchObject({ status: 'found', fromCache: true });
});

it('expires positive entries after 24 hours', async () => {
      let current = 1_000;
      const cache = createNvdCache({ filePath: cacheFile, now: () => current });
      await cache.set(foundResult);
      current += 24 * 60 * 60 * 1_000 + 1;

      expect(await cache.get('CVE-2026-12345')).toBeUndefined();
});

it('stores not-found for one hour and never stores errors', async () => {
      let current = 2_000;
      const cache = createNvdCache({ filePath: cacheFile, now: () => current });
      await cache.set({ status: 'not-found', cveId: 'CVE-2026-11111' });
      await cache.set({ status: 'error', cveId: 'CVE-2026-22222', error: { kind: 'timeout' } });

      expect(await cache.get('CVE-2026-11111')).toMatchObject({ status: 'not-found', fromCache: true });
      expect(await cache.get('CVE-2026-22222')).toBeUndefined();
      current += 60 * 60 * 1_000 + 1;
      expect(await cache.get('CVE-2026-11111')).toBeUndefined();
});

it('treats corrupt data as a miss and exposes a sanitized warning', async () => {
      await writeFile(cacheFile, '{broken', 'utf-8');
      const cache = createNvdCache({ filePath: cacheFile });

      expect(await cache.get('CVE-2026-12345')).toBeUndefined();
      expect(cache.consumeWarnings().join(' ')).toContain('cache do NVD');
});

it('ignores an incompatible cache schema version', async () => {
      await writeFile(cacheFile, JSON.stringify({ schemaVersion: 99, entries: {} }), 'utf-8');
      const cache = createNvdCache({ filePath: cacheFile });

      expect(await cache.get('CVE-2026-12345')).toBeUndefined();
      expect(cache.consumeWarnings().join(' ')).toContain('incompatível');
});

it('ignores a cache entry with malformed normalized NVD metadata', async () => {
      await writeFile(
            cacheFile,
            JSON.stringify({
                  schemaVersion: 1,
                  entries: {
                        'CVE-2026-12345': {
                              expiresAt: Date.now() + 60_000,
                              result: {
                                    status: 'found',
                                    cveId: 'CVE-2026-12345',
                                    data: {
                                          id: 'CVE-2026-12345',
                                          cwes: ['CWE-78'],
                                          references: [{ url: 123, tags: [] }],
                                    },
                              },
                        },
                  },
            }),
            'utf-8',
      );
      const cache = createNvdCache({ filePath: cacheFile });

      expect(await cache.get('CVE-2026-12345')).toBeUndefined();
});

it('degrades to an in-memory result when the cache cannot be written', async () => {
      const blockingFile = join(directory, 'not-a-directory');
      await writeFile(blockingFile, 'x', 'utf-8');
      const cache = createNvdCache({ filePath: join(blockingFile, 'nvd-v1.json') });

      await expect(cache.set(foundResult)).resolves.toBeUndefined();
      expect(await cache.get('CVE-2026-12345')).toMatchObject({ status: 'found', fromCache: true });
      expect(cache.consumeWarnings().join(' ')).toContain('gravar o cache');
});

it('writes a versioned file without storing API secrets', async () => {
      const cache = createNvdCache({ filePath: cacheFile });
      await cache.set(foundResult);

      const persisted = await readFile(cacheFile, 'utf-8');
      expect(persisted).toContain('"schemaVersion": 1');
      expect(persisted).not.toContain('apiKey');
      expect(await readdir(directory)).toEqual(['nvd-v1.json']);
});
