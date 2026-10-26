
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
