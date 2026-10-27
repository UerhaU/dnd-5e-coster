import type { EntityLink, ItemEntityResponse, ItemRules } from '@koster/shared';
import { Link } from 'react-router';
import {
  armorClassText,
  categoryName,
  damageText,
  equipTimeText,
  kindName,
  propertyText,
  consumableActivationText,
  consumableEffectText,
} from '../catalog/item-format';
import { CommonFacts, Fact } from '../components/CardParts';
import { CategoryIcon } from '../components/CategoryIcon';
import { TextBlocks } from '../components/TextBlocks';

const FIREARM_ERAS = {
  renaissance: 'эпоха Возрождения',
  modern: 'современное',
  futuristic: 'футуристическое',
} as const;

/** Столбцы таблицы, которые карточка показывает своими строками. */
const OWN_STAT_LABELS = new Set(['цена', 'стоимость', 'вес']);

const LINK_TITLES: Record<string, { to: string; from: string }> = {
  uses_ammunition: { to: 'Боеприпас', from: 'Используется оружием' },
  contains: { to: 'Состав', from: 'Входит в наборы' },
  material_component: { to: 'Материальный компонент', from: 'Компонент заклинаний' },
  weapon_proficiency: { to: 'Владение оружием', from: 'Владеют расы' },
  tool_proficiency: { to: 'Владение инструментом', from: 'Владеют расы (или выбирают)' },
};

/** Карточка предмета: поля item/v1, разобранная механика, связи, источник. */
export function ItemCardBody({ card }: { card: ItemEntityResponse }) {
  const { data, rules } = card;
  // Состав набора показывается своим списком с количеством, поэтому связь `contains`
  // в сторону «к предмету» не дублируется.
  const links = card.links.filter((link) => !(link.kind === 'contains' && link.direction === 'to'));

  return (
    <article aria-labelledby="item-name">
      <header className="card-header">
        <CategoryIcon category="item" large />
        <div>
          <h1 id="item-name">{card.nameRu}</h1>
          <p className="muted">
            {card.nameEn}
            {card.aliases.length > 0 && ` · также: ${card.aliases.join(', ')}`}
          </p>
          <p data-testid="item-kind">
            {data.category ? categoryName(data.category) : kindName(data.kind)}
            {data.firearm && `, огнестрельное (${FIREARM_ERAS[data.firearm]})`}
          </p>
        </div>
      </header>

      {card.withdrawn && (
        <p className="error">Предмет пропал из источника. Карточка сохранена для ссылок.</p>
      )}
      {data.optionalRule && (
        <p className="badge">Вариант правил: использовать можно с разрешения мастера</p>
      )}

      <dl className="facts">
        <Fact label="Цена">{data.cost.text ?? 'не указана'}</Fact>
        <Fact label="Вес">{data.weight.text ?? 'не указан'}</Fact>
        {data.quantity > 1 && <Fact label="В упаковке">{data.quantity} шт.</Fact>}
        {rules && <RulesFacts rules={rules} />}
        {/* Без механики — столбцы таблицы как на DnD.su: скорость скакуна, экипаж судна. */}
        {!rules &&
          data.stats
            .filter((stat) => !OWN_STAT_LABELS.has(stat.label.toLowerCase()))
            .map((stat) => (
              <Fact key={stat.label} label={stat.label}>
                {stat.value}
              </Fact>
            ))}
        {links.length > 0 && <LinkFacts links={links} />}
        <CommonFacts card={card} />
      </dl>

      {data.contents.length > 0 && (
        <>
          <h2>Состав</h2>
          <ul data-testid="pack-contents">
            {data.contents.map((entry, index) => (
              <li key={`${entry.name}-${index}`}>
                {entry.quantity > 1 && `${entry.quantity} × `}
                {entry.itemId ? (
                  <Link to={`/reference/entity/${entry.itemId}`}>{entry.name}</Link>
                ) : (
                  entry.name
                )}
                {entry.note && <span className="muted"> ({entry.note})</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      <h2>Описание</h2>
      {data.description.length > 0 ? (
        <TextBlocks blocks={data.description} />
      ) : (
        <p className="muted">На DnD.su у этого предмета есть только строка таблицы.</p>
      )}

      <p className="muted">
        <Link to="/reference/item">Всё снаряжение</Link>
      </p>
    </article>
  );
}

function RulesFacts({ rules }: { rules: ItemRules }) {
  if (rules.weapon) {
    const { weapon } = rules;
    return (
      <>
        <Fact label="Урон">
          <span data-testid="item-damage">{damageText(weapon.damage) ?? 'нет'}</span>
        </Fact>
        <Fact label="Свойства">
          {weapon.properties.length > 0 ? weapon.properties.map(propertyText).join(', ') : 'нет'}
        </Fact>
      </>
    );
  }
  if (rules.armor) {
    const { armor } = rules;
    return (
      <>
        <Fact label="Класс доспеха">
          <span data-testid="item-armor-class">{armorClassText(armor.armorClass)}</span>
        </Fact>
        <Fact label="Требование Силы">{armor.strengthRequired ?? 'нет'}</Fact>
        <Fact label="Скрытность">{armor.stealthDisadvantage ? 'помеха' : 'без помехи'}</Fact>
        <Fact label="Надевание / снятие">
          {equipTimeText(armor.don)} / {equipTimeText(armor.doff)}
        </Fact>
      </>
    );
  }
  if (rules.use) {
    const { use } = rules;
    return (
      <>
        <Fact label="При использовании">
          <span data-testid="item-use-effect">
            {use.effects.map(consumableEffectText).join('; ')}
          </span>
        </Fact>
        <Fact label="Как используется">{consumableActivationText(use)}</Fact>
      </>
    );
  }
  if (rules.shield) {
    const { shield } = rules;
    return (
      <>
        <Fact label="Класс доспеха">
          <span data-testid="item-armor-class">+{shield.armorClassBonus}</span>
        </Fact>
        <Fact label="Надевание / снятие">
          {equipTimeText(shield.don)} / {equipTimeText(shield.doff)}
        </Fact>
      </>
    );
  }
  return null;
}

function LinkFacts({ links }: { links: EntityLink[] }) {
  const groups = new Map<string, EntityLink[]>();
  for (const link of links) {
    const title = LINK_TITLES[link.kind]?.[link.direction] ?? link.kind;
    groups.set(title, [...(groups.get(title) ?? []), link]);
  }
  return (
    <>
      {[...groups].map(([title, group]) => (
        <Fact key={title} label={title}>
          {group.map((link, index) => (
            <span key={link.id}>
              {index > 0 && ', '}
              <Link to={`/reference/entity/${link.id}`}>{link.nameRu}</Link>
            </span>
          ))}
        </Fact>
      ))}
    </>
  );
}
