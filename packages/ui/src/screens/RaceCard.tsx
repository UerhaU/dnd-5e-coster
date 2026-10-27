import type { RaceEntityResponse } from '@koster/shared';
import { Link } from 'react-router';
import {
  abilityScoresText,
  creatureTypeName,
  languagesText,
  resistancesText,
  sizeName,
  skillsText,
  speedText,
} from '../catalog/race-format';
import { CommonFacts, Fact } from '../components/CardParts';
import { CategoryIcon } from '../components/CategoryIcon';
import { TextBlocks } from '../components/TextBlocks';

const ARMOR_NAMES = { light: 'лёгкие', medium: 'средние', heavy: 'тяжёлые', shield: 'щиты' };

/** Карточка расы или разновидности: механика race-rules/v1, особенности, связи. */
export function RaceCardBody({ card }: { card: RaceEntityResponse }) {
  const { data, rules } = card;
  const base = card.links.find((link) => link.kind === 'variant_of' && link.direction === 'to');
  const variants = card.links.filter(
    (link) => link.kind === 'variant_of' && link.direction === 'from',
  );
  const weapons = card.links.filter(
    (link) => link.kind === 'weapon_proficiency' && link.direction === 'to',
  );
  const rows: [string, string | null, string?][] = [
    ['Увеличение характеристик', abilityScoresText(rules.abilityScores), 'race-abilities'],
    ['Размер', rules.size ? rules.size.map(sizeName).join(' или ') : null, 'race-size'],
    ['Вид существа', rules.creatureType ? creatureTypeName(rules.creatureType) : null],
    ['Скорость', speedText(rules.speed), 'race-speed'],
    [
      'Тёмное зрение',
      rules.darkvisionFt !== null ? `${rules.darkvisionFt} фт.` : null,
      'race-darkvision',
    ],
    ['Навыки', skillsText(rules.skills)],
    [
      'Доспехи',
      rules.armor.length > 0 ? rules.armor.map((id) => ARMOR_NAMES[id]).join(', ') : null,
    ],
    ['Языки', languagesText(rules.languages), 'race-languages'],
    ['Сопротивление', resistancesText(rules.resistances)],
  ];

  return (
    <article aria-labelledby="race-name">
      <header className="card-header">
        <CategoryIcon category="race" large />
        <div>
          <h1 id="race-name">{card.nameRu}</h1>
          <p className="muted">{card.nameEn}</p>
          <p data-testid="race-kind">
            {base ? (
              <>
                Разновидность расы <Link to={`/reference/entity/${base.id}`}>{base.nameRu}</Link>
              </>
            ) : (
              'Раса'
            )}
          </p>
        </div>
      </header>

      {card.withdrawn && (
        <p className="error">Раса пропала из источника. Карточка сохранена для ссылок.</p>
      )}
      {base && (
        <p className="muted">
          Особенности расы «{base.nameRu}» тоже действуют; здесь — только свои. Особенность с тем же
          названием заменяет расовую.
        </p>
      )}

      <dl className="facts">
        {rows
          .filter(([, value]) => value !== null)
          .map(([label, value, testId]) => (
            <Fact key={label} label={label}>
              <span data-testid={testId}>{value}</span>
            </Fact>
          ))}
        {weapons.length > 0 && (
          <Fact label="Оружие">
            {weapons.map((link, index) => (
              <span key={link.id}>
                {index > 0 && ', '}
                <Link to={`/reference/entity/${link.id}`}>{link.nameRu}</Link>
              </span>
            ))}
          </Fact>
        )}
        {rules.textOnly.length > 0 && (
          <Fact label="Только текстом">{rules.textOnly.join(', ')}</Fact>
        )}
        {variants.length > 0 && (
          <Fact label="Разновидности">
            {variants.map((link, index) => (
              <span key={link.id}>
                {index > 0 && ', '}
                <Link to={`/reference/entity/${link.id}`}>{link.nameRu}</Link>
              </span>
            ))}
          </Fact>
        )}
        <CommonFacts card={card} />
      </dl>

      {data.intro.length > 0 && <TextBlocks blocks={data.intro} />}

      <h2>Особенности</h2>
      {data.features.length > 0 ? (
        <dl className="features">
          {data.features.map((feature, index) => (
            <div key={`${feature.name}-${index}`}>
              <dt>{feature.name}</dt>
              <dd>
                <TextBlocks blocks={feature.blocks} />
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="muted">Своих особенностей нет: всё — у расы.</p>
      )}

      <p className="muted">
        <Link to="/reference/race">Все расы</Link>
      </p>
    </article>
  );
}
