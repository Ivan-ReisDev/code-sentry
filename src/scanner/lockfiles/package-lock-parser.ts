import type { LockedPackage } from './locked-package.js';

export type { LockedPackage } from './locked-package.js';

const LOCKFILE_NAME = 'package-lock.json';

interface LockPackageEntry {
      name?: string;
      version?: string;
      resolved?: string;
      link?: boolean;
}

interface PackageLockFile {
      lockfileVersion: number;
      packages?: Record<string, LockPackageEntry>;
}

const NODE_MODULES_SEGMENT = 'node_modules/';

const isUnresolvableSource = (resolved: string | undefined): boolean =>
      resolved !== undefined && (resolved.startsWith('file:') || resolved.startsWith('git'));

const nameFromKey = (key: string): string | undefined => {
      const lastIndex = key.lastIndexOf(NODE_MODULES_SEGMENT);
      return lastIndex === -1 ? undefined : key.slice(lastIndex + NODE_MODULES_SEGMENT.length);
};

const toLockedPackage = (key: string, entry: LockPackageEntry): LockedPackage | undefined => {
      if (entry.link || !entry.version || isUnresolvableSource(entry.resolved)) {
            return undefined;
      }
      const name = entry.name ?? nameFromKey(key);
      return name ? { name, version: entry.version, ecosystem: 'npm', lockfile: LOCKFILE_NAME } : undefined;
};

const assertSupportedLockfileVersion = (lockfileVersion: number): void => {
      if (lockfileVersion !== 2 && lockfileVersion !== 3) {
            throw new Error('lockfileVersion 1 não é suportado — regenere o lockfile com npm 7+.');
      }
};

export const parsePackageLock = (rawJson: string): LockedPackage[] => {
      const parsed = JSON.parse(rawJson) as PackageLockFile;
      assertSupportedLockfileVersion(parsed.lockfileVersion);

      const deduped = new Map<string, LockedPackage>();
      Object.entries(parsed.packages ?? {})
            .filter(([key]) => key.includes(NODE_MODULES_SEGMENT))
            .forEach(([key, entry]) => {
                  const locked = toLockedPackage(key, entry);
                  if (locked) {
                        deduped.set(`${locked.name}@${locked.version}`, locked);
                  }
            });
      return [...deduped.values()];
};
