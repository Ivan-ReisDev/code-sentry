import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { fetchOwaspRuleset } from '../../scripts/prepare-owasp-rules.mjs';

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
