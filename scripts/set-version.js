/**
 * Sync version from package.json to public/sw.js cache name.
 * NEXT_PUBLIC_APP_VERSION is handled by next.config.ts (reads package.json directly).
 *
 * Run: node scripts/set-version.js [optional-version]
 * If no argument, reads from package.json.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));

// Use CLI argument or package.json version
const version = process.argv[2] || pkg.version;

// If CLI argument provided, also update package.json
if (process.argv[2] && process.argv[2] !== pkg.version) {
  pkg.version = process.argv[2];
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
  console.log(`[set-version] package.json → ${version}`);
}

// Inject version into service worker
const swPath = path.join(root, 'public', 'sw.js');
if (fs.existsSync(swPath)) {
  let sw = fs.readFileSync(swPath, 'utf-8');
  sw = sw.replace(
    /const CACHE_NAME = .+;/,
    `const CACHE_NAME = 'outerpedia-cache-v${version}';`
  );
  fs.writeFileSync(swPath, sw);
  console.log(`[set-version] sw.js cache → outerpedia-cache-v${version}`);
}

console.log(`[set-version] Done — v${version}`);
