import type { RuleContext } from '../../backend/src/spell-catalog/rule-context';

export function RuleContextView({context,showConditions=false}:{context:RuleContext|null;showConditions?:boolean}){
  if(!context)return null;
  return <div className="eq-rule-context">
    {context.condition&&<p>Состояние: {context.condition}.</p>}
    {context.save&&<p><strong>Спасбросок: {context.save.ability} · Сл {context.save.dc??context.save.formula}</strong>{context.save.success&&` · При успехе: ${context.save.success}`}{context.save.failure&&` · При провале: ${context.save.failure}`}</p>}
    {context.save?.successImmunityHours!==null&&context.save?.successImmunityHours!==undefined&&<p>При успехе: иммунитет к этому свойству на {context.save.successImmunityHours} часов.</p>}
    {context.spell&&<p>Заклинание: <a href={context.spell.url} target="_blank" rel="noreferrer">{context.spell.name} ↗</a></p>}
    {context.copyStat&&<p>Значение равно: {context.copyStat}.</p>}
    {context.fact&&<p>Зависит от: {context.fact}{context.divisor&&` / ${context.divisor}`}{context.rounding==='floor'?' (округлить вниз)':''}{context.maximum!==null&&` · Не более ${context.maximum}`}.</p>}
    {context.attackBonus!==null&&<p>Бросок атаки: +{context.attackBonus}.</p>}
    {context.attackAbility&&<p>Атака: {context.attackAbility}{context.alternateAbility&&` или ${context.alternateAbility}`}.</p>}
    {context.range!==null&&<p>Дистанция: {context.range}{context.longRange!==null&&`/${context.longRange}`} футов.</p>}
    {context.radius!==null&&<p>Радиус: {context.radius} футов.</p>}
    <p className="sb-secondary">{context.activation}{context.durationValue!==null&&` · Длительность: ${context.durationValue} ${context.durationUnit?.toLocaleLowerCase('ru')??''}`}{context.maximumPerTurn!==null&&` · Не более ${context.maximumPerTurn} за ход`}{context.uses!==null&&` · Использований: ${context.uses}`}{context.recharge&&` · Восстановление: ${context.recharge.toLocaleLowerCase('ru')}`}</p>
    {context.cost&&<p>Расход: {context.cost.quantity} заряд{context.cost.hpAlternative!==null&&` или ${context.cost.hpAlternative} хитов`}.</p>}
    {context.selfOnly&&<p>Цель: только владелец.</p>}
    {context.concentration===false&&<p>Не требует концентрации.</p>}
    {context.componentsRequired===false&&<p>Компоненты заклинания не требуются.</p>}
    {context.persistentCurse&&<p>Проклятие сохраняется после снятия предмета.</p>}
    {context.endEvent&&<p>{context.endEvent}.</p>}
    {context.sharedUseCode&&<p>Использования общие для связанных свойств.</p>}
    {context.conditionChoices.length>0&&<p>Один из вариантов: {context.conditionChoices.join(', ')}.</p>}
    {showConditions&&context.conditions.length>0&&<details><summary>Условия последствия</summary>{context.conditions.map((test,index)=><p key={index}>{test.fact} {test.comparison==='eq'?'=':test.comparison==='ne'?'≠':test.comparison} {test.valueType==='boolean'?test.value===1?'Да':'Нет':test.value}</p>)}</details>}
    {context.outcomes.map((child,index)=><div className="eq-outcome" key={index}><p><strong>{child.outcome==='failure'?'При провале':'При успехе'}: {child.name}</strong>{child.value!==null&&` · ${child.value}`}{child.roll&&` · ${child.roll}`}</p><RuleContextView context={child.context} showConditions/></div>)}
  </div>;
}
