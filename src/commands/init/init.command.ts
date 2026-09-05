import type { Command } from 'commander';
import { confirm, intro, isCancel, outro, text } from '@clack/prompts';
import chalk from 'chalk';

interface InitAnswers {
  include: string;
  shouldSave: boolean;
}

const collectAnswers = async (): Promise<InitAnswers | undefined> => {
  const include = await text({
    message: 'Quais extensões de arquivo devem ser analisadas?',
    placeholder: '.ts,.js',
    defaultValue: '.ts,.js',
  });
  if (isCancel(include)) {
    return undefined;
  }

  const shouldSave = await confirm({ message: 'Salvar essa configuração?' });
  if (isCancel(shouldSave)) {
    return undefined;
  }
  return { include, shouldSave };
};

const printOutcome = ({ include, shouldSave }: InitAnswers): void => {
  // TODO: persistir em .codesentryrc.json via TDD (config.ts ainda é um stub).
  const message = shouldSave
    ? chalk.green(`Configuração recebida (${include}). Persistência em arquivo ainda não implementada.`)
    : 'Configuração descartada.';
  outro(message);
};

const runInit = async (): Promise<void> => {
  intro(chalk.cyan('CodeSentry — configuração inicial'));
  const answers = await collectAnswers();
  if (!answers) {
    outro('Cancelado.');
    return;
  }
  printOutcome(answers);
};

export const registerInitCommand = (program: Command): void => {
  program
    .command('init')
    .description('Configura o CodeSentry no projeto atual (interativo)')
    .action(async () => {
      await runInit();
    });
};
