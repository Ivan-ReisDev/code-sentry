import { expect, it, vi } from 'vitest';
import { createNvdClient } from '../../src/scanner/nvd-client.js';
import type { NvdCache } from '../../src/scanner/nvd-cache.js';

const noCache = (): NvdCache => ({
      get: async () => undefined,
      set: async () => undefined,
      consumeWarnings: () => [],
});

const response = (status: number, body: unknown, retryAfter?: string) => ({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (name: string) => (name.toLowerCase() === 'retry-after' ? (retryAfter ?? null) : null) },
      json: async () => body,
});

const successBody = {
      totalResults: 1,
      vulnerabilities: [
            {
                  cve: {
                        id: 'CVE-2026-12345',
                        descriptions: [{ lang: 'en', value: 'Example' }],
                        references: [],
                  },
            },
      ],
};

it('queries the CVE endpoint and sends a non-empty API key only in the apiKey header', async () => {
      const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => response(200, successBody));
      const client = createNvdClient({ fetchImpl, apiKey: ' top-secret ', cache: noCache(), minIntervalMs: 0 });

      const result = await client.lookupCve('CVE-2026-12345');

      expect(result.status).toBe('found');
      const [url, init] = fetchImpl.mock.calls[0];
      expect(url).toBe('https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=CVE-2026-12345');
      expect(init?.headers).toEqual({ Accept: 'application/json', apiKey: 'top-secret' });
      expect(url).not.toContain('top-secret');
      expect(JSON.stringify(result)).not.toContain('top-secret');
});

it('omits the apiKey header when no key is configured', async () => {
      const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => response(200, successBody));
      const client = createNvdClient({ fetchImpl, apiKey: '   ', cache: noCache(), minIntervalMs: 0 });

      await client.lookupCve('CVE-2026-12345');

      expect(fetchImpl.mock.calls[0][1]?.headers).toEqual({ Accept: 'application/json' });
});

it.each([
      { apiKey: undefined, expectedInterval: 6_100 },
      { apiKey: 'key', expectedInterval: 610 },
])('paces distinct CVEs conservatively with apiKey=$apiKey', async ({ apiKey, expectedInterval }) => {
      const sleeps: number[] = [];
      const client = createNvdClient({
            fetchImpl: async () => response(404, {}),
            apiKey,
            cache: noCache(),
            now: () => 1_000,
            sleep: async (milliseconds) => {
                  sleeps.push(milliseconds);
            },
      });

      await client.lookupCve('CVE-2026-12345');
      await client.lookupCve('CVE-2026-54321');

      expect(sleeps).toContain(expectedInterval);
});

it('distinguishes an empty response and HTTP 404 from consultation errors', async () => {
      const emptyClient = createNvdClient({
            fetchImpl: async () => response(200, { totalResults: 0, vulnerabilities: [] }),
            cache: noCache(),
            minIntervalMs: 0,
      });
      const missingClient = createNvdClient({
            fetchImpl: async () => response(404, {}),
            cache: noCache(),
            minIntervalMs: 0,
      });

      expect(await emptyClient.lookupCve('CVE-2026-12345')).toMatchObject({ status: 'not-found' });
      expect(await missingClient.lookupCve('CVE-2026-12345')).toMatchObject({ status: 'not-found' });
});

it('retries 429 and respects Retry-After', async () => {
      let calls = 0;
      const sleeps: number[] = [];
      const client = createNvdClient({
            fetchImpl: async () => (++calls === 1 ? response(429, {}, '2') : response(200, successBody)),
            cache: noCache(),
            minIntervalMs: 0,
            sleep: async (milliseconds) => {
                  sleeps.push(milliseconds);
            },
            random: () => 0.5,
      });

      expect(await client.lookupCve('CVE-2026-12345')).toMatchObject({ status: 'found' });
      expect(calls).toBe(2);
      expect(sleeps).toContain(2_000);
});

it('respects Retry-After expressed as an HTTP date', async () => {
      let calls = 0;
      const sleeps: number[] = [];
      const now = Date.parse('2026-01-01T00:00:00Z');
      const client = createNvdClient({
            fetchImpl: async () =>
                  ++calls === 1 ? response(429, {}, 'Thu, 01 Jan 2026 00:00:04 GMT') : response(200, successBody),
            cache: noCache(),
            minIntervalMs: 0,
            now: () => now,
            sleep: async (milliseconds) => {
                  sleeps.push(milliseconds);
            },
            random: () => 0.5,
      });

      expect(await client.lookupCve('CVE-2026-12345')).toMatchObject({ status: 'found' });
      expect(sleeps).toContain(4_000);
});

it('does not retry a permanent client error', async () => {
      const fetchImpl = vi.fn(async () => response(400, {}));
      const client = createNvdClient({ fetchImpl, cache: noCache(), minIntervalMs: 0 });

      expect(await client.lookupCve('CVE-2026-12345')).toMatchObject({
            status: 'error',
            error: { kind: 'http', httpStatus: 400 },
      });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
});

it('classifies invalid JSON as a permanent invalid response', async () => {
      const fetchImpl = vi.fn(async () => ({
            ok: true,
            status: 200,
            json: async () => {
                  throw new SyntaxError('secret response body');
            },
      }));
      const client = createNvdClient({ fetchImpl, cache: noCache(), minIntervalMs: 0 });

      const result = await client.lookupCve('CVE-2026-12345');
      expect(result).toMatchObject({ status: 'error', error: { kind: 'invalid-response' } });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(result)).not.toContain('secret response body');
});

it('retries server and network failures at most three times', async () => {
      const fetchImpl = vi.fn(async () => response(503, {}));
      const client = createNvdClient({
            fetchImpl,
            cache: noCache(),
            minIntervalMs: 0,
            sleep: async () => undefined,
            random: () => 0.5,
      });

      expect(await client.lookupCve('CVE-2026-12345')).toMatchObject({
            status: 'error',
            error: { kind: 'server', httpStatus: 503 },
      });
      expect(fetchImpl).toHaveBeenCalledTimes(3);
});

it('retries a transient network failure and can recover', async () => {
      let calls = 0;
      const client = createNvdClient({
            fetchImpl: async () => {
                  calls += 1;
                  if (calls === 1) throw new TypeError('connection reset');
                  return response(200, successBody);
            },
            cache: noCache(),
            minIntervalMs: 0,
            sleep: async () => undefined,
            random: () => 0.5,
      });

      expect(await client.lookupCve('CVE-2026-12345')).toMatchObject({ status: 'found' });
      expect(calls).toBe(2);
});

it('opens the circuit after a rate limit exhausts its attempts', async () => {
      const fetchImpl = vi.fn(async () => response(429, {}));
      const client = createNvdClient({
            fetchImpl,
            cache: noCache(),
            maxAttempts: 1,
            minIntervalMs: 0,
      });

      expect(await client.lookupCve('CVE-2026-12345')).toMatchObject({ error: { kind: 'rate-limit' } });
      expect(await client.lookupCve('CVE-2026-54321')).toMatchObject({ error: { kind: 'unavailable' } });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
});

it('opens the circuit after three consecutive CVEs fail transiently', async () => {
      const fetchImpl = vi.fn(async () => response(503, {}));
      const client = createNvdClient({
            fetchImpl,
            cache: noCache(),
            maxAttempts: 1,
            minIntervalMs: 0,
      });

      await client.lookupCve('CVE-2026-10001');
      await client.lookupCve('CVE-2026-10002');
      await client.lookupCve('CVE-2026-10003');
      expect(await client.lookupCve('CVE-2026-10004')).toMatchObject({ error: { kind: 'unavailable' } });
      expect(fetchImpl).toHaveBeenCalledTimes(3);
});

it('does not retry 403 and opens the circuit for queued CVEs', async () => {
      const fetchImpl = vi.fn(async () => response(403, {}));
      const client = createNvdClient({ fetchImpl, cache: noCache(), minIntervalMs: 0 });

      const results = await Promise.all([client.lookupCve('CVE-2026-12345'), client.lookupCve('CVE-2026-54321')]);

      expect(results[0]).toMatchObject({ status: 'error', error: { kind: 'forbidden', httpStatus: 403 } });
      expect(results[1]).toMatchObject({ status: 'error', error: { kind: 'unavailable' } });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
});

it('classifies an aborted request as timeout without exposing the original error', async () => {
      const fetchImpl = async () => {
            const error = new Error('top-secret transport detail');
            error.name = 'AbortError';
            throw error;
      };
      const client = createNvdClient({
            fetchImpl,
            cache: noCache(),
            minIntervalMs: 0,
            sleep: async () => undefined,
            maxAttempts: 1,
      });

      const result = await client.lookupCve('CVE-2026-12345');
      expect(result).toMatchObject({ status: 'error', error: { kind: 'timeout' } });
      expect(JSON.stringify(result)).not.toContain('top-secret');
});

it('uses the cache and deduplicates concurrent lookups', async () => {
      const cached = {
            status: 'found' as const,
            cveId: 'CVE-2026-12345',
            data: { id: 'CVE-2026-12345', cwes: [], references: [] },
            fromCache: true as const,
      };
      const cache: NvdCache = { get: async () => cached, set: async () => undefined, consumeWarnings: () => [] };
      const fetchImpl = vi.fn(async () => response(200, successBody));
      const client = createNvdClient({ fetchImpl, cache, minIntervalMs: 0 });

      const [first, second] = await Promise.all([
            client.lookupCve('CVE-2026-12345'),
            client.lookupCve('CVE-2026-12345'),
      ]);

      expect(first).toEqual(cached);
      expect(second).toEqual(cached);
      expect(fetchImpl).not.toHaveBeenCalled();
});
