import { createRequire } from 'node:module';
import { basename } from 'node:path';
import { Linter } from 'eslint';
import babelParser from '@babel/eslint-parser';

export interface EslintFinding {
  ruleId: string;
  message: string;
  line: number;
}

// Caminho absoluto resolvido a partir deste módulo (não de process.cwd()),
// e passado como string para o babelOptions.plugins abaixo. Duas armadilhas
// evitadas aqui:
// 1. Passar só o nome do pacote ('@babel/plugin-syntax-typescript') faz o
//    @babel/core resolvê-lo a partir de process.cwd() — falha silenciosa
//    quando o diretório analisado é um projeto de terceiros sem essa
//    dependência no próprio node_modules (o try/catch abaixo engolia o erro).
// 2. Passar a função do plugin diretamente falha com "could not be cloned",
//    pois o ESLint tenta clonar (structuredClone) partes do config, e
//    funções não são clonáveis.
// Um caminho absoluto já resolvido é só uma string (clonável) e não precisa
// de nenhuma resolução baseada em cwd.
const require = createRequire(import.meta.url);
const SYNTAX_TYPESCRIPT_PLUGIN_PATH = require.resolve('@babel/plugin-syntax-typescript');

const createConfig = (
  rules: Record<string, 'error' | 'warn'>,
  plugins: Record<string, unknown>,
): Linter.Config[] => [
  {
    files: ['**/*'],
    languageOptions: {
      parser: babelParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        requireConfigFile: false,
        babelOptions: { plugins: [SYNTAX_TYPESCRIPT_PLUGIN_PATH] },
      },
    },
    plugins,
    rules,
  },
] as Linter.Config[];

const verify = (content: string, config: Linter.Config[], filename: string): Linter.LintMessage[] => {
  try {
    return new Linter().verify(content, config, filename);
  } catch {
    return [];
  }
};

const toFindings = (messages: Linter.LintMessage[]): EslintFinding[] =>
  messages
    .filter(
      (message): message is Linter.LintMessage & { ruleId: string; line: number } =>
        message.ruleId !== null && typeof message.line === 'number',
    )
    .map((message) => ({
      ruleId: message.ruleId,
      message: message.message,
      line: message.line,
    }));

export const runEslintRules = (
  filePath: string,
  content: string,
  rules: Record<string, 'error' | 'warn'>,
  plugins: Record<string, unknown>,
): EslintFinding[] => {
  // Uma instância nova por chamada: evita qualquer estado/cache compartilhado
  // entre arquivos processados concorrentemente pelo scanner (Promise.all em
  // src/scanner/scanner.ts).
  // O flat config do ESLint não casa `files: ['**/*']` contra caminhos
  // absolutos de verdade, e por segurança usamos só o basename real (nunca um
  // nome fixo compartilhado) para não arriscar colisão de cache com libs de
  // parsing que possam indexar por nome de arquivo — a extensão em si é
  // irrelevante, pois o parser/plugins são sempre forçados abaixo.
  const syntheticFilename = basename(filePath) || 'source.js';

  return toFindings(verify(content, createConfig(rules, plugins), syntheticFilename));
};
