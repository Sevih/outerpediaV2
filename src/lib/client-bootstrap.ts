/**
 * Client-side bootstrap script injected inline in <body>.
 * Handles: SW registration, version checks, ChunkLoadError recovery.
 *
 * Edit the actual JS in client-bootstrap.inline.js (proper syntax highlighting).
 * This module reads it and injects the app version at build time.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const template = readFileSync(join(process.cwd(), 'src/lib/client-bootstrap.inline.js'), 'utf-8');

export function getClientBootstrapScript(appVersion: string): string {
  return template.replace('__APP_VERSION__', appVersion);
}
