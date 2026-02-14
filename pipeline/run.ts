import { mkdirSync, existsSync } from 'fs';
import { PATHS } from './config';

type Step = {
  name: string;
  run: () => Promise<void>;
};

// Pipeline steps — executed in order
const steps: Step[] = [
  // Steps will be added as they are implemented
  // { name: 'characters', run: () => import('./steps/01-generate-characters').then(m => m.run()) },
  // { name: 'equipment', run: () => import('./steps/02-generate-equipment').then(m => m.run()) },
  // { name: 'effects', run: () => import('./steps/03-generate-effects').then(m => m.run()) },
  // { name: 'bosses', run: () => import('./steps/04-generate-bosses').then(m => m.run()) },
  // { name: 'indexes', run: () => import('./steps/05-generate-indexes').then(m => m.run()) },
  // { name: 'validate', run: () => import('./steps/06-validate').then(m => m.run()) },
];

async function main() {
  const args = process.argv.slice(2);
  const stepFilter = args.includes('--step') ? args[args.indexOf('--step') + 1] : null;
  const validateOnly = args.includes('--validate');

  // Ensure generated directory exists
  if (!existsSync(PATHS.generated)) {
    mkdirSync(PATHS.generated, { recursive: true });
  }

  console.log('=== Outerpedia Pipeline ===\n');

  if (steps.length === 0) {
    console.log('No steps configured yet. Add steps to pipeline/run.ts');
    return;
  }

  const toRun = validateOnly
    ? steps.filter(s => s.name === 'validate')
    : stepFilter
      ? steps.filter(s => s.name === stepFilter)
      : steps;

  if (toRun.length === 0) {
    console.error(`Step "${stepFilter || 'validate'}" not found.`);
    console.log('Available:', steps.map(s => s.name).join(', '));
    process.exit(1);
  }

  for (const step of toRun) {
    const start = Date.now();
    console.log(`[${step.name}] Running...`);
    try {
      await step.run();
      console.log(`[${step.name}] Done (${Date.now() - start}ms)`);
    } catch (err) {
      console.error(`[${step.name}] FAILED:`, err);
      process.exit(1);
    }
  }

  console.log('\n=== Pipeline complete ===');
}

main();
