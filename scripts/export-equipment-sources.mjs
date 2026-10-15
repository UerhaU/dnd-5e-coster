import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';

const db = new DatabaseSync('storage/dnd.sqlite', { readOnly: true });
const strip = (html) => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
const normalize = (value) => strip(value).replace(/\s+/g, ' ');
try {
  const all = db.prepare("SELECT canonicalId,russianName,englishName,entityUrl,sourceTitle,editionCompatibility,mechanicsJson,payloadJson FROM ImportedContent WHERE category='magicItems' ORDER BY entityUrl").all().map((row) => ({
    canonicalId: row.canonicalId, name: row.russianName, originalName: row.englishName,
    url: row.entityUrl.replace('https://dnd.su/', 'https://5e14.dnd.su/'),
    edition: row.editionCompatibility, sourceTitle: row.sourceTitle,
    mechanics: JSON.parse(row.mechanicsJson), payload: JSON.parse(row.payloadJson),
  }));
  const equipment = all.filter((row) => /^(Оружие|Доспех|Посох)/i.test(row.mechanics.typeLine ?? '') || ['cloak of protection','ring of protection','bracers of defense'].includes(row.originalName.toLowerCase()));
  if (equipment.some((row) => row.url.includes('/homebrew/') || row.url.includes('next.'))) throw new Error('Out-of-scope source');
  const checks = [];
  for (const [id, filename] of [[1,'adamantine'],[54,'defender'],[254,'shield-bonus']]) {
    const parsed = equipment.find((row) => row.url.includes(`/items/${id}-`));
    const html = readFileSync(`database/equipment/${filename}.html`, 'utf8');
    const body = html.match(/<div itemprop="description">([\s\S]*?)<\/div>/)?.[1];
    const type = html.match(/class=['"]size-type-alignment['"]>([\s\S]*?)<\/li>/)?.[1];
    const sameDescription = normalize(parsed.payload.details.descriptionText) === normalize(body ?? '');
    const sameType = normalize(parsed.mechanics.typeLine) === normalize(type ?? '');
    checks.push({ url: parsed.url, name: parsed.name, sameDescription, sameType });
    if (!sameDescription || !sameType) throw new Error(`Source mismatch: ${parsed.name}`);
  }
  writeFileSync('database/equipment/source-checks.json', JSON.stringify({ checkedOn:'2026-10-16', edition:'5e_2014', checks }, null, 2)+'\n');
  writeFileSync('database/equipment/imported-magic.json', JSON.stringify(equipment, null, 2)+'\n');
  console.log(JSON.stringify({ magicEquipment: equipment.length, sampleMatches: checks.length }));
} finally { db.close(); }
