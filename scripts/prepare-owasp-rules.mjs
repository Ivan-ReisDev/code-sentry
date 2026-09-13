import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const fetchOwaspRuleset = async (source, fetchImpl = fetch) => {
      const response = await fetchImpl(source, {
            headers: { Accept: 'text/yaml', 'Accept-Encoding': 'identity' },
      });
      if (!response.ok) {
            throw new Error(`Não foi possível baixar o ruleset OWASP (${response.status}).`);
      }
      const ruleset = await response.text();
      if (!ruleset.includes('rules:')) {
            throw new Error('O conteúdo recebido não parece ser um ruleset Semgrep.');
      }
      const sha256 = createHash('sha256').update(ruleset).digest('hex');
      return { ruleset, sha256 };
};

export const buildRulesetLock = ({ packageVersion, source, sha256, capturedAt, upstreamRevision }) => ({
      schemaVersion: 1,
      packageVersion,
      ruleset: 'p/owasp-top-ten',
      source,
      sha256,
      capturedAt,
      ...(upstreamRevision ? { upstreamRevision } : {}),
});

const isMainModule = () =>
      process.env.VITEST === undefined &&
      process.argv[1] !== undefined &&
      import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule()) {
      const output = resolve('packages/semgrep-rules/rules/owasp.yml');
      const lockFile = resolve('packages/semgrep-rules/rules/ruleset.lock.json');
      const packageJsonFile = resolve('packages/semgrep-rules/package.json');
      const source = process.env.SEMGREP_OWASP_SOURCE ?? 'https://semgrep.dev/c/p/owasp-top-ten';

      const { ruleset, sha256 } = await fetchOwaspRuleset(source);
      const { version: packageVersion } = JSON.parse(await readFile(packageJsonFile, 'utf8'));
      const lock = buildRulesetLock({
            packageVersion,
            source,
            sha256,
            capturedAt: new Date().toISOString(),
            upstreamRevision: process.env.SEMGREP_OWASP_REVISION,
      });
      await mkdir(dirname(output), { recursive: true });
      await writeFile(output, ruleset, 'utf8');
      await writeFile(lockFile, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
      console.log(`Ruleset OWASP fixado: ${sha256}`);
}
