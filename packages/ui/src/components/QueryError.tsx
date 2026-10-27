import { ApiError } from '@koster/shared';

/** Сообщение об ошибке запроса: текст сервера, если он есть. */
export function QueryError({ error }: { error: Error }) {
  const message =
    error instanceof ApiError && error.code === 'not_found'
      ? 'Не найдено.'
      : `Не удалось загрузить: ${error.message}`;
  return (
    <p className="error" role="alert">
      {message}
    </p>
  );
}
