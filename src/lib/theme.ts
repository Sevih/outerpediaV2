import type { ElementType, RarityType, RoleType, ChainType } from '@/types/enums';

/**
 * Maps game enums to Tailwind token class names.
 * Tokens are defined in globals.css @theme block.
 *
 * Usage: `<span className={ELEMENT_TEXT[character.element]}>Fire</span>`
 */

// ── Elements ──

export const ELEMENT_TEXT: Record<ElementType, string> = {
  Fire: 'text-fire',
  Water: 'text-water',
  Earth: 'text-earth',
  Light: 'text-light',
  Dark: 'text-dark',
};

export const ELEMENT_BG: Record<ElementType, string> = {
  Fire: 'bg-fire',
  Water: 'bg-water',
  Earth: 'bg-earth',
  Light: 'bg-light',
  Dark: 'bg-dark',
};

export const ELEMENT_BORDER: Record<ElementType, string> = {
  Fire: 'border-fire',
  Water: 'border-water',
  Earth: 'border-earth',
  Light: 'border-light',
  Dark: 'border-dark',
};

// ── Rarities (character star rating) ──

export const RARITY_TEXT: Record<RarityType, string> = {
  1: 'text-rarity-1',
  2: 'text-rarity-2',
  3: 'text-rarity-3',
};

// ── Item rarities ──

export type ItemRarity = 'normal' | 'superior' | 'epic' | 'legendary';

export const ITEM_RARITY_TEXT: Record<ItemRarity, string> = {
  normal: 'text-item-normal',
  superior: 'text-item-superior',
  epic: 'text-item-epic',
  legendary: 'text-item-legendary',
};

// ── Roles ──

export const ROLE_TEXT: Record<RoleType, string> = {
  dps: 'text-role-dps',
  support: 'text-role-support',
  sustain: 'text-role-sustain',
};

export const ROLE_BG: Record<RoleType, string> = {
  dps: 'bg-role-dps/70',
  support: 'bg-role-support/70',
  sustain: 'bg-role-sustain/70',
};

// ── Chain types ──

export const CHAIN_TEXT: Record<ChainType, string> = {
  Start: 'text-chain-start',
  Join: 'text-chain-join',
  Finish: 'text-chain-finish',
};

// ── Filters ──

export const FILTER = {
  bg: 'bg-filter-bg',
  active: 'bg-filter/25',
  hover: 'hover:bg-filter/25',
  ring: 'ring-filter-ring',
  focusRing: 'focus-visible:ring-2 focus-visible:ring-filter-ring',
} as const;
