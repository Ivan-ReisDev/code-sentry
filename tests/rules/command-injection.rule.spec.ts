import { expect, it } from 'vitest';
import { commandInjectionRule } from '../../src/rules/command-injection.rule.js';

it('detects a named import of exec() with a string built via concatenation', () => {
  const findings = commandInjectionRule.check(
    'file.js',
    "import { exec } from 'node:child_process';\nexec('rm -rf ' + userInput);",
  );

  expect(findings).toHaveLength(1);
  expect(findings[0]).toMatchObject({
    ruleId: 'command-injection',
    file: 'file.js',
    line: 2,
    severity: 'critical',
  });
});

it('detects exec() with a template literal containing an interpolation', () => {
  const findings = commandInjectionRule.check(
    'file.js',
    "import { exec } from 'child_process';\nexec(`rm -rf ${userInput}`);",
  );

  expect(findings).toHaveLength(1);
});

it('detects a require()-destructured execSync() with a variable command', () => {
  const findings = commandInjectionRule.check(
    'file.js',
    "const { execSync } = require('child_process');\nexecSync(cmd);",
  );

  expect(findings).toHaveLength(1);
});

it('does not flag exec() with a plain string literal', () => {
  const findings = commandInjectionRule.check(
    'file.js',
    "import { exec } from 'child_process';\nexec('ls -la');",
  );

  expect(findings).toHaveLength(0);
});

it('does not flag a namespace import of child_process with a plain string literal', () => {
  const findings = commandInjectionRule.check(
    'file.js',
    "import * as child_process from 'child_process';\nchild_process.exec('ls -la', cb);",
  );

  expect(findings).toHaveLength(0);
});

it('detects a require()-bound child_process namespace with a dynamic argument', () => {
  const findings = commandInjectionRule.check(
    'file.js',
    "const cp = require('node:child_process');\ncp.exec(`ls ${dir}`, cb);",
  );

  expect(findings).toHaveLength(1);
});

it('returns no findings when exec/execSync are not used', () => {
  const findings = commandInjectionRule.check('file.js', 'const x = 1;');

  expect(findings).toHaveLength(0);
});

it('does not flag a database exec() call unrelated to child_process (false positive from better-sqlite3)', () => {
  const findings = commandInjectionRule.check(
    'file.js',
    "import Database from 'better-sqlite3';\nconst db = new Database('app.db');\ndb.exec(`SELECT * FROM t WHERE x = '${authorFilter}'`);",
  );

  expect(findings).toHaveLength(0);
});

it('does not flag RegExp.prototype.exec() (false positive from a regex, not a shell command)', () => {
  const findings = commandInjectionRule.check(
    'file.js',
    'const title = /<title[^>]*>([^<]*)<\\/title>/i.exec(data)?.[1] ?? "";',
  );

  expect(findings).toHaveLength(0);
});

it('does not flag a bare exec() call when child_process was not imported', () => {
  const findings = commandInjectionRule.check('file.js', 'exec(userInput);');

  expect(findings).toHaveLength(0);
});
