import type { Command } from 'commander';
import Table from 'cli-table3';
import { allRules } from '../../rules/index.js';

export const registerRulesCommand = (program: Command): void => {
      program
            .command('rules')
            .description('Lista as regras de análise disponíveis')
            .action(() => {
                  const table = new Table({ head: ['ID', 'Descrição'] });

                  for (const rule of allRules) {
                        table.push([rule.id, rule.description]);
                  }

                  console.log(table.toString());
            });
};
