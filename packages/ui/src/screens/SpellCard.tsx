import type { SpellEntityResponse } from '@koster/shared';
import { Link } from 'react-router';
import {
  classesText,
  componentsText,
  damageTypeName,
  levelAndSchool,
  subclassesText,
  targetsText,
} from '../catalog/spell-format';
import { CommonFacts, Fact } from '../components/CardParts';
import { CategoryIcon } from '../components/CategoryIcon';
import { TextBlocks } from '../components/TextBlocks';

const TAG_NAMES: Record<string, string> = {
  dunamancy: 'Дюнамантия',
  chronurgy: 'Хронургия',
  graviturgy: 'Гравитургия',
};

/** Карточка заклинания: все поля spell/v1, источники, ссылка на DnD.su, статус проверки. */
export function SpellCardBody({ card }: { card: SpellEntityResponse }) {
  const { data } = card;
  const targets = targetsText(data);

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
        <CommonFacts card={card} />
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
