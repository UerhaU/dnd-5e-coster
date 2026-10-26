
CREATE TABLE spell_catalog_entries(
 spell_id INTEGER PRIMARY KEY REFERENCES spells(id), site_id INTEGER NOT NULL UNIQUE,
 source_hash TEXT NOT NULL CHECK(length(source_hash)=64), checked_on TEXT NOT NULL,
 metadata_status TEXT NOT NULL CHECK(metadata_status='checked'),
 mechanics_status TEXT NOT NULL CHECK(mechanics_status IN('reviewed_core','partial')),
 duration_up_to INTEGER NOT NULL CHECK(duration_up_to IN(0,1))) STRICT;
CREATE TABLE spell_material_prerequisites(id INTEGER PRIMARY KEY,code TEXT NOT NULL UNIQUE,name_ru TEXT NOT NULL) STRICT;
CREATE TABLE spell_material_nodes(
 id INTEGER PRIMARY KEY,spell_id INTEGER NOT NULL REFERENCES spells(id),parent_id INTEGER REFERENCES spell_material_nodes(id),
 ordinal INTEGER NOT NULL CHECK(ordinal>0),kind TEXT NOT NULL CHECK(kind IN('all','any','item','prerequisite')),
 requirement_id INTEGER UNIQUE REFERENCES spell_material_requirements(id),prerequisite_id INTEGER REFERENCES spell_material_prerequisites(id),
 minimum_value_cp INTEGER CHECK(minimum_value_cp>=0),
 CHECK((kind='item' AND requirement_id IS NOT NULL AND prerequisite_id IS NULL) OR
 (kind='prerequisite' AND prerequisite_id IS NOT NULL AND requirement_id IS NULL) OR
 (kind IN('all','any') AND requirement_id IS NULL AND prerequisite_id IS NULL)),UNIQUE(parent_id,ordinal)) STRICT;
CREATE UNIQUE INDEX ix_spell_material_root ON spell_material_nodes(spell_id) WHERE parent_id IS NULL;
CREATE TABLE spell_material_usage(
 requirement_id INTEGER PRIMARY KEY REFERENCES spell_material_requirements(id),
 quantity_basis TEXT NOT NULL CHECK(quantity_basis IN('flat','per_target','per_eye')),
 price_basis TEXT NOT NULL CHECK(price_basis IN('flat','target_hit_die')),selector_code TEXT) STRICT;
CREATE TABLE spell_costs(spell_id INTEGER PRIMARY KEY REFERENCES spells(id),kind TEXT NOT NULL CHECK(kind='royalty'),
 amount_cp INTEGER NOT NULL CHECK(amount_cp>0),base_slot_level INTEGER NOT NULL CHECK(base_slot_level BETWEEN 1 AND 9),
 per_additional_slot_cp INTEGER NOT NULL CHECK(per_additional_slot_cp>=0)) STRICT;
CREATE TABLE spell_rule_contexts(
 spell_effect_id INTEGER PRIMARY KEY REFERENCES spell_effects(id),status TEXT NOT NULL CHECK(status IN('reviewed_core','parsed','description')),
 scope TEXT,trigger_code TEXT,choice_name TEXT,repeat_count INTEGER CHECK(repeat_count>0),repeat_per_slot INTEGER CHECK(repeat_per_slot>=0),
 uses_spellcasting_ability INTEGER NOT NULL DEFAULT 0 CHECK(uses_spellcasting_ability IN(0,1)),
 modifier_value REAL,save_dc INTEGER CHECK(save_dc>0),on_success_code TEXT CHECK(on_success_code IN('half','none')),
 paragraph_index INTEGER CHECK(paragraph_index>=0)) STRICT;
CREATE TABLE spell_numeric_scaling(
 id INTEGER PRIMARY KEY,spell_effect_id INTEGER NOT NULL REFERENCES spell_effects(id),
 basis TEXT NOT NULL CHECK(basis IN('slot','character')),threshold INTEGER NOT NULL CHECK(threshold>0),step INTEGER CHECK(step>0),
 operation TEXT NOT NULL CHECK(operation IN('set_value','add_value','set_count','add_count')),
 value REAL NOT NULL,UNIQUE(spell_effect_id,basis,threshold,operation)) STRICT;
CREATE TABLE spell_roll_mentions(id INTEGER PRIMARY KEY,spell_id INTEGER NOT NULL REFERENCES spells(id),
 formula_id INTEGER NOT NULL REFERENCES roll_formulas(id),paragraph_index INTEGER NOT NULL CHECK(paragraph_index>=0),
 offset_in_paragraph INTEGER NOT NULL CHECK(offset_in_paragraph>=0),context_text TEXT NOT NULL) STRICT;
CREATE TABLE spell_save_mentions(id INTEGER PRIMARY KEY,spell_id INTEGER NOT NULL REFERENCES spells(id),
 ability_id INTEGER NOT NULL REFERENCES abilities(id),fixed_dc INTEGER CHECK(fixed_dc>0),
 paragraph_index INTEGER NOT NULL CHECK(paragraph_index>=0),context_text TEXT NOT NULL) STRICT;
CREATE TABLE spell_duration_scaling(id INTEGER PRIMARY KEY,spell_id INTEGER NOT NULL REFERENCES spells(id),
 slot_level INTEGER NOT NULL CHECK(slot_level BETWEEN 1 AND 9),duration_value REAL NOT NULL CHECK(duration_value>0),
 unit_id INTEGER NOT NULL REFERENCES time_units(id),UNIQUE(spell_id,slot_level)) STRICT;
CREATE INDEX ix_spell_roll_mentions_spell ON spell_roll_mentions(spell_id);
CREATE INDEX ix_spell_save_mentions_spell ON spell_save_mentions(spell_id);
CREATE INDEX ix_spell_material_nodes_spell ON spell_material_nodes(spell_id);
