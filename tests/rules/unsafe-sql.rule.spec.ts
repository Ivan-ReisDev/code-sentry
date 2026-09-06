import { expect, it } from 'vitest';
import { unsafeSqlRule } from '../../src/rules/unsafe-sql.rule.js';

it('detects a SELECT query built via string concatenation', () => {
      const findings = unsafeSqlRule.check('file.js', "const query = 'SELECT * FROM users WHERE id = ' + userId;");

      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
            ruleId: 'unsafe-sql',
            file: 'file.js',
            line: 1,
            severity: 'high',
      });
});

it('detects a SELECT query built via a template literal', () => {
      const findings = unsafeSqlRule.check('file.js', 'const query = `SELECT * FROM users WHERE id = ${userId}`;');

      expect(findings).toHaveLength(1);
});

it('detects an INSERT query built via a template literal', () => {
      const findings = unsafeSqlRule.check('file.js', 'const query = `INSERT INTO logs (msg) VALUES (${msg})`;');

      expect(findings).toHaveLength(1);
});

it('does not flag a static SQL string with no concatenation', () => {
      const findings = unsafeSqlRule.check('file.js', "const query = 'SELECT * FROM users';");

      expect(findings).toHaveLength(0);
});

it('does not flag a parameterized query', () => {
      const findings = unsafeSqlRule.check('file.js', "db.query('SELECT * FROM users WHERE id = ?', [userId]);");

      expect(findings).toHaveLength(0);
});

it('does not flag string concatenation unrelated to SQL', () => {
      const findings = unsafeSqlRule.check('file.js', "const greeting = 'Hello ' + name;");

      expect(findings).toHaveLength(0);
});
