/** Canonical star icon paths — single source of truth */
export const STAR_ICONS = {
  g: '/images/ui/star/CM_icon_star_w.webp',
  y: '/images/ui/star/CM_icon_star_y.webp',
  o: '/images/ui/star/CM_icon_star_o.webp',
  r: '/images/ui/star/CM_icon_star_r.webp',
  p: '/images/ui/star/CM_icon_star_v.webp',
} as const;

export type StarColor = keyof typeof STAR_ICONS;

/**
 * Full 6-star row for a transcendence level ID.
 * Always returns 6 entries (gray stars as placeholders).
 * Used by TranscendenceSlider and TranscendDisplay.
 */
export function starRowForLevel(
  lv: string,
): StarColor[] {
  switch (lv) {
    case '1':          return ['y', 'g', 'g', 'g', 'g', 'g'];
    case '2':          return ['y', 'y', 'g', 'g', 'g', 'g'];
    case '3':          return ['y', 'y', 'y', 'g', 'g', 'g'];
    case '4': case '4_1': return ['y', 'y', 'y', 'y', 'g', 'g'];
    case '4_2':        return ['y', 'y', 'y', 'o', 'g', 'g'];
    case '5': case '5_1': return ['y', 'y', 'y', 'y', 'y', 'g'];
    case '5_2':        return ['y', 'y', 'y', 'y', 'r', 'g'];
    case '5_3':        return ['y', 'y', 'y', 'y', 'p', 'g'];
    case '6':          return ['y', 'y', 'y', 'y', 'y', 'y'];
    default:           return ['g', 'g', 'g', 'g', 'g', 'g'];
  }
}

/**
 * Compact star row for display labels like "3", "4+", "5++".
 * Returns only the filled stars (no gray placeholders).
 * Used by premium-limited and gear guides.
 */
export function starRowForLabel(label: string): StarColor[] {
  switch (label) {
    case '1':   return ['y'];
    case '2':   return ['y', 'y'];
    case '3':   return ['y', 'y', 'y'];
    case '4':   return ['y', 'y', 'y', 'y'];
    case '4+':  return ['y', 'y', 'y', 'o'];
    case '5':   return ['y', 'y', 'y', 'y', 'y'];
    case '5+':  return ['y', 'y', 'y', 'y', 'r'];
    case '5++': return ['y', 'y', 'y', 'y', 'p'];
    case '6':   return ['y', 'y', 'y', 'y', 'y', 'y'];
    default:    return [];
  }
}
