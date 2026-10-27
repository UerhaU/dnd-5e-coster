import type { z } from 'zod';
import { healthResponseSchema, type HealthResponse } from '../health.ts';
import {
  categoriesResponseSchema,
  spellEntityResponseSchema,
  spellFacetsResponseSchema,
  spellListResponseSchema,
  type CategoriesResponse,
  type SpellEntityResponse,
  type SpellFacetsResponse,
  type SpellListParams,
  type SpellListResponse,
} from './catalog.ts';
import { apiErrorSchema, type ApiErrorCode } from './errors.ts';

// Общий клиент API (раздел 8.4): интерфейс обращается к серверу только через него.
// Каждый ответ проверяется той же схемой, что и на сервере.

// Без свойств в параметрах конструктора: Node запускает .ts без tsx (Р48).
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | 'network';

  constructor(status: number, code: ApiErrorCode | 'network', message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export interface ApiClient {
  health(): Promise<HealthResponse>;
  categories(): Promise<CategoriesResponse>;
  spells(params: SpellListParams): Promise<SpellListResponse>;
  spellFacets(): Promise<SpellFacetsResponse>;
  spell(id: string, revision?: number): Promise<SpellEntityResponse>;
}

/** Строка запроса без пустых значений: `{ q: '', level: 3 }` → `?level=3`. */
export function toQueryString(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export function createApiClient(
  getBaseUrl: () => Promise<string>,
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
): ApiClient {
  async function get<T extends z.ZodType>(path: string, schema: T): Promise<z.infer<T>> {
    const baseUrl = await getBaseUrl();
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`);
    } catch (error) {
      throw new ApiError(0, 'network', `Сервер не отвечает: ${String(error)}`);
    }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const parsed = apiErrorSchema.safeParse(body);
      throw parsed.success
        ? new ApiError(response.status, parsed.data.error.code, parsed.data.error.message)
        : new ApiError(response.status, 'internal', `Сервер ответил кодом ${response.status}`);
    }
    return schema.parse(body);
  }

  return {
    health: () => get('/api/health', healthResponseSchema),
    categories: () => get('/api/catalog/categories', categoriesResponseSchema),
    spells: (params) => get(`/api/catalog/spell${toQueryString(params)}`, spellListResponseSchema),
    spellFacets: () => get('/api/catalog/spell/facets', spellFacetsResponseSchema),
    spell: (id, revision) =>
      get(
        revision === undefined
          ? `/api/catalog/entity/${encodeURIComponent(id)}`
          : `/api/catalog/entity/${encodeURIComponent(id)}/revisions/${revision}`,
        spellEntityResponseSchema,
      ),
  };
}
