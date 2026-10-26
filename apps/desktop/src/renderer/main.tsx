import { App } from '@koster/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Нет элемента #root');
}

createRoot(root).render(
  <StrictMode>
    <App getServerUrl={window.koster.getServerUrl} />
  </StrictMode>,
);
