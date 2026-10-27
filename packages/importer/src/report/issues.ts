/** Строка отчёта импорта: что не так с объектом и насколько это серьёзно. */
export interface ImportIssue {
  /**
   * `error` — объект не попал в каталог; `skip` — пропущен по правилу (Р12);
   * `warning` — объект в каталоге, но поле не разобрано или расходится с другим источником.
   */
  severity: 'error' | 'skip' | 'warning';
  entityId: string | null;
  dndsuId: number | null;
  field: string;
  message: string;
}
