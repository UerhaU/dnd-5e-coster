import { useEffect,useState } from 'react';
import type { RaceDetail,RaceSummary } from '../../backend/src/spell-catalog/race-repository';
import { calculateBody,calculateCarrying } from '../../backend/src/spell-catalog/race-math';

const n=(v:number)=>v.toLocaleString('ru-RU',{maximumFractionDigits:1});
const pounds=(v:number)=>`${n(v)} фунт. (${n(v*0.45359237)} кг)`;
const height=(v:number)=>`${n(v*2.54)} см`;
async function load<T>(path:string,signal:AbortSignal):Promise<T>{const response=await fetch('/api/spellbook/races'+path,{signal});if(!response.ok)throw new Error(response.status===400?'Проверьте выбранную разновидность.':'Не удалось загрузить расы.');return response.json() as Promise<T>;}
function Placeholder({entry}:{entry:{name:string;iconUrl:string|null}}){return <span className="sb-icon" aria-hidden="true">{entry.iconUrl&&<img src={entry.iconUrl} alt=""/>}</span>;}

function BodyPreview({race}:{race:RaceDetail}){
 const g=race.generator;
 const[h,setH]=useState(g?String(g.heightDice.minimum):''),[w,setW]=useState(g?String(g.weightDice.minimum):'');
 if(!g)return null;
 let result:ReturnType<typeof calculateBody>|null=null;
 try{if(h!==''&&w!=='')result=calculateBody(g,Number(h),Number(w));}catch{/* Inputs may be temporarily incomplete. */}
 const roll=(count:number,sides:number)=>Array.from({length:count},()=>1+Math.floor(Math.random()*sides)).reduce((a,b)=>a+b,0);
 return <section className="rc-preview" data-testid="body-preview"><h3>Случайный рост и вес</h3>
  <p>Рост: ({n(g.baseHeightIn)} + {g.heightDice.label}) дюймов.<br/>Вес: {n(g.baseWeightLb)} + результат роста × {g.weightDice.label} фунтов.</p>
  <div className="rc-inputs"><label>Бросок роста ({g.heightDice.minimum}–{g.heightDice.maximum})<input type="number" min={g.heightDice.minimum} max={g.heightDice.maximum} step={1} value={h} onChange={e=>setH(e.target.value)}/></label>
   <label>Множитель веса ({g.weightDice.minimum}–{g.weightDice.maximum})<input type="number" min={g.weightDice.minimum} max={g.weightDice.maximum} step={1} value={w} onChange={e=>setW(e.target.value)}/></label></div>
  <button type="button" className="rc-button" onClick={()=>{setH(String(roll(g.heightDice.count,g.heightDice.sides)));setW(String(roll(g.weightDice.count,g.weightDice.sides)));}}>Бросить кубики</button>
  {result?<p className="rc-result" role="status">Рост {n(result.heightCm)} см · Вес {pounds(result.weightLb)}</p>:<p role="status">Укажите допустимые результаты бросков.</p>}
  <p className="sb-secondary">Один результат броска роста используется и для роста, и для расчёта веса. Это предварительный просмотр, он не создаёт персонажа.</p>
  <a href={g.sourceUrl} target="_blank" rel="noreferrer">Таблица роста и веса 2014 ↗</a>
 </section>;
}

function CarryPreview({race}:{race:RaceDetail}){
 const[strength,setStrength]=useState('10'),[loadLb,setLoad]=useState('0');
 let result:ReturnType<typeof calculateCarrying>|null=null;
 try{if(strength!==''&&loadLb!=='')result=calculateCarrying(race.carrying,Number(strength),race.size.carryingMultiplier,Number(loadLb));}catch{/* Preserve partially entered values. */}
 return <section className="rc-preview" data-testid="carrying-preview"><h3>Проверка грузоподъёмности</h3>
  <p>Обычное правило 2014: {race.carrying.ability} × {n(race.carrying.carryPerPoint)} × {n(race.size.carryingMultiplier)} за размер, в фунтах.</p>
  <div className="rc-inputs"><label>Итоговая Сила (с бонусами)<input type="number" min={1} max={30} step={1} value={strength} onChange={e=>setStrength(e.target.value)}/></label>
   <label>Вес снаряжения, фунты<input type="number" min={0} step="any" value={loadLb} onChange={e=>setLoad(e.target.value)}/></label></div>
  {result?<div role="status"><p className="rc-result">Можно нести: {pounds(result.capacityLb)}</p><p>Толкать, тянуть или отрывать от земли: {pounds(result.pushDragLiftLb)}.</p><p>{result.overloaded?`Груз превышает лимит на ${pounds(-result.remainingLb)}.`:`Остаток до лимита: ${pounds(result.remainingLb)}.`}</p></div>:<p role="status">Укажите целую Силу от 1 до 30 и неотрицательный вес груза.</p>}
  <p className="sb-secondary">Собственный вес тела не вычитается из этого лимита. При толкании или волочении груза тяжелее переносимого лимита скорость составляет {race.carrying.overloadedDragSpeedFt} футов. Вариант правил «Нагрузка» здесь не применяется.</p>
  <a href={race.carrying.sourceUrl} target="_blank" rel="noreferrer">Правило подъёма и переноса 2014 ↗</a>
 </section>;
}

function RaceCard({race,onSubrace}:{race:RaceDetail;onSubrace:(id:number)=>void}){
 const body=race.body;
 const lifetime=body?.lifespanQualifier==='under'?'менее':body?.lifespanQualifier==='over'?'свыше':body?.lifespanQualifier==='up_to'?'до':'около';
 const kinds:Record<string,string>={weapon:'Оружие',armor:'Доспехи',skill:'Навыки',tool:'Инструменты'};
 return <article className="sb-card" aria-labelledby="race-title">
  <header className="sb-card-heading"><Placeholder entry={race}/><div><p className="sb-eyebrow">Раса · D&D 5e 2014</p><h2 id="race-title">{race.selectedSubrace?.name??race.name}</h2><p className="sb-original">{race.originalName}{race.selectedSubrace?` · ${race.name}`:''}</p></div></header>
  {race.subraces.length>0&&<label className="rc-subrace">Разновидность<select value={race.selectedSubrace?.id??''} onChange={e=>onSubrace(Number(e.target.value))}>{race.subraces.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>}
  {race.description&&<p>{race.description}</p>}
  <dl className="sb-stats"><div><dt>Размер</dt><dd>{race.size.name}</dd></div><div><dt>Тип существа</dt><dd>{race.creatureType}</dd></div><div><dt>Скорость</dt><dd>{race.speeds.map(s=>`${s.mode}: ${s.feet} футов`).join('; ')}</dd></div></dl>
  <section><h3>Бонусы характеристик</h3><div className="sb-tags">{race.bonuses.map(b=><span key={b.abilityId}>{b.ability} {b.bonus>0?'+':''}{b.bonus}</span>)}</div><p className="sb-secondary">Общие бонусы расы и бонусы разновидности сложены один раз.</p></section>
  {body&&<section><h3>Телосложение и возраст</h3><dl className="rc-body">
   <div><dt>Обычный рост</dt><dd>{body.heightMinIn!==null&&height(body.heightMinIn)}{body.heightMaxIn!==null&&` — ${height(body.heightMaxIn)}`}</dd></div>
   <div><dt>Обычный вес</dt><dd>{body.weightAverageLb!==null?`около ${pounds(body.weightAverageLb)}`:body.weightMinLb!==null&&body.weightMaxLb!==null?`${n(body.weightMinLb)}–${n(body.weightMaxLb)} фунт. (${n(body.weightMinLb*0.45359237)}–${n(body.weightMaxLb*0.45359237)} кг)`:'Не указан'}</dd></div>
   <div><dt>{body.adulthoodBasis==='social'?'Признанная зрелость':'Взросление'}</dt><dd>около {body.adultAge} лет</dd></div><div><dt>Продолжительность жизни</dt><dd>{lifetime} {body.lifespan} лет</dd></div>
  </dl><p className="sb-secondary">{body.notes}</p></section>}
  <BodyPreview key={race.generator?.id??'none'} race={race}/>
  <CarryPreview race={race}/>
  <section><h3>Языки</h3><div className="sb-tags">{race.languages.map(l=><span key={l.id}>{l.name}</span>)}</div></section>
  {race.proficiencies.length>0&&<section><h3>Владения</h3>{['weapon','armor','skill','tool'].map(kind=>{const rows=race.proficiencies.filter(p=>p.kind===kind);return rows.length>0&&<p key={kind}><strong>{kinds[kind]}:</strong> {rows.map(p=>p.name).join(', ')}.</p>;})}</section>}
  {race.choices.length>0&&<section><h3>На выбор</h3><div className="rc-choices">{race.choices.map(c=><label key={c.id}>{c.name} · выбрать {c.count}{c.castingAbility&&<small>Характеристика заклинания: {c.castingAbility}</small>}<select defaultValue=""><option value="">Посмотреть доступные варианты</option>{c.options.map(o=><option key={o.id} value={o.id}>{o.name}{o.exotic?' · экзотический, согласовать с мастером':''}</option>)}</select></label>)}</div><p className="sb-secondary">Выбор здесь служит для проверки состава списка и пока не сохраняется.</p></section>}
  {race.traits.length>0&&<section><h3>Особенности</h3><div className="rc-traits">{race.traits.map(t=><div className="rc-trait" key={t.id}><h4>{t.name}</h4><p className="sb-secondary">{t.origin}</p><p>{t.description}</p>{t.rules.map(r=><div className="rc-numeric" key={r.id}><strong>{r.stat}: {r.operator}{r.value!==null?` ${r.value}`:''}{r.damage?` · ${r.damage}`:''}{r.basis==='character_level'?' × уровень персонажа':''}</strong>{r.conditions.length>0&&<p>Условие: {r.conditions.join('; ')}.</p>}</div>)}</div>)}</div></section>}
  <footer className="sb-card-footer">{race.sources.map((s,i)=><p key={i}>{s.name} · Проверено {s.checkedOn} · <a href={s.url} target="_blank" rel="noreferrer">Источник DnD.su ↗</a></p>)}</footer>
 </article>;
}

export function RacesPage(){
 const params=new URLSearchParams(window.location.search);
 const[q,setQ]=useState(''),[list,setList]=useState<{entries:RaceSummary[];total:number}|null>(null),[selected,setSelected]=useState<number|null>(()=>{const v=Number(params.get('race'));return Number.isSafeInteger(v)&&v>0?v:null;}),[subrace,setSubrace]=useState<number|undefined>(()=>{const v=Number(params.get('subrace'));return Number.isSafeInteger(v)&&v>0?v:undefined;}),[detail,setDetail]=useState<RaceDetail|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{const controller=new AbortController();setError('');void load<{entries:RaceSummary[];total:number}>('?q='+encodeURIComponent(q),controller.signal).then(data=>{setList(data);setSelected(previous=>data.entries.some(r=>r.id===previous)?previous:data.entries[0]?.id??null);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[q,retry]);
 useEffect(()=>{const controller=new AbortController();setDetail(null);if(selected!==null){setError('');void load<RaceDetail>(`/${selected}${subrace?`?subrace=${subrace}`:''}`,controller.signal).then(data=>{setDetail(data);const url=new URL(window.location.href);url.searchParams.set('race',String(data.id));if(data.selectedSubrace)url.searchParams.set('subrace',String(data.selectedSubrace.id));else url.searchParams.delete('subrace');window.history.replaceState(null,'',url);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});}return()=>controller.abort();},[selected,subrace,retry]);
 return <div className="sb-page"><header className="sb-masthead"><div><p className="sb-eyebrow">Dungeons & Dragons · 5e 2014</p><h1>Расы</h1><p>Происхождение, телосложение и общие особенности.</p><nav className="rc-nav" aria-label="Локальные каталоги"><a href="/spellbook.html">Заклинания</a><a href="/equipment.html">Снаряжение</a><a href="/races.html" aria-current="page">Расы</a></nav></div><span className="sb-test-label">Пробный набор</span></header>
  <main className="sb-layout"><aside className="sb-sidebar"><div className="sb-filter-heading"><h2>Расы</h2><span>{list?.total??'…'}</span></div><label className="sb-search">Поиск расы<input type="search" value={q} maxLength={200} onChange={e=>{setQ(e.target.value);setSubrace(undefined);}} placeholder="Название расы или разновидности"/></label><p role="status" className="sb-secondary">Найдено: {list?.entries.length??0}</p><nav className="sb-spell-list" aria-label="Выбор расы">{list?.entries.map(r=><button key={r.id} type="button" className="sb-spell-button" aria-pressed={selected===r.id} onClick={()=>{setSubrace(undefined);setSelected(r.id);}}><Placeholder entry={r}/><span><strong>{r.name}</strong><small>{r.originalName}{r.subraces.length>0?` · ${r.subraces.length} разновидности`:''}</small></span></button>)}</nav>{list?.entries.length===0&&<p>По этому запросу ничего не найдено.</p>}<p className="sb-sidebar-note">Три расы для проверки структуры. Другие расы и разновидности добавим после проверки этого набора.</p></aside>
   <div className="sb-detail" aria-live="polite">{error?<div className="sb-message" role="alert"><p>{error}</p><button type="button" onClick={()=>{setSubrace(undefined);setRetry(v=>v+1);}}>Повторить</button></div>:detail?<RaceCard key={`${detail.id}:${detail.selectedSubrace?.id??''}`} race={detail} onSubrace={setSubrace}/>:<div className="sb-message">{selected!==null?'Загрузка расы…':'Выберите расу.'}</div>}</div>
  </main><footer className="sb-page-footer">Пробный набор Книги игрока 2014 · Отдельный локальный каталог · Связи с листом персонажа пока нет</footer>
 </div>;
}
