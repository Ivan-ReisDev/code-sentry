import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { buildRulesetLock, fetchOwaspRuleset } from '../../scripts/prepare-owasp-rules.mjs';

const yamlRuleset = 'rules:\n- id: test-rule\n';

it('requests the ruleset as YAML explicitly, instead of relying on default content negotiation', async () => {
      let receivedHeaders: Record<string, string> | undefined;
      const fetchImpl = async (_url: string, init?: { headers?: Record<string, string> }) => {
            receivedHeaders = init?.headers;
            return { ok: true, text: async () => yamlRuleset };
      };

      await fetchOwaspRuleset('https://semgrep.dev/c/p/owasp-top-ten', fetchImpl);

      expect(receivedHeaders).toMatchObject({ Accept: 'text/yaml' });
});

it('disables compression negotiation, since the CDN caches JSON and YAML variants under the same Accept-Encoding key', async () => {
      let receivedHeaders: Record<string, string> | undefined;
      const fetchImpl = async (_url: string, init?: { headers?: Record<string, string> }) => {
            receivedHeaders = init?.headers;
            return { ok: true, text: async () => yamlRuleset };
      };

      await fetchOwaspRuleset('https://semgrep.dev/c/p/owasp-top-ten', fetchImpl);

      expect(receivedHeaders).toMatchObject({ 'Accept-Encoding': 'identity' });
});

it('rejects a response that is not a YAML ruleset even when the request succeeds', async () => {
      const fetchImpl = async () => ({ ok: true, text: async () => '{"rules":[]}' });

      await expect(fetchOwaspRuleset('https://semgrep.dev/c/p/owasp-top-ten', fetchImpl)).rejects.toThrow(
            'não parece ser um ruleset Semgrep',
      );
});

it('throws with the HTTP status when the download fails', async () => {
      const fetchImpl = async () => ({ ok: false, status: 404 });

      await expect(fetchOwaspRuleset('https://semgrep.dev/c/p/owasp-top-ten', fetchImpl)).rejects.toThrow('404');
});

it('returns the fetched ruleset alongside its sha256', async () => {
      const fetchImpl = async () => ({ ok: true, text: async () => yamlRuleset });

      const result = await fetchOwaspRuleset('https://semgrep.dev/c/p/owasp-top-ten', fetchImpl);

      expect(result).toEqual({
            ruleset: yamlRuleset,
            sha256: createHash('sha256').update(yamlRuleset).digest('hex'),
      });
});

it('records the ruleset provenance required by the published package', () => {
      expect(
            buildRulesetLock({
                  packageVersion: '0.1.12',
                  source: 'https://semgrep.dev/c/p/owasp-top-ten',
                  sha256: '0d7257a1e5af0bfccae7fbbf4d446565126fd226567a0e2c7e00efdf1cae6351',
                  capturedAt: '2026-09-13T12:00:00.000Z',
                  upstreamRevision: 'registry-revision-42',
            }),
      ).toEqual({
            schemaVersion: 1,
            packageVersion: '0.1.12',
            ruleset: 'p/owasp-top-ten',
            source: 'https://semgrep.dev/c/p/owasp-top-ten',
            sha256: '0d7257a1e5af0bfccae7fbbf4d446565126fd226567a0e2c7e00efdf1cae6351',
            capturedAt: '2026-09-13T12:00:00.000Z',
            upstreamRevision: 'registry-revision-42',
      });
});
