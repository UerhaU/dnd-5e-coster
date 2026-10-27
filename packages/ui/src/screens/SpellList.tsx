import type { SpellFacetsResponse } from '@koster/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { useApi } from '../api/api-context';
import { paramsFromSearch, withFilter, type FilterKey } from '../catalog/list-params';
import { classAccessText, levelAndSchool } from '../catalog/spell-format';
import { CategoryIcon } from '../components/CategoryIcon';
import { FilterSelect, Pager, SearchInput } from '../components/ListControls';
import { QueryError } from '../components/QueryError';

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

  return (
    <main className="page">
      <Link className="back-link" to="/reference">
        ← Справочник
      </Link>
      <h1>Заклинания</h1>

      <SearchInput
        label="Поиск заклинаний"
        placeholder="Поиск по названию и тексту: «огнен», «fireball»"
        value={search.get('q') ?? ''}
        onChange={(value) => change('q', value)}
      />
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
                      {classAccessText(spell.classAccess) && (
                        <span className="badge result__access">
                          {classAccessText(spell.classAccess)}
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Pager
            page={list.data.page}
            total={list.data.total}
            pageSize={list.data.pageSize}
            onPage={(page) => change('page', String(page))}
          />
        </>
      )}
    </main>
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
    <FilterSelect
      label={label}
      value={search.get(key) ?? ''}
      options={options}
      anyLabel={anyLabel}
      onChange={(value) => onChange(key, value)}
    />
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
