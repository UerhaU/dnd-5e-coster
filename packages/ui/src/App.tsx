import { createApiClient } from '@koster/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { createHashRouter, RouterProvider } from 'react-router';
import { ApiProvider } from './api/api-context';
import { MainMenu } from './screens/MainMenu';
import { ReferenceHome } from './screens/ReferenceHome';
import { SpellCard } from './screens/SpellCard';
import { SpellList } from './screens/SpellList';
import './theme/tokens.css';
import './theme/base.css';

export interface AppProps {
  /** Возвращает адрес встроенного сервера. Окно получает его от главного процесса. */
  getServerUrl: () => Promise<string>;
}

// Адреса экранов — после `#`: окно открыто как app://koster/index.html (Р44),
// и обновление страницы не должно искать на диске файл `/reference`.
const router = createHashRouter([
  { path: '/', element: <MainMenu /> },
  { path: '/reference', element: <ReferenceHome /> },
  { path: '/reference/spell', element: <SpellList /> },
  { path: '/reference/entity/:id', element: <SpellCard /> },
]);

/** Приложение: общий клиент API, TanStack Query и роутер. Временная тема (Р14). */
export function App({ getServerUrl }: AppProps) {
  const [client] = useState(() => createApiClient(getServerUrl));
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // Каталог не меняется, пока программа работает (Р21): данные не устаревают.
        defaultOptions: { queries: { staleTime: Infinity, retry: 1 } },
      }),
  );

  return (
    <ApiProvider client={client}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ApiProvider>
  );
}
