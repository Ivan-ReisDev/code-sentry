import { Command } from 'commander';
import figlet from 'figlet';
import gradient from 'gradient-string';
import { registerCommandInjectionCommand } from './commands/command-injection/command-injection.command.js';
import { registerDeepNestingCommand } from './commands/deep-nesting/deep-nesting.command.js';
import { registerDependencyAuditCommand } from './commands/dependency-audit/dependency-audit.command.js';
import { registerEmptyCatchCommand } from './commands/empty-catch/empty-catch.command.js';
import { registerExpressMissingBodyLimitCommand } from './commands/express-missing-body-limit/express-missing-body-limit.command.js';
import { registerHelpCommand } from './commands/help/help.command.js';
import { registerHighComplexityCommand } from './commands/high-complexity/high-complexity.command.js';
import { registerInitCommand } from './commands/init/init.command.js';
import { registerInsecureRandomTokenCommand } from './commands/insecure-random-token/insecure-random-token.command.js';
import { registerJwtNoExpirationCommand } from './commands/jwt-no-expiration/jwt-no-expiration.command.js';
import { registerLongFunctionsCommand } from './commands/long-functions/long-functions.command.js';
import { registerNoAnyCommand } from './commands/no-any/no-any.command.js';
import { registerNoEvalCommand } from './commands/no-eval/no-eval.command.js';
import { registerNoHardcodedSecretCommand } from './commands/no-hardcoded-secret/no-hardcoded-secret.command.js';
import { registerPermissiveCorsCommand } from './commands/permissive-cors/permissive-cors.command.js';
import { registerRulesCommand } from './commands/rules/rules.command.js';
import { registerScanCommand } from './commands/scan/scan.command.js';
import { registerSecurityLintCommand } from './commands/security-lint/security-lint.command.js';
import { registerTlsValidationDisabledCommand } from './commands/tls-validation-disabled/tls-validation-disabled.command.js';
import { registerTooManyForLoopsCommand } from './commands/too-many-for-loops/too-many-for-loops.command.js';
import { registerTooManyIfsCommand } from './commands/too-many-ifs/too-many-ifs.command.js';
import { registerTooManySwitchCasesCommand } from './commands/too-many-switch-cases/too-many-switch-cases.command.js';
import { registerTooManyTryCatchCommand } from './commands/too-many-try-catch/too-many-try-catch.command.js';
import { registerTooManyWhileLoopsCommand } from './commands/too-many-while-loops/too-many-while-loops.command.js';
import { registerUnhandledPromisesCommand } from './commands/unhandled-promises/unhandled-promises.command.js';
import { registerUnsafeSqlCommand } from './commands/unsafe-sql/unsafe-sql.command.js';
import { registerWeakHashAlgorithmCommand } from './commands/weak-hash-algorithm/weak-hash-algorithm.command.js';
import { registerXssCommand } from './commands/xss/xss.command.js';

const printBanner = (): void => {
  if (!process.stdout.isTTY) {
    return;
  }

  const banner = figlet.textSync('CodeSentry', { font: 'Standard' });
  console.log(gradient(['cyan', 'magenta'])(banner));
};

const registerAnalysisCommands = (program: Command): void => {
  registerScanCommand(program);
  registerLongFunctionsCommand(program);
  registerDeepNestingCommand(program);
  registerHighComplexityCommand(program);
  registerTooManyIfsCommand(program);
  registerTooManyForLoopsCommand(program);
  registerTooManyWhileLoopsCommand(program);
  registerTooManyTryCatchCommand(program);
  registerTooManySwitchCasesCommand(program);
};

const registerQualityCommands = (program: Command): void => {
  registerUnhandledPromisesCommand(program);
  registerNoAnyCommand(program);
  registerEmptyCatchCommand(program);
  registerRulesCommand(program);
  registerHelpCommand(program);
};

const registerSecurityCommands = (program: Command): void => {
  registerNoEvalCommand(program);
  registerCommandInjectionCommand(program);
  registerUnsafeSqlCommand(program);
  registerJwtNoExpirationCommand(program);
  registerNoHardcodedSecretCommand(program);
  registerPermissiveCorsCommand(program);
  registerInsecureRandomTokenCommand(program);
  registerWeakHashAlgorithmCommand(program);
  registerTlsValidationDisabledCommand(program);
  registerExpressMissingBodyLimitCommand(program);
  registerXssCommand(program);
  registerSecurityLintCommand(program);
  registerDependencyAuditCommand(program);
};

export const createCli = (): Command => {
  printBanner();

  const program = new Command()
    .name('codesentry')
    .description('CLI de verificação de vulnerabilidades e qualidade de código')
    .version('0.1.0')
    .helpCommand(false);

  registerInitCommand(program);
  registerAnalysisCommands(program);
  registerQualityCommands(program);
  registerSecurityCommands(program);

  return program;
};
