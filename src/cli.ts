import { Command } from 'commander';
import figlet from 'figlet';
import gradient from 'gradient-string';
import { registerInitCommand } from './commands/init.command.js';
import { registerRulesCommand } from './commands/rules.command.js';
import { registerScanCommand } from './commands/scan.command.js';

function printBanner(): void {
  if (!process.stdout.isTTY) {
    return;
  }

  const banner = figlet.textSync('CodeSentry', { font: 'Standard' });
  console.log(gradient(['cyan', 'magenta'])(banner));
}

export function createCli(): Command {
  printBanner();

  const program = new Command();

  program
    .name('codesentry')
    .description('CLI de verificação de vulnerabilidades e qualidade de código')
    .version('0.1.0');

  registerScanCommand(program);
  registerInitCommand(program);
  registerRulesCommand(program);

  return program;
}
