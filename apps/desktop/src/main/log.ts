import fs from 'node:fs';
import path from 'node:path';

/** Простой журнал главного процесса в `data/logs/main.log`. */
export function createLogger(logsDir: string): (message: string) => void {
  const file = path.join(logsDir, 'main.log');

  return (message) => {
    fs.appendFileSync(file, `${new Date().toISOString()} ${message}\n`);
  };
}
