import { parseSourceFile, type SourceNode, visitSourceNodes } from '../parser/source-file.js';
import type { Rule, RuleFinding } from './rule.interface.js';

const isBufferFromBase64Call = (node: SourceNode): boolean => {
  const callee = node.callee as SourceNode | undefined;
  if (callee?.type !== 'MemberExpression') {
    return false;
  }
  const object = callee.object as SourceNode | undefined;
  const property = callee.property as SourceNode | undefined;
  const isBufferFrom =
    object?.type === 'Identifier' &&
    object.name === 'Buffer' &&
    property?.type === 'Identifier' &&
    property.name === 'from';
  if (!isBufferFrom) {
    return false;
  }
  const args = node.arguments as SourceNode[] | undefined;
  return args?.[1]?.type === 'StringLiteral' && args[1].value === 'base64';
};

const isBase64DecodeCall = (node: SourceNode): boolean => {
  if (node.type !== 'CallExpression') {
    return false;
  }
  const callee = node.callee as SourceNode | undefined;
  if (callee?.type === 'Identifier' && callee.name === 'atob') {
    return true;
  }
  return isBufferFromBase64Call(node);
};

const isJsonParseCall = (node: SourceNode): boolean => {
  if (node.type !== 'CallExpression') {
    return false;
  }
  const callee = node.callee as SourceNode | undefined;
  return (
    callee?.type === 'MemberExpression' &&
    (callee.object as SourceNode | undefined)?.type === 'Identifier' &&
    ((callee.object as SourceNode).name as string) === 'JSON' &&
    (callee.property as SourceNode | undefined)?.type === 'Identifier' &&
    ((callee.property as SourceNode).name as string) === 'parse'
  );
};

const isSignatureVerificationCall = (node: SourceNode): boolean => {
  if (node.type !== 'CallExpression') {
    return false;
  }
  const callee = node.callee as SourceNode | undefined;
  return (
    callee?.type === 'MemberExpression' &&
    (callee.property as SourceNode | undefined)?.type === 'Identifier' &&
    ((callee.property as SourceNode).name as string) === 'verify'
  );
};

interface FileAnalysis {
  base64DecodeLines: number[];
  hasJsonParse: boolean;
  hasSignatureVerification: boolean;
}

const analyzeFile = (sourceFile: SourceNode): FileAnalysis => {
  const analysis: FileAnalysis = {
    base64DecodeLines: [],
    hasJsonParse: false,
    hasSignatureVerification: false,
  };

  visitSourceNodes(sourceFile, (node) => {
    if (isBase64DecodeCall(node) && node.loc) {
      analysis.base64DecodeLines.push(node.loc.start.line);
    } else if (isJsonParseCall(node)) {
      analysis.hasJsonParse = true;
    } else if (isSignatureVerificationCall(node)) {
      analysis.hasSignatureVerification = true;
    }
  });

  return analysis;
};

const findJwtDecodeWithoutVerifyLines = (filePath: string, content: string): number[] => {
  const sourceFile = parseSourceFile(filePath, content);
  const analysis = analyzeFile(sourceFile);

  if (!analysis.hasJsonParse || analysis.hasSignatureVerification) {
    return [];
  }
  return [...new Set(analysis.base64DecodeLines)].sort((a, b) => a - b);
};

export const jwtDecodeWithoutVerifyRule: Rule = {
  id: 'jwt-decode-without-verify',
  description: 'Detecta decodificação manual de um token (base64 + JSON.parse) sem nenhuma verificação de assinatura no arquivo',
  check(filePath: string, content: string): RuleFinding[] {
    return findJwtDecodeWithoutVerifyLines(filePath, content).map((line) => ({
      ruleId: 'jwt-decode-without-verify',
      message: 'Token decodificado (base64 + JSON.parse) sem verificar a assinatura — claims não confiáveis podem ser forjadas',
      file: filePath,
      line,
      severity: 'critical',
    }));
  },
};
