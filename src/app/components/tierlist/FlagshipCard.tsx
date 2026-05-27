import Image from 'next/image';
import Link from 'next/link';
import type { Lang } from '@/lib/i18n/config';
import type { TranslationKey } from '@/i18n';
import { localePath } from '@/lib/navigation';
import CharacterPortrait from '@/app/components/character/CharacterPortrait';
import { FLAGSHIP_ACCENT, type FlagshipKey } from './tierlistTheme';

export type FlagshipTopHero = {
  /** Character ID (used to render the portrait). */
  id: string;
  /** Localized name (for alt + tooltip). */
  name: string;
};

type Props = {
  flagship: FlagshipKey;
  description: string;
  href: string;
  lang: Lang;
  t: Record<TranslationKey, string>;
  topHeroes: FlagshipTopHero[];
  /** Side controls which corner the art panel pushes the portraits to. */
  side: 'left' | 'right';
};

export default function FlagshipCard({
  flagship, description, href, lang, t, topHeroes, side,
}: Props) {
  const accent = FLAGSHIP_ACCENT[flagship];
  const eyebrow = flagship === 'pve' ? 'PVE' : 'PVP';
  const previewLabel = t['tierlist.versus.preview'];
  const viewLabel = `${t['tierlist.versus.view']} ${eyebrow}`;

  return (
    <Link
      href={localePath(lang, href)}
      className={[
        'group relative flex flex-1 flex-col gap-4 overflow-hidden rounded-2xl border p-5 transition-[transform,border-color,box-shadow] duration-150 md:p-6',
        'hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-(--color-filter-ring) focus-visible:outline-none',
        accent.border,
        accent.surface,
        accent.borderHover,
        accent.glow,
      ].join(' ')}
    >
      {/* Art panel: huge tier glyph in the background + dense portrait cluster */}
      <div className="relative h-40 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 md:h-40">
        {/* Background gradient tinted by accent */}
        <div
          className={[
            'absolute inset-0 opacity-80',
            side === 'left'
              ? 'bg-radial-[at_85%_50%]'
              : 'bg-radial-[at_15%_50%]',
            accent.radialFrom,
            'to-transparent',
          ].join(' ')}
          aria-hidden
        />
        {/* Striped texture */}
        <div
          className="absolute inset-0 opacity-30 bg-[repeating-linear-gradient(135deg,#16161c_0_14px,#101015_14px_28px)]"
          aria-hidden
        />
        {/* Big "S" rank image (matches the in-game tier-list look) */}
        <div
          aria-hidden
          className={[
            'pointer-events-none absolute top-2',
            side === 'left' ? 'left-2' : 'right-2',
          ].join(' ')}
        >
          <Image
            src="/images/ui/rank/IG_Event_Rank_S.webp"
            alt=""
            width={112}
            height={112}
            className="h-24 w-24 object-contain opacity-60 drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] md:h-28 md:w-28"
          />
        </div>

        {/* Portrait cluster — 2 rows that span the remaining panel width */}
        <div
          className={[
            'absolute inset-y-4 flex flex-col justify-center gap-1.5 transition-transform duration-200 group-hover:-translate-y-0.5',
            side === 'left' ? 'right-3 left-28 items-end md:left-32' : 'left-3 right-28 items-start md:right-32',
          ].join(' ')}
        >
          {/* Back row — small, slightly faded */}
          <div className={`flex items-center gap-1 opacity-80 ${side === 'left' ? 'flex-row-reverse' : ''}`}>
            {topHeroes.slice(5, 10).map((h) => (
              <CharacterPortrait key={`back-${h.id}`} id={h.id} name={h.name} size="xs" />
            ))}
          </div>
          {/* Front row — bigger, lead anchored to the corner. */}
          <div className={`flex items-end gap-1.5 ${side === 'left' ? 'flex-row-reverse' : ''}`}>
            {topHeroes.slice(0, 5).map((h) => (
              <CharacterPortrait
                key={`front-${h.id}`}
                id={h.id}
                name={h.name}
                size="sm"
              />
            ))}
          </div>
        </div>

        {/* Corner label */}
        <div
          className={[
            'absolute bottom-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500',
            side === 'left' ? 'left-3' : 'right-3',
          ].join(' ')}
        >
          {previewLabel}
        </div>
      </div>

      {/* Title block */}
      <div>
        <h2 className={`flex items-baseline gap-2 text-2xl font-bold tracking-tight text-zinc-50 after:hidden md:text-3xl`}>
          <span>Tier List</span>
          <span className="text-base font-medium text-zinc-500">·</span>
          <span className={accent.text}>{eyebrow}</span>
        </h2>
        <p className="mt-2 max-w-xl text-sm text-zinc-400">{description}</p>
      </div>

      {/* CTA */}
      <div className="mt-auto flex justify-end">
        <span
          className={[
            'inline-flex items-center gap-1.5 rounded-lg border bg-slate-900/80 px-3 py-1.5 text-xs font-medium transition-colors',
            accent.pillBorder,
            accent.text,
          ].join(' ')}
        >
          {viewLabel}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
