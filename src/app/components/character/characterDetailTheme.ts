import type { ElementType } from '@/types/enums';

/**
 * Per-element accent for the character detail "editorial" layout.
 * Hexes mirror the globals.css --color-* element tokens. The accent is used
 * as a signature (section numbers, eyebrows, hairline dividers, hero name
 * glyph, key value highlights) — never as a fill.
 */
export const ELEMENT_HEX: Record<ElementType, string> = {
  Fire: '#ff6b6b',
  Water: '#4dabf7',
  Earth: '#51cf66',
  Light: '#ffe066',
  Dark: '#cc5de8',
};

export type ElementAccent = {
  hex: string;
  /** 0–255 alpha-hex helpers for inline gradients/borders */
  glow: string;
  soft: string;
  softer: string;
  border: string;
};

export function elementAccent(element: ElementType): ElementAccent {
  const hex = ELEMENT_HEX[element] ?? ELEMENT_HEX.Fire;
  return {
    hex,
    glow: `${hex}66`,
    soft: `${hex}14`,
    softer: `${hex}08`,
    border: `${hex}55`,
  };
}
