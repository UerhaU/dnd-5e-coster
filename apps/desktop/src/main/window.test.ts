import { describe, expect, it } from 'vitest';
import { createWindowOptions, isAllowedExternalUrl } from './window';

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

describe('isAllowedExternalUrl', () => {
  it('открывает во внешнем браузере только DnD.su по https', () => {
    expect(isAllowedExternalUrl('https://5e14.dnd.su/spells/205-fireball/')).toBe(true);
    expect(isAllowedExternalUrl('https://dnd.su/spells/')).toBe(true);
  });

  it('не открывает другие адреса и протоколы', () => {
    for (const url of [
      'http://dnd.su/spells/',
      'https://dnd.su.example.com/',
      'https://evildnd.su/',
      'https://user@dnd.su/',
      'https://dnd.su:8443/',
      'file:///C:/Windows/',
      'javascript:alert(1)',
      'не адрес',
    ]) {
      expect(isAllowedExternalUrl(url), url).toBe(false);
    }
  });
});
