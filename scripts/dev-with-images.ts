import { spawn, execSync, type ChildProcess } from 'child_process';
import { rmSync } from 'fs';
import { join } from 'path';

const children: ChildProcess[] = [];

function cleanup() {
  console.log('\nShutting down...');
  for (const child of children) {
    if (child.pid) {
      // On Windows, spawn with shell requires killing the process tree
      try {
        process.kill(child.pid);
      } catch {
        // Already dead
      }
    }
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// 1. Clean .next cache
const nextDir = join(process.cwd(), '.next');
try { rmSync(nextDir, { recursive: true, force: true }); } catch {}
console.log('[dev] Cleaned .next cache');

// 2. Run pipeline (sync, before anything else)
console.log('[dev] Running pipeline...');
execSync('npx tsx pipeline/run.ts', { stdio: 'inherit' });

// 2. Run image conversion (one-shot scan + watch)
const imageWatcher = spawn('npx tsx scripts/convert-images.ts --watch', {
  stdio: 'inherit',
  shell: true,
});
children.push(imageWatcher);

// 3. Start Next.js dev server after a short delay
setTimeout(() => {
  const nextDev = spawn('npx next dev --port 3001', {
    stdio: 'inherit',
    shell: true,
  });
  children.push(nextDev);

  nextDev.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`Next.js exited with code ${code}`);
    }
    cleanup();
  });
}, 500);
