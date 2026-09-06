import type { Command } from 'commander';
import Table from 'cli-table3';

export interface HelpCommandInfo {
      name: string;
      description: string;
}

export const buildHelpTable = (commands: HelpCommandInfo[]): string => {
      const table = new Table({ head: ['Comando', 'Descrição'] });

      for (const command of commands) {
            table.push([command.name, command.description]);
      }

      return table.toString();
};

export const registerHelpCommand = (program: Command): void => {
      program
            .command('help')
            .description('Lista os comandos disponíveis')
            .action(() => {
                  const commands = program.commands
                        .filter((command) => command.name() !== 'help')
                        .map((command) => ({ name: command.name(), description: command.description() }));

                  console.log(buildHelpTable(commands));
            });
};
