import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { PATHS } from '../config';

export async function run() {
  const script = join(PATHS.parserV3, 'extract_character_stats.py');

  // Skip gracefully if datamine is not available (e.g. on server)
  if (!existsSync(PATHS.parserV3) || !existsSync(script) || !existsSync(PATHS.extractedAssets)) {
    const outputExists = existsSync(join(PATHS.generated, 'character-stats.json'));
    if (outputExists) {
      return 'skipped (no datamine, using existing)';
    }
    throw new Error('character-stats.json is missing and cannot be generated without datamine');
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

  // Parse Python output for a concise summary
  if (output.includes('up_to_date') || output.includes('skipped')) {
    return 'skipped (up to date)';
  }
  // Extract count if present (e.g. "114 characters")
  const countMatch = output.match(/(\d+)\s+character/);
  if (countMatch) return `${countMatch[1]} characters`;
  return 'updated';
}
