import type { Rule, RuleFinding } from './rule.interface.js';

const REGEX_PREFIXES = new Set([
  '(',
  '[',
  '{',
  ',',
  ';',
  ':',
  '=',
  '!',
  '?',
  '+',
  '-',
  '*',
  '%',
  '&',
  '|',
  '^',
  '~',
  '<',
  '>',
  'return',
  'throw',
  'case',
  'delete',
  'void',
  'typeof',
  'instanceof',
  'in',
  'of',
  'yield',
  'await',
]);

function findEvalCallLines(content: string): number[] {
  const lines = new Set<number>();
  let index = 0;
  let line = 1;

  const advance = (): string => {
    const character = content[index++] ?? '';
    if (character === '\n') {
      line += 1;
    }
    return character;
  };

  const skipQuotedString = (quote: "'" | '"'): void => {
    advance();

    while (index < content.length) {
      const character = advance();
      if (character === '\\') {
        advance();
      } else if (character === quote) {
        return;
      }
    }
  };

  const skipLineComment = (): void => {
    advance();
    advance();
    while (index < content.length && content[index] !== '\n') {
      advance();
    }
  };

  const skipBlockComment = (): void => {
    advance();
    advance();

    while (index < content.length) {
      if (content[index] === '*' && content[index + 1] === '/') {
        advance();
        advance();
        return;
      }
      advance();
    }
  };

  const skipRegularExpression = (): void => {
    advance();
    let insideCharacterClass = false;

    while (index < content.length) {
      const character = advance();
      if (character === '\\') {
        advance();
      } else if (character === '[') {
        insideCharacterClass = true;
      } else if (character === ']') {
        insideCharacterClass = false;
      } else if (character === '/' && !insideCharacterClass) {
        while (/[$\w]/u.test(content[index] ?? '')) {
          advance();
        }
        return;
      } else if (character === '\n') {
        return;
      }
    }
  };

  const nextCodeCharacter = (start: number): string => {
    let lookahead = start;

    while (lookahead < content.length) {
      if (/\s/u.test(content[lookahead])) {
        lookahead += 1;
      } else if (content[lookahead] === '/' && content[lookahead + 1] === '/') {
        const newline = content.indexOf('\n', lookahead + 2);
        lookahead = newline === -1 ? content.length : newline + 1;
      } else if (content[lookahead] === '/' && content[lookahead + 1] === '*') {
        const commentEnd = content.indexOf('*/', lookahead + 2);
        lookahead = commentEnd === -1 ? content.length : commentEnd + 2;
      } else {
        return content[lookahead];
      }
    }

    return '';
  };

  const scanCode = (insideTemplateExpression = false): void => {
    let braceDepth = 0;
    let previousToken: string | undefined;

    const skipTemplate = (): void => {
      advance();

      while (index < content.length) {
        if (content[index] === '\\') {
          advance();
          advance();
        } else if (content[index] === '`') {
          advance();
          return;
        } else if (content[index] === '$' && content[index + 1] === '{') {
          advance();
          advance();
          scanCode(true);
        } else {
          advance();
        }
      }
    };

    while (index < content.length) {
      const character = content[index];

      if (/\s/u.test(character)) {
        advance();
        continue;
      }

      if (insideTemplateExpression && character === '}' && braceDepth === 0) {
        advance();
        return;
      }

      if (character === "'" || character === '"') {
        skipQuotedString(character);
        previousToken = 'value';
        continue;
      }

      if (character === '`') {
        skipTemplate();
        previousToken = 'value';
        continue;
      }

      if (character === '/' && content[index + 1] === '/') {
        skipLineComment();
        continue;
      }

      if (character === '/' && content[index + 1] === '*') {
        skipBlockComment();
        continue;
      }

      if (
        character === '/' &&
        (previousToken === undefined || REGEX_PREFIXES.has(previousToken))
      ) {
        skipRegularExpression();
        previousToken = 'value';
        continue;
      }

      if (/[A-Za-z_$]/u.test(character)) {
        const tokenLine = line;
        const start = index;
        advance();
        while (/[\w$]/u.test(content[index] ?? '')) {
          advance();
        }

        const identifier = content.slice(start, index);
        if (identifier === 'eval' && nextCodeCharacter(index) === '(') {
          lines.add(tokenLine);
        }
        previousToken = identifier;
        continue;
      }

      if (/[0-9]/u.test(character)) {
        advance();
        while (/[\w.]/u.test(content[index] ?? '')) {
          advance();
        }
        previousToken = 'value';
        continue;
      }

      if (character === '{') {
        braceDepth += 1;
      } else if (character === '}' && braceDepth > 0) {
        braceDepth -= 1;
      }

      previousToken = character;
      advance();
    }
  };

  scanCode();
  return [...lines];
}

export const noEvalRule: Rule = {
  id: 'no-eval',
  description: 'Detecta o uso de eval(), que pode executar código arbitrário',
  check(filePath: string, content: string): RuleFinding[] {
    return findEvalCallLines(content).map((line) => ({
      ruleId: 'no-eval',
      message: 'Uso de eval() encontrado — evite executar código arbitrário',
      file: filePath,
      line,
      severity: 'high',
    }));
  },
};
