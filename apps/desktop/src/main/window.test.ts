import { describe, expect, it } from 'vitest';
import { createWindowOptions } from './window';

describe('createWindowOptions', () => {
  const options = createWindowOptions('preload.js');
  const web = options.webPreferences;

  it('изолирует окно от Node.js', () => {
    expect(web?.contextIsolation).toBe(true);
    expect(web?.sandbox).toBe(true);
    expect(web?.nodeIntegration).toBe(false);
    expect(web?.nodeIntegrationInWorker).toBe(false);
    expect(web?.nodeIntegrationInSubFrames).toBe(false);
  });

  it('не отключает защиту веб-страницы', () => {
    expect(web?.webSecurity).toBe(true);
    expect(web?.allowRunningInsecureContent).toBe(false);
    expect(web?.webviewTag).toBe(false);
  });

  it('подключает только переданный preload', () => {
    expect(web?.preload).toBe('preload.js');
  });

  it('называет окно «Костёр»', () => {
    expect(options.title).toBe('Костёр');
  });
});
