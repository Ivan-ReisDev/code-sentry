import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { LockedPackage } from './locked-package.js';
import { osvPackageKey } from '../osv-client.js';
import { parsePackageLock } from './package-lock-parser.js';
import { parsePnpmLock } from './pnpm-lock-parser.js';
import { parseYarnLock } from './yarn-lock-parser.js';
import { parsePoetryLock } from './poetry-lock-parser.js';
import { parseRequirementsTxt } from './requirements-txt-parser.js';

export interface LockfileSource {
      filename: string;
      parse: (raw: string) => LockedPackage[];
}

export const SUPPORTED_LOCKFILES: readonly LockfileSource[] = [
      { filename: 'package-lock.json', parse: parsePackageLock },
      { filename: 'pnpm-lock.yaml', parse: parsePnpmLock },
      { filename: 'yarn.lock', parse: parseYarnLock },
      { filename: 'poetry.lock', parse: parsePoetryLock },
      { filename: 'requirements.txt', parse: parseRequirementsTxt },
];

export interface LockfileDiscovery {
      packages: LockedPackage[];
      lockfilesFound: string[];
      warnings: string[];
}

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : 'erro desconhecido');

const readLockfile = async (targetDir: string, filename: string): Promise<string | undefined> => {
      try {
            // codesentry-disable-next-line security/detect-non-literal-fs-filename -- filename comes from the fixed SUPPORTED_LOCKFILES list, never attacker input.
            return await readFile(join(targetDir, filename), 'utf-8');
      } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
            throw error;
      }
};

export const discoverLockedPackages = async (targetDir: string): Promise<LockfileDiscovery> => {
      const deduped = new Map<string, LockedPackage>();
      const lockfilesFound: string[] = [];
      const warnings: string[] = [];

      for (const source of SUPPORTED_LOCKFILES) {
            try {
                  const raw = await readLockfile(targetDir, source.filename);
                  if (raw === undefined) continue;
                  const packages = source.parse(raw);
                  lockfilesFound.push(source.filename);
                  packages.forEach((pkg) => {
                        const key = osvPackageKey(pkg);
                        if (!deduped.has(key)) deduped.set(key, pkg);
                  });
            } catch (error) {
                  warnings.push(`Não foi possível ler "${source.filename}": ${errorMessage(error)}.`);
            }
      }

      return { packages: [...deduped.values()], lockfilesFound, warnings };
};
