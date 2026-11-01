import type {
  BackgroundEntityResponse,
  ConditionEntityResponse,
  EntityLink,
  EntityResponse,
  FeatEntityResponse,
  LanguageEntityResponse,
  SkillEntityResponse,
} from '@koster/shared';
import { CATEGORY_NAMES_RU } from '@koster/shared';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import {
  backgroundLanguagesText,
  coinsText,
  featWeaponsText,
  mixedText,
  prerequisitesText,
  proficienciesText,
} from '../catalog/character-format';
import { abilityName, abilityOptionText } from '../catalog/race-format';
import { CommonFacts, Fact } from '../components/CardParts';
import { CategoryIcon } from '../components/CategoryIcon';
import { TextBlocks } from '../components/TextBlocks';

// Карточки справочных категорий этапа 3: навык, язык, состояние, предыстория, черта.
// Механика — строками фактов, тексты DnD.su — блоками; связи — ссылками на карточки.

export const ARMOR_NAMES = { light: 'лёгкие', medium: 'средние', heavy: 'тяжёлые', shield: 'щиты' };

/** Названия целей связей карточки: ID → русское название. */
export const namesOf = (card: EntityResponse) =>
  new Map(card.links.filter((link) => link.direction === 'to').map((l) => [l.id, l.nameRu]));

export function Header({ card, kind }: { card: EntityResponse; kind?: ReactNode }) {
  return (
    <header className="card-header">
      <CategoryIcon category={card.category} large />
      <div>
        <h1 id="entity-name">{card.nameRu}</h1>
        <p className="muted">{card.nameEn}</p>
        {kind && <p data-testid="entity-kind">{kind}</p>}
      </div>
    </header>
  );
}

/** Строки фактов: пустые значения не показываются. */
export function Facts({
  card,
  rows,
}: {
  card: EntityResponse;
  rows: [string, ReactNode, string?][];
}) {
  return (
    <dl className="facts">
      {rows
        .filter(([, value]) => value !== null && value !== undefined && value !== '')
        .map(([label, value, testId]) => (
          <Fact key={label} label={label}>
            <span data-testid={testId}>{value}</span>
          </Fact>
        ))}
      <CommonFacts card={card} />
    </dl>
  );
}

export function LinkList({ links }: { links: EntityLink[] }) {
  return (
    <>
      {links.map((link, index) => (
        <span key={`${link.kind}-${link.id}`}>
          {index > 0 && ', '}
          <Link to={`/reference/entity/${link.id}`}>{link.nameRu}</Link>
        </span>
      ))}
    </>
  );
}

export const linksOf = (card: EntityResponse, kind: string, direction: 'to' | 'from') =>
  card.links.filter((link) => link.kind === kind && link.direction === direction);

export function AllLink({ category }: { category: EntityResponse['category'] }) {
  return (
    <p className="muted">
      <Link to={`/reference/${category}`}>Все: {CATEGORY_NAMES_RU[category].toLowerCase()}</Link>
    </p>
  );
}

export function SkillCardBody({ card }: { card: SkillEntityResponse }) {
  const holders = card.links.filter(
    (link) => link.kind === 'skill_proficiency' && link.direction === 'from',
  );
  return (
    <article aria-labelledby="entity-name">
      <Header card={card} kind={`Навык ${abilityName(card.data.ability)}`} />
      <Facts
        card={card}
        rows={[
          ['Характеристика', abilityName(card.data.ability), 'skill-ability'],
          ['Дают владение', holders.length > 0 ? <LinkList links={holders} /> : null],
        ]}
      />
      <TextBlocks blocks={card.data.description} />
      <AllLink category="skill" />
    </article>
  );
}

export function LanguageCardBody({ card }: { card: LanguageEntityResponse }) {
  const { data } = card;
  const base = linksOf(card, 'dialect_of', 'to');
  const dialects = linksOf(card, 'dialect_of', 'from');
  const kind = { standard: 'Обычный язык', exotic: 'Экзотический язык' };
  return (
    <article aria-labelledby="entity-name">
      <Header card={card} kind={data.kind ? kind[data.kind] : 'Язык'} />
      <Facts
        card={card}
        rows={[
          ['Диалект языка', base.length > 0 ? <LinkList links={base} /> : null],
          ['Диалекты', dialects.length > 0 ? <LinkList links={dialects} /> : null],
          ['Типичные носители', data.typicalSpeakers, 'language-speakers'],
          [
            'Письменность',
            data.scripts.map((entry) => `${entry.script ?? '—'} (${entry.source})`).join(', '),
            'language-script',
          ],
        ]}
      />
      <TextBlocks blocks={data.description} />
      <AllLink category="language" />
    </article>
  );
}

export function ConditionCardBody({ card }: { card: ConditionEntityResponse }) {
  return (
    <article aria-labelledby="entity-name">
      <Header card={card} kind="Состояние" />
      <Facts
        card={card}
        rows={[['Другие названия', card.aliases.length > 0 ? card.aliases.join(', ') : null]]}
      />
      <TextBlocks blocks={card.data.description} />
      <AllLink category="condition" />
    </article>
  );
}

export function BackgroundCardBody({ card }: { card: BackgroundEntityResponse }) {
  const { data, rules } = card;
  const names = namesOf(card);
  const feats = linksOf(card, 'grants_feat', 'to');
  const vehicles = { land: 'наземный', water: 'водный' };
  return (
    <article aria-labelledby="entity-name">
      <Header
        card={card}
        kind={data.kind === 'adaptation' ? 'Адаптация предысторий' : 'Предыстория'}
      />
      <Facts
        card={card}
        rows={[
          ['Навыки', proficienciesText(rules.skills, names), 'background-skills'],
          ['Инструменты', proficienciesText(rules.tools, names), 'background-tools'],
          ['Навык или инструмент', mixedText(rules.mixed, names), 'background-mixed'],
          [
            'Транспорт',
            rules.vehicles.length > 0 ? rules.vehicles.map((id) => vehicles[id]).join(', ') : null,
          ],
          ['Языки', backgroundLanguagesText(rules.languages, names), 'background-languages'],
          [
            'Снаряжение',
            rules.equipment.items.length > 0 ? (
              <EquipmentList items={rules.equipment.items} names={names} />
            ) : null,
          ],
          ['Деньги', coinsText(rules.equipment.coinsCp), 'background-coins'],
          ['Даёт черту', feats.length > 0 ? <LinkList links={feats} /> : null, 'background-feat'],
          ['Только текстом', rules.textOnly.length > 0 ? rules.textOnly.join('; ') : null],
        ]}
      />
      {data.intro.length > 0 && <TextBlocks blocks={data.intro} />}
      {data.feature && (
        <Section name={data.feature.name}>
          <TextBlocks blocks={data.feature.blocks} />
        </Section>
      )}
      {data.variants.map((variant) => (
        <Section key={variant.name} name={`Разновидность: ${variant.name}`}>
          <TextBlocks blocks={variant.blocks} />
        </Section>
      ))}
      <Personality personality={data.personality} />
      {data.sections.map((section, index) => (
        <Section key={`${section.name}-${index}`} name={section.name}>
          <TextBlocks blocks={section.blocks} />
        </Section>
      ))}
      <AllLink category="background" />
    </article>
  );
}

function EquipmentList({
  items,
  names,
}: {
  items: BackgroundEntityResponse['rules']['equipment']['items'];
  names: Map<string, string>;
}) {
  return (
    <>
      {items.map((item, index) => (
        <span key={`${item.text}-${index}`}>
          {index > 0 && ', '}
          {item.itemId && names.has(item.itemId) ? (
            <Link to={`/reference/entity/${item.itemId}`}>{item.text}</Link>
          ) : (
            item.text
          )}
        </span>
      ))}
    </>
  );
}

export function Section({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section>
      <h2>{name}</h2>
      {children}
    </section>
  );
}

const PERSONALITY_NAMES = {
  traits: 'Черты характера',
  ideals: 'Идеалы',
  bonds: 'Привязанности',
  flaws: 'Слабости',
} as const;

/** Таблицы-подсказки (правила, раздел 9): игрок может придумать своё. */
function Personality({
  personality,
}: {
  personality: BackgroundEntityResponse['data']['personality'];
}) {
  const tables = (Object.keys(PERSONALITY_NAMES) as (keyof typeof PERSONALITY_NAMES)[]).filter(
    (key) => personality[key] !== null,
  );
  if (tables.length === 0) return null;
  return (
    <section>
      <h2>Характер</h2>
      <p className="muted">Подсказки: можно выбрать, бросить кость или придумать своё.</p>
      {tables.map((key) => {
        const table = personality[key];
        if (!table) return null;
        return (
          <div key={key}>
            <h3>
              {PERSONALITY_NAMES[key]}
              {table.die && <span className="muted"> ({table.die})</span>}
            </h3>
            <ol>
              {table.rows.map((row, index) => (
                <li key={index}>{row}</li>
              ))}
            </ol>
          </div>
        );
      })}
    </section>
  );
}

export function FeatCardBody({ card }: { card: FeatEntityResponse }) {
  const { data, rules } = card;
  const names = namesOf(card);
  const increase = rules.abilityIncrease;
  const spells = linksOf(card, 'feat_spell', 'to').filter((link) => rules.spells.includes(link.id));
  const mentioned = linksOf(card, 'feat_spell', 'to').filter(
    (link) => !rules.spells.includes(link.id),
  );
  const grantedBy = linksOf(card, 'grants_feat', 'from');
  const unlocks = linksOf(card, 'prerequisite', 'from');
  return (
    <article aria-labelledby="entity-name">
      <Header card={card} kind="Черта" />
      <Facts
        card={card}
        rows={[
          [
            'Требование',
            prerequisitesText(rules.prerequisites, names) ?? (data.prerequisite ? null : 'нет'),
            'feat-prerequisite',
          ],
          [
            'Увеличение характеристик',
            increase.fixed.length + increase.choices.length > 0
              ? `${abilityOptionText(increase)} (не выше 20)`
              : null,
            'feat-abilities',
          ],
          [
            'Доспехи',
            rules.armor.length > 0 ? rules.armor.map((id) => ARMOR_NAMES[id]).join(', ') : null,
          ],
          ['Оружие', featWeaponsText(rules.weapons)],
          ['Навыки', proficienciesText(rules.skills, names), 'feat-skills'],
          ['Инструменты', proficienciesText(rules.tools, names)],
          ['Навыки или инструменты', mixedText(rules.mixed, names), 'feat-mixed'],
          [
            'Языки',
            rules.languages.choose > 0 ? `${rules.languages.choose} на выбор (любые)` : null,
          ],
          [
            'Спасброски',
            rules.savingThrows === 'chosen_ability' ? 'выбранной характеристики' : null,
          ],
          ['Заклинания', spells.length > 0 ? <LinkList links={spells} /> : null, 'feat-spells'],
          ['Упоминаются заклинания', mentioned.length > 0 ? <LinkList links={mentioned} /> : null],
          ['Даёт предыстория', grantedBy.length > 0 ? <LinkList links={grantedBy} /> : null],
          ['Открывает', unlocks.length > 0 ? <LinkList links={unlocks} /> : null],
          ['Только текстом', rules.textOnly.length > 0 ? rules.textOnly.join(' ') : null],
        ]}
      />
      {data.prerequisite && (
        <p className="muted" data-testid="feat-prerequisite-text">
          Требование на сайте: {data.prerequisite}
        </p>
      )}
      <TextBlocks blocks={data.description} />
      {data.sections.map((section, index) => (
        <Section key={`${section.name}-${index}`} name={section.name}>
          <TextBlocks blocks={section.blocks} />
        </Section>
      ))}
      <AllLink category="feat" />
    </article>
  );
}
