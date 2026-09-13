import type { NvdErrorKind, NvdLookupResult, NvdVulnerabilityData } from '../rules/rule.interface.js';
import type { FetchLike } from './osv-client.js';
import { createNvdCache, type NvdCache } from './nvd-cache.js';
import { normalizeNvdCve } from './nvd-normalizer.js';

const NVD_API_URL = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const TRANSIENT_FAILURE_CIRCUIT_THRESHOLD = 3;
const CVE_PATTERN = /^CVE-\d{4}-\d{4,}$/;

type Sleep = (milliseconds: number) => Promise<void>;
type NvdFetchResponse = Awaited<ReturnType<FetchLike>>;

export interface NvdClient {
      lookupCve(cveId: string): Promise<NvdLookupResult>;
      consumeWarnings(): string[];
}

export interface NvdClientOptions {
      fetchImpl?: FetchLike;
      apiKey?: string;
      cache?: NvdCache;
      timeoutMs?: number;
      maxAttempts?: number;
      minIntervalMs?: number;
      sleep?: Sleep;
      now?: () => number;
      random?: () => number;
}

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null;
const defaultSleep: Sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

interface AttemptFailure {
      result: Extract<NvdLookupResult, { status: 'error' }>;
      retryable: boolean;
      retryAfterMs?: number;
}

type AttemptOutcome = NvdLookupResult | AttemptFailure;

const isAttemptFailure = (outcome: AttemptOutcome): outcome is AttemptFailure => 'result' in outcome;

const errorResult = (
      cveId: string,
      kind: NvdErrorKind,
      httpStatus?: number,
): Extract<NvdLookupResult, { status: 'error' }> => ({
      status: 'error',
      cveId,
      error: { kind, ...(httpStatus === undefined ? {} : { httpStatus }) },
});

const parseRetryAfterDate = (value: string, now: number): number | undefined => {
      const date = Date.parse(value);
      return Number.isNaN(date) ? undefined : Math.max(0, date - now);
};

const retryAfterMilliseconds = (value: string | null | undefined, now: number): number | undefined => {
      if (!value) return undefined;
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
      return parseRetryAfterDate(value, now);
};

const extractCveEntries = (body: unknown): unknown[] | undefined => {
      if (!isRecord(body) || !Array.isArray(body.vulnerabilities)) return undefined;
      return body.vulnerabilities;
};

const buildRequestHeaders = (apiKey: string | undefined): Record<string, string> => {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (apiKey) headers.apiKey = apiKey;
      return headers;
};

const errorKindForStatus = (status: number): NvdErrorKind => {
      if (status === 429) return 'rate-limit';
      if (status >= 500) return 'server';
      return 'http';
};

const isRetryableStatus = (status: number): boolean => status === 408 || status === 429 || status >= 500;

const isEmptyResultBody = (body: unknown, entries: unknown[]): boolean =>
      entries.length === 0 || (isRecord(body) && body.totalResults === 0);

const outcomeFromEntries = (entries: unknown[], cveId: string): AttemptOutcome => {
      for (const entry of entries) {
            if (!isRecord(entry)) continue;
            const normalized: NvdVulnerabilityData | undefined = normalizeNvdCve(entry.cve, cveId);
            if (normalized) return { status: 'found', cveId, data: normalized };
      }
      return { result: errorResult(cveId, 'invalid-response'), retryable: false };
};

const parseSuccessBody = (body: unknown, cveId: string): AttemptOutcome => {
      const entries = extractCveEntries(body);
      if (!entries) return { result: errorResult(cveId, 'invalid-response'), retryable: false };
      if (isEmptyResultBody(body, entries)) return { status: 'not-found', cveId };
      return outcomeFromEntries(entries, cveId);
};

const isTimeoutError = (error: unknown, signal: { aborted: boolean }): boolean =>
      signal.aborted || (error instanceof Error && error.name === 'AbortError');

const attemptCatchResult = (error: unknown, signal: { aborted: boolean }, cveId: string): AttemptFailure => ({
      result: errorResult(cveId, isTimeoutError(error, signal) ? 'timeout' : 'network'),
      retryable: true,
});

class DefaultNvdClient implements NvdClient {
      readonly #fetch: FetchLike;
      readonly #apiKey?: string;
      readonly #cache: NvdCache;
      readonly #timeoutMs: number;
      readonly #maxAttempts: number;
      readonly #minIntervalMs: number;
      readonly #sleep: Sleep;
      readonly #now: () => number;
      readonly #random: () => number;
      readonly #lookups = new Map<string, Promise<NvdLookupResult>>();
      readonly #warnings: string[] = [];
      #requestQueue: Promise<void> = Promise.resolve();
      #nextRequestAt = 0;
      #circuitOpen = false;
      #consecutiveTransientFailures = 0;

      constructor(options: NvdClientOptions) {
            this.#fetch = options.fetchImpl ?? fetch;
            this.#apiKey = options.apiKey?.trim() || undefined;
            this.#cache = options.cache ?? createNvdCache();
            this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
            this.#maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
            this.#minIntervalMs = options.minIntervalMs ?? (this.#apiKey ? 610 : 6_100);
            this.#sleep = options.sleep ?? defaultSleep;
            this.#now = options.now ?? Date.now;
            this.#random = options.random ?? Math.random;
      }

      lookupCve(cveId: string): Promise<NvdLookupResult> {
            const normalizedId = cveId.trim().toUpperCase();
            if (!CVE_PATTERN.test(normalizedId)) {
                  return Promise.resolve(errorResult(normalizedId, 'invalid-response'));
            }
            const existing = this.#lookups.get(normalizedId);
            if (existing) return existing;
            const lookup = this.#lookup(normalizedId);
            this.#lookups.set(normalizedId, lookup);
            return lookup;
      }

      async #shortCircuit(cveId: string): Promise<NvdLookupResult | undefined> {
            const cached = await this.#cache.get(cveId);
            if (cached) return cached;
            if (this.#circuitOpen) return errorResult(cveId, 'unavailable');
            return undefined;
      }

      async #retryUntilSuccess(cveId: string): Promise<{ success: NvdLookupResult } | { failure: AttemptFailure }> {
            let finalFailure: AttemptFailure | undefined;
            for (let attempt = 0; attempt < this.#maxAttempts; attempt += 1) {
                  const outcome = await this.#scheduleAttempt(cveId);
                  if (!isAttemptFailure(outcome)) {
                        this.#consecutiveTransientFailures = 0;
                        await this.#cache.set(outcome);
                        return { success: outcome };
                  }
                  finalFailure = outcome;
                  if (!outcome.retryable || attempt === this.#maxAttempts - 1) break;
                  const baseBackoff = Math.min(30_000, 1_000 * 2 ** attempt);
                  const jitteredBackoff = baseBackoff * (0.8 + this.#random() * 0.4);
                  await this.#sleep(Math.max(jitteredBackoff, outcome.retryAfterMs ?? 0));
            }
            return { failure: finalFailure ?? { result: errorResult(cveId, 'unavailable'), retryable: false } };
      }

      #recordFailure(failure: AttemptFailure): NvdLookupResult {
            if (failure.retryable) {
                  this.#consecutiveTransientFailures += 1;
                  if (
                        failure.result.error.kind === 'rate-limit' ||
                        this.#consecutiveTransientFailures >= TRANSIENT_FAILURE_CIRCUIT_THRESHOLD
                  ) {
                        this.#circuitOpen = true;
                  }
            }
            return failure.result;
      }

      async #lookup(cveId: string): Promise<NvdLookupResult> {
            const shortCircuited = await this.#shortCircuit(cveId);
            if (shortCircuited) return shortCircuited;
            const outcome = await this.#retryUntilSuccess(cveId);
            return 'success' in outcome ? outcome.success : this.#recordFailure(outcome.failure);
      }

      #scheduleAttempt(cveId: string): Promise<AttemptOutcome> {
            const scheduled = this.#requestQueue
                  .then(async () => {
                        if (this.#circuitOpen) return errorResult(cveId, 'unavailable');
                        const waitMs = Math.max(0, this.#nextRequestAt - this.#now());
                        if (waitMs > 0) await this.#sleep(waitMs);
                        this.#nextRequestAt = this.#now() + this.#minIntervalMs;
                        return this.#attempt(cveId);
                  })
                  .catch(() => ({ result: errorResult(cveId, 'unavailable'), retryable: true }));
            this.#requestQueue = scheduled.then(
                  () => undefined,
                  () => undefined,
            );
            return scheduled;
      }

      #failureForStatus(cveId: string, status: number, response: NvdFetchResponse): AttemptFailure {
            if (status === 401 || status === 403) {
                  this.#circuitOpen = true;
                  return { result: errorResult(cveId, 'forbidden', status), retryable: false };
            }
            return {
                  result: errorResult(cveId, errorKindForStatus(status), status),
                  retryable: isRetryableStatus(status),
                  retryAfterMs: retryAfterMilliseconds(response.headers?.get('Retry-After'), this.#now()),
            };
      }

      async #safeFetch(
            url: string,
            headers: Record<string, string>,
            signal: AbortSignal,
            cveId: string,
      ): Promise<NvdFetchResponse | AttemptFailure> {
            try {
                  return await this.#fetch(url, { method: 'GET', headers, signal });
            } catch (error) {
                  return attemptCatchResult(error, signal, cveId);
            }
      }

      async #parseBodySafely(response: NvdFetchResponse, cveId: string): Promise<AttemptOutcome> {
            try {
                  return parseSuccessBody(await response.json(), cveId);
            } catch {
                  return { result: errorResult(cveId, 'invalid-response'), retryable: false };
            }
      }

      async #handleResponse(response: NvdFetchResponse, cveId: string): Promise<AttemptOutcome> {
            const status = response.status ?? 0;
            if (status === 404) return { status: 'not-found', cveId };
            if (!response.ok) return this.#failureForStatus(cveId, status, response);
            return this.#parseBodySafely(response, cveId);
      }

      async #handleFetchOutcome(fetched: NvdFetchResponse | AttemptFailure, cveId: string): Promise<AttemptOutcome> {
            if ('result' in fetched) return fetched;
            return this.#handleResponse(fetched, cveId);
      }

      async #attempt(cveId: string): Promise<AttemptOutcome> {
            const url = new URL(NVD_API_URL);
            url.searchParams.set('cveId', cveId);
            const headers = buildRequestHeaders(this.#apiKey);
            const signal = AbortSignal.timeout(this.#timeoutMs);
            const fetched = await this.#safeFetch(url.toString(), headers, signal, cveId);
            return this.#handleFetchOutcome(fetched, cveId);
      }

      consumeWarnings(): string[] {
            return [...this.#warnings.splice(0), ...this.#cache.consumeWarnings()];
      }
}

export const createNvdClient = (options: NvdClientOptions = {}): NvdClient => new DefaultNvdClient(options);
