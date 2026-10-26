import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PATHS } from '../paths.ts';
import { fetchMissingPages } from './fetch-missing.ts';
import { openSpellCache } from './spell-cache.ts';

let folder: string;

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'koster-fetch-'));
  fs.cpSync(DEFAULT_PATHS.spellFixtures, folder, { recursive: true });
});

afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

describe('npm run catalog:fetch', () => {
  it('скачивает только недостающие страницы, с паузой между запросами', async () => {
    fs.rmSync(path.join(folder, 'pages', 'spell-1.html'));
    fs.rmSync(path.join(folder, 'pages', 'spell-2.html'));
    const cache = openSpellCache(folder);
    const requested: string[] = [];
    const pauses: number[] = [];

    const result = await fetchMissingPages(cache, {
      download: async (url) => {
        requested.push(url);
        return '<html></html>';
      },
      sleep: async (ms) => {
        pauses.push(ms);
      },
    });

    expect(result).toEqual({ missing: 2, fetched: 2, failed: [] });
    expect(requested).toHaveLength(2);
    expect(pauses).toEqual([1000]);
    expect(fs.existsSync(cache.pagePath(1))).toBe(true);
  });

  it('повторяет запрос при ошибке и сообщает о неудаче', async () => {
    fs.rmSync(path.join(folder, 'pages', 'spell-1.html'));
    let attempts = 0;

    const result = await fetchMissingPages(openSpellCache(folder), {
      download: async () => {
        attempts += 1;
        throw new Error('HTTP 503');
      },
      sleep: async () => undefined,
    });

    expect(attempts).toBe(3);
    expect(result.failed).toEqual([expect.objectContaining({ message: 'Error: HTTP 503' })]);
  });
});
