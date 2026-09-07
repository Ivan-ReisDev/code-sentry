import { expect, it } from 'vitest';
import { allRules } from '../../src/rules/index.js';

it('includes weak-cipher-mode and hardcoded-authorization-value', () => {
      const ids = allRules.map((rule) => rule.id);
      expect(ids).toContain('weak-cipher-mode');
      expect(ids).toContain('hardcoded-authorization-value');
});
