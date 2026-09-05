export interface CodeSentryConfig {
  include: string[];
  exclude: string[];
}

const DEFAULT_CONFIG: CodeSentryConfig = {
  include: ['**/*.ts', '**/*.js'],
  exclude: ['node_modules', 'dist'],
};

// TODO: ler um arquivo .codesentryrc.json no cwd; por enquanto retorna os defaults.
export function loadConfig(_cwd: string): CodeSentryConfig {
  return DEFAULT_CONFIG;
}
