// Упаковывает собранную папку в zip с корневой папкой Koster/ (Р41).
// electron-builder сам кладёт файлы в корень архива, поэтому zip делаем здесь,
// встроенным в Windows tar (bsdtar умеет писать zip).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const desktopDir = path.resolve(import.meta.dirname, '..');
// Папку сборки можно передать аргументом, если electron-builder собирал не в release/.
const releaseDir = path.resolve(process.argv[2] ?? path.join(desktopDir, 'release'));
const unpackedDir = path.join(releaseDir, 'win-unpacked');
const stagingDir = path.join(releaseDir, 'zip');
const appDir = path.join(stagingDir, 'Koster');

const { version } = JSON.parse(fs.readFileSync(path.join(desktopDir, 'package.json'), 'utf8')) as {
  version: string;
};
const zipPath = path.join(releaseDir, `Koster-${version}-win-x64.zip`);

if (!fs.existsSync(path.join(unpackedDir, 'Koster.exe'))) {
  throw new Error(`Нет собранной программы: ${unpackedDir}\\Koster.exe`);
}

fs.rmSync(stagingDir, { recursive: true, force: true });
fs.rmSync(zipPath, { force: true });
fs.cpSync(unpackedDir, appDir, { recursive: true });

// Именно tar из Windows: tar из Git for Windows не умеет zip.
const windowsTar = path.join(process.env['SystemRoot'] ?? 'C:\\Windows', 'System32', 'tar.exe');
execFileSync(windowsTar, ['-a', '-c', '-f', zipPath, 'Koster'], {
  cwd: stagingDir,
  stdio: 'inherit',
});
fs.rmSync(stagingDir, { recursive: true, force: true });

console.log(`Готово: ${zipPath}`);
