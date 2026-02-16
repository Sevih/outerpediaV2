import sharp from 'sharp';
import { readdir, stat, access } from 'fs/promises';
import { join, extname, basename } from 'path';
import { watch } from 'fs';

const IMAGES_DIR = join(process.cwd(), 'public/images');
const CONVERTIBLE = new Set(['.png', '.jpg', '.jpeg']);
const QUALITY = 80;

let converted = 0;
let skipped = 0;
let failed = 0;

async function convertFile(filePath: string): Promise<void> {
  const ext = extname(filePath).toLowerCase();
  if (!CONVERTIBLE.has(ext)) return;

  const webpPath = filePath.replace(/\.(png|jpe?g)$/i, '.webp');

  // Skip if WebP already exists
  try {
    await access(webpPath);
    skipped++;
    return;
  } catch {
    // WebP doesn't exist, convert
  }

  try {
    await sharp(filePath).webp({ quality: QUALITY }).toFile(webpPath);
    converted++;
    console.log(`  converted: ${basename(filePath)} -> ${basename(webpPath)}`);
  } catch (err) {
    failed++;
    console.error(`  FAILED: ${basename(filePath)} — ${err}`);
  }
}

async function scanDir(dir: string): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await scanDir(fullPath);
    } else {
      const ext = extname(entry.name).toLowerCase();
      if (CONVERTIBLE.has(ext)) {
        await convertFile(fullPath);
      } else {
        skipped++;
      }
    }
  }
}

async function runOnce(): Promise<void> {
  console.log(`Scanning ${IMAGES_DIR} ...`);
  await scanDir(IMAGES_DIR);
  console.log(`\nDone: ${converted} converted, ${skipped} skipped, ${failed} failed`);
}

function runWatch(): void {
  console.log(`Watching ${IMAGES_DIR} for new PNG/JPG files...\n`);

  watch(IMAGES_DIR, { recursive: true }, async (_event, filename) => {
    if (!filename) return;
    const ext = extname(filename).toLowerCase();
    if (!CONVERTIBLE.has(ext)) return;

    const fullPath = join(IMAGES_DIR, filename);
    try {
      await stat(fullPath);
      // Small delay to let file writing finish
      setTimeout(() => convertFile(fullPath), 200);
    } catch {
      // File was deleted, ignore
    }
  });
}

const isWatch = process.argv.includes('--watch');

if (isWatch) {
  // Convert existing files first, then watch
  runOnce().then(() => {
    console.log('');
    runWatch();
  });
} else {
  runOnce();
}
