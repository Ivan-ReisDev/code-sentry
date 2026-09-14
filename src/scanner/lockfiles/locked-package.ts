export type Ecosystem = 'npm' | 'PyPI';

export interface LockedPackage {
      name: string;
      version: string;
      ecosystem: Ecosystem;
      /** Lockfile the entry came from — becomes `file` on the resulting finding. */
      lockfile: string;
}
