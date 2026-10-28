import { CATALOG_QUERY_MAX } from '@koster/shared';

// Общие элементы экранов-списков каталога: поиск, выбор фильтра, страницы.

/**
 * Поле поиска. Запрос сразу пишется в адрес экрана, без задержки: каталог
 * локальный, а «Назад» из карточки всегда возвращает к набранному запросу.
 */
export function SearchInput({
  value,
  label,
  placeholder,
  onChange,
}: {
  value: string;
  label: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      className="search"
      type="search"
      placeholder={placeholder}
      aria-label={label}
      maxLength={CATALOG_QUERY_MAX}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export interface FilterOption {
  value: string | number;
  label: string;
  count?: number;
}

export function FilterSelect({
  label,
  value,
  options,
  anyLabel = 'Любой',
  onChange,
}: {
  label: string;
  value: string;
  options: readonly FilterOption[];
  anyLabel?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{anyLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.count === undefined ? option.label : `${option.label} (${option.count})`}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Pager({
  page,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) {
    return null;
  }
  return (
    <nav className="pager" aria-label="Страницы">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ← Назад
      </button>
      <span>
        Страница {page} из {pageCount}
      </span>
      <button type="button" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
        Дальше →
      </button>
    </nav>
  );
}
