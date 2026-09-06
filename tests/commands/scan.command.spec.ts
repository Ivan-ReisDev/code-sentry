import { expect, it } from 'vitest';
import { parseConcurrency, parseLocalSemgrepConfig } from '../../src/commands/scan/scan.command.js';

it('accepts a positive integer concurrency value', () => {
      expect(parseConcurrency('3')).toBe(3);
});

it('rejects zero, fractions and non-numeric concurrency values', () => {
      expect(() => parseConcurrency('0')).toThrow('inteiro positivo');
      expect(() => parseConcurrency('1.5')).toThrow('inteiro positivo');
      expect(() => parseConcurrency('fast')).toThrow('inteiro positivo');
});

it('accepts only local Semgrep configuration paths', () => {
      expect(parseLocalSemgrepConfig('rules/custom.yml')).toMatch(/rules\/custom\.yml$/);
      expect(() => parseLocalSemgrepConfig('https://semgrep.dev/p/owasp-top-ten')).toThrow('arquivo local');
});
