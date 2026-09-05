import type { Rule, RuleFinding } from './rule.interface.js';

export const noHardcodedSecretRule: Rule = {
  id: 'no-hardcoded-secret',
  description: 'Detecta segredos/credenciais hardcoded no código-fonte',
  check(_filePath: string, _content: string): RuleFinding[] {
    // TODO: implementar via TDD (ainda sem regra/spec definidos)
    return [];
  },
};
