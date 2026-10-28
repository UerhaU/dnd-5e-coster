import { createApiClient, REFERENCE_LIST_CATEGORIES } from '@koster/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { createHashRouter, RouterProvider } from 'react-router';
import { ApiProvider } from './api/api-context';
import { EntityCard } from './screens/EntityCard';
import { ItemList } from './screens/ItemList';
import { RaceList } from './screens/RaceList';
import { MainMenu } from './screens/MainMenu';
import { ReferenceHome } from './screens/ReferenceHome';
import { ReferenceList } from './screens/ReferenceList';
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
  { path: '/reference/item', element: <ItemList /> },
  { path: '/reference/race', element: <RaceList /> },
  // Справочные категории этапа 3: один экран списка; `key` — новый экран на категорию.
  ...REFERENCE_LIST_CATEGORIES.map((category) => ({
    path: `/reference/${category}`,
    element: <ReferenceList key={category} category={category} />,
  })),
  { path: '/reference/entity/:id', element: <EntityCard /> },
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
