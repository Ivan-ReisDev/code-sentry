import { expect, it } from 'vitest';
import { xxeUnsafeXmlParsingRule } from '../../src/rules/xxe-unsafe-xml-parsing.rule.js';

it('detects parseXmlString with noent enabled', () => {
      const findings = xxeUnsafeXmlParsingRule.check(
            'file.js',
            'const doc = libxmljs.parseXmlString(rawXml, { noent: true });',
      );

      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
            ruleId: 'xxe-unsafe-xml-parsing',
            file: 'file.js',
            line: 1,
            severity: 'critical',
      });
});

it('detects parseXmlString with dtdload enabled', () => {
      const findings = xxeUnsafeXmlParsingRule.check(
            'file.js',
            'const doc = libxmljs.parseXmlString(rawXml, { dtdload: true });',
      );

      expect(findings).toHaveLength(1);
});

it('detects parseXml with both risky options set', () => {
      const findings = xxeUnsafeXmlParsingRule.check(
            'file.js',
            'const doc = parser.parseXml(rawXml, { noent: true, dtdload: true });',
      );

      expect(findings).toHaveLength(1);
});

it('does not flag parseXmlString without risky options', () => {
      const findings = xxeUnsafeXmlParsingRule.check('file.js', 'const doc = libxmljs.parseXmlString(rawXml);');

      expect(findings).toHaveLength(0);
});

it('does not flag parseXmlString with the risky options explicitly disabled', () => {
      const findings = xxeUnsafeXmlParsingRule.check(
            'file.js',
            'const doc = libxmljs.parseXmlString(rawXml, { noent: false, dtdload: false });',
      );

      expect(findings).toHaveLength(0);
});

it('returns no findings for unrelated code', () => {
      const findings = xxeUnsafeXmlParsingRule.check('file.js', 'const x = 1;');

      expect(findings).toHaveLength(0);
});
