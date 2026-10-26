
CREATE TABLE creature_sizes(id INTEGER PRIMARY KEY,code TEXT NOT NULL UNIQUE,name_ru TEXT NOT NULL,carrying_multiplier REAL NOT NULL CHECK(carrying_multiplier>0)) STRICT;
CREATE TABLE creature_types(id INTEGER PRIMARY KEY,code TEXT NOT NULL UNIQUE,name_ru TEXT NOT NULL) STRICT;
CREATE TABLE race_source_checks(id INTEGER PRIMARY KEY,url TEXT NOT NULL UNIQUE,source_hash TEXT NOT NULL CHECK(length(source_hash)=64),checked_on TEXT NOT NULL) STRICT;
CREATE TABLE body_descriptions(
 id INTEGER PRIMARY KEY,code TEXT NOT NULL UNIQUE,height_min_in REAL CHECK(height_min_in>0),height_max_in REAL CHECK(height_max_in>=height_min_in),
 weight_min_lb REAL CHECK(weight_min_lb>0),weight_max_lb REAL CHECK(weight_max_lb>=weight_min_lb),weight_average_lb REAL CHECK(weight_average_lb>0),
 adult_age_years REAL CHECK(adult_age_years>=0),adulthood_basis TEXT CHECK(adulthood_basis IN('approximate','social','biological')),
 lifespan_years REAL CHECK(lifespan_years>0),lifespan_qualifier TEXT CHECK(lifespan_qualifier IN('under','over','up_to','approximate')),notes TEXT) STRICT;
CREATE TABLE body_generators(
 id INTEGER PRIMARY KEY,code TEXT NOT NULL UNIQUE,base_height_in REAL NOT NULL CHECK(base_height_in>0),height_roll_id INTEGER NOT NULL REFERENCES roll_formulas(id),
 base_weight_lb REAL NOT NULL CHECK(base_weight_lb>0),weight_roll_id INTEGER NOT NULL REFERENCES roll_formulas(id),
 weight_formula_code TEXT NOT NULL CHECK(weight_formula_code='base_plus_height_roll_times_weight_roll'),source_check_id INTEGER NOT NULL REFERENCES race_source_checks(id)) STRICT;
CREATE TABLE race_entries(
 id INTEGER PRIMARY KEY,code TEXT NOT NULL UNIQUE,name_ru TEXT NOT NULL,name_original TEXT NOT NULL,parent_id INTEGER REFERENCES race_entries(id),
 edition_id INTEGER NOT NULL REFERENCES editions(id),source_id INTEGER NOT NULL REFERENCES sources(id),source_check_id INTEGER NOT NULL REFERENCES race_source_checks(id),
 source_anchor TEXT,description TEXT,requires_subrace INTEGER NOT NULL DEFAULT 0 CHECK(requires_subrace IN(0,1)),
 size_id INTEGER REFERENCES creature_sizes(id),creature_type_id INTEGER REFERENCES creature_types(id),body_description_id INTEGER REFERENCES body_descriptions(id),body_generator_id INTEGER REFERENCES body_generators(id),icon_url TEXT,
 CHECK(parent_id IS NULL OR (parent_id<>id AND requires_subrace=0)),CHECK(parent_id IS NOT NULL OR (size_id IS NOT NULL AND creature_type_id IS NOT NULL))) STRICT;
CREATE TRIGGER race_parent_is_root BEFORE INSERT ON race_entries WHEN NEW.parent_id IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM race_entries p WHERE p.id=NEW.parent_id AND p.parent_id IS NULL AND p.edition_id=NEW.edition_id) THEN RAISE(ABORT,'Race parent must be a root of the same edition') END;
END;
CREATE TRIGGER race_parent_update_is_root BEFORE UPDATE OF parent_id,edition_id ON race_entries BEGIN
 SELECT CASE WHEN NEW.parent_id IS NOT NULL AND (NOT EXISTS(SELECT 1 FROM race_entries p WHERE p.id=NEW.parent_id AND p.parent_id IS NULL AND p.edition_id=NEW.edition_id) OR EXISTS(SELECT 1 FROM race_entries c WHERE c.parent_id=NEW.id)) THEN RAISE(ABORT,'Race parent must remain a root of the same edition') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM race_entries c WHERE c.parent_id=NEW.id AND c.edition_id<>NEW.edition_id) THEN RAISE(ABORT,'Subraces must use the same edition') END;
END;
CREATE TABLE movement_modes(id INTEGER PRIMARY KEY,code TEXT NOT NULL UNIQUE,name_ru TEXT NOT NULL) STRICT;
CREATE TABLE race_speeds(race_id INTEGER NOT NULL REFERENCES race_entries(id),movement_mode_id INTEGER NOT NULL REFERENCES movement_modes(id),speed_ft REAL NOT NULL CHECK(speed_ft>=0),PRIMARY KEY(race_id,movement_mode_id)) STRICT;
CREATE TABLE race_ability_bonuses(race_id INTEGER NOT NULL REFERENCES race_entries(id),ability_id INTEGER NOT NULL REFERENCES abilities(id),bonus INTEGER NOT NULL CHECK(bonus<>0),PRIMARY KEY(race_id,ability_id)) STRICT;
CREATE TABLE languages(id INTEGER PRIMARY KEY,code TEXT NOT NULL UNIQUE,name_ru TEXT NOT NULL,exotic INTEGER NOT NULL DEFAULT 0 CHECK(exotic IN(0,1))) STRICT;
CREATE TABLE race_languages(race_id INTEGER NOT NULL REFERENCES race_entries(id),language_id INTEGER NOT NULL REFERENCES languages(id),PRIMARY KEY(race_id,language_id)) STRICT;
CREATE TABLE proficiencies(id INTEGER PRIMARY KEY,code TEXT NOT NULL UNIQUE,name_ru TEXT,kind TEXT NOT NULL CHECK(kind IN('skill','tool','weapon','armor')),
 ability_id INTEGER REFERENCES abilities(id),gear_item_id INTEGER REFERENCES gear_entries(item_id),gear_category_id INTEGER REFERENCES gear_categories(id),
 CHECK((kind='weapon' AND gear_item_id IS NOT NULL AND gear_category_id IS NULL) OR (kind='armor' AND gear_category_id IS NOT NULL AND gear_item_id IS NULL) OR (kind IN('skill','tool') AND gear_item_id IS NULL AND gear_category_id IS NULL AND name_ru IS NOT NULL))) STRICT;
CREATE TABLE race_proficiencies(race_id INTEGER NOT NULL REFERENCES race_entries(id),proficiency_id INTEGER NOT NULL REFERENCES proficiencies(id),PRIMARY KEY(race_id,proficiency_id)) STRICT;
CREATE TABLE race_traits(id INTEGER PRIMARY KEY,code TEXT NOT NULL UNIQUE,name_ru TEXT NOT NULL,description TEXT NOT NULL) STRICT;
CREATE TABLE race_trait_links(race_id INTEGER NOT NULL REFERENCES race_entries(id),trait_id INTEGER NOT NULL REFERENCES race_traits(id),PRIMARY KEY(race_id,trait_id)) STRICT;
CREATE TABLE race_trait_effects(id INTEGER PRIMARY KEY,trait_id INTEGER NOT NULL REFERENCES race_traits(id),effect_id INTEGER NOT NULL REFERENCES effects(id),
 condition_group_id INTEGER REFERENCES rule_condition_groups(id),value_basis TEXT NOT NULL CHECK(value_basis IN('fixed','character_level')),UNIQUE(trait_id,effect_id)) STRICT;
CREATE TABLE race_choices(id INTEGER PRIMARY KEY,race_id INTEGER NOT NULL REFERENCES race_entries(id),code TEXT NOT NULL,name_ru TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN('language','proficiency','spell')),choose_count INTEGER NOT NULL CHECK(choose_count>0),
 casting_ability_id INTEGER REFERENCES abilities(id),filter_class_id INTEGER REFERENCES classes(id),filter_spell_level INTEGER CHECK(filter_spell_level BETWEEN 0 AND 9),UNIQUE(race_id,code)) STRICT;
CREATE TABLE race_choice_options(id INTEGER PRIMARY KEY,choice_id INTEGER NOT NULL REFERENCES race_choices(id),language_id INTEGER REFERENCES languages(id),proficiency_id INTEGER REFERENCES proficiencies(id),spell_id INTEGER REFERENCES spells(id),
 CHECK((language_id IS NOT NULL)+(proficiency_id IS NOT NULL)+(spell_id IS NOT NULL)=1),UNIQUE(choice_id,language_id),UNIQUE(choice_id,proficiency_id),UNIQUE(choice_id,spell_id)) STRICT;
CREATE TABLE carrying_rules(id INTEGER PRIMARY KEY,code TEXT NOT NULL UNIQUE,edition_id INTEGER NOT NULL REFERENCES editions(id),ability_id INTEGER NOT NULL REFERENCES abilities(id),
 carry_lb_per_point REAL NOT NULL CHECK(carry_lb_per_point>0),push_drag_lift_lb_per_point REAL NOT NULL CHECK(push_drag_lift_lb_per_point>=carry_lb_per_point),
 overloaded_drag_speed_ft REAL NOT NULL CHECK(overloaded_drag_speed_ft>=0),source_check_id INTEGER NOT NULL REFERENCES race_source_checks(id)) STRICT;
CREATE INDEX ix_race_parent ON race_entries(parent_id);
CREATE INDEX ix_race_trait_effects ON race_trait_effects(trait_id);
CREATE INDEX ix_race_choice_options ON race_choice_options(choice_id);
