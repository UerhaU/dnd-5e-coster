import { describe, expect, it } from 'vitest';
import { RULES_EDITION } from './index';

describe('@koster/rules', () => {
  it('работает с редакцией 5e 2014', () => {
    expect(RULES_EDITION).toBe('dnd5e-2014');
  });
});
