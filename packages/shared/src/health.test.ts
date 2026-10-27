import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './health';

describe('healthResponseSchema', () => {
  it('принимает правильный ответ', () => {
    const response = {
      status: 'ok',
      appVersion: '2.0.0-alpha.0',
      sqliteVersion: '3.50.0',
      catalog: {
        version: 2,
        contentHash: 'abc',
        builtAt: '2026-10-27T00:00:00Z',
        sourceKind: 'full',
      },
    };

    expect(healthResponseSchema.parse(response)).toEqual(response);
  });

  it('отклоняет ответ без версии SQLite', () => {
    const result = healthResponseSchema.safeParse({ status: 'ok', appVersion: '2.0.0' });

    expect(result.success).toBe(false);
  });
});
