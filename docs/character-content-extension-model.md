# Универсальная модель рас, классов и правил персонажа

Статус: главный архитектурный документ для character builder и rules engine.

Согласовано с [ТЗ, редакция 2 от 2026-10-15](./dnd5e_2014_interactive_app_spec.md). Это целевая архитектура; её контракты не считаются реализованными только по наличию этого документа.

Назначение: определить единый способ добавления новых рас, подрас, классов, подклассов, предысторий и их механик без специальных веток кода для каждого названия.

Документ [character-creation-rules-engine.md](./character-creation-rules-engine.md) остаётся справочником конкретных формул D&D 5e 2014 и набором контрольных примеров. Этот файл определяет устройство самой системы.

## 1. Требуемый результат

Добавление обычной новой расы или класса должно состоять из:

1. импорта или ручного создания записи контента;
2. описания её правил через универсальные примитивы;
3. проверки схемы и смысловой валидации;
4. добавления контрольного сценария;
5. включения источника.

Код движка при этом не изменяется.

Запрещённый подход:

```ts
if (raceName === "...") { ... }
if (className === "...") { ... }
```

Допустимый подход:

```ts
const package = contentRegistry.get(selectedEntityId);
const result = rulesEngine.evaluate(package, characterInputs);
```

Если новая механика не выражается существующими примитивами, добавляется один новый универсальный примитив. Он называется по смыслу механики, а не по расе или классу, получает собственные тесты и затем может использоваться любым контентом.

## 2. Пять разных слоёв данных

Система обязана разделять следующие сущности.

### 2.1. Сырой контент источника

Данные, полученные с DnD.su:

- название;
- URL;
- книга;
- редакция;
- исходный текст и распознанные поля;
- статус проверки импорта.

Сырой текст не исполняется как код и не участвует в расчёте напрямую.

### 2.2. Нормализованный пакет правил

Машиночитаемое описание того, что выдаёт сущность, какие выборы создаёт и на каких условиях работают её эффекты.

В текущей базе пакет может храниться в `ImportedContent.mechanicsJson` со `schemaVersion: "character-rules/v1"`. `payloadJson` остаётся источниковым/справочным содержимым.

### 2.3. Сборка персонажа

Только решения пользователя и неизменяемые ссылки на версии контента:

- выбранные сущности;
- распределённые характеристики;
- ответы на обязательные выборы;
- выбор стартового снаряжения и заклинаний;
- ручные повествовательные поля;
- явные разрешения Мастера.

### 2.4. Вычисленный лист

Проекция сборки и активных правил:

- итоговые характеристики;
- владения;
- КД, хиты, скорость;
- особенности;
- атаки;
- заклинания и лимиты;
- объяснение происхождения каждого значения;
- ошибки и предупреждения.

Вычисленный лист можно кэшировать, но нельзя считать единственным источником истины.

### 2.5. Состояние игры

То, что меняется во время сессии:

- текущие хиты;
- временные хиты;
- потраченные кости хитов;
- использованные ячейки и ресурсы;
- активные эффекты;
- состояние предметов и боеприпасов;
- спасброски от смерти.

Смена расы при редактировании сборки пересчитывает максимум хитов, но не должна случайно трактовать старое повреждение как часть правил расы.

## 3. Корневая сущность контента

Раса, класс и предыстория используют один контейнер `ContentPackage`. Различаются их `kind`, разрешённые поля и состав правил.

```ts
type ContentKind =
  | "race"
  | "subrace"
  | "class"
  | "subclass"
  | "background"
  | "feature"
  | "spell"
  | "item"
  | "feat";

interface ContentPackage {
  schemaVersion: "character-rules/v1";
  id: string;
  revision: number;
  kind: ContentKind;
  ruleValidationStatus: "unchecked" | "needs_rule_review" | "validated";

  name: {
    ru: string;
    original?: string;
    aliases?: string[];
  };

  source: SourceRef;
  sourceRefs: SourceRef[];
  availability: AvailabilityRule;
  composition?: CompositionRule;

  tags: string[];
  grants: GrantRule[];
  choices: ChoiceRule[];
  progression: LevelBlock[];
  constraints: ConstraintRule[];
  presentation: PresentationData;
}
```

Логика никогда не определяется по `name.ru`, `aliases` или тексту описания. Для неё используются стабильные `id`, теги и структурированные правила.

## 4. Идентичность, версии и источники

```ts
interface SourceRef {
  sourceBookId?: string;
  sourceTitle: string;
  sourceUrl?: string;
  localContentRef?: { ownerId: string; contentId: string; revision: number };
  edition: "5e_2014" | "5e_2024" | "universal_5e_2014_2024" | "unknown" | "conflict";
  official: boolean;
  homebrew: boolean;
  reviewStatus: "site_catalog" | "unchecked" | "needs_source_review" | "needs_edition_review" | "confirmed";
}

interface AvailabilityRule {
  enabledByDefault: boolean;
  playerSelectable: boolean;
  requiredSourceIds: string[];
  allowedCharacterKinds: ("player" | "npc" | "sidekick")[];
  prerequisites: ConditionExpr[];
}
```

`SourceRef.reviewStatus` описывает источник/импорт, но не доказывает готовность механики. Проверка пакета хранится отдельно как `ruleValidationStatus: "unchecked" | "needs_rule_review" | "validated"`, а степень автоматизации — на уровне `GrantRule.automation`. Если проблем несколько, они сохраняются отдельными диагностическими записями, а не теряются при замене одного статуса другим. Старые `universal` и `verified` преобразуются миграцией по явному контексту; массовая подстановка `validated` недопустима.

Для нескольких источников сохраняется полный список `sourceRefs`; поле `source` может быть выбранным основным источником отображения, но не должно уничтожать остальные ссылки. Хоумбрю получает локальную ссылку на владельца/ревизию вместо выдуманного URL DnD.su.

Для импортированного источника обязателен `sourceUrl`, для локального хоумбрю — `localContentRef`; отсутствие обоих отклоняется валидатором.

Правила:

- `id` не меняется при переименовании.
- Любое изменение исполняемой механики повышает `revision`.
- Персонаж хранит `id` и использованную `revision`, а не только отображаемое название.
- Старый персонаж не меняется молча после обновления импортированной записи.
- Миграция на новую revision выполняется явно: автоматически только при доказанно совместимом изменении либо с подтверждением Мастера.
- Версии фиксируются для всех транзитивных зависимостей: родителя, варианта, особенностей, предметов, заклинаний и таблиц. Одного закреплённого класса недостаточно, если его ссылки разрешаются в «последнюю» версию. Сборка хранит manifest зависимостей вместе с версией движка.
- Выключенный источник не предлагается новой сборке. Уже существующий персонаж сохраняет ссылку, но получает предупреждение о неактивном источнике.
- Отображение и воспроизведение существующей сборки используют сохранённые ревизии; отключение источника не удаляет её особенности при пересчёте. Новые выборы и новые выдачи проверяют текущую политику. Применение существующей способности регулируется отдельным разрешением кампании/Мастера.

## 5. Композиция базовой сущности и варианта

Подраса, вариант происхождения и подкласс не копируют весь родительский пакет.

```ts
interface CompositionRule {
  extendsId: string;
  mode: "extend" | "patch";
  removeRuleIds?: string[];
  replaceRules?: Array<{
    targetRuleId: string;
    replacementRuleId: string;
  }>;
}
```

Семантика:

- `extend` добавляет новые правила к родителю;
- `removeRuleIds` удаляет названные правила;
- `replaceRules` заменяет конкретную особенность;
- совпадение цели само по себе не означает замену;
- движок отклоняет вариант, который пытается заменить отсутствующий `ruleId`;
- итоговый пакет разворачивается до расчёта персонажа.

Так исключается ошибочное суммирование базовой особенности и варианта, который должен её заменить.

## 6. Универсальное правило выдачи

Все механические результаты описываются `GrantRule`.

```ts
interface GrantRule {
  id: string;
  label: string;
  sourceFeatureId?: string;
  unlock: UnlockRule;
  when: ConditionExpr[];
  effect: RuleEffect;
  automation: "full" | "assisted" | "display_only";
  explanation?: string;
}

interface UnlockRule {
  characterLevel?: number;
  classLevel?: { classId: string; level: number };
  selectedOptionId?: string;
}
```

`automation` означает:

- `full` — движок может полностью рассчитать и применить правило;
- `assisted` — движок создаёт выбор, ресурс, действие или предупреждение, но решение требуется игроку/Мастеру;
- `display_only` — особенность показывается на листе, но пока не изменяет числа автоматически.

Нераспознанный текст никогда не становится `full` автоматически.

`full` допустим только при `ruleValidationStatus: "validated"`, поддержанном примитиве и контрольном сценарии. Даже проверенный пакет может содержать `assisted`/`display_only`: проверенность описания не обещает автоматическое применение всех его особенностей.

## 7. Реестр эффектов

`RuleEffect` — дискриминированное объединение. Не допускаются произвольные выполняемые строки JavaScript.

```ts
type RuleEffect =
  | NumericEffect
  | FormulaEffect
  | ProficiencyEffect
  | EntityGrantEffect
  | ResourceGrantEffect
  | ActionGrantEffect
  | SenseEffect
  | ResistanceEffect
  | MovementEffect
  | LimitEffect
  | DiceEffect
  | TagEffect;
```

### 7.1. Числовой эффект

```ts
interface NumericEffect {
  type: "numeric";
  target: NumericTarget;
  operation: "add" | "setBase" | "replace" | "min" | "max" | "multiply";
  value: ValueExpr;
  stacking: StackingRule;
}
```

Примеры категорий `NumericTarget`:

- `ability.strength.score`;
- `ability.dexterity.score`;
- `ability.constitution.score`;
- `ability.intelligence.score`;
- `ability.wisdom.score`;
- `ability.charisma.score`;
- `hp.max`;
- `initiative`;
- `armorClass.bonus`;
- `skill.<id>.bonus`;
- `savingThrow.<ability>.bonus`;
- `spellcasting.<sourceId>.saveDc`;
- `spellcasting.<sourceId>.attackBonus`.

Цели берутся только из версионируемого `TargetRegistry`. Опечатка или неизвестная цель — ошибка импорта.

### 7.2. Формула

```ts
interface FormulaEffect {
  type: "formula";
  target: FormulaTarget;
  formulaId: string;
  expression: ValueExpr;
  selection: "automatic" | "player_choice";
  priority?: number;
}
```

Формулы КД, атаки, урона, подготовки заклинаний и максимума ресурсов являются кандидатами. Альтернативные формулы не складываются автоматически.

### 7.3. Владение и компетентность

```ts
interface ProficiencyEffect {
  type: "proficiency";
  category: "skill" | "savingThrow" | "weapon" | "armor" | "tool" | "language" | "vehicle";
  operation: "grant" | "expertise" | "remove";
  ids: string[];
}
```

Повторное `grant` не удваивает бонус. `expertise` работает только как отдельная операция.

### 7.4. Выдача сущности

```ts
interface EntityGrantEffect {
  type: "grantEntity";
  entityKind: "feature" | "spell" | "item" | "attack";
  entityId: string;
  quantity?: ValueExpr;
  state?: "known" | "prepared" | "always_prepared" | "spellbook" | "inventory";
  spellcastingSourceId?: string;
}
```

Заклинание, оружие и особенность не вставляются простым текстом: они выдаются ссылкой на сущность и получают состояние.

### 7.5. Ресурс

```ts
interface ResourceGrantEffect {
  type: "resource";
  resourceId: string;
  label: string;
  maximum: ValueExpr;
  recovery: RecoveryRule[];
  initial: "full" | "empty" | ValueExpr;
  sharedPoolId?: string;
}
```

Ресурс подходит для ячеек, использований особенности, зарядов и костей. Нельзя создавать отдельное поле кода для каждого ресурса класса.

### 7.6. Действие или реакция

Активная особенность не применяется как постоянный бонус.

```ts
interface ActionGrantEffect {
  type: "action";
  actionId: string;
  economy: "action" | "bonus_action" | "reaction" | "passive" | "special";
  cost?: ResourceCost[];
  createsEffectTemplateId?: string;
}
```

Например, особенность с временным усилением выдаёт действие и шаблон временного эффекта. Она не меняет базовый лист, пока действие не активировано.

### 7.7. Движение, чувства и сопротивления

Это структурированные множества, а не строки:

```ts
interface MovementEffect {
  type: "movement";
  movement: "walk" | "fly" | "swim" | "climb" | "burrow";
  operation: "setBase" | "add" | "equalTo";
  value: ValueExpr;
}

interface SenseEffect {
  type: "sense";
  sense: "darkvision" | "blindsight" | "tremorsense" | "truesight";
  rangeFt: ValueExpr;
  operation: "grant" | "extend" | "replace";
}
```

Сопротивление хранит тип урона, условие и область действия. Два одинаковых сопротивления не превращаются в иммунитет без явного правила.

## 8. Выражения значений

Формулы хранятся как безопасное дерево выражений, а не как строка для `eval`.

```ts
type ValueExpr =
  | { type: "constant"; value: number }
  | { type: "reference"; path: ValueReference }
  | { type: "add"; values: ValueExpr[] }
  | { type: "multiply"; values: ValueExpr[] }
  | { type: "min"; values: ValueExpr[] }
  | { type: "max"; values: ValueExpr[] }
  | { type: "floor"; value: ValueExpr }
  | { type: "ceil"; value: ValueExpr }
  | { type: "if"; condition: ConditionExpr; then: ValueExpr; else: ValueExpr };
```

Разрешённые ссылки:

- уровень персонажа;
- уровень выбранного класса;
- значение или модификатор характеристики;
- бонус мастерства;
- размер;
- количество выбранных опций;
- значение другого уже вычисленного узла;
- состояние допустимой экипировки;
- максимум другого ресурса.

Зависимости выражений формируют граф. Цикл является ошибкой контента и блокирует активацию пакета.

## 9. Условия

```ts
type ConditionExpr =
  | { type: "levelAtLeast"; level: number }
  | { type: "classLevelAtLeast"; classId: string; level: number }
  | { type: "hasSelection"; entityId: string }
  | { type: "hasFeature"; featureId: string }
  | { type: "hasProficiency"; category: string; id: string }
  | { type: "abilityAtLeast"; ability: string; score: number }
  | { type: "isEquipped"; itemTag: string }
  | { type: "isHolding"; itemTag: string }
  | { type: "hasFreeHand" }
  | { type: "choiceEquals"; choiceId: string; optionId: string }
  | { type: "all"; conditions: ConditionExpr[] }
  | { type: "any"; conditions: ConditionExpr[] }
  | { type: "not"; condition: ConditionExpr };
```

Условия сборки и условия активной игры различаются. Условие «пока носит доспех» может влиять на вычисленный лист. Условие «когда попал атакой» создаёт реактивное правило для игрового события и не прибавляет урон постоянно.

## 10. Правила складывания

```ts
interface StackingRule {
  mode: "stack" | "unique" | "highest" | "lowest" | "replace" | "chooseOne";
  group?: string;
  priority?: number;
}
```

Порядок обработки:

1. раскрыть родителя и варианты;
2. применить удаления и замены по `ruleId`;
3. отфильтровать уровень и условия;
4. сгруппировать эффекты по цели и `stacking.group`;
5. разрешить `unique/highest/replace/chooseOne`;
6. построить граф формул;
7. вычислить значения;
8. сформировать breakdown.

Одинаковая цель не означает автоматическую сумму. Решение всегда задаёт `stacking.mode`.

## 11. Универсальная модель выбора

Любой выбор — навыки класса, язык расы, вариант оружия, заклинания или подкласс — описывается одинаково.

```ts
interface ChoiceRule {
  id: string;
  label: string;
  unlock: UnlockRule;
  required: boolean;
  min: ValueExpr;
  max: ValueExpr;
  optionSource: ChoiceOptionSource;
  filters: ChoiceFilter[];
  allowDuplicates: boolean;
  duplicatePolicy: "reject" | "replace_same_category" | "allow";
  dependsOnChoiceIds: string[];
  grantsPerSelection: GrantRule[];
}
```

`optionSource` может быть:

- явный список опций;
- запрос к реестру сущностей по тегам;
- список навыков;
- список языков/инструментов;
- список предметов;
- список заклинаний конкретного источника и уровня;
- список дочерних пакетов, например подрас или подклассов.

UI строится из `ChoiceRule`, а не кодируется вручную под каждый класс.

Движок обязан уметь объяснить, почему опция недоступна: выключен источник, не выполнено требование, уже выбрано максимальное количество, конфликт или дублирование.

## 12. Прогрессия по уровням

Даже при реализации только 1-го уровня данные хранятся как прогрессия.

```ts
interface LevelBlock {
  level: number;
  grants: GrantRule[];
  choices: ChoiceRule[];
  resourceChanges: RuleEffect[];
}
```

Для расы `level` означает уровень персонажа. Для класса — уровень этого класса. В `UnlockRule` это различие указывается явно.

Преимущества будущих уровней:

- хранятся в пакете;
- не применяются раньше времени;
- не создают доступные атаки или заклинания;
- могут быть показаны только в отдельном справочном предпросмотре развития.

## 13. Специализированная конфигурация расы

Раса остаётся обычным `ContentPackage`, но валидатор требует:

- размер или обязательный выбор размера;
- базовую скорость ходьбы либо явное наследование;
- языки или правило их выбора, если источник их предоставляет;
- все особенности с собственными `ruleId`;
- дочерние варианты, если подраса обязательна;
- явную семантику `extend/replace` для вариантов;
- level-gating для поздних расовых заклинаний;
- тип существа, чувства, сопротивления и владения в структурированном виде.

Новая раса не получает отдельную TypeScript-модель. Её особенности компилируются в те же эффекты, выборы и ресурсы.

## 14. Специализированная конфигурация класса

Класс остаётся `ContentPackage`, но имеет обязательный блок:

```ts
interface ClassDefinition {
  hitDie: 6 | 8 | 10 | 12;
  primaryAbilityHints: string[];
  savingThrowProficiencies: string[];
  armorProficiencies: string[];
  weaponProficiencies: string[];
  toolChoices: ChoiceRule[];
  skillChoices: ChoiceRule[];
  startingEquipment: EquipmentChoiceTree;
  startingWealthAlternative?: DiceFormula;
  subclassChoice?: ChoiceRule;
  spellcasting?: SpellcastingDefinition;
  progression: LevelBlock[];
}
```

Особенности класса первого уровня находятся в `progression[level=1]`. Уровень выбора подкласса задаётся `unlock`, а не таблицей условий в UI.

### 14.1. Снаряжение класса

```ts
type EquipmentChoiceNode =
  | { type: "all"; children: EquipmentChoiceNode[] }
  | { type: "choose"; min: number; max: number; options: EquipmentChoiceNode[] }
  | { type: "grantItem"; itemId: string; quantity: ValueExpr }
  | { type: "queryItem"; filters: ChoiceFilter[]; quantity: ValueExpr };
```

Такая структура поддерживает вложенные варианты `а/б/в`, фиксированные предметы, наборы и «любое оружие указанной категории».

### 14.2. Магия класса

```ts
interface SpellcastingDefinition {
  sourceId: string;
  ability: string;
  mode: "known" | "prepared" | "spellbook" | "pact";
  cantripLimit: ValueExpr;
  knownSpellLimit?: ValueExpr;
  preparedSpellLimit?: ValueExpr;
  spellbookGrants?: ValueExpr;
  alwaysPreparedDoesNotCount: boolean;
  slotProgressionId: string;
  spellFilters: ChoiceFilter[];
}
```

Раса, черта или предмет, дающие магию, создают отдельный `SpellcastingSource`. Они не притворяются классовой магией и не используют её ячейки без явного правила.

## 15. Предыстория и другие пакеты

Предыстория использует те же примитивы:

- фиксированные владения как `ProficiencyEffect`;
- языки/инструменты как `ChoiceRule`;
- предметы и деньги как `grantEntity/resource`;
- особенность как `grantEntity(feature)`;
- повествовательные таблицы как presentation-данные, а не обязательная механика.

Черта, предмет и заклинание также являются пакетами. Это позволяет классу ссылаться на них, не копируя текст и формулы.

## 16. Состояние сборки персонажа

```ts
interface CharacterBuildState {
  schemaVersion: "character-build/v1";
  identity: {
    characterName: string;
    playerName: string;
    alignment?: string;
  };

  level: number;
  selections: Array<{
    slot: "race" | "subrace" | "class" | "subclass" | "background" | "feat";
    entityId: string;
    revision: number;
  }>;

  choiceAnswers: Record<string, string[]>;
  abilities: AbilityGenerationState;
  narrative: Record<string, string>;
  attachments: AttachmentRef[];
  gmOverrides: GmOverride[];
}
```

В текущем `sheetJson` данные следует хранить с пространствами имён:

```json
{
  "build": {},
  "computedCache": {},
  "runtime": {},
  "legacy": {}
}
```

Старые поля не удаляются без миграции. Новые расчёты читают `build`, а не отображаемые строки `Character.ancestry` и `Character.className`.

## 17. Результат вычисления

```ts
interface ComputedCharacterSheet {
  engineVersion: string;
  contentRevisions: Record<string, number>;
  values: Record<string, unknown>;
  features: ComputedFeature[];
  actions: ComputedAction[];
  attacks: ComputedAttack[];
  spellcasting: ComputedSpellcastingSource[];
  resources: ComputedResource[];
  inventoryGrants: ComputedItemGrant[];
  unresolvedChoices: string[];
  errors: RuleIssue[];
  warnings: RuleIssue[];
  breakdowns: Record<string, Breakdown>;
}
```

Каждое значение содержит происхождение:

```ts
interface Breakdown {
  total?: number;
  formula?: string;
  parts: Array<{
    ruleId: string;
    sourceEntityId: string;
    label: string;
    operation: string;
    value: unknown;
  }>;
}
```

## 18. Фазы вычисления

Движок работает детерминированно:

1. Проверить редакцию, источник и доступность выбранных сущностей.
2. Загрузить конкретные revisions.
3. Раскрыть наследование и варианты.
4. Собрать level-blocks, доступные текущему уровню.
5. Построить все `ChoiceRule`.
6. Проверить ответы и отметить неразрешённые обязательные выборы.
7. Собрать активные `GrantRule`.
8. Разделить постоянные, условные, активируемые и display-only особенности.
9. Разрешить замены и stacking groups.
10. Построить граф зависимостей формул и проверить циклы.
11. Рассчитать характеристики и модификаторы.
12. Рассчитать зависящие показатели, владения, атаки и магию.
13. Сформировать предметы и начальные ресурсы.
14. Выполнить constraints.
15. Вернуть результат, breakdowns, ошибки и предупреждения.

Одинаковый ввод, версии контента и версия движка всегда должны давать одинаковый результат.

Проверка доступности учитывает контекст: новая сборка, изменение существующей или воспроизведение сохранённой. Предупреждение о выключенном источнике не является поводом молча исключить его из сохранённой сборки. Случайные результаты уже сделанных бросков — входные данные, а не побочный эффект расчёта.

## 19. Смена расы, класса или ответа

При любом изменении:

- старый вычисленный результат полностью отбрасывается;
- ответы на выборы сохраняются только если их `choiceId` всё ещё существует и ответ допустим;
- предметы сборки пересоздаются по стабильным grant-ID, чтобы не плодить дубликаты;
- ручные предметы игрока не удаляются;
- старые особенности выбранной сущности исчезают автоматически;
- runtime-состояние переносится отдельной политикой, если персонаж уже участвовал в кампании;
- пользователь видит список изменений до подтверждения опасной миграции.

Идемпотентность обязательна: повторный расчёт не добавляет второй одинаковый предмет, язык, заклинание или ресурс.

## 20. Валидация пакета контента

### 20.1. Структурная

- корректная JSON Schema;
- известная `schemaVersion`;
- уникальные `id` и `ruleId`;
- только известные targets, operations и condition types;
- ссылки ведут на существующие сущности;
- корректные типы выражений.

### 20.2. Смысловая

- отсутствуют циклы зависимостей;
- варианты заменяют существующие правила;
- обязательный выбор имеет достаточно допустимых опций;
- `min <= max`;
- level-blocks не дублируются;
- spellcasting source ID уникален внутри сборки;
- display-only правило не меняет значения;
- активируемая особенность не применяется как постоянная;
- неизвестная механика имеет `needs_rule_review`, а не молчаливую догадку.

### 20.3. Игровая

- пакет разрешён активными источниками;
- соответствует редакции кампании;
- доступен типу персонажа;
- выполнены prerequisites;
- нет блокирующего конфликта с выбранными сущностями.

## 21. Процесс добавления новой расы

1. Создать/импортировать `ContentPackage(kind="race")`.
2. Проставить источник, редакцию и revision.
3. Разбить каждую механическую особенность на отдельный стабильный `ruleId`.
4. Описать размер, движение, языки, чувства, сопротивления и прочие эффекты.
5. Описать все выборы через `ChoiceRule`.
6. Добавить будущие особенности в соответствующие level-blocks.
7. Если есть варианты/подрасы, использовать `extends/remove/replace`.
8. Оставить сложную непонятую механику `display_only` или `needs_rule_review`.
9. Прогнать валидаторы.
10. Добавить fixture минимальной и граничной сборки.
11. Проверить смену на другую расу и обратный выбор.
12. Включить сущность только после успешной проверки.

## 22. Процесс добавления нового класса

1. Создать/импортировать `ContentPackage(kind="class")`.
2. Задать кость хитов и базовые владения.
3. Описать выбор навыков и инструментов.
4. Построить дерево стартового снаряжения.
5. Разместить особенности по level-blocks.
6. Для каждого ресурса задать максимум, начальное состояние и восстановление.
7. Для активных особенностей создать action и, при необходимости, effect template.
8. Описать уровень и список выбора подкласса.
9. Если класс использует магию, создать `SpellcastingDefinition`.
10. Прогнать валидаторы.
11. Добавить fixtures с низким/высоким основным модификатором, разными комплектами и магией.
12. Проверить смену класса и отсутствие остатков старых владений, предметов и ресурсов.

## 23. Когда действительно меняется код

Изменение движка разрешено, если контент требует новой общей семантики, например:

- нового вида условия;
- нового типа ресурса восстановления;
- нового способа изменения кости;
- нового кандидата формулы;
- новой реакции на игровое событие;
- новой операции stacking.

Порядок:

1. Описать механику без упоминания конкретной расы/класса в названии примитива.
2. Добавить тип в registry и JSON Schema.
3. Реализовать чистую функцию вычисления.
4. Добавить unit-тесты примитива.
5. Добавить интеграционный тест хотя бы для двух потенциальных источников либо доказать общность API.
6. Поднять версию движка и при необходимости схемы.
7. Только затем использовать примитив в пакете контента.

Нельзя добавлять `specialCaseEntityIds` как постоянное решение.

## 24. Тестовая стратегия

Для каждого пакета:

- schema validation;
- semantic validation;
- snapshot нормализованного пакета;
- fixture сборки 1-го уровня;
- проверка breakdown ключевых значений;
- проверка всех обязательных выборов;
- проверка level-gating;
- проверка disabled source;
- тест удаления при смене сущности;
- тест идемпотентного повторного расчёта.

Для движка:

- unit-тест каждого effect/condition/expression;
- property-тесты коммутативных stacking rules;
- обнаружение циклов;
- запрет неизвестных targets;
- стабильность результата независимо от порядка исходных JSON-массивов там, где порядок не является частью правила;
- миграционные тесты revisions.

## 25. Критерии готовности архитектуры

Модель считается реализованной, когда:

- простая новая раса добавляется без изменения TypeScript-кода;
- простой новый класс добавляется без изменения TypeScript-кода;
- UI обязательных выборов строится из данных;
- переименование сущности не ломает персонажей;
- подраса может заменить одну особенность, не копируя расу;
- особенность будущего уровня не применяется раньше;
- активная способность не становится постоянным бонусом;
- смена выбора не оставляет старые эффекты;
- каждый итог объясняется через breakdown;
- непонятая механика безопасно остаётся display-only;
- новая общая механика добавляется одним переиспользуемым примитивом.

## 26. Правило для будущей разработки

Перед добавлением расы, класса или предыстории:

1. проверить, выражаются ли все особенности существующими `GrantRule`, `ChoiceRule`, `ConditionExpr` и `ValueExpr`;
2. расширять данные, если выражаются;
3. расширять универсальный registry, если не выражаются;
4. никогда не писать логику по русскому названию сущности;
5. конкретные формулы и значения сверять с [character-creation-rules-engine.md](./character-creation-rules-engine.md) и активной страницей DnD.su;
6. завершать работу валидатором, fixture и тестом смены выбора.

## 27. Граница расчёта и игрового изменения

Чистый расчёт возвращает проекцию и план выдач, но сам не записывает инвентарь, не тратит ячейки и не восстанавливает ресурсы. План применяется серверной командой с версией состояния и защитой от повторов по ТЗ.

- Повторный расчёт не повторяет применение плана; выдачи связаны со стабильными grant-ID и экземплярами.
- Перенос runtime при изменении сборки имеет отдельный предварительный просмотр и политику для каждого ресурса. Новое максимальное значение не означает автоматическое заполнение.
- Черновик, финализированная сборка и допущенный мастером ручной персонаж имеют разные режимы валидации.
- Поправки Мастера имеют автора, причину, область и срок и применяются после базового расчёта в указанной области. Они не переписывают пакет, не обходят права сервера и не являются произвольным исполняемым кодом.
- Изменение сборки и отмена игрового действия — разные операции. Отмена не заменяет целиком `sheetJson` или инвентарь старым снимком.
- Покрытие контента отражает каждую особенность. Наличие импортированного описания не разрешает выставлять `automation: "full"` без проверки механики и контрольного сценария.

