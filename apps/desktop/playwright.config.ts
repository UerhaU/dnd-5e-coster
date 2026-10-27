import { defineConfig } from '@playwright/test';

// Сценарии Playwright в собранной программе (раздел 9). Браузеры Playwright не нужны:
// запускается сам Koster.exe через Electron. Сначала соберите программу (см. e2e/app.ts).
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 60_000,
  workers: 1,
  reporter: [['list']],
  outputDir: 'release/e2e-results',
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
