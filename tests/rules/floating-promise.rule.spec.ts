import { expect, it } from 'vitest';
import { floatingPromiseRule } from '../../src/rules/floating-promise.rule.js';

it('detects a floating call to an async function declared in the same file', () => {
      const content = ['async function doWork() {}', 'doWork();'].join('\n');

      const findings = floatingPromiseRule.check('file.js', content);

      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
            ruleId: 'floating-promise',
            file: 'file.js',
            line: 2,
            severity: 'medium',
      });
});

it('does not flag the call when it is awaited', () => {
      const content = ['async function doWork() {}', 'async function run() {', '  await doWork();', '}'].join('\n');

      expect(floatingPromiseRule.check('file.js', content)).toHaveLength(0);
});

it('does not flag the call when it has a .catch()', () => {
      const content = ['async function doWork() {}', 'doWork().catch(() => {});'].join('\n');

      expect(floatingPromiseRule.check('file.js', content)).toHaveLength(0);
});

it('does not flag the call when it is assigned to a variable', () => {
      const content = ['async function doWork() {}', 'const result = doWork();'].join('\n');

      expect(floatingPromiseRule.check('file.js', content)).toHaveLength(0);
});

it('does not flag the call when it is returned', () => {
      const content = ['async function doWork() {}', 'function run() {', '  return doWork();', '}'].join('\n');

      expect(floatingPromiseRule.check('file.js', content)).toHaveLength(0);
});

it('does not flag the call when wrapped in void to signal it is intentional', () => {
      const content = ['async function doWork() {}', 'void doWork();'].join('\n');

      expect(floatingPromiseRule.check('file.js', content)).toHaveLength(0);
});

it('detects a floating call to a known Promise-returning global like fetch', () => {
      const findings = floatingPromiseRule.check('file.js', "fetch('/api');");

      expect(findings).toHaveLength(1);
});

it('does not flag a floating call to a function that is not declared as async', () => {
      const content = ['function doWork() {}', 'doWork();'].join('\n');

      expect(floatingPromiseRule.check('file.js', content)).toHaveLength(0);
});
