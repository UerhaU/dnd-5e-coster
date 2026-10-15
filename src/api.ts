export type HttpMethod = 'POST' | 'PATCH' | 'DELETE';

type RuntimeImportMeta = ImportMeta & {
  env?: {
    VITE_API_BASE_URL?: string;
  };
};

function getApiBaseUrl() {
  const configured = (import.meta as RuntimeImportMeta).env?.VITE_API_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  const { protocol, hostname } = window.location;
  const apiHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' ? '127.0.0.1' : hostname;
  return `${protocol}//${apiHost}:3000`;
}

function resolveApiUrl(url: string) {
  if (/^https?:\/\//i.test(url) || !url.startsWith('/api')) {
    return url;
  }

  return `${getApiBaseUrl()}${url}`;
}

export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const requestUrl = resolveApiUrl(url);
  const response = await fetch(requestUrl, { signal });
  if (!response.ok) {
    throw new Error(`Запрос ${url} завершился ошибкой ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function sendJson<T>(url: string, method: HttpMethod, body?: unknown): Promise<T> {
  const requestUrl = resolveApiUrl(url);
  const response = await fetch(requestUrl, {
    method,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? `Запрос ${url} завершился ошибкой ${response.status}`);
  }

  return response.json() as Promise<T>;
}
