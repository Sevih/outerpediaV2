import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { PATHS } from '../config';

export async function run() {
  const script = join(PATHS.parserV3, 'extract_character_stats.py');

  // Skip gracefully if datamine is not available (e.g. on server)
  if (!existsSync(PATHS.parserV3) || !existsSync(script)) {
    const outputExists = existsSync(join(PATHS.generated, 'character-stats.json'));
    if (outputExists) {
      return 'skipped (no datamine, using cached)';
    }
    return 'skipped (no datamine, no cache!)';
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

  // Parse Python output for summary
  if (output.includes('up to date') || output.includes('skipped')) {
    return 'up to date';
  }
  // Extract character count if available
  const match = output.match(/(\d+)\s*character/i);
  return match ? `${match[1]} characters extracted` : 'extracted';
}
