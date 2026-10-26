import { useEffect, useState } from 'react';
import { describeHealth, fetchHealth, type HealthState } from './health-status';

export interface AppProps {
  /** Возвращает адрес встроенного сервера. Окно получает его от главного процесса. */
  getServerUrl: () => Promise<string>;
}

/** Стартовая страница этапа 0: название программы и статус сервера. Без стиля (Р14, Р28). */
export function App({ getServerUrl }: AppProps) {
  const [state, setState] = useState<HealthState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;

    getServerUrl()
      .then(fetchHealth)
      .then((health) => {
        if (!cancelled) setState({ kind: 'ok', health });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        if (!cancelled) setState({ kind: 'error', message });
      });

    return () => {
      cancelled = true;
    };
  }, [getServerUrl]);

  return (
    <main>
      <h1>Костёр</h1>
      <p data-testid="health-status">{describeHealth(state)}</p>
    </main>
  );
}
