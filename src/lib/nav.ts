import type { TranslationKey } from '@/i18n';

export type NavItem = {
  key: TranslationKey;
  shortKey: TranslationKey;
  href: string;
  icon: string;
};

/** Main navigation items (header + search) */
export const NAV_ITEMS: NavItem[] = [
  { key: 'nav.characters', shortKey: 'nav.characters.short', href: '/characters', icon: 'CM_EtcMenu_Colleague' },
  { key: 'nav.equipment', shortKey: 'nav.equipment.short', href: '/equipment', icon: 'CM_EtcMenu_Inventory' },
  { key: 'nav.tierlist', shortKey: 'nav.tierlist.short', href: '/tierlist', icon: 'CM_Mission_Icon_Weekly' },
  { key: 'nav.utilities', shortKey: 'nav.utilities.short', href: '/tools', icon: 'CM_EtcMenu_Setting' },
  { key: 'nav.guides', shortKey: 'nav.guides.short', href: '/guides', icon: 'CM_EtcMenu_Character_Book' },
];

/** Extra pages searchable but not in main nav */
export const EXTRA_PAGES: { key: TranslationKey; href: string }[] = [
  { key: 'page.coupons.title', href: '/coupons' },
  { key: 'page.contributors.title', href: '/contributors' },
];

/** All searchable pages */
export const ALL_PAGES: { key: TranslationKey; href: string }[] = [
  ...NAV_ITEMS.map(({ key, href }) => ({ key, href })),
  ...EXTRA_PAGES,
];
