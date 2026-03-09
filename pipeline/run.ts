import { mkdirSync, existsSync } from 'fs';
import { PATHS } from './config';

type Step = {
  name: string;
  run: () => Promise<string | void>;
};

// Pipeline steps — executed in order
const steps: Step[] = [
  { name: 'effect-group-map', run: () => import('./steps/effect-group-map').then(m => m.run()) },
  { name: 'effects-index', run: () => import('./steps/effects-index').then(m => m.run()) },
  { name: 'boss-index', run: () => import('./steps/boss-index').then(m => m.run()) },
  { name: 'characters-index', run: () => import('./steps/characters-index').then(m => m.run()) },
  { name: 'character-stats', run: () => import('./steps/character-stats').then(m => m.run()) },
  { name: 'area-names', run: () => import('./steps/area-names').then(m => m.run()) },
  { name: 'guide-boss-map', run: () => import('./steps/guide-boss-map').then(m => m.run()) },
  { name: 'most-used-units', run: () => import('./steps/most-used-units').then(m => m.run()) },
  { name: 'bgm-extract', run: () => import('./steps/bgm-extract').then(m => m.run()) },
  { name: 'wallpapers', run: () => import('./steps/wallpapers').then(m => m.run()) },
  { name: 'patch-notes', run: () => import('./steps/patch-notes').then(m => m.run()) },
  { name: 'patch-notes-legacy', run: () => import('./steps/patch-notes-legacy').then(m => m.run()) },
  { name: 'gear-usage-stats', run: () => import('./steps/gear-usage-stats').then(m => m.run()) },
  { name: 'validate-reco', run: () => import('./steps/validate-reco').then(m => m.run()) },
];

const NAME_PAD = Math.max(...steps.map(s => s.name.length));

async function main() {
  const args = process.argv.slice(2);
  const stepFilter = args.includes('--step') ? args[args.indexOf('--step') + 1] : null;
  const validateOnly = args.includes('--validate');

  // Ensure generated directory exists
  if (!existsSync(PATHS.generated)) {
    mkdirSync(PATHS.generated, { recursive: true });
  }

  console.log('\nPipeline\n');

  if (steps.length === 0) {
    console.log('  No steps configured. Add steps to pipeline/run.ts');
    return;
  }

  const toRun = validateOnly
    ? steps.filter(s => s.name === 'validate')
    : stepFilter
      ? steps.filter(s => s.name === stepFilter)
      : steps;

  if (toRun.length === 0) {
    console.error(`  Step "${stepFilter || 'validate'}" not found.`);
    console.log('  Available:', steps.map(s => s.name).join(', '));
    process.exit(1);
  }

  const totalStart = Date.now();

  for (const step of toRun) {
    const start = Date.now();
    try {
      const summary = await step.run();
      const name = step.name.padEnd(NAME_PAD);
      const ms = Date.now() - start;
      console.log(`  \x1b[32m✓\x1b[0m ${name}  ${summary || 'ok'} \x1b[2m(${ms}ms)\x1b[0m`);
    } catch (err) {
      const name = step.name.padEnd(NAME_PAD);
      const ms = Date.now() - start;
      console.log(`  \x1b[31m✗\x1b[0m ${name}  FAILED \x1b[2m(${ms}ms)\x1b[0m`);
      console.error(`\n  ${err}\n`);
      process.exit(1);
    }
  }

  console.log(`\nDone in ${Date.now() - totalStart}ms\n`);
}

main();
