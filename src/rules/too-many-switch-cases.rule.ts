import { parseSourceFile, visitSourceNodes } from '../parser/source-file.js';
import type { Rule, RuleFinding } from './rule.interface.js';

const MAX_CASES = 4;

interface SwitchCaseCount {
      line: number;
      caseCount: number;
}

const findOversizedSwitches = (filePath: string, content: string): SwitchCaseCount[] => {
      const results: SwitchCaseCount[] = [];
      const sourceFile = parseSourceFile(filePath, content);
      visitSourceNodes(sourceFile, (node) => {
            const cases = node.type === 'SwitchStatement' && Array.isArray(node.cases) ? node.cases : [];
            if (cases.length > MAX_CASES && node.loc) {
                  results.push({ line: node.loc.start.line, caseCount: cases.length });
            }
      });
      return results;
};

export const tooManySwitchCasesRule: Rule = {
      id: 'too-many-switch-cases',
      description: 'Detecta "switch" com muitos "case" (considere um mapa/lookup)',
      check(filePath: string, content: string): RuleFinding[] {
            return findOversizedSwitches(filePath, content).map(({ line, caseCount }) => ({
                  ruleId: 'too-many-switch-cases',
                  message: `Switch com ${caseCount} cases — complexidade alta, considere um mapa/lookup em vez de switch (limite recomendado: ${MAX_CASES})`,
                  file: filePath,
                  line,
                  severity: 'low',
            }));
      },
};
