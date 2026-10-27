import type { SpellFacetsResponse } from '@koster/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useApi } from '../api/api-context';
import { paramsFromSearch, withFilter, type FilterKey } from '../catalog/list-params';
import { levelAndSchool } from '../catalog/spell-format';
import { CategoryIcon } from '../components/CategoryIcon';
import { QueryError } from '../components/QueryError';

const SEARCH_DELAY_MS = 250;

/** Экран списка заклинаний: поиск, фильтры, сортировка, страницы. */
export function SpellList() {
  const api = useApi();
  const [search, setSearch] = useSearchParams();
  const params = paramsFromSearch(search);

  const facets = useQuery({ queryKey: ['spell-facets'], queryFn: () => api.spellFacets() });
  const list = useQuery({
    queryKey: ['spells', params],
    queryFn: () => api.spells(params),
    placeholderData: keepPreviousData,
  });

  const change = (key: FilterKey | 'page', value: string) =>
    setSearch(withFilter(search, key, value), { replace: key !== 'page' });

  const pageCount = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;
  const page = list.data?.page ?? 1;

  return (
    <main className="page">
      <Link className="back-link" to="/reference">
        ← Справочник
      </Link>
      <h1>Заклинания</h1>

      <SearchInput value={search.get('q') ?? ''} onChange={(value) => change('q', value)} />
      <Filters facets={facets.data} search={search} onChange={change} />

      {list.isError && <QueryError error={list.error} />}
      {list.data && (
        <>
          <p className="muted" data-testid="result-count">
            Найдено: {list.data.total}
          </p>
          <ul className="result-list" aria-label="Результаты поиска">
            {list.data.items.map((spell) => (
              <li key={spell.id}>
                <Link className="result" to={`/reference/entity/${spell.id}`}>
                  <CategoryIcon category="spell" />
                  <span>
                    <span className="result__name">{spell.nameRu}</span>{' '}
                    <span className="muted">{spell.nameEn}</span>
                    <br />
                    <span className="result__meta">
                      {levelAndSchool(spell.level, spell.school, spell.ritual)}
                      {spell.concentration ? ' · концентрация' : ''} · {spell.sources.join(', ')}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {list.data.total > list.data.pageSize && (
            <nav className="pager" aria-label="Страницы">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => change('page', String(page - 1))}
              >
                ← Назад
              </button>
              <span>
                Страница {page} из {pageCount}
              </span>
              <button
                type="button"
                disabled={page >= pageCount}
                onClick={() => change('page', String(page + 1))}
              >
                Дальше →
              </button>
            </nav>
          )}
        </>
      )}
    </main>
  );
}

/** Поле поиска: запрос уходит, когда пользователь перестал печатать. */
function SearchInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [text, setText] = useState(value);
  const [shown, setShown] = useState(value);

  // Запрос сменился снаружи (кнопка «Назад»): поле показывает его. Свой ввод
  // не перезаписывается — иначе пропадал бы пробел, набранный между словами.
  if (value !== shown) {
    setShown(value);
    if (value !== text.trim()) {
      setText(value);
    }
  }

  useEffect(() => {
    if (text.trim() === value) {
      return;
    }
    const timer = setTimeout(() => onChange(text.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text, value, onChange]);

  return (
    <input
      className="search"
      type="search"
      placeholder="Поиск по названию и тексту: «огнен», «fireball»"
      aria-label="Поиск заклинаний"
      value={text}
      onChange={(event) => setText(event.target.value)}
    />
  );
}

interface FiltersProps {
  facets: SpellFacetsResponse | undefined;
  search: URLSearchParams;
  onChange: (key: FilterKey, value: string) => void;
}

function Filters({ facets, search, onChange }: FiltersProps) {
  const select = (
    key: FilterKey,
    label: string,
    options: { value: string | number; label: string; count?: number }[],
    anyLabel = 'Любой',
  ) => (
    <label>
      {label}
      <select value={search.get(key) ?? ''} onChange={(event) => onChange(key, event.target.value)}>
        <option value="">{anyLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.count === undefined ? option.label : `${option.label} (${option.count})`}
          </option>
        ))}
      </select>
    </label>
  );
  const yesNo = [
    { value: 'true', label: 'Да' },
    { value: 'false', label: 'Нет' },
  ];

  return (
    <div className="filters">
      {select('level', 'Уровень', facets?.level ?? [])}
      {select('school', 'Школа', facets?.school ?? [], 'Любая')}
      {select('class', 'Класс', facets?.class ?? [])}
      {select('source', 'Источник', facets?.source ?? [])}
      {select('ritual', 'Ритуал', yesNo, 'Не важно')}
      {select('concentration', 'Концентрация', yesNo, 'Не важно')}
      {select(
        'sort',
        'Сортировка',
        [
          { value: 'name', label: 'По названию' },
          { value: 'level', label: 'По уровню' },
        ],
        'Сначала точные совпадения',
      )}
    </div>
  );
}
