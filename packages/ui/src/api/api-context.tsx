import type { ApiClient } from '@koster/shared';
import { createContext, useContext, type ReactNode } from 'react';

// Общий клиент API (раздел 8.4) доступен экранам через контекст:
// так экраны не знают, откуда берётся адрес сервера.

const ApiContext = createContext<ApiClient | null>(null);

export function ApiProvider({ client, children }: { client: ApiClient; children: ReactNode }) {
  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiClient {
  const client = useContext(ApiContext);
  if (!client) {
    throw new Error('useApi вызван вне ApiProvider');
  }
  return client;
}
