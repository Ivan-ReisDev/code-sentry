import babelParser from '@babel/eslint-parser';
import prettier from 'eslint-config-prettier';

export default [
      {
            ignores: [
                  'node_modules/**',
                  'dist/**',
                  'coverage/**',
                  '.next/**',
                  'packages/*/runtime/**',
                  'codesentry-report-*.md',
            ],
      },
      {
            files: ['**/*.{js,mjs,cjs,ts,tsx}'],
            languageOptions: {
                  parser: babelParser,
                  parserOptions: {
                        requireConfigFile: false,
                        sourceType: 'module',
                        babelOptions: {
                              plugins: ['@babel/plugin-syntax-typescript'],
                        },
                  },
            },
            rules: {
                  'no-constant-binary-expression': 'error',
                  'no-debugger': 'error',
                  'no-duplicate-imports': 'error',
            },
      },
      prettier,
];
