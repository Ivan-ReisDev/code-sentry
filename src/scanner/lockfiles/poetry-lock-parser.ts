import { parse } from 'smol-toml';
import type { LockedPackage } from './locked-package.js';
import { normalizePyPiName } from './pypi-name.js';

const LOCKFILE_NAME = 'poetry.lock';
const UNRESOLVABLE_SOURCE_TYPES = new Set(['directory', 'file', 'url', 'git']);

interface PoetryPackageEntry {
      name?: unknown;
      version?: unknown;
      source?: { type?: unknown };
}

interface PoetryLockFile {
      package?: unknown;
}

const isUnresolvableSource = (entry: PoetryPackageEntry): boolean => {
      const type = entry.source?.type;
      return typeof type === 'string' && UNRESOLVABLE_SOURCE_TYPES.has(type);
};

const toLockedPackage = (entry: PoetryPackageEntry): LockedPackage | undefined => {
      if (typeof entry.name !== 'string' || typeof entry.version !== 'string' || isUnresolvableSource(entry)) {
            return undefined;
      }
      return {
            name: normalizePyPiName(entry.name),
            version: entry.version,
            ecosystem: 'PyPI',
            lockfile: LOCKFILE_NAME,
      };
};

export const parsePoetryLock = (raw: string): LockedPackage[] => {
      const parsed = parse(raw) as PoetryLockFile;
      const entries = Array.isArray(parsed.package) ? (parsed.package as PoetryPackageEntry[]) : [];

      const deduped = new Map<string, LockedPackage>();
      for (const entry of entries) {
            const locked = toLockedPackage(entry);
            if (locked) {
                  deduped.set(`${locked.name}@${locked.version}`, locked);
            }
      }
      return [...deduped.values()];
};
