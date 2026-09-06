import { describe, expect, it } from 'vitest';
import { buildHelpTable } from '../../src/commands/help/help.command.js';

describe('buildHelpTable', () => {
      it('includes every command name and description in the output', () => {
            const output = buildHelpTable([
                  { name: 'scan', description: 'Analisa um diretório' },
                  { name: 'rules', description: 'Lista as regras' },
            ]);

            expect(output).toContain('scan');
            expect(output).toContain('Analisa um diretório');
            expect(output).toContain('rules');
            expect(output).toContain('Lista as regras');
      });

      it('returns a string even for an empty command list', () => {
            const output = buildHelpTable([]);

            expect(typeof output).toBe('string');
      });
});
