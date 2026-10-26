CREATE TABLE rule_events(id INTEGER PRIMARY KEY,code TEXT NOT NULL UNIQUE,name_ru TEXT NOT NULL) STRICT;

CREATE TABLE catalog_source_audits(url TEXT PRIMARY KEY,checked_on TEXT NOT NULL,sha256 TEXT NOT NULL,description TEXT NOT NULL) STRICT;

CREATE TABLE effect_context(effect_id INTEGER PRIMARY KEY REFERENCES effects(id),event_id INTEGER NOT NULL REFERENCES rule_events(id),range_ft REAL CHECK(range_ft>=0),long_range_ft REAL CHECK(long_range_ft>=range_ft),radius_ft REAL CHECK(radius_ft>=0),duration_value REAL CHECK(duration_value>0),duration_unit_id INTEGER REFERENCES time_units(id),maximum_per_turn INTEGER CHECK(maximum_per_turn>0),uses INTEGER CHECK(uses>0),recharge_event_id INTEGER REFERENCES rule_events(id),self_only INTEGER CHECK(self_only IN(0,1)),requires_concentration INTEGER CHECK(requires_concentration IN(0,1)),components_required INTEGER CHECK(components_required IN(0,1)),copy_stat_id INTEGER REFERENCES rule_stats(id),fact_id INTEGER REFERENCES rule_facts(id),divisor REAL CHECK(divisor>0),rounding TEXT CHECK(rounding IN('floor','ceil')),maximum REAL,attack_bonus REAL,attack_ability_id INTEGER REFERENCES abilities(id),alternate_ability_id INTEGER REFERENCES abilities(id),persistent_curse INTEGER NOT NULL DEFAULT 0 CHECK(persistent_curse IN(0,1)),shared_use_code TEXT, condition_group_id INTEGER REFERENCES rule_condition_groups(id), end_event_id INTEGER REFERENCES rule_events(id)) STRICT;

CREATE TABLE effect_save_rules(effect_id INTEGER PRIMARY KEY REFERENCES effects(id),ability_id INTEGER NOT NULL REFERENCES abilities(id),dc INTEGER CHECK(dc>0),dc_formula_id INTEGER REFERENCES roll_formulas(id),success_code TEXT, failure_code TEXT, success_immunity_hours REAL CHECK(success_immunity_hours>0),CHECK((dc IS NULL)<>(dc_formula_id IS NULL))) STRICT;

CREATE TABLE effect_outcome_links(parent_effect_id INTEGER NOT NULL REFERENCES effects(id),outcome TEXT NOT NULL CHECK(outcome IN('failure','success')),effect_id INTEGER NOT NULL REFERENCES effects(id),PRIMARY KEY(parent_effect_id,outcome,effect_id),CHECK(parent_effect_id<>effect_id)) STRICT;

CREATE TABLE gear_resources(id INTEGER PRIMARY KEY,item_id INTEGER NOT NULL UNIQUE REFERENCES gear_entries(item_id),capacity INTEGER CHECK(capacity>0),initial_formula_id INTEGER REFERENCES roll_formulas(id),recovery_formula_id INTEGER REFERENCES roll_formulas(id),recharge_event_id INTEGER NOT NULL REFERENCES rule_events(id)) STRICT;

CREATE TABLE effect_resource_costs(effect_id INTEGER PRIMARY KEY REFERENCES effects(id),resource_id INTEGER NOT NULL REFERENCES gear_resources(id),quantity INTEGER NOT NULL CHECK(quantity>0),hit_point_alternative INTEGER CHECK(hit_point_alternative>0)) STRICT;

CREATE TABLE rule_spell_references(id INTEGER PRIMARY KEY,site_id INTEGER NOT NULL UNIQUE,name_ru TEXT NOT NULL,name_original TEXT NOT NULL,url TEXT NOT NULL,spell_id INTEGER REFERENCES spells(id)) STRICT;

CREATE TABLE effect_spell_links(effect_id INTEGER PRIMARY KEY REFERENCES effects(id),reference_id INTEGER NOT NULL REFERENCES rule_spell_references(id)) STRICT;

CREATE TABLE effect_condition_choices(effect_id INTEGER NOT NULL REFERENCES effects(id),condition_id INTEGER NOT NULL REFERENCES conditions(id),PRIMARY KEY(effect_id,condition_id)) STRICT;

CREATE TABLE spell_numeric_rules(spell_id INTEGER PRIMARY KEY REFERENCES spells(id),maximum_targets INTEGER CHECK(maximum_targets>0),additional_targets_per_slot INTEGER NOT NULL DEFAULT 0 CHECK(additional_targets_per_slot>=0),base_slot_level INTEGER CHECK(base_slot_level BETWEEN 0 AND 9),condition_group_id INTEGER REFERENCES rule_condition_groups(id),requires_continuous_touch INTEGER NOT NULL DEFAULT 0 CHECK(requires_continuous_touch IN(0,1)), target_kind TEXT CHECK(target_kind IN('creature','creature_or_object','area_creatures'))) STRICT;

CREATE TABLE spell_effect_rule_links(spell_effect_id INTEGER NOT NULL REFERENCES spell_effects(id),stat_id INTEGER REFERENCES rule_stats(id),operator_id INTEGER NOT NULL REFERENCES rule_operators(id),success_numerator INTEGER,success_denominator INTEGER CHECK(success_denominator>0),condition_group_id INTEGER REFERENCES rule_condition_groups(id),PRIMARY KEY(spell_effect_id,operator_id,stat_id)) STRICT;

CREATE TABLE gear_rule_reviews(item_id INTEGER PRIMARY KEY REFERENCES gear_entries(item_id),checked_on TEXT NOT NULL,numeric_reviewed INTEGER NOT NULL CHECK(numeric_reviewed IN(0,1))) STRICT;
