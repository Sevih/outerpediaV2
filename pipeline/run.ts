import { mkdirSync, existsSync } from 'fs';
import { PATHS } from './config';

type Step = {
  name: string;
  run: () => Promise<string | void>;
  /** Skipped on `--prod` builds (e.g. fetches that rely on a dev-only API key). */
  devOnly?: boolean;
};

// Pipeline steps — executed in order
// Order matters. The two extraction steps must run FIRST so every downstream
// consumer reads fresh data:
//   - bytes-cache    → produces `data/admin/json2/`        (consumed by
//                       character-stats, damage-calc, area-names,
//                       bgm-extract, tower-data)
//   - extract-assets → produces `data/extracted_astudio/`  (consumed by
//                       wallpapers)
// Both early-return cleanly when the source bundles are absent (typical
// prod deploy), so moving them first doesn't break the no-datamine path.
const steps: Step[] = [
  { name: 'bytes-cache', run: () => import('./steps/bytes-cache').then(m => m.run()) },
  { name: 'extract-assets', run: () => import('./steps/extract-assets').then(m => m.run()) },
  { name: 'game-version', run: () => import('./steps/game-version').then(m => m.run()) },
  { name: 'singularity-ascension', run: () => import('./steps/singularity-ascension').then(m => m.run()) },
  { name: 'singularity-rotation', run: () => import('./steps/singularity-rotation').then(m => m.run()) },
  { name: 'unlock-content', run: () => import('./steps/unlock-content').then(m => m.run()) },
  { name: 'ascension-view', run: () => import('./steps/ascension-view').then(m => m.run()) },
  { name: 'stat-ranges-v2', run: () => import('./steps/stat-ranges-v2').then(m => m.run()) },
  { name: 'item-names', run: () => import('./steps/item-names').then(m => m.run()) },
  { name: 'item-stats-detail', run: () => import('./steps/item-stats-detail').then(m => m.run()) },
  { name: 'character-skins', run: () => import('./steps/character-skins').then(m => m.run()) },
  { name: 'face-icons', run: () => import('./steps/face-icons').then(m => m.run()) },
  { name: 'effect-group-map', run: () => import('./steps/effect-group-map').then(m => m.run()) },
  { name: 'effects-index', run: () => import('./steps/effects-index').then(m => m.run()) },
  { name: 'boss-index', run: () => import('./steps/boss-index').then(m => m.run()) },
  { name: 'characters-index', run: () => import('./steps/characters-index').then(m => m.run()) },
  { name: 'character-stats', run: () => import('./steps/character-stats').then(m => m.run()) },
  { name: 'damage-calc', run: () => import('./steps/damage-calc').then(m => m.run()) },
  { name: 'cf-skill-names', run: () => import('./steps/cf-skill-names').then(m => m.run()) },
  { name: 'area-names', run: () => import('./steps/area-names').then(m => m.run()) },
  { name: 'guide-boss-map', run: () => import('./steps/guide-boss-map').then(m => m.run()) },
  { name: 'most-used-units', run: () => import('./steps/most-used-units').then(m => m.run()) },
  { name: 'bgm-extract', run: () => import('./steps/bgm-extract').then(m => m.run()) },
  { name: 'wallpapers', run: () => import('./steps/wallpapers').then(m => m.run()) },
  { name: 'comics', run: () => import('./steps/comics').then(m => m.run()) },
  { name: 'patch-notes', run: () => import('./steps/patch-notes').then(m => m.run()) },
  { name: 'gear-usage-stats', run: () => import('./steps/gear-usage-stats').then(m => m.run()) },
  { name: 'gear-finder-index', run: () => import('./steps/gear-finder-index').then(m => m.run()) },
  { name: 'event-registry', run: () => import('./steps/event-registry').then(m => m.run()) },
  { name: 'tower-data', run: () => import('./steps/tower-data').then(m => m.run()) },
  { name: 'video-meta', devOnly: true, run: () => import('./steps/video-meta').then(m => m.run()) },
  { name: 'validate-reco', run: () => import('./steps/validate-reco').then(m => m.run()) },
];

const NAME_PAD = Math.max(...steps.map(s => s.name.length));

async function main() {
  const args = process.argv.slice(2);
  const stepFilter = args.includes('--step') ? args[args.indexOf('--step') + 1] : null;
  const validateOnly = args.includes('--validate');
  const isProd = args.includes('--prod');

  const compact = process.stdout.isTTY && !process.argv.includes('--verbose');

  // Ensure generated directory exists
  if (!existsSync(PATHS.generated)) {
    mkdirSync(PATHS.generated, { recursive: true });
  }

  if (compact) {
    console.log('[Running pipeline]');
  } else {
    console.log('\nPipeline\n');
  }

  if (steps.length === 0) {
    console.log('  No steps configured. Add steps to pipeline/run.ts');
    return;
  }

  const selected = validateOnly
    ? steps.filter(s => s.name === 'validate')
    : stepFilter
      ? steps.filter(s => s.name === stepFilter)
      : steps;

  // Drop dev-only steps on prod builds (they rely on a dev-only API key and
  // the artifacts they produce are committed).
  const toRun = isProd ? selected.filter(s => !s.devOnly) : selected;

  if (toRun.length === 0) {
    console.error(`  Step "${stepFilter || 'validate'}" not found.`);
    console.log('  Available:', steps.map(s => s.name).join(', '));
    process.exit(1);
  }

  const totalStart = Date.now();
  const total = toRun.length;

  for (let i = 0; i < total; i++) {
    const step = toRun[i];
    const start = Date.now();
    const idx = `[${i + 1}/${total}]`;

    if (compact) {
      process.stdout.write(`\r  \x1b[2m${idx}\x1b[0m ${step.name}…`);
    }

    try {
      const summary = await step.run();
      const ms = Date.now() - start;

      if (compact) {
        // Clear the progress line — will be overwritten by next step
        process.stdout.write(`\r\x1b[K`);
      }

      if (!compact) {
        const name = step.name.padEnd(NAME_PAD);
        console.log(`  \x1b[32m✓\x1b[0m ${name}  ${summary || 'ok'} \x1b[2m(${ms}ms)\x1b[0m`);
      }
    } catch (err) {
      if (compact) {
        process.stdout.write(`\r\x1b[K`);
      }
      const name = step.name.padEnd(NAME_PAD);
      const ms = Date.now() - start;
      console.log(`  \x1b[31m✗\x1b[0m ${name}  FAILED \x1b[2m(${ms}ms)\x1b[0m`);
      console.error(`\n  ${err}\n`);
      process.exit(1);
    }
  }

  const elapsed = Date.now() - totalStart;

  if (compact) {
    console.log(`  \x1b[32m✓\x1b[0m Pipeline complete \x1b[2m(${total} steps in ${elapsed}ms)\x1b[0m`);
  } else {
    console.log(`\nDone in ${elapsed}ms\n`);
  }
}

main();
