export type CategoryAccentKey = 'rankings' | 'equipment' | 'simulators' | 'info' | 'media';

export type CategoryAccent = {
  text: string;
  dot: string;
  stripe: string;
  iconBorder: string;
  iconFrom: string;
  hoverBorder: string;
  tabActiveBorder: string;
  tabActiveBg: string;
  tabActiveText: string;
  tabActiveCount: string;
  featuredBorder: string;
  featuredFrom: string;
};

/**
 * Per-category accent classes. Tailwind v4 requires literal class strings,
 * so every value here must be a concrete utility name — no concatenation.
 */
export const CATEGORY_ACCENT: Record<CategoryAccentKey, CategoryAccent> = {
  rankings: {
    text: 'text-rose-300',
    dot: 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.6)]',
    stripe: 'bg-rose-400',
    iconBorder: 'border-rose-500/30',
    iconFrom: 'from-rose-500/15',
    hoverBorder: 'hover:border-rose-500/40',
    tabActiveBorder: 'border-rose-500/60',
    tabActiveBg: 'bg-rose-500/10',
    tabActiveText: 'text-rose-300',
    tabActiveCount: 'text-rose-300/70',
    featuredBorder: 'border-rose-500/30',
    featuredFrom: 'from-rose-500/10',
  },
  equipment: {
    text: 'text-amber-300',
    dot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]',
    stripe: 'bg-amber-400',
    iconBorder: 'border-amber-500/30',
    iconFrom: 'from-amber-500/15',
    hoverBorder: 'hover:border-amber-500/40',
    tabActiveBorder: 'border-amber-500/60',
    tabActiveBg: 'bg-amber-500/10',
    tabActiveText: 'text-amber-300',
    tabActiveCount: 'text-amber-300/70',
    featuredBorder: 'border-amber-500/30',
    featuredFrom: 'from-amber-500/10',
  },
  simulators: {
    text: 'text-cyan-300',
    dot: 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]',
    stripe: 'bg-cyan-400',
    iconBorder: 'border-cyan-500/30',
    iconFrom: 'from-cyan-500/15',
    hoverBorder: 'hover:border-cyan-500/40',
    tabActiveBorder: 'border-cyan-500/60',
    tabActiveBg: 'bg-cyan-500/10',
    tabActiveText: 'text-cyan-300',
    tabActiveCount: 'text-cyan-300/70',
    featuredBorder: 'border-cyan-500/30',
    featuredFrom: 'from-cyan-500/10',
  },
  info: {
    text: 'text-violet-300',
    dot: 'bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.6)]',
    stripe: 'bg-violet-400',
    iconBorder: 'border-violet-500/30',
    iconFrom: 'from-violet-500/15',
    hoverBorder: 'hover:border-violet-500/40',
    tabActiveBorder: 'border-violet-500/60',
    tabActiveBg: 'bg-violet-500/10',
    tabActiveText: 'text-violet-300',
    tabActiveCount: 'text-violet-300/70',
    featuredBorder: 'border-violet-500/30',
    featuredFrom: 'from-violet-500/10',
  },
  media: {
    text: 'text-pink-300',
    dot: 'bg-pink-400 shadow-[0_0_8px_rgba(244,114,182,0.6)]',
    stripe: 'bg-pink-400',
    iconBorder: 'border-pink-500/30',
    iconFrom: 'from-pink-500/15',
    hoverBorder: 'hover:border-pink-500/40',
    tabActiveBorder: 'border-pink-500/60',
    tabActiveBg: 'bg-pink-500/10',
    tabActiveText: 'text-pink-300',
    tabActiveCount: 'text-pink-300/70',
    featuredBorder: 'border-pink-500/30',
    featuredFrom: 'from-pink-500/10',
  },
};

export const FLAGSHIP_SLUGS = ['tierlistpve', 'progress-tracker', 'coupon-codes'] as const;
export type FlagshipSlug = (typeof FLAGSHIP_SLUGS)[number];

export const FLAGSHIP_RIBBON: Record<FlagshipSlug, 'most_used' | 'community_pick' | 'new'> = {
  tierlistpve: 'most_used',
  'progress-tracker': 'community_pick',
  'coupon-codes': 'new',
};
