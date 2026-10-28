import type { EntityResponse } from '@koster/shared';
import type { ReactNode } from 'react';
import { AUTOMATION_TEXT, REVIEW_STATUS_TEXT } from '../catalog/spell-format';

// Части карточки, общие для всех категорий: строка фактов, источники, проверка, ревизия.

export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

/** Источники, проверка и ревизия — последние строки списка фактов. */
export function CommonFacts({ card }: { card: EntityResponse }) {
  const verified = card.reviewStatus === 'rules_verified';
  return (
    <>
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
    </>
  );
}
