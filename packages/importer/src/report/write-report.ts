import fs from 'node:fs';
import path from 'node:path';
import type { BuildResult } from '../build/build-catalog.ts';

// Шаг report (раздел 6): что добавлено, изменено, пропущено, с ошибкой.

const SEVERITY_TITLES = {
  error: 'Ошибки (объект не попал в каталог)',
  skip: 'Пропущено по правилам',
  warning: 'Предупреждения (объект в каталоге)',
} as const;

export function summaryLines(result: BuildResult): string[] {
  const { collect, write, issues } = result;
  const count = (severity: keyof typeof SEVERITY_TITLES) =>
    issues.filter((issue) => issue.severity === severity).length;
  return [
    `Заклинаний в списке DnD.su: ${collect.listed}`,
    `В каталоге: ${write.entities} (новых ${write.added}, изменённых ${write.changed}, без изменений ${write.unchanged})`,
    `Снято (пропали из источника): ${write.withdrawn}`,
    `Новых ревизий: ${write.newRevisions}, всего ревизий: ${write.revisionsTotal}`,
    `Нет страницы в кэше: ${collect.missingPages}; ошибок разбора: ${collect.failed}; пропущено: ${collect.skipped}`,
    `Ручных исправлений применено: ${collect.reviewedApplied}; проверенных правил: ${collect.rulesVerified}`,
    `Версия каталога: ${write.catalogVersion}${write.previousFound ? '' : ' (собран с нуля)'}`,
    `Ошибок: ${count('error')}, пропусков: ${count('skip')}, предупреждений: ${count('warning')}`,
  ];
}

function markdown(result: BuildResult, title: string): string {
  const lines = [`# ${title}`, '', ...summaryLines(result).map((line) => `- ${line}`)];
  for (const severity of ['error', 'skip', 'warning'] as const) {
    const items = result.issues.filter((issue) => issue.severity === severity);
    if (items.length === 0) {
      continue;
    }
    lines.push('', `## ${SEVERITY_TITLES[severity]}: ${items.length}`, '');
    lines.push('| ID | DnD.su | Поле | Что |', '| --- | --- | --- | --- |');
    for (const issue of items) {
      const message = issue.message.replace(/\|/g, '\\|').replace(/\n/g, ' ');
      lines.push(
        `| ${issue.entityId ?? '—'} | ${issue.dndsuId ?? '—'} | ${issue.field} | ${message} |`,
      );
    }
  }
  return `${lines.join('\n')}\n`;
}

/** Пишет отчёт в папку: `<имя>.json` (всё) и `<имя>.md` (для чтения). */
export function writeBuildReport(result: BuildResult, folder: string, name: string): string {
  fs.mkdirSync(folder, { recursive: true });
  const base = path.join(folder, name);
  fs.writeFileSync(`${base}.json`, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(`${base}.md`, markdown(result, `Сборка каталога: ${name}`));
  return `${base}.md`;
}
