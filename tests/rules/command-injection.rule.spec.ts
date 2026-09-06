import { expect, it } from 'vitest';
import { commandInjectionRule } from '../../src/rules/command-injection.rule.js';

it('detects exec() with a string built via concatenation', () => {
  const findings = commandInjectionRule.check('file.js', "exec('rm -rf ' + userInput);");

  expect(findings).toHaveLength(1);
  expect(findings[0]).toMatchObject({
    ruleId: 'command-injection',
    file: 'file.js',
    line: 1,
    severity: 'critical',
  });
});

it('detects exec() with a template literal containing an interpolation', () => {
  const findings = commandInjectionRule.check('file.js', 'exec(`rm -rf ${userInput}`);');

  expect(findings).toHaveLength(1);
});

it('detects execSync() with a variable command', () => {
  const findings = commandInjectionRule.check('file.js', 'execSync(cmd);');

  expect(findings).toHaveLength(1);
});

it('does not flag exec() with a plain string literal', () => {
  const findings = commandInjectionRule.check('file.js', "exec('ls -la');");

  expect(findings).toHaveLength(0);
});

it('does not flag child_process.exec() with a plain string literal', () => {
  const findings = commandInjectionRule.check('file.js', "child_process.exec('ls -la', cb);");

  expect(findings).toHaveLength(0);
});

it('detects child_process.exec() with a dynamic argument', () => {
  const findings = commandInjectionRule.check(
    'file.js',
    'child_process.exec(`ls ${dir}`, cb);',
  );

  expect(findings).toHaveLength(1);
});

it('returns no findings when exec/execSync are not used', () => {
  const findings = commandInjectionRule.check('file.js', 'const x = 1;');

  expect(findings).toHaveLength(0);
});
