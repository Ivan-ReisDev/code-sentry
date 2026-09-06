import { parseSourceFile, type SourceNode, visitSourceNodes } from '../parser/source-file.js';
import type { Rule, RuleFinding } from './rule.interface.js';

const CIPHER_METHOD_NAMES = new Set(['createCipheriv', 'createDecipheriv']);
const WEAK_MODE_PATTERN = /-(cbc|ecb)$/i;

const isWeakCipherModeCall = (node: SourceNode): boolean => {
      if (node.type !== 'CallExpression') {
            return false;
      }
      const callee = node.callee as SourceNode | undefined;
      if (callee?.type !== 'MemberExpression') {
            return false;
      }
      const property = callee.property as SourceNode | undefined;
      if (property?.type !== 'Identifier' || !CIPHER_METHOD_NAMES.has(property.name as string)) {
            return false;
      }
      const args = node.arguments as SourceNode[] | undefined;
      const algorithm = args?.[0];
      return algorithm?.type === 'StringLiteral' && WEAK_MODE_PATTERN.test(algorithm.value as string);
};

const findWeakCipherModeLines = (filePath: string, content: string): number[] => {
      const lines = new Set<number>();
      const sourceFile = parseSourceFile(filePath, content);

      visitSourceNodes(sourceFile, (node) => {
            if (isWeakCipherModeCall(node) && node.loc) {
                  lines.add(node.loc.start.line);
            }
      });
      return [...lines].sort((a, b) => a - b);
};

export const weakCipherModeRule: Rule = {
      id: 'weak-cipher-mode',
      description: 'Detecta cifragem em modo não autenticado (CBC/ECB) sem AEAD/HMAC associado',
      check(filePath: string, content: string): RuleFinding[] {
            return findWeakCipherModeLines(filePath, content).map((line) => ({
                  ruleId: 'weak-cipher-mode',
                  message: 'Modo de cifra sem autenticação (CBC/ECB) — considere um modo AEAD como GCM',
                  file: filePath,
                  line,
                  severity: 'high',
            }));
      },
};
