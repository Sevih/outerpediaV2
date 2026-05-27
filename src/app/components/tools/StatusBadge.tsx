import type { TranslationKey } from '@/i18n';

type Status = 'coming-soon' | 'hidden' | 'unlisted';

type Props = {
  status: Status;
  t: Record<TranslationKey, string>;
};

/**
 * Status badge with a glyph + monospace label.
 * - coming-soon: zinc tones + clock glyph
 * - hidden (DEV): amber tones + glowing dot
 * - unlisted: sky tones + eye-off glyph
 */
export default function StatusBadge({ status, t }: Props) {
  if (status === 'coming-soon') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-700/60 bg-zinc-800/60 px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
        <ClockGlyph />
        {t['common.coming_soon']}
      </span>
    );
  }

  if (status === 'hidden') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.12em] text-amber-300">
        <span className="size-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)]" />
        DEV
      </span>
    );
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-sky-500/50 bg-sky-500/10 px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.12em] text-sky-300">
      <EyeOffGlyph />
      UNLISTED
    </span>
  );
}

function ClockGlyph() {
  return (
    <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <circle cx="6" cy="6" r="4.2" />
      <path d="M6 3.5V6l1.5 1.2" />
    </svg>
  );
}

function EyeOffGlyph() {
  return (
    <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <path d="M2 6c1.5-2.5 3-4 4-4s2.5 1.5 4 4M2 6c1.5 2.5 3 4 4 4s2.5-1.5 4-4M2 2l8 8" />
    </svg>
  );
}
