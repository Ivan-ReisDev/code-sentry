import { expect, it } from 'vitest';
import { hardcodedAuthorizationValueRule } from '../../src/rules/hardcoded-authorization-value.rule.js';

it('detects a request header compared against a hardcoded constant to grant access', () => {
      const content = [
            'const MCP_SESSION_HEADER = "X-MCP-Session";',
            'const MCP_SESSION_VALUE = "oopssec-internal-agent";',
            'const hasSession = request.headers.get(MCP_SESSION_HEADER) === MCP_SESSION_VALUE;',
      ].join('\n');

      const findings = hardcodedAuthorizationValueRule.check('file.js', content);

      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
            ruleId: 'hardcoded-authorization-value',
            file: 'file.js',
            line: 3,
            severity: 'critical',
      });
});

it('detects a cookie compared against a hardcoded string literal to grant access', () => {
      const findings = hardcodedAuthorizationValueRule.check(
            'file.js',
            'const isAuthenticated = cookies.get("siem_session") === "authenticated";',
      );

      expect(findings).toHaveLength(1);
});

it('does not flag a header compared against a non-constant (env-derived) value', () => {
      const findings = hardcodedAuthorizationValueRule.check(
            'file.js',
            'const hasSession = request.headers.get("X-Session") === process.env.SESSION_TOKEN;',
      );

      expect(findings).toHaveLength(0);
});

it('does not flag unrelated string comparisons', () => {
      const findings = hardcodedAuthorizationValueRule.check('file.js', 'const isAdmin = user.role === "admin";');

      expect(findings).toHaveLength(0);
});

it('returns no findings for unrelated code', () => {
      const findings = hardcodedAuthorizationValueRule.check('file.js', 'const x = 1;');

      expect(findings).toHaveLength(0);
});
