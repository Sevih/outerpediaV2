import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { PATHS } from '../config';

export async function run() {
  const script = join(PATHS.parserV3, 'extract_bgm.py');

  if (!existsSync(PATHS.parserV3) || !existsSync(script)) {
    return 'skipped (parser not available)';
  }

  // Need at least bundles or extracted assets
  const hasBundles = existsSync(PATHS.datamineFiles);
  const hasDatamine = existsSync(PATHS.extractedAssets);

  if (!hasBundles && !hasDatamine) {
    return 'skipped (no datamine)';
  }

  const output = await new Promise<string>((resolve, reject) => {
    execFile(
      'python',
      [script],
      { cwd: PATHS.parserV3, timeout: 600_000 },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`${err.message}\n${stderr}`));
          return;
        }
        resolve(stdout.trim());
      },
    );
  });

  if (output.startsWith('no_datamine_no_wavs')) {
    return 'skipped (no datamine, no WAV files)';
  }

  if (output.startsWith('mapping_only')) {
    const match = output.match(/(\d+) entries/);
    return `mapping only — ${match?.[1] ?? '?'} entries`;
  }

  if (output.startsWith('done')) {
    const match = output.match(/(\d+) entries (\d+) converted/);
    if (match) {
      return `${match[1]} entries, ${match[2]} converted`;
    }
    return output.replace('done ', '');
  }

  return output || 'done';
}
