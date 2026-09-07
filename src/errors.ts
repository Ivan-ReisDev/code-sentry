const errorDetail = (error: Error): string => {
      const stderr = (error as { stderr?: unknown }).stderr;
      const stderrText = typeof stderr === 'string' && stderr.trim().length > 0 ? ` (stderr: ${stderr.trim()})` : '';
      return `${error.message}${stderrText}`;
};

/**
 * Mensagens de erro genéricas ("Falha durante a análise") escondem a causa
 * real por trás de camadas de wrapping — percorre error.cause até o fim para
 * que o motivo verdadeiro (ex.: ENOENT do child_process, stderr do processo)
 * chegue ao usuário em vez de se perder.
 */
export const formatErrorChain = (error: unknown): string => {
      if (!(error instanceof Error)) {
            return 'erro desconhecido';
      }

      const parts = [errorDetail(error)];
      let current: unknown = error.cause;
      while (current instanceof Error) {
            parts.push(errorDetail(current));
            current = current.cause;
      }

      return parts.join(' | Causa: ');
};
