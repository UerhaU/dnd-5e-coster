import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const directory = new URL('../database/equipment/', import.meta.url);
export const equipmentPayload = () => JSON.parse(readFileSync(new URL('catalog-data.json', directory), 'utf8'));
export const equipmentDdl = `
CREATE TABLE catalog_modules (code TEXT PRIMARY KEY, version INTEGER NOT NULL, data_hash TEXT NOT NULL) STRICT;
CREATE TABLE gear_kinds (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, name_ru TEXT NOT NULL) STRICT;
CREATE TABLE gear_rarities (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, name_ru TEXT NOT NULL) STRICT;
CREATE TABLE gear_categories (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, name_ru TEXT NOT NULL, proficiency_code TEXT NOT NULL) STRICT;
CREATE TABLE gear_entries (
 item_id INTEGER PRIMARY KEY REFERENCES items(id), kind_id INTEGER NOT NULL REFERENCES gear_kinds(id),
 category_id INTEGER REFERENCES gear_categories(id), edition_id INTEGER NOT NULL REFERENCES editions(id),
 original_name TEXT, source_url TEXT NOT NULL, magical INTEGER NOT NULL CHECK(magical IN(0,1)),
 requires_attunement INTEGER NOT NULL CHECK(requires_attunement IN(0,1)), attunement_requirement TEXT,
 optional_rule INTEGER NOT NULL CHECK(optional_rule IN(0,1)), review_status TEXT NOT NULL CHECK(review_status IN('structured','partial')),
 type_line TEXT, description TEXT, price_min_cp INTEGER CHECK(price_min_cp>=0), price_max_cp INTEGER CHECK(price_max_cp>=price_min_cp)
) STRICT;
CREATE TABLE gear_sources (item_id INTEGER NOT NULL REFERENCES gear_entries(item_id), source_id INTEGER NOT NULL REFERENCES sources(id), PRIMARY KEY(item_id,source_id)) STRICT;
CREATE TABLE gear_base_options (item_id INTEGER NOT NULL REFERENCES gear_entries(item_id), base_item_id INTEGER NOT NULL REFERENCES gear_entries(item_id), PRIMARY KEY(item_id,base_item_id), CHECK(item_id<>base_item_id)) STRICT;
CREATE TABLE gear_variants (id INTEGER PRIMARY KEY, item_id INTEGER NOT NULL REFERENCES gear_entries(item_id), code TEXT NOT NULL, name_ru TEXT NOT NULL, rarity_id INTEGER NOT NULL REFERENCES gear_rarities(id), enhancement INTEGER, UNIQUE(item_id,code)) STRICT;
CREATE TABLE gear_properties (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, name_ru TEXT NOT NULL, description TEXT NOT NULL) STRICT;
CREATE TABLE gear_property_links (item_id INTEGER NOT NULL REFERENCES gear_entries(item_id), property_id INTEGER NOT NULL REFERENCES gear_properties(id), numeric_value REAL, formula_id INTEGER REFERENCES roll_formulas(id), PRIMARY KEY(item_id,property_id)) STRICT;
CREATE TABLE rule_stats (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, name_ru TEXT NOT NULL) STRICT;
CREATE TABLE rule_operators (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, name_ru TEXT NOT NULL) STRICT;
CREATE TABLE rule_facts (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, name_ru TEXT NOT NULL, value_type TEXT NOT NULL CHECK(value_type IN('boolean','number','code'))) STRICT;
CREATE TABLE rule_condition_groups (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, match_mode TEXT NOT NULL CHECK(match_mode IN('all','any'))) STRICT;
CREATE TABLE rule_condition_tests (id INTEGER PRIMARY KEY, group_id INTEGER NOT NULL REFERENCES rule_condition_groups(id), fact_id INTEGER NOT NULL REFERENCES rule_facts(id), comparison TEXT NOT NULL CHECK(comparison IN('eq','ne','lt','le','gt','ge')), number_value REAL, code_value TEXT, CHECK((number_value IS NULL)<>(code_value IS NULL))) STRICT;
CREATE TABLE gear_parameters (id INTEGER PRIMARY KEY, item_id INTEGER NOT NULL REFERENCES gear_entries(item_id), code TEXT NOT NULL, name_ru TEXT NOT NULL, minimum REAL NOT NULL, maximum REAL NOT NULL CHECK(maximum>=minimum), default_value REAL NOT NULL CHECK(default_value BETWEEN minimum AND maximum), UNIQUE(item_id,code)) STRICT;
CREATE TABLE effect_mechanics (effect_id INTEGER PRIMARY KEY REFERENCES effects(id), stat_id INTEGER NOT NULL REFERENCES rule_stats(id), operator_id INTEGER NOT NULL REFERENCES rule_operators(id), stacking_group TEXT NOT NULL, stacking_mode TEXT NOT NULL CHECK(stacking_mode IN('add','choose_one','highest','override'))) STRICT;
CREATE TABLE mechanic_terms (id INTEGER PRIMARY KEY, effect_id INTEGER NOT NULL REFERENCES effect_mechanics(effect_id), ordinal INTEGER NOT NULL CHECK(ordinal>0), kind TEXT NOT NULL CHECK(kind IN('constant','ability','variant','parameter')), constant_value REAL, ability_id INTEGER REFERENCES abilities(id), parameter_id INTEGER REFERENCES gear_parameters(id), coefficient REAL NOT NULL DEFAULT 1 CHECK(coefficient<>0), maximum REAL,
 CHECK((kind='constant' AND constant_value IS NOT NULL AND ability_id IS NULL AND parameter_id IS NULL) OR (kind='ability' AND constant_value IS NULL AND ability_id IS NOT NULL AND parameter_id IS NULL) OR (kind='variant' AND constant_value IS NULL AND ability_id IS NULL AND parameter_id IS NULL) OR (kind='parameter' AND constant_value IS NULL AND ability_id IS NULL AND parameter_id IS NOT NULL)), UNIQUE(effect_id,ordinal)) STRICT;
CREATE TABLE gear_effect_links (id INTEGER PRIMARY KEY, item_id INTEGER NOT NULL REFERENCES gear_entries(item_id), effect_id INTEGER NOT NULL REFERENCES effects(id), condition_group_id INTEGER REFERENCES rule_condition_groups(id), activation TEXT NOT NULL, duration_code TEXT NOT NULL, scope TEXT NOT NULL CHECK(scope IN('wearer','source_weapon','incoming_attack','target')), UNIQUE(item_id,effect_id,activation)) STRICT;
CREATE TABLE property_effect_links (property_id INTEGER NOT NULL REFERENCES gear_properties(id), effect_id INTEGER NOT NULL REFERENCES effects(id), condition_group_id INTEGER REFERENCES rule_condition_groups(id), PRIMARY KEY(property_id,effect_id)) STRICT;
CREATE TABLE gear_attack_profiles (id INTEGER PRIMARY KEY, item_id INTEGER NOT NULL REFERENCES gear_entries(item_id), mode TEXT NOT NULL CHECK(mode IN('melee','ranged','thrown','two_handed','bonus_action')), hands_required INTEGER NOT NULL CHECK(hands_required BETWEEN 1 AND 2), damage_effect_id INTEGER REFERENCES effects(id), attack_ability_id INTEGER NOT NULL REFERENCES abilities(id), alternate_ability_id INTEGER REFERENCES abilities(id), damage_ability_id INTEGER NOT NULL REFERENCES abilities(id), add_ability_to_damage INTEGER NOT NULL DEFAULT 1 CHECK(add_ability_to_damage IN(0,1)), reach_ft REAL CHECK(reach_ft>0), normal_range_ft REAL CHECK(normal_range_ft>0), maximum_range_ft REAL CHECK(maximum_range_ft>=normal_range_ft), condition_group_id INTEGER REFERENCES rule_condition_groups(id), UNIQUE(item_id,mode)) STRICT;
CREATE TABLE gear_unresolved_rules (id INTEGER PRIMARY KEY, item_id INTEGER NOT NULL REFERENCES gear_entries(item_id), ordinal INTEGER NOT NULL, description TEXT NOT NULL, reason TEXT NOT NULL, UNIQUE(item_id,ordinal)) STRICT;
CREATE TABLE item_packages (id INTEGER PRIMARY KEY, item_id INTEGER NOT NULL REFERENCES items(id), quantity REAL NOT NULL CHECK(quantity>0), unit_id INTEGER NOT NULL REFERENCES quantity_units(id), price_cp INTEGER CHECK(price_cp>=0), weight_lb REAL CHECK(weight_lb>=0), source_id INTEGER NOT NULL REFERENCES sources(id)) STRICT;
CREATE TABLE weapon_ammunition (weapon_item_id INTEGER PRIMARY KEY REFERENCES gear_entries(item_id), ammunition_item_id INTEGER NOT NULL REFERENCES items(id), quantity_per_attack REAL NOT NULL CHECK(quantity_per_attack>0), unit_id INTEGER NOT NULL REFERENCES quantity_units(id)) STRICT;
CREATE INDEX ix_gear_kind ON gear_entries(kind_id);
CREATE INDEX ix_gear_effect_item ON gear_effect_links(item_id);
CREATE INDEX ix_gear_attack_item ON gear_attack_profiles(item_id);
CREATE INDEX ix_rule_tests_group ON rule_condition_tests(group_id);
`;

export function applyEquipment(db, payload = equipmentPayload(), { rebuild = false } = {}) {
  if(payload.edition!=='5e_2014'||payload.magic.some(entry=>!/^https:\/\/5e14\.dnd\.su\/items\//.test(entry.url))||payload.base.some(entry=>!entry.url.startsWith('https://5e14.dnd.su/articles/inventory/')))throw new Error('Only official 2014 source paths are accepted.');
  const dataHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='catalog_modules'").get()) {
    const installed = db.prepare("SELECT * FROM catalog_modules WHERE code='equipment'").get();
    if (installed?.data_hash === dataHash && !rebuild) return { changed:false };
    if(!rebuild)throw new Error('Equipment module already exists with different data. A new migration is required.');
  }
  if (db.prepare('PRAGMA user_version').get().user_version !== 102) throw new Error('Core catalog v1.2 is required.');
  if(rebuild&&db.prepare("SELECT 1 FROM sqlite_master WHERE name='catalog_modules'").get()&&db.prepare("SELECT 1 FROM catalog_modules WHERE code='rules_audit'").get())throw new Error('Каталог уже проверен: пересборка запрещена. Изменяйте его отдельными миграциями.');
  const insert = (table, values) => {
    const keys = Object.keys(values).filter((key) => values[key] !== undefined);
    return Number(db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).run(...keys.map((key)=>typeof values[key]==='boolean'?Number(values[key]):values[key])).lastInsertRowid);
  };
  const findId = (table, code) => db.prepare(`SELECT id FROM ${table} WHERE code=?`).get(code)?.id;
  const dict = (table, rows, extra) => rows.forEach(([code,name],i)=>insert(table,{id:i+1,code,name_ru:name,...extra?.(code)}));
  const state = (code, tests, mode='all') => {
    const existing=findId('rule_condition_groups',code); if(existing)return existing;
    const id=insert('rule_condition_groups',{code,match_mode:mode});
    for(const [fact,comparison,value]of tests)insert('rule_condition_tests',{group_id:id,fact_id:findId('rule_facts',fact),comparison,number_value:typeof value==='number'?value:null,code_value:typeof value==='string'?value:null});
    return id;
  };
  const source = (name) => {
    const existing=db.prepare('SELECT id FROM sources WHERE name_original=? OR name_ru=?').get(name,name);if(existing)return existing.id;
    return insert('sources',{code:'equipment:'+name.toLowerCase().replace(/[^a-z0-9]+/g,'_'),name_ru:name,name_original:name,edition_id:1});
  };
  const formula = (value) => {
    if(!value)return null;
    const existing=db.prepare('SELECT id FROM roll_formulas WHERE source_expression=?').get(value);if(existing)return existing.id;
    const id=insert('roll_formulas',{code:'equipment:roll:'+value,name_ru:value,source_expression:value});
    const dice=value.match(/^(\d+)к(\d+)$/);
    insert('roll_terms',{formula_id:id,ordinal:1,kind:dice?'кубики':'константа',die_id:dice?db.prepare('SELECT id FROM dice WHERE sides=?').get(Number(dice[2])).id:null,dice_count:dice?Number(dice[1]):null,constant_value:dice?null:Number(value),use_spellcasting_ability:0,coefficient:1});
    return id;
  };
  const damageType = (value) => value?.includes('колющ')?'piercing':value?.includes('рубящ')?'slashing':value?.includes('дробящ')?'bludgeoning':value?.includes('некрот')?'necrotic':value?.includes('излуч')?'radiant':null;
  const damage = (roll,type) => {
    if(!roll||!type)return null;
    const f=formula(roll),d=findId('damage_types',type),code=`equipment:damage:${f}:${d}`;
    return findId('effects',code)??insert('effects',{code,name_ru:'Урон',effect_type_id:1,roll_formula_id:f,damage_type_id:d,choose_damage_type:0,automation:'справочно'});
  };
  const mechanic = (code,name,stat,operator,terms=[],description=null,stacking=stat) => {
    const existing=findId('effects','equipment:'+code);if(existing)return existing;
    const id=insert('effects',{code:'equipment:'+code,name_ru:name,effect_type_id:5,choose_damage_type:0,description,automation:'справочно'});
    insert('effect_mechanics',{effect_id:id,stat_id:findId('rule_stats',stat),operator_id:findId('rule_operators',operator),stacking_group:stacking,stacking_mode:operator==='base'?'choose_one':operator==='ignore'?'override':stacking==='shield'?'highest':'add'});
    terms.forEach((term,index)=>insert('mechanic_terms',{effect_id:id,ordinal:index+1,kind:term.kind??'constant',constant_value:term.kind?null:term.value,ability_id:term.ability??null,parameter_id:term.parameter??null,coefficient:term.coefficient??1,maximum:term.maximum??null}));return id;
  };
  const link = (item,effect,condition=null,activation='while_equipped',duration='while_equipped',scope='wearer') => insert('gear_effect_links',{item_id:item,effect_id:effect,condition_group_id:condition,activation,duration_code:duration,scope});
  const rare = (line) => /варьир/i.test(line)?'varies':/артефакт/i.test(line)?'artifact':/легендар/i.test(line)?'legendary':/очень редк/i.test(line)?'very_rare':/редк/i.test(line)?'rare':/необыч/i.test(line)?'uncommon':/обыч/i.test(line)?'common':'unknown';
  const attack=(item,mode,roll,type,hands,reach,normal,max,ability,alternate=null,damageAbility=ability) => insert('gear_attack_profiles',{item_id:item,mode,hands_required:hands,damage_effect_id:damage(roll,type),attack_ability_id:findId('abilities',ability),alternate_ability_id:alternate?findId('abilities',alternate):null,damage_ability_id:findId('abilities',damageAbility),reach_ft:reach,normal_range_ft:normal,maximum_range_ft:max});

  db.exec('BEGIN IMMEDIATE');
  try {
    if(rebuild&&db.prepare("SELECT 1 FROM sqlite_master WHERE name='catalog_modules'").get()){
      const ownedItems=db.prepare("SELECT item_id FROM gear_entries UNION SELECT id AS item_id FROM items WHERE code LIKE 'equipment:ammo:%'").all();
      const tables=[...equipmentDdl.matchAll(/CREATE TABLE (\w+)/g)].map(match=>match[1]);
      for(const table of tables.reverse())db.exec(`DROP TABLE IF EXISTS ${table}`);
      db.exec("DELETE FROM effects WHERE code LIKE 'equipment:%'; DELETE FROM roll_terms WHERE formula_id IN(SELECT id FROM roll_formulas WHERE code LIKE 'equipment:roll:%'); DELETE FROM roll_formulas WHERE code LIKE 'equipment:roll:%';");
      const remove=db.prepare('DELETE FROM items WHERE id=?');for(const item of ownedItems)remove.run(item.item_id);
    }
    db.exec(equipmentDdl);
    dict('gear_kinds',[['weapon','Оружие'],['armor','Доспех'],['shield','Щит'],['staff','Магический посох'],['ammunition','Боеприпасы'],['accessory','Защитный предмет']]);
    dict('gear_rarities',[['common','Обычный'],['uncommon','Необычный'],['rare','Редкий'],['very_rare','Очень редкий'],['legendary','Легендарный'],['artifact','Артефакт'],['varies','Варьируется'],['unknown','Не указана']]);
    dict('gear_categories',[['light_armor','Лёгкий доспех'],['medium_armor','Средний доспех'],['heavy_armor','Тяжёлый доспех'],['shield','Щит'],['simple_melee','Простое рукопашное'],['simple_ranged','Простое дальнобойное'],['martial_melee','Воинское рукопашное'],['martial_ranged','Воинское дальнобойное'],['firearm_renaissance','Огнестрельное: Возрождение'],['firearm_modern','Огнестрельное: современное'],['firearm_future','Огнестрельное: футуристическое']],code=>({proficiency_code:code.startsWith('simple')?'simple_weapons':code.startsWith('martial')?'martial_weapons':code}));
    dict('rule_stats',[['armor_class','Класс брони'],['attack_roll','Бросок атаки'],['damage_roll','Бросок урона'],['saving_throws','Спасброски'],['stealth','Скрытность'],['speed','Скорость (футы)'],['critical_damage','Критический урон'],['spellcasting','Накладывание заклинаний'],['strength_checks','Проверки Силы'],['dexterity_checks','Проверки Ловкости'],['strength_saves','Спасброски Силы'],['dexterity_saves','Спасброски Ловкости'],['attacks_per_action','Атак одним действием'],['hands','Требуемые руки'],['ammunition_cost','Боеприпасов на атаку'],['armor_strength_requirement','Требование Силы доспеха'],['stealth_penalty','Помеха Скрытности от доспеха'],['damage_taken','Получаемый урон']]);
    dict('rule_operators',[['base','Базовая формула'],['add','Прибавка'],['advantage','Преимущество'],['disadvantage','Помеха'],['block','Запрет'],['normal_critical','Критическое попадание становится обычным'],['ignore','Игнорировать ограничение'],['cap','Верхний предел'],['require','Требуется'],['resistance','Сопротивление']]);
    const facts=[['equipped','Предмет используется','boolean'],['attuned','Есть настройка','boolean'],['armor_proficient','Есть владение доспехом/щитом','boolean'],['armor_strength_exempt','Игнорирует штраф скорости за Силу','boolean'],['strength_score','Значение Силы','number'],['size','Размер владельца','code'],['target_distance','Дистанция до цели (футы)','number'],['mounted','Владелец верхом','boolean'],['wearing_armor','Надет доспех','boolean'],['using_shield','Используется щит','boolean'],['target_type','Тип цели','code'],['flames_active','Пламя оружия включено','boolean'],['attack_uses_strength_or_dexterity','Бросок атаки использует Силу или Ловкость','boolean']];
    facts.forEach(([code,name,type],i)=>insert('rule_facts',{id:i+1,code,name_ru:name,value_type:type}));
    const properties=[['light','Лёгкое','Подходит для сражения двумя оружиями по правилам 2014.'],['finesse','Фехтовальное','Выбор Силы или Ловкости; одна характеристика для атаки и урона.'],['thrown','Метательное','Есть отдельный режим броска с нормальной и предельной дальностью.'],['versatile','Универсальное','Двуручный режим использует отдельную формулу урона.'],['two_handed','Двуручное','Для атаки нужны две руки.'],['reach','Досягаемость','Увеличивает досягаемость атак этим оружием на 5 футов.'],['heavy','Тяжёлое','В редакции 2014 Маленькие и Крошечные существа атакуют с помехой.'],['loading','Перезарядка','Один выстрел действием, бонусным действием или реакцией независимо от числа атак.'],['ammunition','Боеприпас','Для атаки нужен боеприпас; зарядка одноручного оружия требует свободную руку.'],['special','Особое','Проверьте отдельные условия и режимы.'],['reload','Боекомплект','Число выстрелов до перезарядки.'],['burst','Очередь','Особый режим стрельбы, который требует отдельного разрешения.']];
    properties.forEach(([code,name,description],i)=>insert('gear_properties',{id:i+1,code,name_ru:name,description}));
    const small=state('small_or_tiny',[['size','eq','small'],['size','eq','tiny']],'any');
    const untrained=state('armor_without_proficiency',[['equipped','eq',1],['armor_proficient','eq',0]]);
    const untrainedAttack=state('armor_untrained_str_dex_attack',[['equipped','eq',1],['armor_proficient','eq',0],['attack_uses_strength_or_dexterity','eq',1]]);
    const noArmorShield=state('no_armor_no_shield',[['wearing_armor','eq',0],['using_shield','eq',0]]);
    const active=state('equipped',[['equipped','eq',1]]);
    const attuned=state('equipped_and_attuned',[['equipped','eq',1],['attuned','eq',1]]);
    const armorPenalties=['attack_roll','strength_checks','dexterity_checks','strength_saves','dexterity_saves'].map(stat=>mechanic('untrained:'+stat,'Без владения доспехом',stat,'disadvantage'));
    const noCasting=mechanic('untrained:casting','Без владения нельзя накладывать заклинания','spellcasting','block');
    const heavy=mechanic('heavy:small','Тяжёлое оружие: Маленький/Крошечный владелец','attack_roll','disadvantage');
    insert('property_effect_links',{property_id:findId('gear_properties','heavy'),effect_id:heavy,condition_group_id:small});
    for(const [property,stat,op,value]of [['loading','attacks_per_action','cap',1],['two_handed','hands','require',2],['ammunition','ammunition_cost','require',1]])insert('property_effect_links',{property_id:findId('gear_properties',property),effect_id:mechanic('property:'+property,properties.find(x=>x[0]===property)[1],stat,op,[{value}]),condition_group_id:null});
    const bases=[];
    const ammoIds=new Map();
    const piece=findId('quantity_units','piece');
    const charge=findId('quantity_units','charge')??insert('quantity_units',{code:'charge',name_ru:'Заряд'});
    for(let index=0;index<(payload.ammunition??[]).length;index++){
      const entry=payload.ammunition[index],id=150001+index;ammoIds.set(entry.name,id);
      insert('items',{id,code:'equipment:ammo:'+index,name_ru:entry.name,unit_id:piece,icon_url:null});
      insert('item_packages',{item_id:id,quantity:entry.quantity,unit_id:piece,price_cp:entry.priceCp,weight_lb:entry.weightLb,source_id:source(entry.source)});
    }
    for(let index=0;index<payload.base.length;index++){
      const entry=payload.base[index],id=100000+index+1;bases.push({...entry,id});
      insert('items',{id,code:'equipment:'+entry.key,name_ru:entry.name,price_cp:entry.priceCp,weight_lb:entry.weightLb,icon_url:null});
      insert('gear_entries',{item_id:id,kind_id:findId('gear_kinds',entry.kind),category_id:findId('gear_categories',entry.category),edition_id:1,source_url:entry.url,magical:0,requires_attunement:0,optional_rule:entry.optional,review_status:entry.specialDescription||entry.category.includes('modern')||entry.category.includes('future')?'partial':'structured',description:entry.specialDescription});
      insert('gear_sources',{item_id:id,source_id:source(entry.source)});
      if(entry.kind==='weapon'){
        const prop=entry.properties.toLowerCase().replaceAll('ё','е');
        for(const [code,,]of properties){const terms={light:'легкое',finesse:'фехтовальное',thrown:'метательное',versatile:'универсальное',two_handed:'двуручное',reach:'досягаемость',heavy:'тяжелое',loading:'перезарядка',ammunition:'боеприпас',special:'особое',reload:'боекомплект',burst:'очередь'};if(prop.includes(terms[code]))insert('gear_property_links',{item_id:id,property_id:findId('gear_properties',code),numeric_value:code==='reload'?Number(prop.match(/боекомплект\s*\((\d+)/)?.[1])||null:null,formula_id:code==='versatile'?formula(prop.match(/универсальное\s*\((\d+к\d+)/)?.[1]):null});}
        const ranged=entry.category.includes('ranged')||entry.category.startsWith('firearm'),finesse=prop.includes('фехтовальное'),ability=ranged?'dexterity':'strength',alternate=finesse?(ranged?'strength':'dexterity'):null;
        if(prop.includes('боеприпас')){
          const ammoName=entry.category==='firearm_future'?'Батарея':entry.category==='firearm_modern'?'Патроны':entry.category==='firearm_renaissance'?'Пули':entry.name==='Большой длинный лук'?'Большие стрелы':/арбалет/i.test(entry.name)?'Арбалетные болты':entry.name==='Духовая трубка'?'Иглы для трубки':entry.name==='Праща'||entry.name==='Хупак'?'Снаряды для пращи':'Стрелы';
          insert('weapon_ammunition',{weapon_item_id:id,ammunition_item_id:ammoIds.get(ammoName),quantity_per_attack:1,unit_id:entry.category==='firearm_future'?charge:piece});
        }
        attack(id,ranged?prop.includes('метательное')?'thrown':'ranged':'melee',entry.damage,damageType(entry.damageType),prop.includes('двуручное')?2:1,ranged?null:prop.includes('досягаемость')?10:5,ranged?entry.normalRange:null,ranged?entry.maxRange:null,ability,alternate,entry.name==='Большой длинный лук'?'strength':ability);
        if(!ranged&&prop.includes('метательное'))attack(id,'thrown',entry.damage,damageType(entry.damageType),1,null,entry.normalRange,entry.maxRange,ability,alternate);
        if(prop.includes('универсальное'))attack(id,'two_handed',prop.match(/универсальное\s*\((\d+к\d+)/)?.[1],damageType(entry.damageType),2,5,null,null,ability,alternate);
        if(entry.name==='Двухклинковый скимитар')attack(id,'bonus_action','1к4','slashing',2,5,null,null,'strength');
        if(entry.name==='Хупак')attack(id,'ranged','1к4','bludgeoning',2,null,40,160,'dexterity','strength');
        if(entry.name==='Длинное копьё'){
          link(id,mechanic('lance:close','Длинное копьё: близкая цель','attack_roll','disadvantage'),state('lance_close',[['target_distance','le',5]]),'while_equipped','while_equipped','source_weapon');
          link(id,mechanic('lance:unmounted','Длинное копьё без верхового животного','hands','require',[{value:2}]),state('unmounted',[['mounted','eq',0]]),'while_equipped','while_equipped','source_weapon');
        }
      }else{
        const ac=mechanic(`ac:${entry.ac}:${entry.dex}:${entry.dexCap}`,entry.kind==='shield'?'Бонус щита':'Формула КБ доспеха','armor_class',entry.kind==='shield'?'add':'base',[{value:entry.ac},...(entry.dex?[{kind:'ability',ability:findId('abilities','dexterity'),maximum:entry.dexCap}]:[])],null,entry.kind==='shield'?'shield':'armor_base');
        link(id,ac,active);
        if(entry.stealth)link(id,mechanic('armor:stealth','Помеха Скрытности от доспеха','stealth','disadvantage',[],null,'armor_stealth'),active);
        if(entry.strength)link(id,mechanic('armor:slow','Недостаточная Сила для тяжёлого доспеха','speed','add',[{value:-10}],null,'armor_strength_speed'),state('armor_strength_below_'+entry.strength,[['equipped','eq',1],['strength_score','lt',entry.strength],['armor_strength_exempt','eq',0]]));
        for(const effect of [...armorPenalties,noCasting])link(id,effect,effect===armorPenalties[0]?untrainedAttack:untrained);
      }
      if(entry.specialDescription)insert('gear_unresolved_rules',{item_id:id,ordinal:1,description:entry.specialDescription,reason:'Особые условия требуют отдельной проверки перед автоматическим расчётом.'});
    }
    const normal=(s)=>s.toLowerCase().replaceAll('ё','е').replace(/доспех[аи]?/g,'').replace(/\s+/g,' ').trim();
    function baseOptions(entry,kind){
      const spec=entry.typeLine.match(/\(([^)]+)\)/)?.[1]??'';
      if(kind==='accessory'||kind==='ammunition')return[];
      if(kind==='staff')return /боев(?:ой|ым) посох/.test(entry.description)?bases.filter(b=>b.name==='Боевой посох'):[];
      if(kind==='shield')return bases.filter(b=>b.kind==='shield');
      const candidates=bases.filter(b=>kind==='armor'?b.kind==='armor':b.kind==='weapon');
      const exact=candidates.filter(b=>normal(spec)===normal(b.name));if(exact.length)return exact;
      let matched=candidates.filter(b=>normal(spec).includes(normal(b.name)));
      if(/длинное копь[её] или пика/.test(spec))matched=candidates.filter(b=>['Длинное копьё','Пика'].includes(b.name));
      if(matched.length)return matched;
      if(kind==='armor')return candidates.filter(b=>(/легк|лёгк/.test(spec)&&b.category==='light_armor')||(/средн/.test(spec)&&b.category==='medium_armor'&&(!/кроме шкурного/.test(spec)||b.name!=='Шкурный'))||(/тяжел|тяжёл/.test(spec)&&b.category==='heavy_armor'));
      if(/меч/.test(spec))return candidates.filter(b=>/меч|рапира|скимитар/i.test(b.name)||/топор/.test(spec)&&/топор|секира/.test(b.name));
      if(/топор/.test(spec))return candidates.filter(b=>/топор|секира/.test(b.name));
      if(/арбалет/.test(spec))return candidates.filter(b=>/Арбалет/i.test(b.name));
      if(/лук/.test(spec))return candidates.filter(b=>/лук/i.test(b.name));
      if(/дробящий/.test(spec))return candidates.filter(b=>damageType(b.damageType)==='bludgeoning');
      if(/огнестрел/.test(spec))return candidates.filter(b=>b.category.startsWith('firearm'));
      if(/любое/.test(spec))return candidates;
      return[];
    }
    let structuredMagic=0;
    for(const entry of payload.magic){
      const id=200000+entry.siteId,description=entry.description.replaceAll('\\n','\n');
      const kind=/^Доспех/.test(entry.typeLine)?/\(щит\)/i.test(entry.typeLine)?'shield':'armor':/^Посох/.test(entry.typeLine)?'staff':/^Оружие/.test(entry.typeLine)?/боеприпас/i.test(entry.typeLine)?'ammunition':'weapon':'accessory';
      const complete=[1,148,33,160,254,94,171,151].includes(entry.siteId);
      const price=entry.priceText?.match(/([\d ]+)\s*[-–]\s*([\d ]+)\s*зм/);
      const minimum=price?Number(price[1].replaceAll(' ',''))*100:/^от\s*(\d+)/.test(entry.priceText??'')?Number(entry.priceText.match(/\d+/)[0])*100:null;
      insert('items',{id,code:'dndsu:5e2014:item:'+entry.siteId,name_ru:entry.name,icon_url:null});
      insert('gear_entries',{item_id:id,kind_id:findId('gear_kinds',kind),edition_id:1,original_name:entry.originalName,source_url:entry.url,magical:1,requires_attunement:entry.requiresAttunement,attunement_requirement:entry.typeLine.match(/\(требуется настройка([^)]*)\)/)?.[1]?.trim()||null,optional_rule:0,review_status:complete?'structured':'partial',type_line:entry.typeLine,description,price_min_cp:minimum,price_max_cp:price?Number(price[2].replaceAll(' ',''))*100:null});
      for(const title of entry.sourceTitles)insert('gear_sources',{item_id:id,source_id:source(title)});
      for(const base of baseOptions({...entry,description},kind))insert('gear_base_options',{item_id:id,base_item_id:base.id});
      const variable=[33,160,254].includes(entry.siteId);
      if(variable)for(const enhancement of [1,2,3])insert('gear_variants',{item_id:id,code:'plus_'+enhancement,name_ru:'+'+enhancement,enhancement,rarity_id:findId('gear_rarities',entry.siteId===33?['rare','very_rare','legendary'][enhancement-1]:['uncommon','rare','very_rare'][enhancement-1])});
      else insert('gear_variants',{item_id:id,code:'default',name_ru:entry.name,rarity_id:findId('gear_rarities',rare(entry.typeLine)),enhancement:null});
      const condition=entry.requiresAttunement?attuned:active;
      if(variable)for(const stat of entry.siteId===160?['attack_roll','damage_roll']:['armor_class'])link(id,mechanic(`enhancement:${stat}`,'Магическое улучшение',stat,'add',[{kind:'variant'}],null,'enhancement:'+stat),condition,'while_equipped','while_equipped',entry.siteId===160?'source_weapon':'wearer');
      if(entry.siteId===1)link(id,mechanic('adamantine','Адамантин: обычный урон вместо критического','critical_damage','normal_critical'),condition);
      if(entry.siteId===148){link(id,mechanic('mithral:stealth','Мифрил: нет помехи Скрытности','stealth','ignore',[],null,'armor_stealth'),condition);link(id,mechanic('mithral:strength','Мифрил: нет штрафа скорости за Силу','speed','ignore',[],null,'armor_strength_speed'),condition);}
      if([94,171].includes(entry.siteId))for(const stat of ['armor_class','saving_throws'])link(id,mechanic('protection:'+stat,'Защита',stat,'add',[{value:1}],null,'protection:'+entry.siteId+':'+stat),condition);
      if(entry.siteId===151){
        const group=state('bracers_active',[['equipped','eq',1],['attuned','eq',1],['wearing_armor','eq',0],['using_shield','eq',0]]);
        link(id,mechanic('bracers:ac','Наручи без доспеха и щита','armor_class','add',[{value:2}]),group);
      }
      if(entry.siteId===54){
        const parameter=insert('gear_parameters',{item_id:id,code:'defender_ac',name_ru:'Часть бонуса, перенесённая в КБ',minimum:0,maximum:3,default_value:0});
        for(const stat of ['attack_roll','damage_roll'])link(id,mechanic('defender:'+stat,'Остаток бонуса «Защитника»',stat,'add',[{value:3},{kind:'parameter',parameter,coefficient:-1}]),condition,'first_attack_each_turn','start_next_turn','source_weapon');
        link(id,mechanic('defender:ac','Перенесённый бонус «Защитника»','armor_class','add',[{kind:'parameter',parameter}]),condition,'first_attack_each_turn','start_next_turn');
      }else if(!variable&&kind==='weapon'){
        const bonus=description.match(/^Вы получаете бонус \+(\d) к броскам атаки и урона/);
        if(bonus)for(const stat of ['attack_roll','damage_roll'])link(id,mechanic('flat_bonus:'+bonus[1]+':'+stat,'Бонус магического оружия',stat,'add',[{value:Number(bonus[1])}]),condition,'while_equipped','while_equipped','source_weapon');
      }
      if(entry.siteId===262){
        const effect=damage('2к6','fire');link(id,effect,state('flame_tongue_on',[['equipped','eq',1],['attuned','eq',1],['flames_active','eq',1]]),'on_hit','while_active','source_weapon');
      }
      if(!complete){
        const paragraphs=description.split(/\n\s*\n/).filter(Boolean);
        for(let i=0;i<paragraphs.length;i++)insert('gear_unresolved_rules',{item_id:id,ordinal:i+1,description:paragraphs[i],reason:'Исходный текст сохранён; полный структурный разбор ещё не подтверждён.'});
      }else structuredMagic++;
    }
    if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Equipment foreign key check failed');
    insert('catalog_modules',{code:'equipment',version:1,data_hash:dataHash});
    db.exec('COMMIT');
    return {changed:true,base:payload.base.length,magic:payload.magic.length,structuredMagic,partialMagic:payload.magic.length-structuredMagic};
  }catch(error){db.exec('ROLLBACK');throw error;}
}
