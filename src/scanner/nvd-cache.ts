import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import type { NvdLookupResult, NvdVulnerabilityData } from '../rules/rule.interface.js';

const CACHE_SCHEMA_VERSION = 1;
const FOUND_TTL_MS = 24 * 60 * 60 * 1_000;
const NOT_FOUND_TTL_MS = 60 * 60 * 1_000;

type CacheableNvdResult = Extract<NvdLookupResult, { status: 'found' | 'not-found' }>;

interface StoredEntry {
      expiresAt: number;
      result: CacheableNvdResult;
}

interface CacheFile {
      schemaVersion: number;
      entries: Record<string, StoredEntry>;
}

export interface NvdCache {
      get(cveId: string): Promise<CacheableNvdResult | undefined>;
      set(result: NvdLookupResult): Promise<void>;
      consumeWarnings(): string[];
}

export interface NvdCacheOptions {
      filePath?: string;
      now?: () => number;
}

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null;

const defaultCacheFile = (): string => {
      if (process.platform === 'win32') {
            return join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'CodeSentry', 'nvd-v1.json');
      }
      if (process.platform === 'darwin') {
            return join(homedir(), 'Library', 'Caches', 'CodeSentry', 'nvd-v1.json');
      }
      return join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'codesentry', 'nvd-v1.json');
};

const isValidReference = (value: unknown): boolean => isRecord(value) && typeof value.url === 'string';

const isNvdData = (value: unknown, cveId: string): value is NvdVulnerabilityData =>
      isRecord(value) &&
      value.id === cveId &&
      Array.isArray(value.cwes) &&
      value.cwes.every((item) => typeof item === 'string') &&
      Array.isArray(value.references) &&
      value.references.every(isValidReference);

const isStoredEnvelope = (value: unknown): value is { expiresAt: number; result: UnknownRecord } =>
      isRecord(value) && typeof value.expiresAt === 'number' && isRecord(value.result);

const parseFoundResult = (cveId: string, result: UnknownRecord): CacheableNvdResult | undefined =>
      result.status === 'found' && isNvdData(result.data, cveId)
            ? { status: 'found', cveId, data: result.data }
            : undefined;

const parseStoredResult = (cveId: string, result: UnknownRecord): CacheableNvdResult | undefined => {
      if (result.cveId !== cveId) return undefined;
      if (result.status === 'not-found') return { status: 'not-found', cveId };
      return parseFoundResult(cveId, result);
};

const parseStoredEntry = (cveId: string, value: unknown): StoredEntry | undefined => {
      if (!isStoredEnvelope(value)) return undefined;
      const result = parseStoredResult(cveId, value.result);
      return result ? { expiresAt: value.expiresAt, result } : undefined;
};

interface ParsedCacheFile {
      entries: Map<string, StoredEntry>;
      incompatible: boolean;
}

const parseCacheFileBody = (parsed: unknown, now: number): ParsedCacheFile => {
      if (!isRecord(parsed) || parsed.schemaVersion !== CACHE_SCHEMA_VERSION || !isRecord(parsed.entries)) {
            return { entries: new Map(), incompatible: true };
      }
      const entries = new Map<string, StoredEntry>();
      for (const [cveId, value] of Object.entries(parsed.entries)) {
            const entry = parseStoredEntry(cveId, value);
            if (entry && entry.expiresAt > now) entries.set(cveId, entry);
      }
      return { entries, incompatible: false };
};

const cleanCacheableResult = (
      result: Extract<NvdLookupResult, { status: 'found' | 'not-found' }>,
): CacheableNvdResult =>
      result.status === 'found'
            ? { status: 'found', cveId: result.cveId, data: result.data }
            : { status: 'not-found', cveId: result.cveId };

const toStoredEntry = (result: CacheableNvdResult, now: number): StoredEntry => ({
      expiresAt: now + (result.status === 'found' ? FOUND_TTL_MS : NOT_FOUND_TTL_MS),
      result,
});

class PersistentNvdCache implements NvdCache {
      readonly #filePath: string;
      readonly #now: () => number;
      readonly #entries = new Map<string, StoredEntry>();
      readonly #warnings: string[] = [];
      #loadPromise?: Promise<void>;
      #writeCounter = 0;
      #writeQueue: Promise<void> = Promise.resolve();

      constructor(options: NvdCacheOptions) {
            this.#filePath = options.filePath ?? defaultCacheFile();
            this.#now = options.now ?? Date.now;
      }

      async #loadFromDisk(): Promise<void> {
            try {
                  // codesentry-disable-next-line security/detect-non-literal-fs-filename -- path is an internal cache path or an injected test path.
                  const raw = await readFile(this.#filePath, 'utf-8');
                  const parsed = JSON.parse(raw) as unknown;
                  const { entries, incompatible } = parseCacheFileBody(parsed, this.#now());
                  if (incompatible) {
                        this.#warnings.push('O cache do NVD possui versão ou formato incompatível e foi ignorado.');
                        return;
                  }
                  entries.forEach((entry, cveId) => this.#entries.set(cveId, entry));
            } catch (error) {
                  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                        this.#warnings.push('Não foi possível ler o cache do NVD; as consultas continuarão sem ele.');
                  }
            }
      }

      async #load(): Promise<void> {
            this.#loadPromise ??= this.#loadFromDisk();
            await this.#loadPromise;
      }

      async get(cveId: string): Promise<CacheableNvdResult | undefined> {
            await this.#load();
            const entry = this.#entries.get(cveId);
            if (!entry) return undefined;
            if (entry.expiresAt <= this.#now()) {
                  this.#entries.delete(cveId);
                  return undefined;
            }
            return { ...entry.result, fromCache: true };
      }

      async set(result: NvdLookupResult): Promise<void> {
            if (result.status === 'error') return;
            await this.#load();
            const entry = toStoredEntry(cleanCacheableResult(result), this.#now());
            this.#entries.set(result.cveId, entry);
            this.#writeQueue = this.#writeQueue.then(() => this.#persist()).catch(() => undefined);
            await this.#writeQueue;
      }

      async #persist(): Promise<void> {
            try {
                  const directory = dirname(this.#filePath);
                  // codesentry-disable-next-line security/detect-non-literal-fs-filename -- path is an internal cache path or an injected test path.
                  await mkdir(directory, { recursive: true });
                  const entries = Object.fromEntries(this.#entries);
                  const body: CacheFile = { schemaVersion: CACHE_SCHEMA_VERSION, entries };
                  const temporary = `${this.#filePath}.${process.pid}.${this.#writeCounter++}.tmp`;
                  // codesentry-disable-next-line security/detect-non-literal-fs-filename -- path is an internal cache path or an injected test path.
                  await writeFile(temporary, JSON.stringify(body, null, 2), { encoding: 'utf-8', mode: 0o600 });
                  // codesentry-disable-next-line security/detect-non-literal-fs-filename -- both paths are the same internal cache path (plus a fixed temp suffix) or an injected test path.
                  await rename(temporary, this.#filePath);
            } catch {
                  this.#warnings.push('Não foi possível gravar o cache do NVD; o scan continuará normalmente.');
            }
      }

      consumeWarnings(): string[] {
            return this.#warnings.splice(0);
      }
}

export const createNvdCache = (options: NvdCacheOptions = {}): NvdCache => new PersistentNvdCache(options);
