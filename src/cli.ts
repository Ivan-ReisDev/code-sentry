import { Command } from 'commander';
import figlet from 'figlet';
import gradient from 'gradient-string';
import { registerDeepNestingCommand } from './commands/deep-nesting/deep-nesting.command.js';
import { registerEmptyCatchCommand } from './commands/empty-catch/empty-catch.command.js';
import { registerHelpCommand } from './commands/help/help.command.js';
import { registerHighComplexityCommand } from './commands/high-complexity/high-complexity.command.js';
import { registerInitCommand } from './commands/init/init.command.js';
import { registerLongFunctionsCommand } from './commands/long-functions/long-functions.command.js';
import { registerNoAnyCommand } from './commands/no-any/no-any.command.js';
import { registerRulesCommand } from './commands/rules/rules.command.js';
import { registerScanCommand } from './commands/scan/scan.command.js';
import { registerTooManyForLoopsCommand } from './commands/too-many-for-loops/too-many-for-loops.command.js';
import { registerTooManyIfsCommand } from './commands/too-many-ifs/too-many-ifs.command.js';
import { registerTooManySwitchCasesCommand } from './commands/too-many-switch-cases/too-many-switch-cases.command.js';
import { registerTooManyTryCatchCommand } from './commands/too-many-try-catch/too-many-try-catch.command.js';
import { registerTooManyWhileLoopsCommand } from './commands/too-many-while-loops/too-many-while-loops.command.js';
import { registerUnhandledPromisesCommand } from './commands/unhandled-promises/unhandled-promises.command.js';

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
  registerTooManyIfsCommand(program);
  registerTooManyForLoopsCommand(program);
  registerTooManyWhileLoopsCommand(program);
  registerTooManyTryCatchCommand(program);
  registerTooManySwitchCasesCommand(program);
  registerUnhandledPromisesCommand(program);
  registerNoAnyCommand(program);
  registerEmptyCatchCommand(program);
  registerHelpCommand(program);

  return program;
};
