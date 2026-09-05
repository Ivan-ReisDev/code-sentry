import type { Rule, RuleFinding } from './rule.interface.js';

export const unsafeSqlRule: Rule = {
  id: 'unsafe-sql',
  description: 'Detecta concatenação insegura de SQL (risco de SQL injection)',
  check(_filePath: string, _content: string): RuleFinding[] {
    // TODO: implementar via TDD (ainda sem regra/spec definidos)
    return [];
  },
};
