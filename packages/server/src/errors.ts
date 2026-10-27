import type { ApiErrorBody, ApiErrorCode } from '@koster/shared';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

const STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  not_found: 404,
  catalog_unavailable: 503,
  internal: 500,
};

/** Ошибка, которую маршрут бросает, чтобы ответить в едином формате. */
export class HttpError extends Error {
  readonly code: ApiErrorCode;
  readonly details: unknown;

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.code = code;
    this.details = details;
  }
}

export function sendError(
  reply: FastifyReply,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
): FastifyReply {
  const body: ApiErrorBody = {
    error: { code, message, ...(details === undefined ? {} : { details }) },
  };
  return reply.status(STATUS[code]).send(body);
}

/** Проверяет параметры запроса схемой; ошибка — 400 со списком полей. */
export function parseOr400<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new HttpError('bad_request', 'Неверные параметры запроса', z.flattenError(result.error));
  }
  return result.data;
}

/** Любая ошибка и неизвестный адрес отвечают `{ error: { code, message } }`. */
export function registerErrorHandling(server: FastifyInstance): void {
  server.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      return sendError(reply, error.code, error.message, error.details);
    }
    const status = (error as { statusCode?: number }).statusCode;
    if (status !== undefined && status >= 400 && status < 500) {
      return sendError(
        reply,
        'bad_request',
        error instanceof Error ? error.message : String(error),
      );
    }
    return sendError(reply, 'internal', 'Внутренняя ошибка сервера');
  });
  server.setNotFoundHandler((request, reply) =>
    sendError(reply, 'not_found', `Нет такого адреса: ${request.method} ${request.url}`),
  );
}
