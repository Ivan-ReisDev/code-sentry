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

const COMMANDS_WITHOUT_TESTS_OPTION = new Set(['init', 'rules', 'help', 'dependency-audit']);

it('registers --tests on every scan/rule command, except commands that never read source files', () => {
      const program = createCli();

      const commandsMissingTestsOption = program.commands
            .filter((command) => !COMMANDS_WITHOUT_TESTS_OPTION.has(command.name()))
            .filter((command) => !command.options.some((option) => option.flags === '--tests'))
            .map((command) => command.name());

      expect(commandsMissingTestsOption).toEqual([]);
});
