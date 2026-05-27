import Image from 'next/image';
import Link from 'next/link';
import type { CategoryViewProps } from './types';
import type { GuideMeta } from '@/types/guide';
import type { TranslationKey } from '@/i18n';
import { lRec } from '@/lib/i18n/localize';
import { localePath } from '@/lib/navigation';
import { guideAccent } from '../guidesTheme';

type TierKey = 'first-steps' | 'pulls' | 'economy' | 'heroes-gear';

const TIERS: { key: TierKey }[] = [
  { key: 'first-steps' },
  { key: 'pulls' },
  { key: 'economy' },
  { key: 'heroes-gear' },
];

/**
 * Curriculum buckets are hand-maintained per slug — pedagogical grouping and
 * reading order are different concerns. `order` (in JSON) still drives sort.
 */
const TIER_BY_SLUG: Record<string, TierKey> = {
  'free-heroes-start-banner': 'first-steps',
  'beginner-faq': 'first-steps',
  'banner-mileage': 'pulls',
  'premium-limited': 'pulls',
  'core-fusion': 'pulls',
  'ether-income': 'economy',
  'unlock-content': 'economy',
  'shop-purchase-priorities': 'economy',
  'timegate-resource': 'economy',
  'daily-stamina': 'economy',
  'heroes-growth': 'heroes-gear',
  'gear': 'heroes-gear',
  'quirk': 'heroes-gear',
  'stats': 'heroes-gear',
};

export default function GeneralGuidesList({ guides, lang, t }: CategoryViewProps) {
  const accent = guideAccent('general-guides');

  const sorted = [...guides].sort((a, b) => a.order - b.order);
  const withTier = sorted.map((meta) => ({
    meta,
    tier: TIER_BY_SLUG[meta.slug] ?? null,
  }));

  // Bucket by tier (preserving tier order).
  const tiers = TIERS.map((def) => ({
    def,
    items: withTier.filter((x) => x.tier === def.key),
  })).filter((bucket) => bucket.items.length > 0);

  return (
    <div className="mt-6 flex flex-col gap-10">
      {tiers.map(({ def, items }) => {
        const labelKey = `guides.general.tier.${def.key}.label` as TranslationKey;
        const label = t[labelKey] ?? def.key;
        return (
          <section key={def.key} className="flex flex-col gap-5">
            <header className="relative border-b border-zinc-800 pb-3">
              <span className={`absolute -bottom-px left-0 h-0.5 w-12 rounded-full ${accent.stripe}`} aria-hidden />
              <span className={`font-mono text-[11px] font-semibold uppercase tracking-[0.18em] ${accent.text}`}>
                {label}
              </span>
            </header>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map(({ meta }) => (
                <LessonCard key={meta.slug} meta={meta} lang={lang} t={t} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function LessonCard({
  meta, lang, t,
}: {
  meta: GuideMeta;
  lang: CategoryViewProps['lang'];
  t: Record<TranslationKey, string>;
}) {
  const accent = guideAccent('general-guides');
  const title = lRec(meta.title, lang);
  const description = lRec(meta.description, lang);

  return (
    <Link
      href={localePath(lang, `/guides/${meta.category}/${meta.slug}`)}
      className={[
        'group relative flex items-start gap-3 overflow-hidden rounded-xl border border-zinc-800 bg-slate-800/50 p-4 transition-[transform,border-color,box-shadow] duration-150',
        'hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-(--color-filter-ring) focus-visible:outline-none',
        accent.hoverBorder,
        accent.glow,
      ].join(' ')}
    >
      <div
        className={[
          'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border bg-linear-to-br to-transparent',
          accent.iconBorder,
          accent.iconFrom,
        ].join(' ')}
      >
        <Image
          src={`/images/guides/${meta.icon}.webp`}
          alt={title}
          fill
          sizes="44px"
          className="object-contain p-1"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3 className="static pb-0 text-sm font-semibold tracking-tight text-zinc-100 after:hidden">
          {title}
        </h3>
        {description && (
          <p className="text-xs text-zinc-400">{description}</p>
        )}
        <div className="mt-auto flex items-center justify-between gap-3 pt-2 font-mono text-[9.5px] uppercase tracking-[0.12em] text-zinc-500">
          <span>{t['page.guide.by'].replace('{author}', meta.author)}</span>
          <span>{meta.last_updated}</span>
        </div>
      </div>
    </Link>
  );
}
