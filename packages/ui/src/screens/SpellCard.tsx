import type { SpellEntityResponse } from '@koster/shared';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useApi } from '../api/api-context';
import {
  AUTOMATION_TEXT,
  classesText,
  componentsText,
  damageTypeName,
  levelAndSchool,
  REVIEW_STATUS_TEXT,
  subclassesText,
  targetsText,
} from '../catalog/spell-format';
import { CategoryIcon } from '../components/CategoryIcon';
import { QueryError } from '../components/QueryError';
import { TextBlocks } from '../components/TextBlocks';

const TAG_NAMES: Record<string, string> = {
  dunamancy: 'Дюнамантия',
  chronurgy: 'Хронургия',
  graviturgy: 'Гравитургия',
};

/** Карточка заклинания: все поля spell/v1, источники, ссылка на DnD.su, статус проверки. */
export function SpellCard() {
  const api = useApi();
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const card = useQuery({ queryKey: ['entity', id], queryFn: () => api.spell(id) });

  return (
    <main className="page">
      <button type="button" className="back-link" onClick={() => void navigate(-1)}>
        ← К списку
      </button>
      {card.isPending && <p className="muted">Загрузка…</p>}
      {card.isError && <QueryError error={card.error} />}
      {card.data && <SpellCardBody card={card.data} />}
    </main>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

function SpellCardBody({ card }: { card: SpellEntityResponse }) {
  const { data } = card;
  const targets = targetsText(data);
  const verified = card.reviewStatus === 'rules_verified';

  return (
    <article aria-labelledby="spell-name">
      <header className="card-header">
        <CategoryIcon category="spell" large />
        <div>
          <h1 id="spell-name">{card.nameRu}</h1>
          <p className="muted">
            {card.nameEn}
            {card.aliases.length > 0 && ` · также: ${card.aliases.join(', ')}`}
          </p>
          <p data-testid="spell-level-school">
            {levelAndSchool(data.level, data.school, data.ritual)}
          </p>
        </div>
      </header>

      {card.withdrawn && (
        <p className="error">Заклинание пропало из источника. Карточка сохранена для ссылок.</p>
      )}

      <dl className="facts">
        <Fact label="Время накладывания">{data.castingTime.text}</Fact>
        {data.castingTime.reactionTrigger && (
          <Fact label="Условие реакции">{data.castingTime.reactionTrigger}</Fact>
        )}
        <Fact label="Дистанция">{data.range.text}</Fact>
        <Fact label="Компоненты">
          <span data-testid="spell-components">{componentsText(data.components)}</span>
        </Fact>
        <Fact label="Длительность">{data.duration.text}</Fact>
        <Fact label="Концентрация">{data.concentration ? 'Да' : 'Нет'}</Fact>
        <Fact label="Ритуал">{data.ritual ? 'Да' : 'Нет'}</Fact>
        <Fact label="Классы">{classesText(data)}</Fact>
        <Fact label="Подклассы">{subclassesText(data)}</Fact>
        {data.damageTypes.length > 0 && (
          <Fact label="Типы урона">{data.damageTypes.map(damageTypeName).join(', ')}</Fact>
        )}
        {targets && <Fact label="Цели">{targets}</Fact>}
        {data.tags.length > 0 && (
          <Fact label="Метки">{data.tags.map((tag) => TAG_NAMES[tag] ?? tag).join(', ')}</Fact>
        )}
        <Fact label="Источники">
          {card.sources.map((source, index) => (
            <span key={source.id}>
              {index > 0 && ', '}
              <abbr title={source.nameRu ?? source.nameEn}>{source.code}</abbr>
              {source.url && (
                <>
                  {' '}
                  (
                  <a href={source.url} target="_blank" rel="noreferrer">
                    DnD.su
                  </a>
                  )
                </>
              )}
            </span>
          ))}
        </Fact>
        <Fact label="Проверка">
          <span className={verified ? 'badge badge--ok' : 'badge'}>
            {REVIEW_STATUS_TEXT[card.reviewStatus]}
          </span>{' '}
          <span className="muted">{AUTOMATION_TEXT[card.automation]}</span>
        </Fact>
        <Fact label="Ревизия">
          {card.revision.revision} от {card.revision.createdAt.slice(0, 10)}
          {card.revisions.length > 1 && (
            <span className="muted"> (всего ревизий: {card.revisions.length})</span>
          )}
        </Fact>
      </dl>

      <h2>Описание</h2>
      <TextBlocks blocks={data.description} />

      {data.higherLevels.length > 0 && (
        <>
          <h2>На больших уровнях</h2>
          <TextBlocks blocks={data.higherLevels} />
        </>
      )}

      {card.rules && (
        <p className="muted">
          Механика проверена вручную: эффектов {card.rules.effects.length}. Применение — на
          следующих этапах.
        </p>
      )}

      <p className="muted">
        <Link to="/reference/spell">Все заклинания</Link>
      </p>
    </article>
  );
}
