import { expect, it } from 'vitest';
import { awaitNoTryCatchRule } from '../../src/rules/await-no-try-catch.rule.js';

it('detects an await without try/catch inside a standalone function', () => {
  const content = ['async function run() {', '  await foo();', '}'].join('\n');

  const findings = awaitNoTryCatchRule.check('file.js', content);

  expect(findings).toHaveLength(1);
  expect(findings[0]).toMatchObject({
    ruleId: 'await-no-try-catch',
    file: 'file.js',
    line: 2,
    severity: 'medium',
  });
});

it('does not flag an await wrapped in try/catch', () => {
  const content = [
    'async function run() {',
    '  try {',
    '    await foo();',
    '  } catch (e) {}',
    '}',
  ].join('\n');

  expect(awaitNoTryCatchRule.check('file.js', content)).toHaveLength(0);
});

it('does not flag awaits in a test file because the test runner handles rejections', () => {
  const findings = awaitNoTryCatchRule.check('tests/file.spec.ts', 'await runTest();');

  expect(findings).toHaveLength(0);
});

it('does not flag an await inside a class method without a decorator', () => {
  const content = ['class Foo {', '  async run() {', '    await bar();', '  }', '}'].join('\n');

  expect(awaitNoTryCatchRule.check('file.js', content)).toHaveLength(0);
});

it('does not flag an await inside a decorated class method (e.g. NestJS controllers/providers)', () => {
  const content = [
    '@Injectable()',
    'class FooService {',
    '  async run() {',
    '    await bar();',
    '  }',
    '}',
  ].join('\n');

  expect(awaitNoTryCatchRule.check('file.js', content)).toHaveLength(0);
});

it('does not flag an await inside an arrow function assigned as a class field', () => {
  const content = ['class Foo {', '  run = async () => {', '    await bar();', '  };', '}'].join(
    '\n',
  );

  expect(awaitNoTryCatchRule.check('file.js', content)).toHaveLength(0);
});

it('does not flag an await inside a closure nested within a class method', () => {
  const content = [
    'class Foo {',
    '  run() {',
    '    return async () => {',
    '      await bar();',
    '    };',
    '  }',
    '}',
  ].join('\n');

  expect(awaitNoTryCatchRule.check('file.js', content)).toHaveLength(0);
});

it('returns no findings when there is no await', () => {
  const findings = awaitNoTryCatchRule.check('file.js', 'const x = 1;');

  expect(findings).toHaveLength(0);
});
