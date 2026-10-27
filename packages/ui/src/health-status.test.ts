import { describe, expect, it } from 'vitest';
import { describeHealth } from './health-status';

describe('describeHealth', () => {
  it('показывает версии, когда сервер работает', () => {
    const text = describeHealth({
      kind: 'ok',
      health: {
        status: 'ok',
        appVersion: '2.0.0-alpha.0',
        sqliteVersion: '3.50.0',
        catalog: null,
      },
    });

    expect(text).toBe(
      'Сервер работает. Версия программы 2.0.0-alpha.0, SQLite 3.50.0, каталога нет.',
    );
  });

  it('показывает версию каталога и пометку тестового', () => {
    const text = describeHealth({
      kind: 'ok',
      health: {
        status: 'ok',
        appVersion: '2.0.0',
        sqliteVersion: '3.50.0',
        catalog: { version: 2, contentHash: 'x', builtAt: 'y', sourceKind: 'fixtures' },
      },
    });

    expect(text).toBe(
      'Сервер работает. Версия программы 2.0.0, SQLite 3.50.0, каталог 2 (тестовый).',
    );
  });

  it('объясняет ошибку', () => {
    expect(describeHealth({ kind: 'error', message: 'нет связи' })).toBe(
      'Сервер не отвечает: нет связи',
    );
  });
});
