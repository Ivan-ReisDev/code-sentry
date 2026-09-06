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
const SYNTAX_JSX_PLUGIN_PATH = require.resolve('@babel/plugin-syntax-jsx');

const isJsxFile = (filePath: string): boolean => /\.(tsx|jsx)$/.test(filePath);

// O ESLint 9+ só reconhece nativamente .js/.mjs/.cjs como "linguagem JS" sem
// configuração extra — .ts/.jsx/.tsx exigem que `files` liste a extensão
// explicitamente, senão o `Linter#verify` devolve silenciosamente
// "No matching configuration found" (sem lançar erro) e nenhuma regra roda.
const SCANNABLE_FILE_GLOBS = ['**/*.js', '**/*.mjs', '**/*.cjs', '**/*.ts', '**/*.jsx', '**/*.tsx'];

const createConfig = (
      filePath: string,
      rules: Record<string, 'error' | 'warn'>,
      plugins: Record<string, unknown>,
): Linter.Config[] =>
      [
            {
                  files: SCANNABLE_FILE_GLOBS,
                  languageOptions: {
                        parser: babelParser,
                        ecmaVersion: 'latest',
                        sourceType: 'module',
                        parserOptions: {
                              requireConfigFile: false,
                              babelOptions: {
                                    plugins: isJsxFile(filePath)
                                          ? [SYNTAX_JSX_PLUGIN_PATH, SYNTAX_TYPESCRIPT_PLUGIN_PATH]
                                          : [SYNTAX_TYPESCRIPT_PLUGIN_PATH],
                              },
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
      // parsing que possam indexar por nome de arquivo. A extensão é preservada
      // (não trocada por um nome genérico) porque createConfig usa isJsxFile()
      // para decidir se habilita a sintaxe JSX.
      const syntheticFilename = basename(filePath) || 'source.js';

      return toFindings(verify(content, createConfig(syntheticFilename, rules, plugins), syntheticFilename));
};
