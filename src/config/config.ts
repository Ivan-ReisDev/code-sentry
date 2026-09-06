export interface CodeSentryConfig {
      include: string[];
      exclude: string[];
}

const DEFAULT_CONFIG: CodeSentryConfig = {
      include: ['**/*.ts', '**/*.js'],
      exclude: ['node_modules', 'dist', '.next'],
};

// TODO: ler um arquivo .codesentryrc.json no cwd; por enquanto retorna os defaults.
export const loadConfig = (_cwd: string): CodeSentryConfig => {
      return DEFAULT_CONFIG;
};
