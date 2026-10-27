import type { RaceFacetsResponse } from '@koster/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { useApi } from '../api/api-context';
import { raceParamsFromSearch, withFilter, type RaceFilterKey } from '../catalog/list-params';
import { raceSummary } from '../catalog/race-format';
import { CategoryIcon } from '../components/CategoryIcon';
import { FilterSelect, Pager, SearchInput, type FilterOption } from '../components/ListControls';
import { QueryError } from '../components/QueryError';

/** Экран списка рас: поиск, фильтры, страницы. Разновидность — сразу за своей расой. */
export function RaceList() {
  const api = useApi();
  const [search, setSearch] = useSearchParams();
  const params = raceParamsFromSearch(search);

  const facets = useQuery({ queryKey: ['race-facets'], queryFn: () => api.raceFacets() });
  const list = useQuery({
    queryKey: ['races', params],
    queryFn: () => api.races(params),
    placeholderData: keepPreviousData,
  });

  const change = (key: RaceFilterKey | 'page', value: string) =>
    setSearch(withFilter(search, key, value), { replace: key !== 'page' });

  return (
    <main className="page">
      <Link className="back-link" to="/reference">
        ← Справочник
      </Link>
      <h1>Расы</h1>

      <SearchInput
        label="Поиск рас"
        placeholder="Поиск по названию и тексту: «эльф», «darkvision»"
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
            {list.data.items.map((race) => (
              <li key={race.id}>
                <Link
                  className={race.kind === 'variant' ? 'result result--nested' : 'result'}
                  to={`/reference/entity/${race.id}`}
                >
                  <CategoryIcon category="race" />
                  <span>
                    <span className="result__name">{race.nameRu}</span>{' '}
                    <span className="muted">{race.nameEn}</span>
                    <br />
                    <span className="result__meta">
                      {raceSummary(race)} · {race.sources.join(', ')}
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
  facets: RaceFacetsResponse | undefined;
  search: URLSearchParams;
  onChange: (key: RaceFilterKey, value: string) => void;
}

function Filters({ facets, search, onChange }: FiltersProps) {
  const select = (
    key: RaceFilterKey,
    label: string,
    options: readonly FilterOption[],
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
  const yesNo = (yes: string, no: string): FilterOption[] => [
    { value: 'true', label: yes },
    { value: 'false', label: no },
  ];

  return (
    <div className="filters">
      {select('kind', 'Расы и разновидности', facets?.kind ?? [], 'Все')}
      {select('size', 'Размер', facets?.size ?? [])}
      {select('flying', 'Полёт', yesNo('Летают', 'Не летают'), 'Все')}
      {select('darkvision', 'Тёмное зрение', yesNo('Есть', 'Нет'), 'Все')}
      {select('source', 'Источник', facets?.source ?? [])}
      {select(
        'sort',
        'Сортировка',
        [{ value: 'name', label: 'По названию' }],
        'Сначала точные совпадения',
      )}
    </div>
  );
}
