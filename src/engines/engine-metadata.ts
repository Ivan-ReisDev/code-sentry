import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

export interface SemgrepRuntimeMetadata {
      packageName: string;
      semgrepVersion: string;
      pythonVersion: string;
      runtimeSha256: string;
}

export interface OwaspRulesetMetadata {
      packageVersion: string;
      ruleset: string;
      source: string;
      sha256: string;
      capturedAt: string;
      upstreamRevision?: string;
}

export interface EngineMetadata {
      semgrep: SemgrepRuntimeMetadata;
      owaspRuleset: OwaspRulesetMetadata;
}

interface RuntimeLock {
      schemaVersion: number;
      semgrepVersion: string;
      pythonVersion: string;
      runtimeSha256: string;
}

interface RulesetLock {
      schemaVersion: number;
      packageVersion: string;
      ruleset: string;
      source: string;
      sha256: string;
      capturedAt: string;
      upstreamRevision?: string;
}

const require = createRequire(import.meta.url);

const packageForPlatform = (platform: NodeJS.Platform, architecture: string): string | undefined => {
      if (platform === 'linux' && architecture === 'x64') {
            return 'codesentry-semgrep-linux-x64';
      }
      if (platform === 'win32' && architecture === 'x64') {
            return 'codesentry-semgrep-win32-x64';
      }
      return undefined;
};

const unsupportedRuntimeMessage = (platform: NodeJS.Platform, architecture: string): string =>
      `O runtime Semgrep embutido não está disponível para ${platform}-${architecture}. ` +
      'O CodeSentry oferece suporte a Linux x64 e Windows x64.';

const readJsonFile = <T>(path: string): T => {
      // codesentry-disable-next-line security/detect-non-literal-fs-filename -- paths are resolved from package exports or injected by tests.
      return JSON.parse(readFileSync(path, 'utf-8')) as T;
};

const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

const validRuntimeLock = (lock: RuntimeLock): boolean =>
      lock.schemaVersion === 1 &&
      nonEmptyString(lock.semgrepVersion) &&
      nonEmptyString(lock.pythonVersion) &&
      /^[a-f0-9]{64}$/i.test(lock.runtimeSha256);

const validRulesetLock = (lock: RulesetLock): boolean =>
      lock.schemaVersion === 1 &&
      nonEmptyString(lock.packageVersion) &&
      nonEmptyString(lock.ruleset) &&
      nonEmptyString(lock.source) &&
      /^[a-f0-9]{64}$/i.test(lock.sha256) &&
      nonEmptyString(lock.capturedAt) &&
      !Number.isNaN(Date.parse(lock.capturedAt)) &&
      (lock.upstreamRevision === undefined || nonEmptyString(lock.upstreamRevision));

export const loadBundledSemgrepRuntimeMetadata = (
      platform: NodeJS.Platform = process.platform,
      architecture: string = process.arch,
      resolveLockPath: (packageName: string) => string = (packageName) =>
            require.resolve(`${packageName}/runtime.lock.json`),
): SemgrepRuntimeMetadata => {
      const packageName = packageForPlatform(platform, architecture);
      if (!packageName) {
            throw new Error(unsupportedRuntimeMessage(platform, architecture));
      }

      try {
            const lock = readJsonFile<RuntimeLock>(resolveLockPath(packageName));
            if (!validRuntimeLock(lock)) {
                  throw new Error('manifesto de versão inválido');
            }
            return {
                  packageName,
                  semgrepVersion: lock.semgrepVersion,
                  pythonVersion: lock.pythonVersion,
                  runtimeSha256: lock.runtimeSha256,
            };
      } catch (error) {
            const reason = error instanceof Error ? error.message : 'erro desconhecido';
            throw new Error(`Não foi possível carregar os metadados do runtime Semgrep embutido: ${reason}`, {
                  cause: error,
            });
      }
};

export const loadBundledOwaspRulesetMetadata = (
      resolveLockPath: () => string = () => require.resolve('codesentry-semgrep-rules/rules/ruleset.lock.json'),
): OwaspRulesetMetadata => {
      try {
            const lock = readJsonFile<RulesetLock>(resolveLockPath());
            if (!validRulesetLock(lock)) {
                  throw new Error('manifesto de versão inválido');
            }
            return {
                  packageVersion: lock.packageVersion,
                  ruleset: lock.ruleset,
                  source: lock.source,
                  sha256: lock.sha256,
                  capturedAt: lock.capturedAt,
                  ...(lock.upstreamRevision ? { upstreamRevision: lock.upstreamRevision } : {}),
            };
      } catch (error) {
            const reason = error instanceof Error ? error.message : 'erro desconhecido';
            throw new Error(`Não foi possível carregar os metadados do ruleset OWASP embutido: ${reason}`, {
                  cause: error,
            });
      }
};

export const loadEngineMetadata = (): EngineMetadata => ({
      semgrep: loadBundledSemgrepRuntimeMetadata(),
      owaspRuleset: loadBundledOwaspRulesetMetadata(),
});
