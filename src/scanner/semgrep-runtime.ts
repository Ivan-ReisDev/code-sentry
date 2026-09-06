import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

interface RuntimeManifest {
      semgrep: string;
}

export interface BundledSemgrepRuntime {
      semgrep: string;
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

export const unsupportedRuntimeMessage = (platform: NodeJS.Platform, architecture: string): string =>
      `O runtime Semgrep embutido não está disponível para ${platform}-${architecture}. ` +
      'O CodeSentry oferece suporte a Linux x64 e Windows x64.';

export const resolveBundledSemgrepRuntime = (
      platform: NodeJS.Platform = process.platform,
      architecture: string = process.arch,
      resolveManifestPath: (packageName: string) => string = (packageName) =>
            require.resolve(`${packageName}/runtime.json`),
): BundledSemgrepRuntime => {
      const packageName = packageForPlatform(platform, architecture);
      if (!packageName) {
            throw new Error(unsupportedRuntimeMessage(platform, architecture));
      }

      try {
            const manifestPath = resolveManifestPath(packageName);
            const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as RuntimeManifest;
            const runtime = {
                  semgrep: resolve(dirname(manifestPath), manifest.semgrep),
            };
            if (!existsSync(runtime.semgrep)) {
                  throw new Error('artefatos do runtime ausentes');
            }
            return runtime;
      } catch (error) {
            const reason = error instanceof Error ? error.message : 'erro desconhecido';
            throw new Error(`Não foi possível carregar o runtime Semgrep embutido: ${reason}`, { cause: error });
      }
};
