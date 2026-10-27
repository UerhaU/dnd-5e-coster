import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { launchBuiltApp, type RunningApp } from './app';

// Сценарий этапа 1: «Справочник» → поиск «огнен» → карточка «Огненного шара».
// Огненный шар есть и в полном каталоге, и в тестовом (data/fixtures), поэтому
// сценарий проходит в zip из CI и в программе автора.

let running: RunningApp;

test.beforeAll(async () => {
  running = await launchBuiltApp();
});

test.afterAll(async () => {
  await running?.close();
});

test('справочник: найти «Огненный шар» по «огнен» и открыть карточку', async () => {
  const { window } = running;

  await expect(window.getByRole('heading', { name: 'Костёр' })).toBeVisible();
  await expect(window.getByTestId('health-status')).toContainText('Сервер работает');
  // Остальные пункты меню видны, но неактивны.
  await expect(window.getByText('Мои персонажи')).toBeVisible();
  await expect(window.getByRole('link', { name: 'Мои персонажи' })).toHaveCount(0);

  await window.getByRole('link', { name: 'Справочник' }).click();
  await window.getByRole('link', { name: /Заклинания/ }).click();

  await window.getByRole('searchbox', { name: 'Поиск заклинаний' }).fill('огнен');
  const results = window.getByRole('list', { name: 'Результаты поиска' });
  const fireball = results.getByRole('link', { name: /Огненный шар/ });
  await expect(fireball).toBeVisible();

  await fireball.click();
  await expect(window.getByRole('heading', { level: 1, name: 'Огненный шар' })).toBeVisible();
  await expect(window.getByTestId('spell-level-school')).toHaveText('3 уровень, воплощение');
  await expect(window.getByTestId('spell-components')).toContainText('В, С, М (');

  // Назад — к тому же списку с тем же запросом.
  await window.getByRole('button', { name: '← К списку' }).click();
  await expect(window.getByRole('searchbox', { name: 'Поиск заклинаний' })).toHaveValue('огнен');
});

test('программа пишет только в data/ рядом с Koster.exe', async () => {
  const data = path.join(running.folder, 'data');
  expect(fs.existsSync(data)).toBe(true);
  expect(fs.readdirSync(data).sort()).toEqual(['electron', 'logs']);
});
