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

// 3. Start Caddy reverse proxy (HTTPS subdomains → localhost:3000)
console.log('[dev] Starting Caddy...');
const caddy = spawn('caddy run --config Caddyfile', {
  stdio: ['ignore', 'ignore', 'pipe'],
  shell: true,
});
children.push(caddy);

let caddyReady = false;
caddy.stderr?.on('data', (data: Buffer) => {
  const text = data.toString();
  if (!caddyReady && text.includes('serving initial configuration')) {
    caddyReady = true;
    console.log('[dev] Caddy ready (https://outerpedia.local)');
  }
  // Only forward errors, ignoring expected startup 502s (Next.js not ready yet)
  if (text.includes('"level":"error"') && !text.includes('"status":502')) {
    process.stderr.write(text);
  }
});

// 4. Start Next.js dev server after a short delay
setTimeout(() => {
  const nextDev = spawn('npx next dev', {
    stdio: ['inherit', 'pipe', 'inherit'],
    shell: true,
  });
  children.push(nextDev);

  let nextReady = false;
  nextDev.stdout?.on('data', (data: Buffer) => {
    process.stdout.write(data);
    if (!nextReady && data.toString().includes('Ready')) {
      nextReady = true;
      console.log('\n  \x1b[36m▲ Open:\x1b[0m  https://outerpedia.local\n');
    }
  });

  nextDev.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`Next.js exited with code ${code}`);
    }
    cleanup();
  });
}, 500);
