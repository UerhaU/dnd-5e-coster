import type { ClassEntityResponse, ClassFeature, SubclassEntityResponse } from '@koster/shared';
import { CLASS_NAMES_RU } from '@koster/shared';
import { Link } from 'react-router';
import {
  abilitiesText,
  armorText,
  equipmentText,
  levelsText,
  multiclassProficienciesText,
  requirementsText,
  skillsText,
  spellcastingText,
  startingGoldText,
  toolsText,
  weaponsText,
} from '../catalog/class-format';
import { TextBlocks } from '../components/TextBlocks';
import { AllLink, Facts, Header, LinkList, linksOf, namesOf, Section } from './ReferenceCard';

// Карточки класса и подкласса: механика — фактами, таблица класса 1–20 — как на
// сайте, особенности — разделами с уровнем; опциональные особенности TCE помечены
// «вариант правил» (Р74).

function Features({ features }: { features: readonly ClassFeature[] }) {
  return (
    <section aria-label="Особенности">
      <h2>Особенности</h2>
      {features.map((feature, index) => (
        <details
          key={`${feature.key ?? feature.nameRu}-${index}`}
          className="feature"
          data-testid="class-feature"
        >
          <summary>
            <strong>{feature.nameRu}</strong>{' '}
            <span className="muted">· {levelsText(feature.levels)}</span>
            {feature.optionalRule && (
              <span className="badge" data-testid="optional-rule">
                {' '}
                · вариант правил, нужно разрешение мастера
              </span>
            )}
          </summary>
          <TextBlocks blocks={feature.blocks} />
          {feature.subsections.map((part, partIndex) => (
            <div key={`${part.name}-${partIndex}`}>
              <h3>{part.name}</h3>
              <TextBlocks blocks={part.blocks} />
            </div>
          ))}
        </details>
      ))}
    </section>
  );
}

export function ClassCardBody({ card }: { card: ClassEntityResponse }) {
  const { data, rules } = card;
  const names = namesOf(card);
  const p = rules.proficiencies;
  const subclasses = linksOf(card, 'subclass_of', 'from');
  return (
    <article aria-labelledby="entity-name">
      <Header card={card} kind={`Класс · кость хитов к${rules.hitDie}`} />
      <Facts
        card={card}
        rows={[
          ['Кость хитов', `к${rules.hitDie}`, 'class-hit-die'],
          ['Хиты на 1-м уровне', `${rules.hitPointsFirstLevel} + модификатор Телосложения`],
          [
            'Хиты на следующих уровнях',
            `к${rules.hitDie} (или ${rules.hitPointsPerLevel}) + модификатор Телосложения`,
          ],
          ['Спасброски', abilitiesText(rules.savingThrows), 'class-saves'],
          ['Доспехи', armorText(p.armor) ?? 'нет'],
          ['Оружие', weaponsText(p.weapons, names)],
          ['Инструменты', toolsText(p, names) ?? 'нет'],
          ['Навыки', skillsText(p.skills, names), 'class-skills'],
          ['Заклинания', spellcastingText(rules.spellcasting), 'class-spellcasting'],
          [
            'Подкласс',
            `${rules.subclass.nameRu}, с ${rules.subclass.level}-го уровня (особенности: ${rules.subclass.featureLevels.join(', ')})`,
            'class-subclass',
          ],
          [
            'Мультикласс: требование',
            requirementsText(rules.multiclass.requirements),
            'class-multiclass',
          ],
          [
            'Мультикласс: владения',
            multiclassProficienciesText(rules.multiclass.proficiencies, names),
          ],
          ['Деньги вместо снаряжения', startingGoldText(rules.startingGold)],
          ['Только текстом', rules.textOnly.length > 0 ? rules.textOnly.join(' ') : null],
        ]}
      />

      <Section name="Стартовое снаряжение">
        <ul data-testid="class-equipment">
          {rules.equipment.map((choice, index) => (
            <li key={index}>{equipmentText(choice, names)}</li>
          ))}
        </ul>
      </Section>

      <Section name={`Таблица класса «${card.nameRu}»`}>
        <div className="table-scroll">
          <table className="class-table" data-testid="class-table">
            <thead>
              <tr>
                {data.table.header.map((name, index) => (
                  <th key={index} scope="col">
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.table.rows.map((row, index) => (
                <tr key={index}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Features features={data.features} />

      {data.options.map((list) => (
        <Section key={list.name} name={list.name}>
          <TextBlocks blocks={list.blocks} />
          {list.items.map((item, index) => (
            <details key={`${item.name}-${index}`}>
              <summary>{item.name}</summary>
              <TextBlocks blocks={item.blocks} />
            </details>
          ))}
        </Section>
      ))}

      <Section name={data.subclassIntro.name || 'Подклассы'}>
        <TextBlocks blocks={data.subclassIntro.blocks} />
        <p data-testid="class-subclasses">
          <LinkList links={subclasses} />
        </p>
      </Section>

      <details>
        <summary>Описание и создание персонажа</summary>
        <TextBlocks blocks={data.intro} />
        {data.sections.map((section, index) => (
          <div key={`${section.name}-${index}`}>
            <h3>{section.name}</h3>
            <TextBlocks blocks={section.blocks} />
          </div>
        ))}
        <h3>Мультиклассирование</h3>
        <TextBlocks blocks={data.multiclass} />
      </details>
      <AllLink category="class" />
    </article>
  );
}

const SLOT_COLUMNS = ['1', '2', '3', '4'];

export function SubclassCardBody({ card }: { card: SubclassEntityResponse }) {
  const { data, rules } = card;
  const names = namesOf(card);
  const parent = linksOf(card, 'subclass_of', 'to');
  return (
    <article aria-labelledby="entity-name">
      <Header card={card} kind={`Подкласс · ${CLASS_NAMES_RU[rules.subclassOf]}`} />
      <Facts
        card={card}
        rows={[
          ['Класс', parent.length > 0 ? <LinkList links={parent} /> : null, 'subclass-class'],
          ['Заклинания', spellcastingText(rules.spellcasting)],
        ]}
      />
      {rules.spellLists.map((list, index) => (
        <Section
          key={`${list.name ?? ''}-${index}`}
          name={list.name ? `Заклинания: ${list.name}` : 'Дополнительные заклинания'}
        >
          <table data-testid="subclass-spells">
            <thead>
              <tr>
                <th scope="col">
                  {list.levelKind === 'spell' ? 'Уровень заклинания' : 'Уровень класса'}
                </th>
                <th scope="col">Заклинания</th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((row) => (
                <tr key={row.level}>
                  <td>{row.level}</td>
                  <td>
                    {row.spellIds.map((id, spellIndex) => (
                      <span key={id}>
                        {spellIndex > 0 && ', '}
                        <Link to={`/reference/entity/${id}`}>{names.get(id) ?? id}</Link>
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ))}
      {rules.spellTable && (
        <Section name="Таблица заклинателя">
          <table>
            <thead>
              <tr>
                <th scope="col">Уровень</th>
                <th scope="col">Заговоры</th>
                <th scope="col">Заклинания</th>
                {SLOT_COLUMNS.map((slot) => (
                  <th key={slot} scope="col">
                    Ячейки {slot}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.spellTable.map((row) => (
                <tr key={row.level}>
                  <td>{row.level}</td>
                  <td>{row.values.cantripsKnown ?? '—'}</td>
                  <td>{row.values.spellsKnown ?? '—'}</td>
                  {SLOT_COLUMNS.map((_, slot) => (
                    <td key={slot}>{row.spellSlots?.[slot] || '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
      <TextBlocks blocks={data.intro} />
      {data.sections.map((section, index) => (
        <Section key={`${section.name}-${index}`} name={section.name}>
          <TextBlocks blocks={section.blocks} />
        </Section>
      ))}
      <Features features={data.features} />
      <AllLink category="subclass" />
    </article>
  );
}
