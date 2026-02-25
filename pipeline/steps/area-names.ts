import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { PATHS } from '../config';

const OUTPUT = join(process.cwd(), 'data', 'guides', 'area_name.json');

export async function run() {
  const script = join(PATHS.parserV3, 'extract_area_names.py');

  // Skip gracefully if datamine is not available
  if (!existsSync(PATHS.parserV3) || !existsSync(script) || !existsSync(PATHS.extractedAssets)) {
    const outputExists = existsSync(OUTPUT);
    console.log(`  Datamine not available, skipping area names extraction`);
    if (outputExists) {
      console.log(`  Using existing area_name.json from git`);
    } else {
      console.warn(`  WARNING: area_name.json is missing and cannot be generated without datamine`);
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

  if (output.includes('up_to_date')) {
    const countMatch = output.match(/(\d+)\s+locations/);
    return `skipped (up to date${countMatch ? `, ${countMatch[1]} locations` : ''})`;
  }
  if (output.includes('missing_datamine')) {
    console.log(`  Datamine bytes files not found, skipping`);
    return;
  }
  const countMatch = output.match(/(\d+)\s+locations/);
  if (countMatch) return `${countMatch[1]} locations`;
  return 'updated';
}
