import {
  CATEGORY_NAMES_RU,
  type ReferenceFacetsResponse,
  type ReferenceListCategory,
} from '@koster/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { useApi } from '../api/api-context';
import {
  referenceParamsFromSearch,
  withFilter,
  type ReferenceFilterKey,
} from '../catalog/list-params';
import { CategoryIcon } from '../components/CategoryIcon';
import { FilterSelect, Pager, SearchInput, type FilterOption } from '../components/ListControls';
import { QueryError } from '../components/QueryError';

/** Подсказка поиска своей категории. */
const PLACEHOLDERS: Record<ReferenceListCategory, string> = {
  skill: 'Поиск по названию и тексту: «скрыт», «athletics»',
  language: 'Поиск по названию и носителям: «эльф», «draconic»',
  condition: 'Поиск по названию и тексту: «ничком», «poisoned»',
  background: 'Поиск по названию и тексту: «артист», «sage»',
  feat: 'Поиск по названию и тексту: «доспех», «lucky»',
};

/**
 * Экран списка справочной категории этапа 3: навыки, языки, состояния, предыстории,
 * черты. Поиск, фильтры своей категории, страницы.
 */
export function ReferenceList({ category }: { category: ReferenceListCategory }) {
  const api = useApi();
  const [search, setSearch] = useSearchParams();
  const params = referenceParamsFromSearch(search);

  const facets = useQuery({
    queryKey: ['reference-facets', category],
    queryFn: () => api.referenceFacets(category),
  });
  const list = useQuery({
    queryKey: ['reference', category, params],
    queryFn: () => api.reference(category, params),
    placeholderData: keepPreviousData,
  });

  const change = (key: ReferenceFilterKey | 'page', value: string) =>
    setSearch(withFilter(search, key, value), { replace: key !== 'page' });
  const title = CATEGORY_NAMES_RU[category];

  return (
    <main className="page">
      <Link className="back-link" to="/reference">
        ← Справочник
      </Link>
      <h1>{title}</h1>

      <SearchInput
        label={`Поиск: ${title.toLowerCase()}`}
        placeholder={PLACEHOLDERS[category]}
        value={search.get('q') ?? ''}
        onChange={(value) => change('q', value)}
      />
      <Filters category={category} facets={facets.data} search={search} onChange={change} />

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
                  <CategoryIcon category={category} />
                  <span>
                    <span className="result__name">{item.nameRu}</span>{' '}
                    <span className="muted">{item.nameEn}</span>
                    <br />
                    <span className="result__meta">
                      {[item.detail, item.sources.join(', ')].filter(Boolean).join(' · ')}
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
  category: ReferenceListCategory;
  facets: ReferenceFacetsResponse | undefined;
  search: URLSearchParams;
  onChange: (key: ReferenceFilterKey, value: string) => void;
}

function Filters({ category, facets, search, onChange }: FiltersProps) {
  const select = (
    key: ReferenceFilterKey,
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
      {category === 'skill' && select('ability', 'Характеристика', facets?.ability ?? [], 'Любая')}
      {category === 'language' && select('kind', 'Вид языка', facets?.kind ?? [])}
      {category === 'background' && select('kind', 'Вид', facets?.kind ?? [], 'Все')}
      {category === 'background' &&
        select('grantsFeat', 'Черта от умения', yesNo('Даёт черту', 'Не даёт'), 'Все')}
      {category === 'feat' && (
        <>
          {select('prerequisite', 'Требование', yesNo('Есть', 'Нет'), 'Все')}
          {select('raceRequired', 'Требует расу', yesNo('Да', 'Нет'), 'Все')}
          {select('abilityIncrease', 'Увеличение характеристики', yesNo('Да', 'Нет'), 'Все')}
        </>
      )}
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
