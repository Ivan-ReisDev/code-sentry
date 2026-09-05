import type { Command } from 'commander';
import { confirm, intro, isCancel, outro, text } from '@clack/prompts';
import chalk from 'chalk';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Configura o CodeSentry no projeto atual (interativo)')
    .action(async () => {
      intro(chalk.cyan('CodeSentry — configuração inicial'));

      const include = await text({
        message: 'Quais extensões de arquivo devem ser analisadas?',
        placeholder: '.ts,.js',
        defaultValue: '.ts,.js',
      });

      if (isCancel(include)) {
        outro('Cancelado.');
        return;
      }

      const shouldSave = await confirm({
        message: 'Salvar essa configuração?',
      });

      if (isCancel(shouldSave)) {
        outro('Cancelado.');
        return;
      }

      // TODO: persistir em .codesentryrc.json via TDD (config.ts ainda é um stub).
      outro(
        shouldSave
          ? chalk.green(`Configuração recebida (${include}). Persistência em arquivo ainda não implementada.`)
          : 'Configuração descartada.',
      );
    });
}
