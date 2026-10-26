import { healthResponseSchema, type HealthResponse } from '@koster/shared';

export type HealthState =
  { kind: 'loading' } | { kind: 'ok'; health: HealthResponse } | { kind: 'error'; message: string };

/** Запрашивает `/api/health` и проверяет ответ схемой. */
export async function fetchHealth(serverUrl: string): Promise<HealthResponse> {
  const response = await fetch(`${serverUrl}/api/health`);
  if (!response.ok) {
    throw new Error(`Сервер ответил кодом ${response.status}`);
  }
  return healthResponseSchema.parse(await response.json());
}

/** Текст статуса для пользователя. */
export function describeHealth(state: HealthState): string {
  switch (state.kind) {
    case 'loading':
      return 'Проверяем сервер…';
    case 'ok':
      return `Сервер работает. Версия программы ${state.health.appVersion}, SQLite ${state.health.sqliteVersion}.`;
    case 'error':
      return `Сервер не отвечает: ${state.message}`;
  }
}
