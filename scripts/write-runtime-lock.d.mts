export interface RuntimeLockInput {
      semgrepVersion: string;
      pythonVersion: string;
      runtimeSha256: string;
}

export declare const buildRuntimeLock: (input: RuntimeLockInput) => {
      schemaVersion: number;
      semgrepVersion: string;
      pythonVersion: string;
      runtimeSha256: string;
};
