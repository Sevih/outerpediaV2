'use client';

// Shared primitives for the equipment detail page (Console direction).
// Single source of truth — used by EquipmentDetailInteractive (the default live view).

import { useState } from 'react';
import Link from 'next/link';
import type { ArmorSetStatRanges } from '@/lib/data/equipment';
import type { ArmorPiece } from '@/lib/data/stat-ranges-v2';
import { getBonusEffectsForSlot, ASCENSION_STEPS, ASCENSION_INIT, ASCENSION_TOTAL_RATE, GRADES, type BonusEffect, type Grade } from '@/lib/data/ascension';
import type { Lang } from '@/lib/i18n/config';
import type { LangMap } from '@/types/common';
import { useI18n } from '@/lib/contexts/I18nContext';
import CharacterPortrait from '@/app/components/character/CharacterPortrait';
import ItemInline from '@/app/components/inline/ItemInline';
import FitText from '@/app/components/ui/FitText';
import type { ItemRarity } from '@/lib/theme';

// ── Console direction tokens ──
// Accent is driven by item RARITY (real equipment has no element). Hex values
// mirror the repo theme (globals.css @theme · item-rarity tokens).
export const RARITY_HEX: Record<ItemRarity, string> = {
  normal: '#e5e7eb',
  superior: '#4ade80',
  epic: '#93c5fd',
  legendary: '#f87171',
};
export const ELEMENT_HEX: Record<string, string> = {
  Fire: '#ff6b6b', Water: '#4dabf7', Earth: '#51cf66', Light: '#ffe066', Dark: '#cc5de8',
};
export const BUFF_HEX = '#38bdf8';
export const STAT_HEX = '#fbbf24';
export const FUCHSIA_HEX = '#f0abfc';

export type CharacterRef = {
  id: string;
  name: string;
  slug: string | null;
  element: string | null;
  classType: string | null;
};

// ── Console shell primitives ──

// Module descriptor used to assemble the dashboard grid.
export type EDModule = { key: string; title: string; span?: 1 | 2; ascension?: boolean; node: React.ReactNode };

export function Module({ title, span, ascension, children }: {
  title: string; span?: 1 | 2; ascension?: boolean; accentHex: string; children: React.ReactNode;
}) {
  return (
    <section
      className={`flex min-w-0 flex-col overflow-hidden rounded-lg border ${ascension ? 'border-fuchsia-700/30' : 'border-zinc-700/50'} ${span === 2 ? 'md:col-span-2' : ''}`}
      style={{ backgroundColor: '#0f172bcc' }}
    >
      <div className="flex items-center gap-2 border-b border-white/5 px-3.5 py-2.5" style={{ background: '#1e293980' }}>
        <span className="flex-1 text-xs font-bold uppercase tracking-wider text-white">{title}</span>
      </div>
      <div className="flex-1 p-4">{children}</div>
    </section>
  );
}

// Flat character reference for compact grids (recommended-for in the live view): no card
// frame, just the portrait + name. Links to the character page when a slug is available.
export function CharacterRefInline({ char }: { char: CharacterRef }) {
  const { href } = useI18n();
  const content = (
    <div className="flex flex-col items-center gap-1.5">
      <CharacterPortrait id={char.id} name={char.name} size="md" showIcons />
      <div className="w-full text-center text-sm font-bold text-zinc-100">
        <FitText max={14} min={9}>{char.name}</FitText>
      </div>
    </div>
  );
  if (char.slug) return <Link href={href(`/characters/${char.slug}`)} className="transition-opacity hover:opacity-80">{content}</Link>;
  return content;
}

// ── Armor piece labels ──

export const ARMOR_PIECE_I18N: Record<string, string> = {
  Helmet: 'equip.detail.piece.helmet',
  Armor: 'equip.detail.piece.armor',
  Gloves: 'equip.detail.piece.gloves',
  Shoes: 'equip.detail.piece.shoes',
};

// ── Singularity Ascension ──
// Labels live inline as LangMaps (matching the convention used by gear/index.tsx).

export const ASCENSION_LABELS = {
  title: { en: 'Singularity Ascension', jp: '特異点昇華', kr: '특이점 승화', zh: '奇点升华' },
} satisfies Record<string, LangMap>;

// ── Singularity Ascension — interactive "Ledger" panel ──
// Recreated from the Claude Design "Version A — Ledger" handoff, with the user's tweaks:
// no main-stat multiplier, no section numbers, and an interactive bonus-effect prize
// (pick a grade C→S+ to read its value). Wired to the real ascension data.
const ASC_GOLD_FMT = new Intl.NumberFormat('en');
const ASC_PCT_FMT = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });
const ascSuccessPct = (v: number) => `${ASC_PCT_FMT.format(v * 100)}%`;
const ascSuccessHex = (v: number) => (v >= 0.8 ? '#4ade80' : v >= 0.5 ? '#fbbf24' : '#f87171');
// Singularity is legendary-6★ only, so the materials are fixed.
const ASC_CHIP_ITEM = 'High-Precision Chip';
const ASC_HAMMER_ITEM = "Artisan's Hammer";
// In-game Singularity grade ladder colors (C→S+). The vertical cyan→violet→magenta
// gradient still lives on the hero name when ascended (see EquipmentDetailInteractive),
// but is no longer used as a decorative background in this panel.
const AX_CYAN = '#16EBF1', AX_VIOLET = '#9D51FF', AX_MAGENTA = '#E02BCD';
const AX_GRADE_COLOR: Record<Grade, string> = { C: AX_CYAN, B: '#5E86F4', A: AX_VIOLET, S: '#C13BDE', 'S+': AX_MAGENTA };

function AxEyebrow({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-300">{children}</div>;
}

function AxActivationBand() {
  const init = ASCENSION_INIT;
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/40 px-2 py-3.5">
      <div className="mb-3"><AxEyebrow>Activation cost</AxEyebrow></div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <span className="inline-flex items-center gap-1.5"><span className="font-mono font-bold text-amber-300/90">{ASC_GOLD_FMT.format(init.gold)}</span><ItemInline name="Gold" /></span>
        <span className="inline-flex items-center gap-1.5"><span className="font-mono font-bold text-zinc-200">×{init.chip}</span><ItemInline name={ASC_CHIP_ITEM} /></span>
        <span className="inline-flex items-center gap-1.5"><span className="font-mono font-bold text-zinc-200">×{init.hammer}</span><ItemInline name={ASC_HAMMER_ITEM} /></span>
      </div>
    </div>
  );
}

function AxStepsTable() {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <th className="pb-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Step</th>
          <th className="whitespace-nowrap pb-1.5 pl-3 text-right text-xs font-normal text-zinc-400"><ItemInline name="Gold" /></th>
          <th className="whitespace-nowrap pb-1.5 pl-3 text-right text-xs font-normal text-zinc-400"><ItemInline name={ASC_CHIP_ITEM} /></th>
          <th className="whitespace-nowrap pb-1.5 pl-3 text-right text-xs font-normal text-zinc-400"><ItemInline name={ASC_HAMMER_ITEM} /></th>
          <th className="pb-1.5 pl-3 text-right text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Chance</th>
        </tr>
      </thead>
      <tbody>
        {ASCENSION_STEPS.map((s) => {
          const c = ascSuccessHex(s.success);
          return (
            <tr key={s.to} className="border-t border-white/5">
              <td className="whitespace-nowrap py-2 align-middle font-mono text-sm font-bold text-zinc-100">+{s.to}</td>
              <td className="whitespace-nowrap py-2 pl-3 text-right align-middle font-mono text-xs tabular-nums text-amber-300/90">{ASC_GOLD_FMT.format(s.gold)}</td>
              <td className="whitespace-nowrap py-2 pl-3 text-right align-middle font-mono text-xs tabular-nums text-zinc-300">×{s.chip}</td>
              <td className="whitespace-nowrap py-2 pl-3 text-right align-middle font-mono text-xs tabular-nums text-zinc-300">×{s.hammer}</td>
              <td className="whitespace-nowrap py-2 pl-3 text-right align-middle font-mono text-sm font-bold tabular-nums" style={{ color: c }}>{ascSuccessPct(s.success)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function AxBonusRow({ effect, sel, lang }: { effect: BonusEffect; sel: Grade; lang: Lang }) {
  const name = effect.name[lang] ?? effect.name.en ?? effect.key;
  const chance = ASC_PCT_FMT.format((effect.rate / ASCENSION_TOTAL_RATE) * 100);
  const row = effect.grades[sel];
  const c = AX_GRADE_COLOR[sel];
  const split = row?.rangeAlt && effect.splitLabels;
  return (
    <div className="ax-bonus flex flex-col gap-2 rounded-lg border px-3 py-3" style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(4,6,12,0.5)' }}>
      <div className="flex items-start justify-between gap-2.5">
        <span className="text-[13px] font-medium leading-snug text-zinc-100">{name}</span>
        <span className="shrink-0 font-mono text-[13px] font-bold tabular-nums text-zinc-100">{chance}%</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded px-1 font-mono text-[10.5px] font-bold" style={{ border: `1px solid ${c}aa`, background: `${c}26`, color: c }}>{sel}</span>
        <span className="font-mono text-sm font-bold tabular-nums" style={{ color: c }}>
          {row?.range ?? '—'}
          {split && <span className="ml-1 text-[10px] font-normal text-zinc-500">({effect.splitLabels!.primary})</span>}
        </span>
        {split && (
          <span className="font-mono text-sm font-bold tabular-nums" style={{ color: c }}>
            / {row!.rangeAlt}<span className="ml-1 text-[10px] font-normal text-zinc-500">({effect.splitLabels!.alt})</span>
          </span>
        )}
        {row && <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums text-zinc-400">{row.rate}%</span>}
      </div>
    </div>
  );
}

function AxBonusColumn({ effects, lang }: { effects: readonly BonusEffect[]; lang: Lang }) {
  const [sel, setSel] = useState<Grade>('S+');
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <AxEyebrow>Bonus effect · unlocked at +15</AxEyebrow>
        <div className="inline-flex items-center gap-1.5">
          <span className="mr-1 text-[9.5px] uppercase tracking-wider text-zinc-300">Grade</span>
          {GRADES.map((g) => {
            const c = AX_GRADE_COLOR[g];
            const on = g === sel;
            return (
              <button key={g} type="button" onClick={() => setSel(g)} aria-pressed={on}
                className="inline-flex h-5 min-w-5 cursor-pointer items-center justify-center rounded px-1 font-mono text-[10.5px] font-bold transition-all"
                style={{
                  border: `1px solid ${on ? c + 'aa' : 'rgba(255,255,255,0.1)'}`,
                  background: on ? `${c}26` : 'transparent',
                  color: on ? c : '#d4d4d8',
                }}>{g}</button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {effects.map((e) => <AxBonusRow key={e.key} effect={e} sel={sel} lang={lang} />)}
      </div>
    </div>
  );
}

function AscensionLedger({ slot, lang }: { slot: string; lang: Lang }) {
  const effects = getBonusEffectsForSlot(slot);
  return (
    <div className={`grid grid-cols-1 items-start gap-4 ${effects.length > 0 ? 'md:grid-cols-2' : ''}`}>
      <div className="flex flex-col gap-4">
        <AxActivationBand />
        <AxStepsTable />
      </div>
      {effects.length > 0 && <AxBonusColumn effects={effects} lang={lang} />}
    </div>
  );
}

/** Ascension content for single-item slots (weapons + accessories). Renders the
 *  interactive Ledger panel: activation band + gamble ladder + interactive bonus pool. */
export function AscensionContent({ slot, ascendedRanges, lang }: {
  slot: 'weapons' | 'accessories';
  standardRanges: Record<string, [number, number]> | null;
  ascendedRanges: Record<string, number> | null;
  lang: Lang;
}) {
  if (!ascendedRanges || Object.keys(ascendedRanges).length === 0) return null;
  return <AscensionLedger slot={slot} lang={lang} />;
}

/** Ascension content for armor sets. Same Ledger panel shape, scoped to the set's
 *  defensive bonus pool. */
export function AscensionContentForSet({ ascendedRanges, lang }: {
  standardRanges: ArmorSetStatRanges | null;
  ascendedRanges: Record<ArmorPiece, Record<string, number>> | null;
  lang: Lang;
}) {
  if (!ascendedRanges) return null;
  const pieces: ArmorPiece[] = ['Helmet', 'Armor', 'Gloves', 'Shoes'];
  if (!pieces.some((p) => ascendedRanges[p] && Object.keys(ascendedRanges[p]).length > 0)) return null;
  return <AscensionLedger slot="Helmet" lang={lang} />;
}
