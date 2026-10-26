import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';
import type { Plugin } from 'vite';
import { buildCsp } from './src/main/csp';

/** Вставляет Content-Security-Policy в index.html окна. */
function cspPlugin(): Plugin {
  let mode: 'production' | 'development' = 'production';

  return {
    name: 'koster-csp',
    configResolved(config) {
      mode = config.command === 'serve' ? 'development' : 'production';
    },
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: buildCsp(mode) },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

// Пакеты монорепозитория — это исходники на TS, их нужно собрать в бандл.
// Наружу остаются зависимости из dependencies (better-sqlite3, fastify):
// electron-builder копирует их в программу вместе с их зависимостями.
const workspacePackages = ['@koster/db', '@koster/server', '@koster/shared'];

export default defineConfig({
  main: {
    build: {
      externalizeDeps: { exclude: workspacePackages },
    },
  },
  preload: {
    build: {
      externalizeDeps: { exclude: workspacePackages },
    },
  },
  renderer: {
    plugins: [react(), cspPlugin()],
  },
});
