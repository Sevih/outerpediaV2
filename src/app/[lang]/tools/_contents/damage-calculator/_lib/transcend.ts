/**
 * Transcend label helpers — shared between the damage dealer's
 * `TranscendControl` (full UI with bonuses) and the team slot's compact
 * inline slider. Pure functions of `(transStar, basicStar)`.
 */

/**
 * Map raw `TransStar` (3-9 for 3★ chars, 2-9 for 2★) to an in-game tier
 * label like `'3' / '4_1' / '4_2' / '5_1' / '5_2' / '5_3' / '6'`.
 *
 * The branching only kicks in once we've passed the BasicStar tier; the
 * first 1-2 tiers are linear (`'2' → '3'`). Past that, every two templet
 * rows correspond to one in-game tier branch (4, 4+, 5, 5+, 5++).
 */
export function transStarToLevelId(transStar: number, basicStar: number): string {
  if (transStar === basicStar) return String(basicStar)
  if (basicStar === 2 && transStar === 3) return '3'
  switch (transStar) {
    case 4: return '4_1'
    case 5: return '4_2'
    case 6: return '5_1'
    case 7: return '5_2'
    case 8: return '5_3'
    case 9: return '6'
    default: return String(transStar)
  }
}

/** Friendly compact label for the slider readout (`4 / 4+ / 5 / 5+ / 5++ / 6`). */
export const TRANSCEND_LEVEL_DISPLAY: Record<string, string> = {
  '1': '1', '2': '2', '3': '3',
  '4': '4', '4_1': '4', '4_2': '4+',
  '5': '5', '5_1': '5', '5_2': '5+', '5_3': '5++',
  '6': '6',
}

/** Resolve the compact tier label (`'5+'` etc.) for a given `transStar`. */
export function transcendLabel(transStar: number, basicStar: number): string {
  const id = transStarToLevelId(transStar, basicStar)
  return TRANSCEND_LEVEL_DISPLAY[id] ?? String(transStar)
}
