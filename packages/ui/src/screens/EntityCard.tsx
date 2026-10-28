import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useApi } from '../api/api-context';
import { QueryError } from '../components/QueryError';
import { ClassCardBody, SubclassCardBody } from './ClassCard';
import { ItemCardBody } from './ItemCard';
import { RaceCardBody } from './RaceCard';
import {
  BackgroundCardBody,
  ConditionCardBody,
  FeatCardBody,
  LanguageCardBody,
  SkillCardBody,
} from './ReferenceCard';
import { SpellCardBody } from './SpellCard';

/** Карточка объекта любой категории: общий экран, тело — по категории. */
export function EntityCard() {
  const api = useApi();
  const navigate = useNavigate();
  const location = useLocation();
  const { id = '' } = useParams();
  const card = useQuery({ queryKey: ['entity', id], queryFn: () => api.entity(id) });

  // Карточку открыли без истории (первый экран окна): «назад» некуда — ведём к списку.
  const list = `/reference/${card.data?.category ?? id.split(':')[0] ?? ''}`;
  const back = () => (location.key === 'default' ? void navigate(list) : void navigate(-1));

  return (
    <main className="page">
      <button type="button" className="back-link" onClick={back}>
        ← К списку
      </button>
      {card.isPending && <p className="muted">Загрузка…</p>}
      {card.isError && <QueryError error={card.error} />}
      {card.data?.category === 'spell' && <SpellCardBody card={card.data} />}
      {card.data?.category === 'item' && <ItemCardBody card={card.data} />}
      {card.data?.category === 'race' && <RaceCardBody card={card.data} />}
      {card.data?.category === 'skill' && <SkillCardBody card={card.data} />}
      {card.data?.category === 'language' && <LanguageCardBody card={card.data} />}
      {card.data?.category === 'condition' && <ConditionCardBody card={card.data} />}
      {card.data?.category === 'background' && <BackgroundCardBody card={card.data} />}
      {card.data?.category === 'feat' && <FeatCardBody card={card.data} />}
      {card.data?.category === 'class' && <ClassCardBody card={card.data} />}
      {card.data?.category === 'subclass' && <SubclassCardBody card={card.data} />}
    </main>
  );
}
