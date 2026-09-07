import { Command } from 'commander';
import { expect, it } from 'vitest';
import { withScanOptions } from '../../src/commands/scan/scan-options.js';

it('registers --json and --tests on the given command', () => {
      const command = new Command('fake');

      withScanOptions(command);

      const optionFlags = command.options.map((option) => option.flags);
      expect(optionFlags).toContain('--json');
      expect(optionFlags).toContain('--tests');
});

it('returns the same command instance, so it can be chained', () => {
      const command = new Command('fake');

      expect(withScanOptions(command)).toBe(command);
});
