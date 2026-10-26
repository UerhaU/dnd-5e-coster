import { useEffect, useState } from 'react';
import type { IllustratedEntry, SpellDetail, SpellList, SpellLookups } from '../../backend/src/spell-catalog/types';
import type { MaterialNode } from '../../backend/src/spell-catalog/full-spell-details';

const emptyFilters = { q: '', level: '', school: '', class: '', ritual: false, concentration: false };
const levelName = (level: number) => level === 0 ? 'Заговор' : `${level} уровень`;
const money = (copper: number) => `${(copper / 100).toLocaleString('ru-RU')} зм`;

async function load<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`/api/spellbook/${path}`, { signal });
  if (!response.ok) throw new Error('Не удалось загрузить каталог.');
  return response.json() as Promise<T>;
}

function Icon({ entry, large = false }: { entry: Pick<IllustratedEntry, 'name' | 'iconUrl'>; large?: boolean }) {
  return <span className={`sb-icon${large ? ' sb-icon-large' : ''}`} data-icon-state={entry.iconUrl === null ? 'empty' : 'image'} aria-hidden="true">
    {entry.iconUrl !== null && <img src={entry.iconUrl} alt="" />}
  </span>;
}

function MaterialTree({node,spell}:{node:MaterialNode;spell:SpellDetail}){
  if(node.kind==='prerequisite')return <p>{node.prerequisite}</p>;
  if(node.kind==='item'){
    const material=spell.materials.flatMap(g=>g.requirements).find(m=>m.id===node.requirementId);
    if(!material)return null;
    const usage=spell.catalog?.materialUsage.find(u=>u.requirementId===material.id);
    return <div className="sb-material"><Icon entry={material.item}/><div>
      <strong>{material.item.name}{material.quantityLabel&&` · ${material.quantityLabel}`}{usage?.quantityBasis==='per_target'?' на каждую цель':usage?.quantityBasis==='per_eye'?' на каждый глаз':''}</strong>
      <p className="sb-secondary">{material.consumption}{material.minimumValueCp!==null&&` · Не менее ${money(material.minimumValueCp)}${usage?.priceBasis==='target_hit_die'?' за каждый КХ цели':''}`}{material.consumedQuantityLabel&&` · Расход: ${material.consumedQuantityLabel}`}</p>
      {material.consumptionCondition&&<p>{material.consumptionCondition}</p>}{material.specialRequirements&&<p>{material.specialRequirements}</p>}
      {node.minimumValueCp!==null&&<p>Общая ценность: не менее {money(node.minimumValueCp)}.</p>}
    </div></div>;
  }
  return <div className="sb-material-branch"><p className="sb-secondary">{node.kind==='any'?'Один из вариантов:':'Нужны вместе:'}{node.minimumValueCp!==null&&` общая ценность не менее ${money(node.minimumValueCp)}`}</p>
    <div className="sb-material-children">{node.children.map(child=><MaterialTree key={child.id} node={child} spell={spell}/>)}</div>
  </div>;
}

function SpellCard({ spell }: { spell: SpellDetail }) {
  return <article className="sb-card" aria-labelledby="spell-title" data-spell-id={spell.id}>
    <header className="sb-card-heading">
      <Icon entry={spell} large />
      <div>
        <p className="sb-eyebrow">{levelName(spell.level)} · {spell.school.name}</p>
        <h2 id="spell-title">{spell.name}</h2>
        {spell.originalName && <p className="sb-original">{spell.originalName}</p>}
      </div>
    </header>
    {(spell.ritual || spell.concentration) && <div className="sb-tags">
      {spell.ritual && <span>Ритуал</span>}{spell.concentration && <span>Концентрация</span>}
    </div>}
    <dl className="sb-stats">
      <div><dt>Время накладывания</dt><dd>{spell.castingTimes.join(' / ') || 'Не указано'}</dd></div>
      <div><dt>Дистанция</dt><dd>{spell.range ?? 'Не указана'}</dd></div>
      <div><dt>Длительность</dt><dd>{spell.duration ?? 'Не указана'}</dd></div>
    </dl>
    <section><h3>Компоненты</h3><p>{spell.components ?? 'Не указаны'}</p></section>
    {spell.catalog?.costs.map((cost,index)=><section key={index}><h3>Авторские отчисления</h3><p>{money(cost.amountCp)} при ячейке {cost.baseSlotLevel} уровня; ещё {money(cost.perAdditionalSlotCp)} за каждый уровень ячейки выше.</p></section>)}
    {(spell.targets||spell.areas.length>0) && <section><h3>Цели и область</h3>{spell.targets&&<p>{spell.targets}</p>}
      {spell.areas.map((area, index) => <p className="sb-secondary" key={index}>{area.shape}
        {area.radiusFt !== null && ` · Радиус ${area.radiusFt} футов`}
        {area.lengthFt !== null && ` · Длина ${area.lengthFt} футов`}
        {area.widthFt !== null && ` · Ширина ${area.widthFt} футов`}
        {area.heightFt !== null && ` · Высота ${area.heightFt} футов`}
        {area.description && ` · ${area.description}`}
      </p>)}
    </section>}
    <section><h3>Описание</h3><p>{spell.description ?? 'Описание пока не заполнено.'}</p></section>
    {spell.catalog&&spell.catalog.rules.length>0?<section><h3>Эффекты и броски</h3><div className="sb-effects">
      {spell.catalog.rules.map(rule=><div className="sb-effect" key={rule.id}>
        <div className="sb-effect-top"><strong>{rule.stat??rule.kind}{rule.value!==null?` · ${rule.value}`:rule.roll?` · ${rule.roll}`:''}{rule.ability&&` + мод. ${rule.ability}`}{rule.spellcasting&&!rule.roll?' · Модификатор заклинательной характеристики':''}</strong>{rule.damageType&&<span className="sb-inline-entry"><Icon entry={rule.damageType}/>{rule.damageType.name}</span>}</div>
        {rule.operator&&<p>{rule.operator}{rule.value!==null&&rule.roll&&rule.roll!==String(Math.abs(rule.value))?` · ${rule.roll}`:''}</p>}
        {rule.resolution!=='особое'&&<p>{rule.resolution==='спасбросок'?`Спасбросок: ${rule.saveAbility??'особый'}`:rule.resolution}{rule.onSuccess&&`; при успехе — ${rule.onSuccess}`}</p>}
        {rule.repeatCount!==null&&<p>Количество попаданий/лучей: {rule.repeatCount}.</p>}
        {rule.damageChoices.length>0&&<div className="sb-tags">{rule.damageChoices.map(d=><span key={d.id} className="sb-inline-entry"><Icon entry={d}/>{d.name}</span>)}</div>}
        {rule.choice&&<p>Вариант: {rule.choice}</p>}{(rule.scope||rule.trigger)&&<p className="sb-secondary">{[rule.scope,rule.trigger].filter(Boolean).join(' · ')}</p>}
        {rule.condition&&<details><summary>Условия эффекта</summary><p>{rule.condition}</p></details>}
        {rule.scaling.map((s,i)=><p className="sb-secondary" key={i}>{s}</p>)}
        {rule.status==='parsed'&&<small className="sb-secondary">Числа выделены из описания; условия требуют проверки перед автоматическим расчётом.</small>}
      </div>)}
    </div></section>:(!spell.catalog||spell.catalog.mechanicsStatus==='reviewed_core')&&spell.effects.length > 0 && <section><h3>Эффекты и броски</h3><div className="sb-effects">
      {spell.effects.map((effect) => <div className="sb-effect" key={effect.id}>
        <div className="sb-effect-top"><strong>{effect.roll ?? effect.kind}</strong>
          {effect.damageType && <span className="sb-inline-entry"><Icon entry={effect.damageType} />{effect.damageType.name}</span>}
        </div>
        <p>{effect.resolution === 'спасбросок' ? `Спасбросок: ${effect.saveAbility ?? 'не указан'}` : effect.resolution}
          {effect.onSuccess && `; при успехе — ${effect.onSuccess}`}</p>
        {effect.description && <p>{effect.description}</p>}
        {effect.ruleTargets.length>0&&<p>Применяется к: {effect.ruleTargets.map(target=>target.stat).join(', ')}.</p>}
        {effect.condition && <p className="sb-secondary">Условие: {effect.condition}</p>}
        {effect.option && <p className="sb-secondary">Вариант: {effect.option}</p>}
        {effect.damageChoices.length > 0 && <div className="sb-tags">{effect.damageChoices.map((damage) => <span className="sb-inline-entry" key={damage.id}><Icon entry={damage} />{damage.name}</span>)}</div>}
        {effect.scaling.map((scaling, index) => <p className="sb-secondary" key={index}>{scaling.basis}: {scaling.description ?? scaling.roll ?? 'Условия не заполнены'}</p>)}
      </div>)}
    </div></section>}
    {spell.higherLevels && <section><h3>На высоких уровнях</h3><p>{spell.higherLevels}</p></section>}
    {spell.catalog?.durationScaling.map(s=><p key={s.slotLevel}>Длительность при ячейке {s.slotLevel} уровня и выше: {s.duration}{spell.concentration?', концентрация':''}.</p>)}
    <section data-testid="materials"><h3>Материалы</h3>
      {spell.catalog?.materialTree?<MaterialTree node={spell.catalog.materialTree} spell={spell}/>:spell.materials.length === 0 ? <p className="sb-secondary">Материальные компоненты не требуются.</p> : spell.materials.map((group, groupIndex) => <div className="sb-material-group" key={group.id}>
        {(spell.materials.length > 1 || group.selection !== 'все') && <p className="sb-secondary">Группа {groupIndex + 1}: {group.selection === 'один из' ? 'один из вариантов' : 'все вместе'}</p>}
        {group.description && <p>{group.description}</p>}
        {group.minimumValueCp !== null && <p>Общая минимальная ценность: {money(group.minimumValueCp)}</p>}
        {group.requirements.map((material) => <div className="sb-material" key={material.id}>
          <Icon entry={material.item} />
          <div><strong>{material.item.name}{material.quantityLabel && ` · ${material.quantityLabel}`}</strong>
            <p className="sb-secondary">{material.consumption}
              {material.minimumValueCp !== null && ` · Ценность не менее ${money(material.minimumValueCp)}`}
              {material.quantity === null && ' · Количество не указано'}
              {material.consumedQuantityLabel !== null && ` · Расходуется: ${material.consumedQuantityLabel}`}
            </p>
            {material.consumptionCondition && <p>{material.consumptionCondition}</p>}
            {material.specialRequirements && <p>{material.specialRequirements}</p>}
          </div>
        </div>)}
      </div>)}
    </section>
    <section><h3>Классы</h3><div className="sb-tags">{spell.classAccess.map((entry, index) => <span key={`${entry.id}-${index}`} title={[entry.source, entry.rule].filter(Boolean).join('. ')}>{entry.name}</span>)}</div>
      {spell.classAccess.length===0&&spell.subclasses.length===0&&<p>Особые условия доступа указаны в описании заклинания.</p>}
      {spell.subclasses.length > 0 && <details className="sb-subclasses"><summary>Подклассы и дополнительные условия ({spell.subclasses.length})</summary>
        <ul>{spell.subclasses.map((entry, index) => <li key={`${entry.id}-${index}`}><strong>{entry.name}</strong> · {entry.className}<small>{entry.source}{entry.rule && ` · ${entry.rule}`}</small></li>)}</ul>
      </details>}
    </section>
    <footer className="sb-card-footer"><span>{spell.edition} · {spell.sources.map((source) => source.name + (source.page ? `, ${source.page}` : '')).join('; ')}</span>
      {spell.sourceUrl && <a href={spell.sourceUrl} target="_blank" rel="noreferrer">Открыть на DnD.su ↗</a>}
      {spell.catalog&&<small>Сверено с источником: {spell.catalog.checkedOn}. {spell.catalog.mechanicsStatus==='partial'?'Полный текст сохранён; автоматизация сложных условий ещё требует проверки.':'Основные числовые правила проверены; особые условия приведены в описании.'}</small>}
    </footer>
  </article>;
}

export function Spellbook() {
  const [filters, setFilters] = useState(emptyFilters);
  const [list, setList] = useState<SpellList | null>(null);
  const [lookups, setLookups] = useState<SpellLookups | null>(null);
  const [selected, setSelected] = useState<number | null>(() => {
    const id = Number(new URLSearchParams(window.location.search).get('spell'));
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  });
  const [detail, setDetail] = useState<SpellDetail | null>(null);
  const [listing, setListing] = useState(true);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void load<SpellLookups>('lookups', controller.signal).then(setLookups).catch(() => {});
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    const controller = new AbortController();
    setListing(true); setError('');
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) if (value !== '' && value !== false) params.set(key, String(value));
      void load<SpellList>(`spells?${params}`, controller.signal).then((result) => {
        setList(result);
        setSelected((previous) => result.spells.some((spell) => spell.id === previous) ? previous : result.spells[0]?.id ?? null);
        setListing(false);
      }).catch((failure: Error) => { if (!controller.signal.aborted) { setError(failure.message); setListing(false); } });
    }, 150);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [filters, retry]);

  useEffect(() => {
    const controller = new AbortController();
    setDetail(null); setDetailError('');
    if (selected !== null) {
      const url = new URL(window.location.href); url.searchParams.set('spell', String(selected));
      window.history.replaceState(null, '', url);
      void load<SpellDetail>(`spells/${selected}`, controller.signal).then(setDetail).catch((failure: Error) => {
        if (!controller.signal.aborted) setDetailError(failure.message);
      });
    }
    return () => controller.abort();
  }, [selected, retry]);

  return <div className="sb-page">
    <header className="sb-masthead"><div><p className="sb-eyebrow">Dungeons & Dragons · 5e 2014</p><h1>Книга заклинаний</h1><p>Найдите заклинание и откройте его описание.</p></div><span className="sb-test-label">Тестовый каталог</span></header>
    <main className="sb-layout">
      <aside className="sb-sidebar" aria-label="Каталог заклинаний">
        <div className="sb-filter-heading"><h2>Заклинания</h2><span>{list?.total ?? '—'}</span></div>
        <label className="sb-search">Поиск по названию<input type="search" maxLength={200} value={filters.q} placeholder="Название на русском или английском" onChange={(event) => setFilters({ ...filters, q: event.target.value })} /></label>
        <div className="sb-filter-grid">
          <label>Уровень<select value={filters.level} onChange={(event) => setFilters({ ...filters, level: event.target.value })}><option value="">Все уровни</option>{Array.from({ length: 10 }, (_, level) => <option key={level} value={level}>{levelName(level)}</option>)}</select></label>
          <label>Школа<select value={filters.school} onChange={(event) => setFilters({ ...filters, school: event.target.value })}><option value="">Все школы</option>{lookups?.schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
        </div>
        <label className="sb-class-filter">Класс<select value={filters.class} onChange={(event) => setFilters({ ...filters, class: event.target.value })}><option value="">Все классы</option>{lookups?.classes.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
        <div className="sb-checkboxes"><label><input type="checkbox" checked={filters.ritual} onChange={(event) => setFilters({ ...filters, ritual: event.target.checked })} />Ритуал</label><label><input type="checkbox" checked={filters.concentration} onChange={(event) => setFilters({ ...filters, concentration: event.target.checked })} />Концентрация</label></div>
        <div className="sb-results-bar"><span role="status">{listing ? 'Поиск…' : `Найдено: ${list?.spells.length ?? 0}`}</span><button type="button" onClick={() => setFilters(emptyFilters)}>Сбросить</button></div>
        {error ? <div className="sb-message" role="alert"><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>Повторить</button></div> : <nav aria-label="Выбор заклинания" className="sb-spell-list" aria-busy={listing}>
          {list?.spells.map((spell) => <button type="button" key={spell.id} className="sb-spell-button" aria-pressed={selected === spell.id} onClick={() => setSelected(spell.id)}>
            <Icon entry={spell} /><span><strong>{spell.name}</strong><small>{levelName(spell.level)} · {spell.school.name}{spell.ritual ? ' · Ритуал' : ''}</small></span>
          </button>)}
          {!listing && list?.spells.length === 0 && <p className="sb-message">По этим условиям ничего не найдено. Измените поиск или сбросьте фильтры.</p>}
        </nav>}
        <p className="sb-sidebar-note">Класс учитывает и доступ через подклассы.</p>
      </aside>
      <div className="sb-detail" aria-live="polite" aria-busy={selected !== null && !detail && !detailError}>
        {error ? <div className="sb-message">Каталог сейчас недоступен.</div> : detailError ? <div className="sb-message" role="alert"><p>{detailError}</p><button onClick={() => setRetry((value) => value + 1)}>Повторить</button></div> : detail && detail.id === selected ? <SpellCard spell={detail} /> : <div className="sb-message">{selected !== null || listing ? 'Загружаем заклинание…' : 'Выберите другие условия поиска.'}</div>}
      </div>
    </main>
    <footer className="sb-page-footer">Официальные заклинания D&D 5e 2014 и дополнений · {list?.total??'…'} записей · Отдельный локальный каталог</footer>
  </div>;
}
