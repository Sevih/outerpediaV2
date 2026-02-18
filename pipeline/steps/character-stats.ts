import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { PATHS } from '../config';

export async function run() {
  const script = join(PATHS.parserV3, 'extract_character_stats.py');

  // Skip gracefully if datamine is not available (e.g. on server)
  if (!existsSync(PATHS.parserV3) || !existsSync(script)) {
    const outputExists = existsSync(join(PATHS.generated, 'character-stats.json'));
    console.log(`  Datamine not available, skipping Python extraction`);
    if (outputExists) {
      console.log(`  Using existing character-stats.json from git`);
    } else {
      console.warn(`  WARNING: character-stats.json is missing and cannot be generated without datamine`);
    }
    return;
  }

  const output = await new Promise<string>((resolve, reject) => {
    execFile('python', [script], { cwd: PATHS.parserV3 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`${err.message}\n${stderr}`));
        return;
      }
      resolve(stdout.trim());
    });
  });

  // Forward Python script output
  for (const line of output.split('\n')) {
    if (line.trim()) console.log(`  ${line.trim()}`);
  }
}
