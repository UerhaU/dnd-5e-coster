// Разовый перенос ручных исправлений заклинаний из v0.1 (ветка legacy) в data/reviewed/spells/.
// Повторный запуск перезаписывает файлы тем же содержимым.
//
//   node scripts/legacy/convert-spell-reviewed.mts
//
// Что переносится:
//   - scripts/spell-reviewed-rules.mjs — проверенные правила (reviewedSpellRules)
//     и число целей (reviewedTargetCounts, targetPerSlot);
//   - scripts/spell-materials.mjs — составы материальных компонентов;
//   - правила четырёх исходных записей v0.1 (Огненный шар, Лечение ран, Опознание,
//     Благословение): в v0.1 они лежали только в storage/spell-catalog.sqlite
//     (effects 3001–3004, spell_effects 4001–4004, spell_scaling, spell_numeric_rules)
//     и переписаны сюда вручную.
// Механика, выделенная v0.1 автоматически (spell-rule-parser.mjs), не переносится.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  materialNodeSchema,
  slugFromName,
  SPELL_RULES_SCHEMA_VERSION,
  spellEffectSchema,
  type SpellEffect,
} from '@koster/shared';

type LegacyEffect = Record<string, unknown>;
interface LegacySpell {
  siteId: number;
  name: string;
  originalName: string;
  material: string | null;
}

const root = path.resolve(import.meta.dirname, '..', '..');
const outDir = path.join(root, 'data', 'reviewed', 'spells');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'koster-legacy-'));

function legacyFile(file: string): string {
  const target = path.join(temp, path.basename(file));
  const content = execFileSync('git', ['show', `refs/heads/legacy:${file}`], {
    cwd: root,
    maxBuffer: 64 * 1024 * 1024,
  });
  fs.writeFileSync(target, content);
  return target;
}

const rulesModule = (await import(
  pathToFileURL(legacyFile('scripts/spell-reviewed-rules.mjs')).href
)) as {
  reviewedSpellRules: Record<string, LegacyEffect[]>;
  reviewedTargetCounts: Record<string, number | null>;
  targetPerSlot: Set<string>;
};
const materialsModule = (await import(
  pathToFileURL(legacyFile('scripts/spell-materials.mjs')).href
)) as { materialRecipe(spell: LegacySpell): { node: unknown } | null };
const catalog = JSON.parse(
  fs.readFileSync(legacyFile('database/spells/full-catalog.json'), 'utf8'),
) as { spells: LegacySpell[] };

const ABILITY: Record<string, string> = {
  strength: 'str',
  dexterity: 'dex',
  constitution: 'con',
  intelligence: 'int',
  wisdom: 'wis',
  charisma: 'cha',
};
const RESOLUTION: Record<string, string> = {
  автоматически: 'auto',
  'дальнобойная атака': 'ranged_spell_attack',
  'рукопашная атака': 'melee_spell_attack',
};
const dice = (roll: unknown) => String(roll).replaceAll('к', 'd');

/** Эффект v0.1 → spell-rules/v1. Незнакомое поле — ошибка, чтобы ничего не потерять. */
function convertEffect(effect: LegacyEffect): SpellEffect {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(effect)) {
    switch (key) {
      case 'kind':
        out['type'] = value;
        break;
      case 'roll':
        out['dice'] = dice(value);
        break;
      case 'damage':
        out['damageType'] = value;
        break;
      case 'ability':
        out['ability'] = ABILITY[String(value)];
        break;
      case 'save':
        out['save'] = { ability: ABILITY[String(value)], onSuccess: effect['onSuccess'] ?? null };
        break;
      case 'onSuccess':
        break;
      case 'resolution':
        out['resolution'] = RESOLUTION[String(value)];
        break;
      case 'scaling':
        out['slotScaling'] = (value as { level: number; value?: number; roll?: string }[]).map(
          (step) =>
            step.roll
              ? { slotLevel: step.level, dice: dice(step.roll) }
              : { slotLevel: step.level, value: step.value },
        );
        break;
      case 'beamLevels':
        out['beamsByCharacterLevel'] = (value as { level: number; count: number }[]).map(
          (step) => ({ characterLevel: step.level, count: step.count }),
        );
        break;
      case 'scalingAdd':
        out['scalingDice'] = dice(value);
        break;
      case 'cantripDice':
        out['cantripDice'] = dice(value);
        break;
      case 'stat':
      case 'op':
      case 'value':
      case 'choices':
      case 'condition':
      case 'choice':
      case 'trigger':
      case 'scope':
      case 'conditionText':
      case 'spellcasting':
      case 'scalarPerSlot':
      case 'repeatCount':
      case 'repeatPerSlot':
      case 'scalingStart':
      case 'scalingStep':
      case 'noScaling':
        out[key] = value;
        break;
      default:
        throw new Error(`Незнакомое поле эффекта v0.1: ${key}`);
    }
  }
  return spellEffectSchema.parse(out);
}

/** Правила четырёх исходных записей v0.1 (storage/spell-catalog.sqlite). */
const ORIGINAL_RECORDS: Record<string, { effects: SpellEffect[]; targets: Targets | null }> = {
  fireball: {
    effects: [
      {
        type: 'damage',
        dice: '8d6',
        damageType: 'fire',
        save: { ability: 'dex', onSuccess: 'half' },
        scalingDice: '1d6',
        conditionText: 'Существа в сфере взрыва.',
      },
    ],
    targets: null,
  },
  'cure wounds': {
    effects: [
      {
        type: 'healing',
        dice: '1d8+SC',
        resolution: 'auto',
        scalingDice: '1d8',
        conditionText: 'Касание существа, не являющегося Нежитью или Конструктом.',
      },
    ],
    targets: { maxCount: 1, extraPerSlot: 0 },
  },
  identify: {
    effects: [
      {
        type: 'information',
        conditionText:
          'Узнайте свойства магического предмета или действующие на цель заклинания. ' +
          'Касание выбранного предмета или существа в течение накладывания.',
      },
    ],
    targets: { maxCount: 1, extraPerSlot: 0 },
  },
  bless: {
    effects: ['attack_roll', 'saving_throws'].map((stat) => ({
      type: 'modifier' as const,
      stat,
      op: 'add' as const,
      dice: '1d4',
      resolution: 'auto' as const,
      conditionText: 'Когда цель совершает бросок атаки или спасбросок.',
    })),
    targets: { maxCount: 3, extraPerSlot: 1 },
  },
};

interface Targets {
  maxCount: number;
  extraPerSlot: number;
}

/** Ключ v0.1: английское название в нижнем регистре, апостроф прямой. */
function legacyKey(name: string): string {
  return name.toLowerCase().replaceAll('’', "'").trim();
}

// В v0.1 правило «Волшебной стрелы Джима» записано под ключом «jim's magic missile»,
// а на сайте название без апострофа (Jims Magic Missile), поэтому v0.1 его не применяла.
const KEY_ALIASES: Record<string, string> = { "jim's magic missile": 'jims magic missile' };

const rulesByKey = new Map<string, LegacyEffect[]>();
for (const [key, effects] of Object.entries(rulesModule.reviewedSpellRules)) {
  rulesByKey.set(KEY_ALIASES[legacyKey(key)] ?? legacyKey(key), effects);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const counts = { files: 0, rules: 0, materials: 0, targets: 0 };
const usedRuleKeys = new Set<string>();

for (const spell of catalog.spells) {
  const key = legacyKey(spell.originalName);
  const provenance: string[] = [];
  const file: Record<string, unknown> = {
    id: `spell:${slugFromName(spell.originalName)}`,
    dndsuId: spell.siteId,
    nameRu: spell.name,
  };

  const original = ORIGINAL_RECORDS[key];
  const legacyRules = rulesByKey.get(key);
  if (original) {
    file['rules'] = { schemaVersion: SPELL_RULES_SCHEMA_VERSION, effects: original.effects };
    provenance.push('rules: v0.1 storage/spell-catalog.sqlite (исходная проверенная запись)');
  } else if (legacyRules) {
    file['rules'] = {
      schemaVersion: SPELL_RULES_SCHEMA_VERSION,
      effects: legacyRules.map(convertEffect),
    };
    provenance.push('rules: v0.1 scripts/spell-reviewed-rules.mjs');
  }
  if (legacyRules) {
    usedRuleKeys.add(key);
  }

  const count = rulesModule.reviewedTargetCounts[key];
  const targets: Targets | null = count
    ? { maxCount: count, extraPerSlot: rulesModule.targetPerSlot.has(key) ? 1 : 0 }
    : (original?.targets ?? null);
  if (targets) {
    file['targets'] = targets;
    provenance.push(
      count
        ? 'targets: v0.1 scripts/spell-reviewed-rules.mjs'
        : 'targets: v0.1 storage/spell-catalog.sqlite',
    );
  }

  const recipe = materialsModule.materialRecipe(spell);
  if (recipe) {
    file['materials'] = materialNodeSchema.parse(recipe.node);
    provenance.push('materials: v0.1 scripts/spell-materials.mjs');
  }

  if (provenance.length === 0) {
    continue;
  }
  file['provenance'] = provenance;
  counts.files += 1;
  counts.rules += file['rules'] ? 1 : 0;
  counts.materials += file['materials'] ? 1 : 0;
  counts.targets += file['targets'] ? 1 : 0;

  const name = String(file['id']).replace(/^spell:/, '');
  fs.writeFileSync(path.join(outDir, `${name}.json`), `${JSON.stringify(file, null, 2)}\n`);
}

const unused = [...rulesByKey.keys()].filter((key) => !usedRuleKeys.has(key));
if (unused.length > 0) {
  throw new Error(`Правила v0.1 не нашли своё заклинание: ${unused.join(', ')}`);
}
fs.rmSync(temp, { recursive: true, force: true });
console.log(counts);
