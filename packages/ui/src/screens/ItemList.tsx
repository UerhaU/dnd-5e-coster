import type { ItemFacetsResponse } from '@koster/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { useApi } from '../api/api-context';
import { itemSummary } from '../catalog/item-format';
import { itemParamsFromSearch, withFilter, type ItemFilterKey } from '../catalog/list-params';
import { CategoryIcon } from '../components/CategoryIcon';
import { FilterSelect, Pager, SearchInput, type FilterOption } from '../components/ListControls';
import { QueryError } from '../components/QueryError';

/** Экран списка снаряжения: поиск, фильтры по виду и свойствам, сортировка, страницы. */
export function ItemList() {
  const api = useApi();
  const [search, setSearch] = useSearchParams();
  const params = itemParamsFromSearch(search);

  const facets = useQuery({ queryKey: ['item-facets'], queryFn: () => api.itemFacets() });
  const list = useQuery({
    queryKey: ['items', params],
    queryFn: () => api.items(params),
    placeholderData: keepPreviousData,
  });

  const change = (key: ItemFilterKey | 'page', value: string) =>
    setSearch(withFilter(search, key, value), { replace: key !== 'page' });

  return (
    <main className="page">
      <Link className="back-link" to="/reference">
        ← Справочник
      </Link>
      <h1>Снаряжение</h1>

      <SearchInput
        label="Поиск снаряжения"
        placeholder="Поиск по названию и тексту: «меч», «longsword»"
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
            {list.data.items.map((item) => (
              <li key={item.id}>
                <Link className="result" to={`/reference/entity/${item.id}`}>
                  <CategoryIcon category="item" />
                  <span>
                    <span className="result__name">{item.nameRu}</span>{' '}
                    <span className="muted">{item.nameEn}</span>
                    <br />
                    <span className="result__meta">
                      {itemSummary(item)} · {item.sources.join(', ')}
                      {item.optionalRule && (
                        <span className="badge result__access">вариант правил</span>
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
  facets: ItemFacetsResponse | undefined;
  search: URLSearchParams;
  onChange: (key: ItemFilterKey, value: string) => void;
}

function Filters({ facets, search, onChange }: FiltersProps) {
  const select = (
    key: ItemFilterKey,
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

  return (
    <div className="filters">
      {select('kind', 'Вид', facets?.kind ?? [])}
      {select('category', 'Группа', facets?.category ?? [], 'Любая')}
      {select('property', 'Свойство оружия', facets?.property ?? [])}
      {select('damageType', 'Тип урона', facets?.damageType ?? [])}
      {select('source', 'Источник', facets?.source ?? [])}
      {select(
        'optionalRule',
        'Вариант правил',
        [
          { value: 'false', label: 'Только обычные правила' },
          { value: 'true', label: 'Только с разрешения мастера' },
        ],
        'Все',
      )}
      {select(
        'sort',
        'Сортировка',
        [
          { value: 'name', label: 'По названию' },
          { value: 'cost', label: 'По цене' },
          { value: 'weight', label: 'По весу' },
        ],
        'Сначала точные совпадения',
      )}
    </div>
  );
}
