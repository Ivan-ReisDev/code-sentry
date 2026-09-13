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

const COMMANDS_WITHOUT_TESTS_OPTION = new Set(['init', 'rules', 'help', 'dependency-audit', 'version']);

it('registers --tests on every scan/rule command, except commands that never read source files', () => {
      const program = createCli();

      const commandsMissingTestsOption = program.commands
            .filter((command) => !COMMANDS_WITHOUT_TESTS_OPTION.has(command.name()))
            .filter((command) => !command.options.some((option) => option.flags === '--tests'))
            .map((command) => command.name());

      expect(commandsMissingTestsOption).toEqual([]);
});

it('registers --no-deps on scan only, since it is the only command that should run the dependency audit', () => {
      const program = createCli();

      const commandsWithDepsOption = program.commands
            .filter((command) => command.options.some((option) => option.flags.includes('--no-deps')))
            .map((command) => command.name());

      expect(commandsWithDepsOption).toEqual(['scan']);
});

it('registers standalone commands for weak-cipher-mode and hardcoded-authorization-value', () => {
      const program = createCli();

      const commandNames = program.commands.map((command) => command.name());

      expect(commandNames).toContain('weak-cipher-mode');
      expect(commandNames).toContain('hardcoded-authorization-value');
      expect(commandNames).toContain('version');
});
