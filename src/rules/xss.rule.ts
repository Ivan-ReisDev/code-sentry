// @ts-expect-error -- sem types publicados; ver docs/adr/0002-security-tooling.md
import noUnsanitizedPlugin from 'eslint-plugin-no-unsanitized';
import { parseSourceFile, type SourceNode, visitSourceNodes } from '../parser/source-file.js';
import { runEslintRules } from './lib/eslint-linter.js';
import type { Rule, RuleFinding } from './rule.interface.js';

const RULES = {
      'no-unsanitized/property': 'error',
      'no-unsanitized/method': 'error',
} as const;

const PLUGINS = { 'no-unsanitized': noUnsanitizedPlugin };

// eslint-plugin-no-unsanitized não entende JSX (dangerouslySetInnerHTML é uma
// prop React, sintaticamente uma JSXAttribute — bem diferente de uma
// AssignmentExpression para .innerHTML), então esse sink é checado à parte,
// com o mesmo parser Babel usado pelas demais rules hand-rolled do projeto.
const isHtmlProperty = (property: SourceNode): boolean => {
      const key = property.key as SourceNode | undefined;
      return key?.type === 'Identifier' && key.name === '__html';
};

const isDangerouslySetInnerHtmlWithDynamicValue = (node: SourceNode): boolean => {
      const name = node.name as SourceNode | undefined;
      const value = node.value as SourceNode | undefined;
      const expression = value?.expression as SourceNode | undefined;
      const properties = expression?.properties as SourceNode[] | undefined;
      const htmlProperty = properties?.find(isHtmlProperty);
      const htmlValue = htmlProperty?.value as SourceNode | undefined;
      return (
            node.type === 'JSXAttribute' &&
            name?.type === 'JSXIdentifier' &&
            name.name === 'dangerouslySetInnerHTML' &&
            value?.type === 'JSXExpressionContainer' &&
            expression?.type === 'ObjectExpression' &&
            htmlValue !== undefined &&
            htmlValue.type !== 'StringLiteral'
      );
};

const findDangerouslySetInnerHtmlFindings = (filePath: string, content: string): RuleFinding[] => {
      const findings: RuleFinding[] = [];
      let sourceFile: SourceNode;
      try {
            sourceFile = parseSourceFile(filePath, content);
      } catch {
            return findings;
      }

      visitSourceNodes(sourceFile, (node) => {
            if (isDangerouslySetInnerHtmlWithDynamicValue(node) && node.loc) {
                  findings.push({
                        ruleId: 'dangerously-set-inner-html',
                        message: 'Possível XSS: dangerouslySetInnerHTML com valor não literal (dado não confiável)',
                        file: filePath,
                        line: node.loc.start.line,
                        severity: 'high',
                  });
            }
      });

      return findings;
};

export const xssRule: Rule = {
      id: 'xss',
      description: 'Detecta sinks perigosos de XSS (innerHTML, document.write, dangerouslySetInnerHTML, etc.)',
      check(filePath: string, content: string): RuleFinding[] {
            const eslintFindings: RuleFinding[] = runEslintRules(filePath, content, RULES, PLUGINS).map((finding) => ({
                  ruleId: finding.ruleId,
                  message: `Possível XSS: ${finding.message}`,
                  file: filePath,
                  line: finding.line,
                  severity: 'high',
            }));

            return [...eslintFindings, ...findDangerouslySetInnerHtmlFindings(filePath, content)];
      },
};
