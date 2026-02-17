import { spawn, type ChildProcess } from 'child_process';

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

// 1. Run image conversion (one-shot scan + watch)
const imageWatcher = spawn('npx', ['tsx', 'scripts/convert-images.ts', '--watch'], {
  stdio: 'inherit',
  shell: true,
});
children.push(imageWatcher);

// 2. Start Next.js dev server after a short delay
setTimeout(() => {
  const nextDev = spawn('npx', ['next', 'dev', '--port', '3001'], {
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
