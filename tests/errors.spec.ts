import { expect, it } from 'vitest';
import { formatErrorChain } from '../src/errors.js';

it('includes the top-level error message', () => {
      expect(formatErrorChain(new Error('falhou'))).toBe('falhou');
});

it('appends the cause chain, so the real root cause stays visible instead of a generic wrapper message', () => {
      const cause = new Error('causa raiz');
      const top = new Error('falha geral', { cause });

      expect(formatErrorChain(top)).toBe('falha geral | Causa: causa raiz');
});

it('walks multiple levels of cause', () => {
      const root = new Error('nível 3');
      const middle = new Error('nível 2', { cause: root });
      const top = new Error('nível 1', { cause: middle });

      expect(formatErrorChain(top)).toBe('nível 1 | Causa: nível 2 | Causa: nível 3');
});

it('includes stderr from a failed child process, since that is often where the real OS-level reason lives', () => {
      const childError = Object.assign(new Error('Command failed'), {
            stderr: 'algo específico do sistema operacional',
      });

      expect(formatErrorChain(childError)).toContain('algo específico do sistema operacional');
});

it('returns a generic message for non-Error values', () => {
      expect(formatErrorChain('string qualquer')).toBe('erro desconhecido');
});
