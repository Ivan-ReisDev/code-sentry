import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

interface PackageJson {
      version: string;
      dependencies: Record<string, string>;
}

it('depends on codesentry-semgrep-rules pinned to this exact release version', () => {
      // resolveBundledSemgrepRuleset() requires this package unconditionally (it
      // is not optional like the platform runtimes) — if this entry is ever
      // silently dropped from package.json again, every `codesentry scan` fails
      // with "Cannot find module 'codesentry-semgrep-rules/rules/owasp.yml'"
      // instead of npm installing it. This happened once already, apparently
      // from a concurrent edit to this same file during a version bump.
      const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8')) as PackageJson;

      expect(pkg.dependencies['codesentry-semgrep-rules']).toBe(pkg.version);
});
