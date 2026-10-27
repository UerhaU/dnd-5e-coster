import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useApi } from '../api/api-context';
import { CategoryIcon } from '../components/CategoryIcon';
import { QueryError } from '../components/QueryError';

/** Справочник: категории каталога. На этапе 1 — только заклинания. */
export function ReferenceHome() {
  const api = useApi();
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api.categories() });

  return (
    <main className="page">
      <Link className="back-link" to="/">
        ← Главное меню
      </Link>
      <h1>Справочник</h1>
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
    </main>
  );
}
