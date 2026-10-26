/** Каналы между окном и главным процессом. Других нет. */
export const IPC_GET_SERVER_URL = 'koster:get-server-url';

/** Что preload открывает окну как `window.koster`. */
export interface KosterBridge {
  getServerUrl: () => Promise<string>;
}
