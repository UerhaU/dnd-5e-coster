import fs from 'node:fs';
import path from 'node:path';
import type { PageList } from './spell-cache.ts';

// Шаг fetch (раздел 6): скачать только страницы, которых нет в кэше.
// Бережно к сайту: не чаще одного запроса в секунду, повтор с паузой.

export interface FetchOptions {
  /** Скачивает страницу; по умолчанию — fetch с таймаутом. */
  download?: (url: string) => Promise<string>;
  /** Пауза между запросами, мс. */
  delayMs?: number;
  retries?: number;
  sleep?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
}

export interface FetchResult {
  missing: number;
  fetched: number;
  failed: { url: string; message: string }[];
}

async function defaultDownload(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Koster catalog importer (personal, non-commercial)' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function fetchMissingPages(
  cache: PageList,
  options: FetchOptions = {},
): Promise<FetchResult> {
  const download = options.download ?? defaultDownload;
  const delayMs = options.delayMs ?? 1000;
  const retries = options.retries ?? 3;
  const sleep = options.sleep ?? defaultSleep;
  const log = options.log ?? (() => undefined);

  const missing = cache.listPages().filter((page) => !fs.existsSync(page.file));
  const result: FetchResult = { missing: missing.length, fetched: 0, failed: [] };

  for (const [index, page] of missing.entries()) {
    if (index > 0) {
      await sleep(delayMs);
    }
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        const html = await download(page.url);
        const file = page.file;
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, html);
        result.fetched += 1;
        log(`Скачано: ${page.url}`);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        await sleep(delayMs * 2 ** attempt);
      }
    }
    if (lastError !== null) {
      result.failed.push({ url: page.url, message: String(lastError) });
      log(`Не скачано: ${page.url}: ${String(lastError)}`);
    }
  }
  return result;
}
