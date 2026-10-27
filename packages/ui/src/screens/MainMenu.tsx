import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useApi } from '../api/api-context';
import { describeHealth } from '../health-status';

// Главное меню (Р33). На этапе 1 работает только «Справочник»,
// остальные пункты видны, но неактивны.
const ITEMS: { label: string; to?: string }[] = [
  { label: 'Подключиться к игре' },
  { label: 'Мои персонажи' },
  { label: 'Мои кампании' },
  { label: 'Справочник', to: '/reference' },
  { label: 'Хоумбрю' },
  { label: 'Настройки' },
  { label: 'Выход' },
];

export function MainMenu() {
  const api = useApi();
  const health = useQuery({ queryKey: ['health'], queryFn: () => api.health() });

  return (
    <main className="page">
      <h1>Костёр</h1>
      <nav aria-label="Главное меню">
        <ul className="main-menu">
          {ITEMS.map((item) => (
            <li key={item.label}>
              {item.to ? (
                <Link className="main-menu__item" to={item.to}>
                  {item.label}
                </Link>
              ) : (
                <span className="main-menu__item main-menu__item--disabled" aria-disabled="true">
                  {item.label}
                  <span className="main-menu__later">появится позже</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>
      <p className="footer muted" data-testid="health-status">
        {describeHealth(
          health.isPending
            ? { kind: 'loading' }
            : health.isError
              ? { kind: 'error', message: health.error.message }
              : { kind: 'ok', health: health.data },
        )}
      </p>
    </main>
  );
}
