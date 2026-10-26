import { contextBridge, ipcRenderer } from 'electron';
import { IPC_GET_SERVER_URL, type KosterBridge } from '../shared/ipc';

// Узкий preload: окно получает только адрес встроенного сервера.
const bridge: KosterBridge = {
  getServerUrl: () => ipcRenderer.invoke(IPC_GET_SERVER_URL) as Promise<string>,
};

contextBridge.exposeInMainWorld('koster', bridge);
