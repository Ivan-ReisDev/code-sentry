import { expect, it } from 'vitest';
import { deepNestingRule } from '../../src/rules/deep-nesting.rule.js';

it('does not report nesting at exactly the recommended limit (3 levels)', () => {
      const content = [
            'function fn() {',
            '  if (a) {',
            '    if (b) {',
            '      if (c) {',
            '        doWork();',
            '      }',
            '    }',
            '  }',
            '}',
      ].join('\n');

      const findings = deepNestingRule.check('file.ts', content);

      expect(findings).toHaveLength(0);
});

it('reports a 4th nested if level', () => {
      const content = [
            'function fn() {',
            '  if (a) {',
            '    if (b) {',
            '      if (c) {',
            '        if (d) {',
            '          doWork();',
            '        }',
            '      }',
            '    }',
            '  }',
            '}',
      ].join('\n');

      const findings = deepNestingRule.check('file.ts', content);

      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('deep-nesting');
      expect(findings[0].severity).toBe('low');
      expect(findings[0].line).toBe(5);
});

it('treats an if/else-if/else-if chain as flat, not increasing nesting', () => {
      const content = [
            'function fn() {',
            '  if (a) {',
            '    doWork();',
            '  } else if (b) {',
            '    doWork();',
            '  } else if (c) {',
            '    doWork();',
            '  } else if (d) {',
            '    doWork();',
            '  }',
            '}',
      ].join('\n');

      const findings = deepNestingRule.check('file.ts', content);

      expect(findings).toHaveLength(0);
});

it('counts a real if nested inside a plain else block (not an else-if)', () => {
      const content = [
            'function fn() {',
            '  if (a) {',
            '    doWork();',
            '  } else {',
            '    if (b) {',
            '      if (c) {',
            '        if (d) {',
            '          doWork();',
            '        }',
            '      }',
            '    }',
            '  }',
            '}',
      ].join('\n');

      const findings = deepNestingRule.check('file.ts', content);

      expect(findings).toHaveLength(1);
});

it('counts mixed statement types (for/if/while/if) toward the same depth', () => {
      const content = [
            'function fn() {',
            '  for (const x of xs) {',
            '    if (a) {',
            '      while (b) {',
            '        if (c) {',
            '          doWork();',
            '        }',
            '      }',
            '    }',
            '  }',
            '}',
      ].join('\n');

      const findings = deepNestingRule.check('file.ts', content);

      expect(findings).toHaveLength(1);
});

it('counts a switch statement as one nesting level, regardless of its cases', () => {
      const content = [
            'function fn() {',
            '  if (a) {',
            '    if (b) {',
            '      if (c) {',
            '        switch (x) {',
            '          case 1:',
            '            doWork();',
            '            break;',
            '          case 2:',
            '            doWork();',
            '            break;',
            '        }',
            '      }',
            '    }',
            '  }',
            '}',
      ].join('\n');

      const findings = deepNestingRule.check('file.ts', content);

      expect(findings).toHaveLength(1);
});

it('counts try/catch as a single nesting level, not one for try and one for catch', () => {
      const content = [
            'function fn() {',
            '  if (a) {',
            '    if (b) {',
            '      if (c) {',
            '        try {',
            '          doWork();',
            '        } catch (err) {',
            '          handle(err);',
            '        }',
            '      }',
            '    }',
            '  }',
            '}',
      ].join('\n');

      const findings = deepNestingRule.check('file.ts', content);

      expect(findings).toHaveLength(1);
});

it('resets nesting depth for a function declared inside an already-deep block', () => {
      const content = [
            'function outer() {',
            '  if (a) {',
            '    if (b) {',
            '      if (c) {',
            '        function inner() {',
            '          if (x) {',
            '            doWork();',
            '          }',
            '        }',
            '        inner();',
            '      }',
            '    }',
            '  }',
            '}',
      ].join('\n');

      const findings = deepNestingRule.check('file.ts', content);

      expect(findings).toHaveLength(0);
});

it('does not report shallow nesting', () => {
      const content = ['function fn() {', '  if (a) {', '    doWork();', '  }', '}'].join('\n');

      const findings = deepNestingRule.check('file.ts', content);

      expect(findings).toHaveLength(0);
});
