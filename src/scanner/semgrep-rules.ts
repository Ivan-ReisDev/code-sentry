import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** Resolves the ruleset shipped as a package, never from the Semgrep Registry. */
export const resolveBundledSemgrepRuleset = (): string => {
      try {
            const ruleset = require.resolve('codesentry-semgrep-rules/rules/owasp.yml');
            // codesentry-disable-next-line security/detect-non-literal-fs-filename -- require.resolve returns the package-owned ruleset path.
            if (!existsSync(ruleset)) {
                  throw new Error('ruleset ausente');
            }
            return ruleset;
      } catch (error) {
            const reason = error instanceof Error ? error.message : 'erro desconhecido';
            throw new Error(`Não foi possível carregar o ruleset OWASP embutido: ${reason}`, { cause: error });
      }
};
