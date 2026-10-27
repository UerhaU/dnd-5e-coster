import type { HealthResponse } from '@koster/shared';

export type HealthState =
  { kind: 'loading' } | { kind: 'ok'; health: HealthResponse } | { kind: 'error'; message: string };

/** Строка состояния внизу главного меню: версии программы, SQLite и каталога. */
export function describeHealth(state: HealthState): string {
  switch (state.kind) {
    case 'loading':
      return 'Проверяем сервер…';
    case 'ok': {
      const { appVersion, sqliteVersion, catalog } = state.health;
      const catalogText = catalog
        ? `каталог ${catalog.version}${catalog.sourceKind === 'fixtures' ? ' (тестовый)' : ''}`
        : 'каталога нет';
      return `Сервер работает. Версия программы ${appVersion}, SQLite ${sqliteVersion}, ${catalogText}.`;
    }
    case 'error':
      return `Сервер не отвечает: ${state.message}`;
  }
}
