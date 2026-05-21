import { writeFile, rename } from 'fs/promises';
import { writeFileSync, renameSync } from 'fs';

/**
 * Atomic file writes for generated artifacts.
 *
 * A plain `writeFile(dest, …)` truncates `dest` to 0 bytes before streaming the
 * new content. Any reader (SSR render, another pipeline step) that reads `dest`
 * during that window sees an empty/partial file and crashes with
 * `SyntaxError: Unexpected end of JSON input`.
 *
 * Writing to a sibling temp file then `rename`-ing onto the target avoids this:
 * `rename` is atomic on the same filesystem (POSIX) and replace-atomic on
 * Windows (MoveFileEx). The temp lives next to `dest`, so they share a volume.
 *
 * Call sites keep their own `JSON.stringify(...)` so the exact serialization
 * (pretty vs minified) is preserved.
 */

let seq = 0;
const tmpName = (dest: string) => `${dest}.tmp-${process.pid}-${seq++}`;

export async function writeFileAtomic(dest: string, body: string | Buffer): Promise<void> {
  const tmp = tmpName(dest);
  await writeFile(tmp, body);
  await rename(tmp, dest);
}

export function writeFileAtomicSync(dest: string, body: string | Buffer): void {
  const tmp = tmpName(dest);
  writeFileSync(tmp, body);
  renameSync(tmp, dest);
}
