// Build the tooltip discovery map used to derive custom effect labels
// (e.g. "HARMONY_DESPAIR", "HEAVY_STRIKE") from TooltipTemplet rows.

import type { BuffRow, TooltipEntry } from './types'

/**
 * Normalize a raw English name into a safe label key.
 * - Apostrophes (straight `'` and curly `’`) are DROPPED (not replaced)
 *   so "Bane's Domain" → "BANES_DOMAIN", not "BANE_S_DOMAIN".
 * - Uppercase
 * - Any remaining non `[A-Z0-9_]` run (whitespace, punctuation, etc.)
 *   collapses to a single `_`
 * - Leading/trailing underscores trimmed
 *
 * Example: `Bane’s Domain`        → `BANES_DOMAIN`
 *          `Defense System: Sigma Dome` → `DEFENSE_SYSTEM_SIGMA_DOME`
 *          `Spatial Distortion (Self)`  → `SPATIAL_DISTORTION_SELF`
 */
export function sanitizeTooltipLabel(raw: string): string {
  return raw
    .replace(/['\u2019\u2018]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

/**
 * Build the tooltip map from TooltipTemplet rows + a TextSystem index.
 * The label is the English name, normalized via `sanitizeTooltipLabel`.
 *
 * `englishCol` is the TextSystem column name for English text (differs
 * between tables, usually 'English'). Passed in so this module stays
 * independent of the caller's constants.
 */
export function buildTooltipMap(
  tooltipRows: BuffRow[],
  textSystemIndex: Map<string, BuffRow>,
  englishCol = 'English'
): Map<string, TooltipEntry> {
  const map = new Map<string, TooltipEntry>()
  for (const tt of tooltipRows) {
    if (!tt.ID) continue
    const nameEntry = tt.NameID ? textSystemIndex.get(tt.NameID) : undefined
    const raw = nameEntry?.[englishCol] ?? tt.NameID ?? ''
    map.set(tt.ID, { name: sanitizeTooltipLabel(raw), isDebuff: tt.IsDebuff === 'True' })
  }
  return map
}
