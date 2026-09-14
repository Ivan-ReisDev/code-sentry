import { parse } from 'yaml';
import type { LockedPackage } from './locked-package.js';

const LOCKFILE_NAME = 'pnpm-lock.yaml';

type KeyFormat = 'at' | 'slash';

interface PnpmLockFile {
      lockfileVersion?: unknown;
      packages?: unknown;
}

const keyFormatForVersion = (lockfileVersion: unknown): KeyFormat | undefined => {
      const major = String(lockfileVersion ?? '').split('.')[0];
      if (major === '9' || major === '6') return 'at';
      if (major === '5') return 'slash';
      return undefined;
};

const stripPeerSuffixes = (key: string): string => key.replaceAll(/\([^)]*\)/g, '');

const splitOnLast = (key: string, separator: string): [string, string] | undefined => {
      const index = key.lastIndexOf(separator);
      if (index <= 0) return undefined;
      return [key.slice(0, index), key.slice(index + separator.length)];
};

const parseKey = (rawKey: string, format: KeyFormat): [string, string] | undefined => {
      const key = stripPeerSuffixes(rawKey).replace(/^\//, '');
      return format === 'slash' ? splitOnLast(key, '/') : splitOnLast(key, '@');
};

export const parsePnpmLock = (raw: string): LockedPackage[] => {
      const parsed = parse(raw) as PnpmLockFile;
      const format = keyFormatForVersion(parsed.lockfileVersion);
      if (!format || typeof parsed.packages !== 'object' || parsed.packages === null) {
            return [];
      }

      const deduped = new Map<string, LockedPackage>();
      for (const rawKey of Object.keys(parsed.packages)) {
            const split = parseKey(rawKey, format);
            if (!split) continue;
            const [name, version] = split;
            deduped.set(`${name}@${version}`, { name, version, ecosystem: 'npm', lockfile: LOCKFILE_NAME });
      }
      return [...deduped.values()];
};
