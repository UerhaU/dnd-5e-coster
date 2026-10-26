import { armorReviewedRules } from './armor-reviewed-rules.mjs';

export function applyAuditCorrections(db){
  if(db.prepare("SELECT 1 FROM catalog_modules WHERE code='audit_corrections_v3'").get())return{changed:false};
  db.exec('BEGIN IMMEDIATE');
  try{
    db.exec(`ALTER TABLE spell_numeric_rules ADD COLUMN target_kind TEXT CHECK(target_kind IN('creature','creature_or_object','area_creatures'));
      ALTER TABLE effect_context ADD COLUMN condition_group_id INTEGER REFERENCES rule_condition_groups(id);
      ALTER TABLE effect_context ADD COLUMN end_event_id INTEGER REFERENCES rule_events(id);
      ALTER TABLE effect_save_rules ADD COLUMN success_immunity_hours REAL CHECK(success_immunity_hours>0);`);
    db.exec("UPDATE spell_numeric_rules SET target_kind=CASE spell_id WHEN 10001 THEN 'area_creatures' WHEN 10003 THEN 'creature_or_object' ELSE 'creature' END");
    const eventNames={end_turn:'До конца текущего хода',end_next_turn:'До конца следующего хода владельца',start_next_turn:'До начала следующего хода цели'};
    const walk=(siteId,rule,path)=>{
      const effect=db.prepare('SELECT id FROM effects WHERE code=?').get(`equipment:audit:${siteId}:${path}`);if(!effect)return;
      const group=db.prepare('SELECT id FROM rule_condition_groups WHERE code=?').get(`audit:${siteId}:${path}`);
      let eventId=null;if(rule.duration){const found=db.prepare('SELECT id FROM rule_events WHERE code=?').get(rule.duration);eventId=found?.id??Number(db.prepare('INSERT INTO rule_events(code,name_ru) VALUES(?,?)').run(rule.duration,eventNames[rule.duration]??rule.duration).lastInsertRowid);}
      db.prepare('UPDATE effect_context SET condition_group_id=?,end_event_id=? WHERE effect_id=?').run(group?.id??null,eventId,effect.id);
      for(const[index,child]of(rule.failureRules??[]).entries())walk(siteId,child,path+'.f'+index);
    };
    for(const entry of armorReviewedRules)entry.rules.forEach((rule,index)=>walk(entry.siteId,rule,String(index)));
    db.prepare("UPDATE effect_save_rules SET success_immunity_hours=24 WHERE effect_id IN(SELECT id FROM effects WHERE code='equipment:audit:2252:4')").run();
    for(const siteId of [3615,3616,3617,397,398,425,440]){
      db.prepare("DELETE FROM gear_unresolved_rules WHERE item_id=? AND reason LIKE 'Исходный текст сохранён%'").run(200000+siteId);
      if(!db.prepare('SELECT 1 FROM gear_unresolved_rules WHERE item_id=?').get(200000+siteId))db.prepare("UPDATE gear_entries SET review_status='structured' WHERE item_id=?").run(200000+siteId);
    }
    db.prepare("INSERT INTO catalog_modules(code,version,data_hash) VALUES('audit_corrections_v3',3,'numeric-target-kinds-outcomes-v3')").run();
    if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Corrections FK check failed');
    db.exec('COMMIT');return{changed:true};
  }catch(error){db.exec('ROLLBACK');throw error;}
}

export function applyAuditSemantics(db){
  if(db.prepare("SELECT 1 FROM catalog_modules WHERE code='audit_semantics_v4'").get())return{changed:false};
  db.exec('BEGIN IMMEDIATE');
  try{
    const event=db.prepare("INSERT INTO rule_events(code,name_ru) VALUES('on_parent_save_failure','После провала указанного спасброска')").run().lastInsertRowid;
    db.prepare('UPDATE effect_context SET event_id=? WHERE effect_id IN(SELECT effect_id FROM effect_outcome_links)').run(event);
    db.exec("UPDATE effect_mechanics SET stacking_mode='highest',stacking_group=stacking_group||':'||(SELECT code FROM rule_operators WHERE id=operator_id)||':'||COALESCE((SELECT damage_type_id FROM effects WHERE id=effect_id),'context') WHERE effect_id IN(SELECT id FROM effects WHERE code LIKE 'equipment:audit:%') AND operator_id IN(SELECT id FROM rule_operators WHERE code IN('resistance','immunity','vulnerability','advantage','disadvantage'));UPDATE effect_mechanics SET stacking_mode='highest' WHERE stat_id IN(SELECT id FROM rule_stats WHERE code='darkvision');");
    db.prepare('INSERT INTO rule_stats(code,name_ru) VALUES(?,?)').run('base_damage','Базовый урон атаки');
    for(const[siteId,index,mode,normal,max,alternate]of[[32,2,'melee',null,null,null],[7149,0,'thrown',20,60,'dexterity']]){
      const effect=db.prepare('SELECT id FROM effects WHERE code=?').get(`equipment:audit:${siteId}:${index}`);
      db.prepare("UPDATE effect_mechanics SET stat_id=(SELECT id FROM rule_stats WHERE code='base_damage'),operator_id=(SELECT id FROM rule_operators WHERE code='set'),stacking_mode='override' WHERE effect_id=?").run(effect.id);
      db.prepare(`INSERT INTO gear_attack_profiles(item_id,mode,hands_required,damage_effect_id,attack_ability_id,alternate_ability_id,damage_ability_id,reach_ft,normal_range_ft,maximum_range_ft)
        VALUES(?,?,1,?,(SELECT id FROM abilities WHERE code='strength'),(SELECT id FROM abilities WHERE code=?),(SELECT id FROM abilities WHERE code='strength'),?,?,?)`).run(200000+siteId,mode,effect.id,alternate,mode==='melee'?5:null,normal,max);
    }
    const flight=db.prepare("SELECT condition_group_id FROM effect_context WHERE effect_id=(SELECT id FROM effects WHERE code='equipment:audit:10778:3')").get();
    db.prepare("INSERT INTO rule_condition_tests(group_id,fact_id,comparison,number_value) VALUES(?,(SELECT id FROM rule_facts WHERE code='armor_active'),'eq',1)").run(flight.condition_group_id);
    db.prepare("INSERT INTO catalog_modules(code,version,data_hash) VALUES('audit_semantics_v4',4,'one-shot-outcomes-and-damage-profiles-v4')").run();
    if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Semantics FK check failed');
    db.exec('COMMIT');return{changed:true};
  }catch(error){db.exec('ROLLBACK');throw error;}
}

export function applyRuidiumTravel(db){
  if(db.prepare("SELECT 1 FROM catalog_modules WHERE code='ruidium_travel_v5'").get())return{changed:false};
  db.exec('BEGIN IMMEDIATE');
  try{
    const carried=Number(db.prepare("INSERT INTO rule_facts(code,name_ru,value_type) VALUES('carried','Предмет находится при владельце','boolean')").run().lastInsertRowid);
    const group=Number(db.prepare("INSERT INTO rule_condition_groups(code,match_mode) VALUES('audit:ruidium_weapon_carried','all')").run().lastInsertRowid);
    db.prepare("INSERT INTO rule_condition_tests(group_id,fact_id,comparison,number_value) VALUES(?,?,'eq',1)").run(group,carried);
    db.prepare("INSERT INTO rule_condition_tests(group_id,fact_id,comparison,number_value) VALUES(?,(SELECT id FROM rule_facts WHERE code='attuned'),'eq',1)").run(group);
    db.prepare("INSERT INTO rule_condition_tests(group_id,fact_id,comparison,number_value) VALUES(?,(SELECT id FROM rule_facts WHERE code='ruidium_destroyed'),'eq',0)").run(group);
    for(const[code,name,stat,op,copy]of[['breathing','Подводное дыхание','underwater_breathing','grant',false],['swimming','Скорость плавания','swim_speed','copy',true]]){
      const effect=Number(db.prepare("INSERT INTO effects(code,name_ru,effect_type_id,choose_damage_type,automation) VALUES(?,?,5,0,'справочно')").run('equipment:audit:3617:travel:'+code,name).lastInsertRowid);
      db.prepare("INSERT INTO effect_mechanics(effect_id,stat_id,operator_id,stacking_group,stacking_mode) VALUES(?,(SELECT id FROM rule_stats WHERE code=?),(SELECT id FROM rule_operators WHERE code=?),?,'highest')").run(effect,stat,op,stat);
      db.prepare("INSERT INTO gear_effect_links(item_id,effect_id,condition_group_id,activation,duration_code,scope) VALUES(203617,?,?,'while_carried','while_carried','wearer')").run(effect,group);
      db.prepare("INSERT INTO effect_context(effect_id,event_id,copy_stat_id,condition_group_id) VALUES(?,(SELECT id FROM rule_events WHERE code='while_equipped'),(SELECT id FROM rule_stats WHERE code=?),?)").run(effect,copy?'speed':null,group);
    }
    db.prepare("INSERT INTO rule_events(code,name_ru) VALUES('while_carried','Пока предмет находится при владельце')").run();
    db.prepare("UPDATE effect_context SET event_id=(SELECT id FROM rule_events WHERE code='while_carried') WHERE effect_id IN(SELECT id FROM effects WHERE code LIKE 'equipment:audit:3617:travel:%')").run();
    db.prepare("INSERT INTO catalog_modules(code,version,data_hash) VALUES('ruidium_travel_v5',5,'restored-ruidium-weapon-list-v5')").run();
    if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Ruidium travel FK check failed');
    db.exec('COMMIT');return{changed:true};
  }catch(error){db.exec('ROLLBACK');throw error;}
}

export function applyDelayedOutcomes(db){
  if(db.prepare("SELECT 1 FROM catalog_modules WHERE code='delayed_outcomes_v6'").get())return{changed:false};
  db.exec('BEGIN IMMEDIATE');
  try{
    const walk=(siteId,rule,path)=>{
      for(const[index,child]of(rule.failureRules??[]).entries()){
        const childPath=path+'.f'+index;
        if(child.activation)db.prepare('UPDATE effect_context SET event_id=(SELECT id FROM rule_events WHERE code=?) WHERE effect_id=(SELECT id FROM effects WHERE code=?)').run(child.activation,`equipment:audit:${siteId}:${childPath}`);
        walk(siteId,child,childPath);
      }
    };
    for(const entry of armorReviewedRules)entry.rules.forEach((rule,index)=>walk(entry.siteId,rule,String(index)));
    db.prepare("UPDATE gear_effect_links SET scope='target' WHERE effect_id=(SELECT id FROM effects WHERE code='equipment:audit:2252:4')").run();
    db.prepare("INSERT INTO catalog_modules(code,version,data_hash) VALUES('delayed_outcomes_v6',6,'preserve-explicit-delayed-triggers-v6')").run();
    if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Delayed outcome FK check failed');
    db.exec('COMMIT');return{changed:true};
  }catch(error){db.exec('ROLLBACK');throw error;}
}
