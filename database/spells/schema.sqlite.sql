PRAGMA foreign_keys = ON;

CREATE TABLE "editions" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "code" TEXT NOT NULL CHECK ("code" IS NULL OR (length("code") BETWEEN 1 AND 64)),
  "name_ru" TEXT NOT NULL CHECK ("name_ru" IS NULL OR (length("name_ru") BETWEEN 1 AND 150)),
  "description" TEXT,
  UNIQUE ("code")
) STRICT;

CREATE TABLE "magic_schools" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "code" TEXT NOT NULL CHECK ("code" IS NULL OR (length("code") BETWEEN 1 AND 64)),
  "name_ru" TEXT NOT NULL CHECK ("name_ru" IS NULL OR (length("name_ru") BETWEEN 1 AND 150)),
  "description" TEXT,
  UNIQUE ("code")
) STRICT;

CREATE TABLE "action_types" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "code" TEXT NOT NULL CHECK ("code" IS NULL OR (length("code") BETWEEN 1 AND 64)),
  "name_ru" TEXT NOT NULL CHECK ("name_ru" IS NULL OR (length("name_ru") BETWEEN 1 AND 150)),
  "description" TEXT,
  UNIQUE ("code")
) STRICT;

CREATE TABLE "time_units" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "code" TEXT NOT NULL CHECK ("code" IS NULL OR (length("code") BETWEEN 1 AND 64)),
  "name_ru" TEXT NOT NULL CHECK ("name_ru" IS NULL OR (length("name_ru") BETWEEN 1 AND 150)),
  "description" TEXT,
  UNIQUE ("code")
) STRICT;

CREATE TABLE "range_types" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "code" TEXT NOT NULL CHECK ("code" IS NULL OR (length("code") BETWEEN 1 AND 64)),
  "name_ru" TEXT NOT NULL CHECK ("name_ru" IS NULL OR (length("name_ru") BETWEEN 1 AND 150)),
  "description" TEXT,
  UNIQUE ("code")
) STRICT;

CREATE TABLE "duration_types" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "code" TEXT NOT NULL CHECK ("code" IS NULL OR (length("code") BETWEEN 1 AND 64)),
  "name_ru" TEXT NOT NULL CHECK ("name_ru" IS NULL OR (length("name_ru") BETWEEN 1 AND 150)),
  "description" TEXT,
  UNIQUE ("code")
) STRICT;

CREATE TABLE "component_types" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "code" TEXT NOT NULL CHECK ("code" IS NULL OR (length("code") BETWEEN 1 AND 64)),
  "name_ru" TEXT NOT NULL CHECK ("name_ru" IS NULL OR (length("name_ru") BETWEEN 1 AND 150)),
  "description" TEXT,
  UNIQUE ("code")
) STRICT;

CREATE TABLE "classes" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "code" TEXT NOT NULL CHECK ("code" IS NULL OR (length("code") BETWEEN 1 AND 64)),
  "name_ru" TEXT NOT NULL CHECK ("name_ru" IS NULL OR (length("name_ru") BETWEEN 1 AND 150)),
  "description" TEXT,
  UNIQUE ("code")
) STRICT;

CREATE TABLE "subclasses" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "code" TEXT NOT NULL CHECK ("code" IS NULL OR (length("code") BETWEEN 1 AND 120)),
  "name_ru" TEXT NOT NULL CHECK ("name_ru" IS NULL OR (length("name_ru") BETWEEN 1 AND 180)),
  "class_id" INTEGER NOT NULL REFERENCES "classes"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "description" TEXT,
  UNIQUE ("code")
) STRICT;

CREATE INDEX "ix_subclasses_class_id" ON "subclasses" ("class_id");

CREATE TABLE "damage_types" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "code" TEXT NOT NULL CHECK ("code" IS NULL OR (length("code") BETWEEN 1 AND 64)),
  "name_ru" TEXT NOT NULL CHECK ("name_ru" IS NULL OR (length("name_ru") BETWEEN 1 AND 150)),
  "description" TEXT,
  "icon_url" TEXT CHECK ("icon_url" IS NULL OR (length("icon_url") BETWEEN 1 AND 500)),
  UNIQUE ("code")
) STRICT;

CREATE TABLE "dice" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "code" TEXT NOT NULL CHECK ("code" IS NULL OR (length("code") BETWEEN 1 AND 64)),
  "name_ru" TEXT NOT NULL CHECK ("name_ru" IS NULL OR (length("name_ru") BETWEEN 1 AND 150)),
  "description" TEXT,
  "sides" INTEGER NOT NULL CHECK ( "sides" >1),
  UNIQUE ("code")
) STRICT;

CREATE TABLE "effect_types" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "code" TEXT NOT NULL CHECK ("code" IS NULL OR (length("code") BETWEEN 1 AND 64)),
  "name_ru" TEXT NOT NULL CHECK ("name_ru" IS NULL OR (length("name_ru") BETWEEN 1 AND 150)),
  "description" TEXT,
  UNIQUE ("code")
) STRICT;

CREATE TABLE "abilities" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "code" TEXT NOT NULL CHECK ("code" IS NULL OR (length("code") BETWEEN 1 AND 64)),
  "name_ru" TEXT NOT NULL CHECK ("name_ru" IS NULL OR (length("name_ru") BETWEEN 1 AND 150)),
  "description" TEXT,
  UNIQUE ("code")
) STRICT;

CREATE TABLE "area_shapes" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "code" TEXT NOT NULL CHECK ("code" IS NULL OR (length("code") BETWEEN 1 AND 64)),
  "name_ru" TEXT NOT NULL CHECK ("name_ru" IS NULL OR (length("name_ru") BETWEEN 1 AND 150)),
  "description" TEXT,
  UNIQUE ("code")
) STRICT;

CREATE TABLE "conditions" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "code" TEXT NOT NULL CHECK ("code" IS NULL OR (length("code") BETWEEN 1 AND 64)),
  "name_ru" TEXT NOT NULL CHECK ("name_ru" IS NULL OR (length("name_ru") BETWEEN 1 AND 150)),
  "description" TEXT,
  UNIQUE ("code")
) STRICT;

CREATE TABLE "quantity_units" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "code" TEXT NOT NULL CHECK ("code" IS NULL OR (length("code") BETWEEN 1 AND 64)),
  "name_ru" TEXT NOT NULL CHECK ("name_ru" IS NULL OR (length("name_ru") BETWEEN 1 AND 150)),
  "description" TEXT,
  UNIQUE ("code")
) STRICT;

CREATE TABLE "consumption_modes" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "code" TEXT NOT NULL CHECK ("code" IS NULL OR (length("code") BETWEEN 1 AND 64)),
  "name_ru" TEXT NOT NULL CHECK ("name_ru" IS NULL OR (length("name_ru") BETWEEN 1 AND 150)),
  "description" TEXT,
  UNIQUE ("code")
) STRICT;

CREATE TABLE "sources" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "code" TEXT NOT NULL CHECK ("code" IS NULL OR (length("code") BETWEEN 1 AND 120)),
  "name_ru" TEXT NOT NULL CHECK ("name_ru" IS NULL OR (length("name_ru") BETWEEN 1 AND 200)),
  "name_original" TEXT CHECK ("name_original" IS NULL OR (length("name_original") BETWEEN 1 AND 200)),
  "edition_id" INTEGER NOT NULL REFERENCES "editions"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "url" TEXT CHECK ("url" IS NULL OR (length("url") BETWEEN 1 AND 255)),
  "notes" TEXT,
  UNIQUE ("code")
) STRICT;

CREATE INDEX "ix_sources_edition_id" ON "sources" ("edition_id");

CREATE TABLE "items" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "code" TEXT NOT NULL CHECK ("code" IS NULL OR (length("code") BETWEEN 1 AND 120)),
  "name_ru" TEXT NOT NULL CHECK ("name_ru" IS NULL OR (length("name_ru") BETWEEN 1 AND 200)),
  "description" TEXT,
  "unit_id" INTEGER REFERENCES "quantity_units"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "price_cp" INTEGER CHECK ( "price_cp" Is Null Or ( "price_cp" >=0 And "price_cp" =CAST("price_cp" AS INTEGER))),
  "weight_lb" REAL CHECK ( "weight_lb" Is Null Or "weight_lb" >=0),
  "notes" TEXT,
  "icon_url" TEXT CHECK ("icon_url" IS NULL OR (length("icon_url") BETWEEN 1 AND 500)),
  UNIQUE ("code")
) STRICT;

CREATE INDEX "ix_items_unit_id" ON "items" ("unit_id");

CREATE TABLE "roll_formulas" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "code" TEXT NOT NULL CHECK ("code" IS NULL OR (length("code") BETWEEN 1 AND 120)),
  "name_ru" TEXT NOT NULL CHECK ("name_ru" IS NULL OR (length("name_ru") BETWEEN 1 AND 180)),
  "source_expression" TEXT CHECK ("source_expression" IS NULL OR (length("source_expression") BETWEEN 1 AND 255)),
  "special_rules" TEXT,
  UNIQUE ("code")
) STRICT;

CREATE TABLE "roll_terms" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "formula_id" INTEGER NOT NULL REFERENCES "roll_formulas"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "ordinal" INTEGER NOT NULL CHECK ( "ordinal" >0),
  "kind" TEXT NOT NULL CHECK ("kind" IS NULL OR (length("kind") BETWEEN 1 AND 40)) CHECK ( "kind" In ('кубики','константа','модификатор','мастерство')),
  "die_id" INTEGER REFERENCES "dice"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "dice_count" INTEGER CHECK ( "dice_count" Is Null Or "dice_count" >0),
  "constant_value" INTEGER,
  "ability_id" INTEGER REFERENCES "abilities"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "use_spellcasting_ability" INTEGER NOT NULL DEFAULT 0 CHECK ("use_spellcasting_ability" IN (0, 1)),
  "coefficient" INTEGER NOT NULL DEFAULT 1 CHECK ( "coefficient" <>0),
  "notes" TEXT,
  UNIQUE ("formula_id", "ordinal"),
  CHECK (("kind"='кубики' And "die_id" Is Not Null And "dice_count" Is Not Null And "constant_value" Is Null And "ability_id" Is Null And "use_spellcasting_ability"=0) Or ("kind"='константа' And "constant_value" Is Not Null And "die_id" Is Null And "dice_count" Is Null And "ability_id" Is Null And "use_spellcasting_ability"=0) Or ("kind"='модификатор' And "die_id" Is Null And "dice_count" Is Null And "constant_value" Is Null And (("ability_id" Is Not Null And "use_spellcasting_ability"=0) Or ("ability_id" Is Null And "use_spellcasting_ability"=1))) Or ("kind"='мастерство' And "die_id" Is Null And "dice_count" Is Null And "constant_value" Is Null And "ability_id" Is Null And "use_spellcasting_ability"=0))
) STRICT;

CREATE INDEX "ix_roll_terms_formula_id" ON "roll_terms" ("formula_id");

CREATE INDEX "ix_roll_terms_die_id" ON "roll_terms" ("die_id");

CREATE INDEX "ix_roll_terms_ability_id" ON "roll_terms" ("ability_id");

CREATE TABLE "spells" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "canonical_id" TEXT NOT NULL CHECK ("canonical_id" IS NULL OR (length("canonical_id") BETWEEN 1 AND 160)),
  "revision" INTEGER NOT NULL DEFAULT 1 CHECK ( "revision" >0),
  "name_ru" TEXT NOT NULL CHECK ("name_ru" IS NULL OR (length("name_ru") BETWEEN 1 AND 200)),
  "name_original" TEXT CHECK ("name_original" IS NULL OR (length("name_original") BETWEEN 1 AND 200)),
  "aliases" TEXT,
  "level" INTEGER NOT NULL CHECK ( "level" Between 0 And 9),
  "school_id" INTEGER NOT NULL REFERENCES "magic_schools"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "edition_id" INTEGER NOT NULL REFERENCES "editions"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "is_ritual" INTEGER NOT NULL DEFAULT 0 CHECK ("is_ritual" IN (0, 1)),
  "requires_concentration" INTEGER NOT NULL DEFAULT 0 CHECK ("requires_concentration" IN (0, 1)),
  "range_type_id" INTEGER NOT NULL REFERENCES "range_types"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "range_ft" REAL CHECK ( "range_ft" Is Null Or "range_ft" >=0),
  "range_text" TEXT,
  "duration_type_id" INTEGER NOT NULL REFERENCES "duration_types"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "duration_value" REAL CHECK ( "duration_value" Is Null Or "duration_value" >0),
  "duration_unit_id" INTEGER REFERENCES "time_units"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "duration_text" TEXT,
  "components_text" TEXT,
  "targets_text" TEXT,
  "description" TEXT,
  "higher_levels_text" TEXT,
  "source_url" TEXT CHECK ("source_url" IS NULL OR (length("source_url") BETWEEN 1 AND 255)),
  "site_id" TEXT CHECK ("site_id" IS NULL OR (length("site_id") BETWEEN 1 AND 80)),
  "review_status" TEXT NOT NULL DEFAULT 'черновик' CHECK ("review_status" IS NULL OR (length("review_status") BETWEEN 1 AND 40)) CHECK ( "review_status" In ('черновик','требует проверки','проверено')),
  "reviewed_at" TEXT,
  "notes" TEXT,
  "icon_url" TEXT CHECK ("icon_url" IS NULL OR (length("icon_url") BETWEEN 1 AND 500)),
  UNIQUE ("canonical_id", "revision")
) STRICT;

CREATE INDEX "ix_spells_school_id" ON "spells" ("school_id");

CREATE INDEX "ix_spells_edition_id" ON "spells" ("edition_id");

CREATE INDEX "ix_spells_range_type_id" ON "spells" ("range_type_id");

CREATE INDEX "ix_spells_duration_type_id" ON "spells" ("duration_type_id");

CREATE INDEX "ix_spells_duration_unit_id" ON "spells" ("duration_unit_id");

CREATE TABLE "spell_casting_times" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "spell_id" INTEGER NOT NULL REFERENCES "spells"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "ordinal" INTEGER NOT NULL CHECK ( "ordinal" >0),
  "action_type_id" INTEGER REFERENCES "action_types"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "action_count" INTEGER CHECK ( "action_count" Is Null Or "action_count" >0),
  "time_value" REAL CHECK ( "time_value" Is Null Or "time_value" >0),
  "time_unit_id" INTEGER REFERENCES "time_units"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "reaction_trigger" TEXT,
  "source_text" TEXT,
  UNIQUE ("spell_id", "ordinal"),
  CHECK (("action_type_id" Is Not Null And "action_count" Is Not Null And "time_value" Is Null And "time_unit_id" Is Null) Or ("action_type_id" Is Null And "action_count" Is Null And "time_value" Is Not Null And "time_unit_id" Is Not Null) Or ("action_type_id" Is Null And "action_count" Is Null And "time_value" Is Null And "time_unit_id" Is Null And "source_text" Is Not Null))
) STRICT;

CREATE INDEX "ix_spell_casting_times_spell_id" ON "spell_casting_times" ("spell_id");

CREATE INDEX "ix_spell_casting_times_action_type_id" ON "spell_casting_times" ("action_type_id");

CREATE INDEX "ix_spell_casting_times_time_unit_id" ON "spell_casting_times" ("time_unit_id");

CREATE TABLE "spell_classes" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "spell_id" INTEGER NOT NULL REFERENCES "spells"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "class_id" INTEGER NOT NULL REFERENCES "classes"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "rule_source_id" INTEGER NOT NULL REFERENCES "sources"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "access_rule" TEXT,
  "notes" TEXT,
  UNIQUE ("spell_id", "class_id", "rule_source_id")
) STRICT;

CREATE INDEX "ix_spell_classes_spell_id" ON "spell_classes" ("spell_id");

CREATE INDEX "ix_spell_classes_class_id" ON "spell_classes" ("class_id");

CREATE INDEX "ix_spell_classes_rule_source_id" ON "spell_classes" ("rule_source_id");

CREATE TABLE "spell_subclasses" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "spell_id" INTEGER NOT NULL REFERENCES "spells"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "subclass_id" INTEGER NOT NULL REFERENCES "subclasses"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "rule_source_id" INTEGER NOT NULL REFERENCES "sources"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "access_rule" TEXT,
  "notes" TEXT,
  UNIQUE ("spell_id", "subclass_id", "rule_source_id")
) STRICT;

CREATE INDEX "ix_spell_subclasses_spell_id" ON "spell_subclasses" ("spell_id");

CREATE INDEX "ix_spell_subclasses_subclass_id" ON "spell_subclasses" ("subclass_id");

CREATE INDEX "ix_spell_subclasses_rule_source_id" ON "spell_subclasses" ("rule_source_id");

CREATE TABLE "spell_sources" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "spell_id" INTEGER NOT NULL REFERENCES "spells"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "source_id" INTEGER NOT NULL REFERENCES "sources"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "page_reference" TEXT CHECK ("page_reference" IS NULL OR (length("page_reference") BETWEEN 1 AND 80)),
  "url" TEXT CHECK ("url" IS NULL OR (length("url") BETWEEN 1 AND 255)),
  "notes" TEXT,
  UNIQUE ("spell_id", "source_id")
) STRICT;

CREATE INDEX "ix_spell_sources_spell_id" ON "spell_sources" ("spell_id");

CREATE INDEX "ix_spell_sources_source_id" ON "spell_sources" ("source_id");

CREATE TABLE "spell_components" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "spell_id" INTEGER NOT NULL REFERENCES "spells"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "component_type_id" INTEGER NOT NULL REFERENCES "component_types"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  UNIQUE ("spell_id", "component_type_id")
) STRICT;

CREATE INDEX "ix_spell_components_spell_id" ON "spell_components" ("spell_id");

CREATE INDEX "ix_spell_components_component_type_id" ON "spell_components" ("component_type_id");

CREATE TABLE "spell_material_groups" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "spell_id" INTEGER NOT NULL REFERENCES "spells"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "ordinal" INTEGER NOT NULL CHECK ( "ordinal" >0),
  "selection_mode" TEXT NOT NULL DEFAULT 'все' CHECK ("selection_mode" IS NULL OR (length("selection_mode") BETWEEN 1 AND 25)) CHECK ( "selection_mode" In ('все','один из')),
  "minimum_group_value_cp" INTEGER CHECK ( "minimum_group_value_cp" Is Null Or ( "minimum_group_value_cp" >=0 And "minimum_group_value_cp" =CAST("minimum_group_value_cp" AS INTEGER))),
  "description" TEXT,
  UNIQUE ("spell_id", "ordinal")
) STRICT;

CREATE INDEX "ix_spell_material_groups_spell_id" ON "spell_material_groups" ("spell_id");

CREATE TABLE "spell_material_requirements" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "group_id" INTEGER NOT NULL REFERENCES "spell_material_groups"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "ordinal" INTEGER NOT NULL CHECK ( "ordinal" >0),
  "item_id" INTEGER NOT NULL REFERENCES "items"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "quantity" REAL CHECK ( "quantity" Is Null Or "quantity" >0),
  "unit_id" INTEGER REFERENCES "quantity_units"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "minimum_item_value_cp" INTEGER CHECK ( "minimum_item_value_cp" Is Null Or ( "minimum_item_value_cp" >=0 And "minimum_item_value_cp" =CAST("minimum_item_value_cp" AS INTEGER))),
  "consumption_mode_id" INTEGER NOT NULL DEFAULT 1 REFERENCES "consumption_modes"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "consumed_quantity" REAL CHECK ( "consumed_quantity" Is Null Or "consumed_quantity" >0),
  "consumption_condition" TEXT,
  "special_requirements" TEXT,
  UNIQUE ("group_id", "ordinal"),
  CHECK (("quantity" Is Null And "unit_id" Is Null) Or ("quantity" Is Not Null And "unit_id" Is Not Null))
) STRICT;

CREATE INDEX "ix_spell_material_requirements_group_id" ON "spell_material_requirements" ("group_id");

CREATE INDEX "ix_spell_material_requirements_item_id" ON "spell_material_requirements" ("item_id");

CREATE INDEX "ix_spell_material_requirements_unit_id" ON "spell_material_requirements" ("unit_id");

CREATE INDEX "ix_spell_material_requirements_consumption_mode_id" ON "spell_material_requirements" ("consumption_mode_id");

CREATE TABLE "effects" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "code" TEXT NOT NULL CHECK ("code" IS NULL OR (length("code") BETWEEN 1 AND 120)),
  "name_ru" TEXT NOT NULL CHECK ("name_ru" IS NULL OR (length("name_ru") BETWEEN 1 AND 200)),
  "effect_type_id" INTEGER NOT NULL REFERENCES "effect_types"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "roll_formula_id" INTEGER REFERENCES "roll_formulas"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "damage_type_id" INTEGER REFERENCES "damage_types"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "choose_damage_type" INTEGER NOT NULL DEFAULT 0 CHECK ("choose_damage_type" IN (0, 1)),
  "condition_id" INTEGER REFERENCES "conditions"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "modified_stat" TEXT CHECK ("modified_stat" IS NULL OR (length("modified_stat") BETWEEN 1 AND 120)),
  "description" TEXT,
  "automation" TEXT NOT NULL DEFAULT 'справочно' CHECK ("automation" IS NULL OR (length("automation") BETWEEN 1 AND 30)) CHECK ( "automation" In ('справочно','с подтверждением','полностью')),
  "notes" TEXT,
  UNIQUE ("code"),
  CHECK (("choose_damage_type"=0) Or ("choose_damage_type"=1 And "damage_type_id" Is Null))
) STRICT;

CREATE INDEX "ix_effects_effect_type_id" ON "effects" ("effect_type_id");

CREATE INDEX "ix_effects_roll_formula_id" ON "effects" ("roll_formula_id");

CREATE INDEX "ix_effects_damage_type_id" ON "effects" ("damage_type_id");

CREATE INDEX "ix_effects_condition_id" ON "effects" ("condition_id");

CREATE TABLE "effect_damage_choices" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "effect_id" INTEGER NOT NULL REFERENCES "effects"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "damage_type_id" INTEGER NOT NULL REFERENCES "damage_types"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  UNIQUE ("effect_id", "damage_type_id")
) STRICT;

CREATE INDEX "ix_effect_damage_choices_effect_id" ON "effect_damage_choices" ("effect_id");

CREATE INDEX "ix_effect_damage_choices_damage_type_id" ON "effect_damage_choices" ("damage_type_id");

CREATE TABLE "spell_effect_choices" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "spell_id" INTEGER NOT NULL REFERENCES "spells"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "code" TEXT NOT NULL CHECK ("code" IS NULL OR (length("code") BETWEEN 1 AND 100)),
  "name_ru" TEXT NOT NULL CHECK ("name_ru" IS NULL OR (length("name_ru") BETWEEN 1 AND 180)),
  "description" TEXT,
  UNIQUE ("spell_id", "code")
) STRICT;

CREATE INDEX "ix_spell_effect_choices_spell_id" ON "spell_effect_choices" ("spell_id");

CREATE TABLE "spell_effect_options" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "choice_id" INTEGER NOT NULL REFERENCES "spell_effect_choices"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "code" TEXT NOT NULL CHECK ("code" IS NULL OR (length("code") BETWEEN 1 AND 100)),
  "name_ru" TEXT NOT NULL CHECK ("name_ru" IS NULL OR (length("name_ru") BETWEEN 1 AND 180)),
  "description" TEXT,
  UNIQUE ("choice_id", "code")
) STRICT;

CREATE INDEX "ix_spell_effect_options_choice_id" ON "spell_effect_options" ("choice_id");

CREATE TABLE "spell_effects" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "spell_id" INTEGER NOT NULL REFERENCES "spells"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "effect_id" INTEGER NOT NULL REFERENCES "effects"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "ordinal" INTEGER NOT NULL CHECK ( "ordinal" >0),
  "resolution_type" TEXT NOT NULL DEFAULT 'особое' CHECK ("resolution_type" IS NULL OR (length("resolution_type") BETWEEN 1 AND 40)) CHECK ( "resolution_type" In ('автоматически','рукопашная атака','дальнобойная атака','спасбросок','проверка','особое')),
  "save_ability_id" INTEGER REFERENCES "abilities"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "on_success" TEXT CHECK ("on_success" IS NULL OR (length("on_success") BETWEEN 1 AND 80)),
  "application_condition" TEXT,
  "trigger_timing" TEXT,
  "option_id" INTEGER REFERENCES "spell_effect_options"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "target_description" TEXT,
  UNIQUE ("spell_id", "ordinal")
) STRICT;

CREATE INDEX "ix_spell_effects_spell_id" ON "spell_effects" ("spell_id");

CREATE INDEX "ix_spell_effects_effect_id" ON "spell_effects" ("effect_id");

CREATE INDEX "ix_spell_effects_save_ability_id" ON "spell_effects" ("save_ability_id");

CREATE INDEX "ix_spell_effects_option_id" ON "spell_effects" ("option_id");

CREATE TABLE "spell_scaling" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "spell_effect_id" INTEGER NOT NULL REFERENCES "spell_effects"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "ordinal" INTEGER NOT NULL CHECK ( "ordinal" >0),
  "basis" TEXT NOT NULL CHECK ("basis" IS NULL OR (length("basis") BETWEEN 1 AND 40)) CHECK ( "basis" In ('уровень ячейки','уровень персонажа','уровень класса','особое')),
  "threshold" INTEGER CHECK ( "threshold" Is Null Or "threshold" >0),
  "step" INTEGER CHECK ( "step" Is Null Or "step" >0),
  "class_id" INTEGER REFERENCES "classes"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "operation" TEXT NOT NULL CHECK ("operation" IS NULL OR (length("operation") BETWEEN 1 AND 40)) CHECK ( "operation" In ('добавить формулу','заменить формулу','другой результат')),
  "roll_formula_id" INTEGER REFERENCES "roll_formulas"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "description" TEXT,
  UNIQUE ("spell_effect_id", "ordinal"),
  CHECK (("operation"='другой результат' And "description" Is Not Null) Or ("operation" In ('добавить формулу','заменить формулу') And "roll_formula_id" Is Not Null))
) STRICT;

CREATE INDEX "ix_spell_scaling_spell_effect_id" ON "spell_scaling" ("spell_effect_id");

CREATE INDEX "ix_spell_scaling_class_id" ON "spell_scaling" ("class_id");

CREATE INDEX "ix_spell_scaling_roll_formula_id" ON "spell_scaling" ("roll_formula_id");

CREATE TABLE "spell_areas" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "spell_id" INTEGER NOT NULL REFERENCES "spells"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "ordinal" INTEGER NOT NULL CHECK ( "ordinal" >0),
  "shape_id" INTEGER NOT NULL REFERENCES "area_shapes"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "radius_ft" REAL CHECK ( "radius_ft" Is Null Or "radius_ft" >0),
  "length_ft" REAL CHECK ( "length_ft" Is Null Or "length_ft" >0),
  "width_ft" REAL CHECK ( "width_ft" Is Null Or "width_ft" >0),
  "height_ft" REAL CHECK ( "height_ft" Is Null Or "height_ft" >0),
  "description" TEXT,
  UNIQUE ("spell_id", "ordinal")
) STRICT;

CREATE INDEX "ix_spell_areas_spell_id" ON "spell_areas" ("spell_id");

CREATE INDEX "ix_spell_areas_shape_id" ON "spell_areas" ("shape_id");

CREATE TABLE "schema_information" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "code" TEXT NOT NULL CHECK ("code" IS NULL OR (length("code") BETWEEN 1 AND 80)),
  "section" TEXT NOT NULL CHECK ("section" IS NULL OR (length("section") BETWEEN 1 AND 150)),
  "explanation" TEXT NOT NULL,
  UNIQUE ("code")
) STRICT;

PRAGMA user_version = 102;
