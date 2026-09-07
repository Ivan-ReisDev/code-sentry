import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { createCli } from '../src/cli.js';

it('reports the actual package.json version instead of a hardcoded one', () => {
      const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8')) as {
            version: string;
      };

      const program = createCli();

      expect(program.version()).toBe(version);
});
