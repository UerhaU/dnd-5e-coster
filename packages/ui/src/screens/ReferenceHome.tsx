import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { useApi } from '../api/api-context';
import { searchParamsFromSearch, withFilter } from '../catalog/list-params';
import { categoryCountText, searchResultSummary } from '../catalog/search-format';
import { CategoryIcon } from '../components/CategoryIcon';
import { Pager, SearchInput } from '../components/ListControls';
import { QueryError } from '../components/QueryError';

/**
 * Справочник: одна строка поиска по всему каталогу (Р54) и категории — заклинания,
 * снаряжение и расы. Пока запрос пуст, показываются категории.
 */
export function ReferenceHome() {
  const api = useApi();
  const [search, setSearch] = useSearchParams();
  const params = searchParamsFromSearch(search);
  const query = params.q ?? '';

  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api.categories() });
  const results = useQuery({
    queryKey: ['search', params],
    queryFn: () => api.search(params),
    enabled: query !== '',
    placeholderData: keepPreviousData,
  });

  const change = (key: 'q' | 'page', value: string) =>
    setSearch(withFilter(search, key, value), { replace: key !== 'page' });

  return (
    <main className="page">
      <Link className="back-link" to="/">
        ← Главное меню
      </Link>
      <h1>Справочник</h1>

      <SearchInput
        label="Поиск по всему справочнику"
        placeholder="Поиск везде: «меч», «щит», «эльф», «fireball»"
        value={search.get('q') ?? ''}
        onChange={(value) => change('q', value)}
      />

      {query === '' ? (
        <>
          {categories.isError && <QueryError error={categories.error} />}
          <ul className="result-list">
            {categories.data?.categories.map((category) => (
              <li key={category.id}>
                <Link className="result" to={`/reference/${category.id}`}>
                  <CategoryIcon category={category.id} />
                  <span className="result__name">{category.nameRu}</span>
                  <span className="result__meta">{category.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          {results.isError && <QueryError error={results.error} />}
          {results.data && (
            <>
              <p className="muted" data-testid="result-count">
                Найдено: {results.data.total}
                {results.data.byCategory.length > 0 &&
                  ` (${results.data.byCategory.map(categoryCountText).join(', ')})`}
              </p>
              <ul className="result-list" aria-label="Результаты поиска">
                {results.data.items.map((item) => (
                  <li key={item.id}>
                    <Link className="result" to={`/reference/entity/${item.id}`}>
                      <CategoryIcon category={item.category} />
                      <span>
                        <span className="result__name">{item.nameRu}</span>{' '}
                        <span className="muted">{item.nameEn}</span>
                        <br />
                        <span className="result__meta" data-testid="result-category">
                          {searchResultSummary(item)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Pager
                page={results.data.page}
                total={results.data.total}
                pageSize={results.data.pageSize}
                onPage={(page) => change('page', String(page))}
              />
            </>
          )}
        </>
      )}
    </main>
  );
}
