import { Command } from 'commander';
import figlet from 'figlet';
import gradient from 'gradient-string';
import { registerDeepNestingCommand } from './commands/deep-nesting/deep-nesting.command.js';
import { registerHelpCommand } from './commands/help/help.command.js';
import { registerHighComplexityCommand } from './commands/high-complexity/high-complexity.command.js';
import { registerInitCommand } from './commands/init/init.command.js';
import { registerLongFunctionsCommand } from './commands/long-functions/long-functions.command.js';
import { registerRulesCommand } from './commands/rules/rules.command.js';
import { registerScanCommand } from './commands/scan/scan.command.js';

const printBanner = (): void => {
  if (!process.stdout.isTTY) {
    return;
  }

  const banner = figlet.textSync('CodeSentry', { font: 'Standard' });
  console.log(gradient(['cyan', 'magenta'])(banner));
};

export const createCli = (): Command => {
  printBanner();

  const program = new Command();

  program
    .name('codesentry')
    .description('CLI de verificação de vulnerabilidades e qualidade de código')
    .version('0.1.0')
    .helpCommand(false);

  registerScanCommand(program);
  registerInitCommand(program);
  registerRulesCommand(program);
  registerLongFunctionsCommand(program);
  registerDeepNestingCommand(program);
  registerHighComplexityCommand(program);
  registerHelpCommand(program);

  return program;
};
