import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function runSql(databasePath, sql) {
  const output = execFileSync('sqlite3', ['-json', databasePath, sql], { encoding: 'utf8' }).trim();
  return output ? JSON.parse(output) : [];
}

export function executeSqlScript(databasePath, script) {
  const tempFile = path.join(os.tmpdir(), `bi-dashboard-${process.pid}-${Date.now()}.sql`);
  fs.writeFileSync(tempFile, script);
  try {
    execFileSync('sqlite3', [databasePath, `.read ${tempFile}`], { encoding: 'utf8' });
  } finally {
    fs.rmSync(tempFile, { force: true });
  }
}
