'use client';

// Interactive progression preview (Console direction · "live" layer).
// Gated behind ?build=live by EquipmentDetailClient. Renders client-only.
//
// Driven by REAL data: data/equipment/item-stats-detail.json via the data layer
// (getItemLiveDetail → liveDetail prop). Mechanics:
//   • Enhancement 0→10 (→15 if canAscend, Singularity) → main stat(s)
//   • Breakthrough T0→T4 → main stat(s) + passive/effect text
//   • Reforge 0→N (N = stars, +3 if 6★) → secondary stats only (from the real pool,
//     excluding fixed mains + the chosen choice-main)
// EE has no datamine detail → falls back to the eeStatRange/curated effect.

import { useState, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { ArmorPiece } from '@/lib/data/stat-ranges-v2';
import type { LangMap } from '@/types/common';
import type { Lang } from '@/lib/i18n/config';
import type { ItemRarity } from '@/lib/theme';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l, lRec } from '@/lib/i18n/localize';
import EquipmentIcon from '@/app/components/equipment/EquipmentIcon';
import EquipmentSource from '@/app/components/equipment/EquipmentSource';
import BuffDebuffDisplay from '@/app/components/character/BuffDebuffDisplay';
import StatInline from '@/app/components/inline/StatInline';
import { formatEffectText, getRarityBgPath } from '@/lib/format-text';
import { useBreadcrumbOverride } from '@/lib/contexts/BreadcrumbContext';
import { makeFormula, renderPassive, renderSetEffect, type LiveMainSlot, type LiveSubOpt, type LivePassive, type LiveSetPassive, type LiveSetEffectBlock } from '@/lib/equipment-formula';
import {
  RARITY_HEX, STAT_HEX, BUFF_HEX, ASCENSION_LABELS,
  ARMOR_PIECE_I18N, Module, CharacterRefCard, AscensionContent, AscensionContentForSet,
} from './equipment-console-shared';
import type { EquipmentViewProps } from './EquipmentDetailClient';

// Control-surface labels — inline LangMaps (preview-only).
const LIVE_LABELS = {
  configure:    { en: 'Configure',    jp: '設定',     kr: '설정',   zh: '配置' },
  enhancement:  { en: 'Enhancement',  jp: '強化',     kr: '강화',   zh: '强化' },
  breakthrough: { en: 'Breakthrough', jp: '突破',     kr: '돌파',   zh: '突破' },
  level:        { en: 'Level',        jp: 'レベル',   kr: '레벨',   zh: '等级' },
  reforge:      { en: 'Reforge',      jp: '再錬成',   kr: '재연성', zh: '重铸' },
  substats:     { en: 'Substats',     jp: 'サブステ', kr: '부옵션', zh: '副属性' },
  tier:         { en: 'Tier',         jp: 'ティア',   kr: '티어',   zh: '阶' },
  ascend:       { en: 'Ascend',       jp: '昇華',     kr: '승화',   zh: '升华' },
  ascended:     { en: 'Ascended',     jp: '昇華済',   kr: '승화됨', zh: '已升华' },
} satisfies Record<string, LangMap>;

const lerpRound = (f: number, p: number, b: number) => Math.round(f + (p - f) * b);
const FUCHSIA_HEX = '#f0abfc';

type EffectModel = { name: string | null; icon: string | null; isBuff: boolean; steps: { from: number; text: string }[] } | null;

type LiveModel = {
  type: 'weapon' | 'accessory' | 'talisman' | 'armor' | 'ee' | 'none';
  useTiers: boolean;
  star: number;
  canAscend: boolean;
  enhMin: number;
  maxEnhBase: number;     // standard enhancement cap (10); ascension extends to +15
  reforgeBase: number;    // base reforge attempts (= stars); 0 if no substat pool
  reforgeBonus: number;   // extra reforge attempts granted by ascension
  maxSubStats: number;
  mains: LiveMainSlot[];
  pool: LiveSubOpt[];
  excluded: string[];
  passive: LivePassive;
  pieces: { slot: ArmorPiece; mains: LiveMainSlot[]; pool: LiveSubOpt[]; excluded: string[] }[];
  setPassive: LiveSetPassive;
  effect: EffectModel;          // curated fallback (weapon/talisman) or EE effect
  eeMain: { label: string; range: [number, number] } | null;
};

type SrcLike = { source?: string | null; boss?: string | string[] | null };
type CuratedSrc = { effect_name?: string | null; effect_icon?: string | null; effect_desc1?: string | null; effect_desc4?: string | null };

function curatedEffect(data: CuratedSrc, lang: Lang, thresholds: [number, number], isBuff: boolean): EffectModel {
  const name = data.effect_name ? l(data, 'effect_name', lang) : null;
  const t0 = data.effect_desc1 ? l(data, 'effect_desc1', lang) : null;
  const t4 = data.effect_desc4 ? l(data, 'effect_desc4', lang) : null;
  const steps: { from: number; text: string }[] = [];
  if (t0) steps.push({ from: thresholds[0], text: t0 });
  if (t4 && t4 !== t0) steps.push({ from: thresholds[1], text: t4 });
  if (!name && steps.length === 0) return null;
  return { name, icon: data.effect_icon ?? null, isBuff, steps };
}

function buildModel(props: EquipmentViewProps): LiveModel {
  const { equipment, liveDetail, eeStatRange, lang } = props;
  const blank: LiveModel = {
    type: 'none', useTiers: false, star: 0, canAscend: false, enhMin: 0, maxEnhBase: 10, reforgeBase: 0, reforgeBonus: 0, maxSubStats: 4,
    mains: [], pool: [], excluded: [], passive: null, pieces: [], setPassive: null, effect: null, eeMain: null,
  };

  if (liveDetail) {
    const it = liveDetail.item;
    const maxSubStats = liveDetail.meta.constants.reforge.maxSubStats;
    const reforgeBonus = liveDetail.meta.constants.singularity.reforgeBonus ?? 0;
    if (it.kind === 'weapon' || it.kind === 'accessory') {
      const hasPool = (it.subPool ?? []).length > 0;
      return {
        ...blank, type: it.kind, useTiers: true, star: it.star, canAscend: it.canAscend,
        reforgeBase: hasPool ? it.star : 0, reforgeBonus, maxSubStats,
        mains: it.mainStats ?? [], pool: it.subPool ?? [], excluded: it.excludedSubStats ?? [], passive: it.passive ?? null,
        effect: curatedEffect(equipment.data as CuratedSrc, lang, [0, 4], false),
      };
    }
    if (it.kind === 'talisman') {
      return {
        ...blank, type: 'talisman', useTiers: false, star: it.star, canAscend: false, maxSubStats,
        mains: it.mainStats ?? [],
        effect: curatedEffect(equipment.data as CuratedSrc, lang, [0, 10], true),
      };
    }
    if (it.kind === 'armor') {
      const hasPool = (it.pieces ?? []).some((p) => p.subPool.length > 0);
      return {
        ...blank, type: 'armor', useTiers: true, star: it.star, canAscend: it.canAscend,
        reforgeBase: hasPool ? it.star : 0, reforgeBonus, maxSubStats,
        pieces: (it.pieces ?? []).map((p) => ({ slot: p.slot as ArmorPiece, mains: p.mainStats, pool: p.subPool, excluded: p.excludedSubStats })),
        setPassive: it.setPassive ?? null,
      };
    }
  }

  if (equipment.type === 'ee') {
    const ee = equipment.data;
    const mainStat = l(ee, 'mainStat', lang);
    const range = eeStatRange?.range ?? null;
    return {
      ...blank, type: 'ee', useTiers: false, enhMin: 1,
      eeMain: mainStat && range ? { label: mainStat, range } : null,
      effect: curatedEffect({ effect_name: null, effect_desc1: l(ee, 'effect', lang), effect_desc4: l(ee, 'effect10', lang) }, lang, [1, 10], false),
    };
  }

  return blank;
}

// ── build state ──

function useBuild(model: LiveModel) {
  const [tier, setTier] = useState(4);
  const [enh, setEnhRaw] = useState(model.maxEnhBase);   // default +10
  const [reforge, setReforgeRaw] = useState(model.reforgeBase); // default base max (e.g. 6/6)
  const [ascended, setAscended] = useState(false);
  const [choice, setChoiceRaw] = useState<Record<number, number>>({});

  // Singularity Ascension is an explicit activation (button). It's only available once the
  // prerequisites are met — legendary 6★ gear AT +10 with reforge at base max. Once ascended,
  // enhancement extends to +15, reforge to base + bonus, and the main uses the ascended table.
  const maxEnh = ascended ? 15 : model.maxEnhBase;
  const maxReforge = ascended ? model.reforgeBase + model.reforgeBonus : model.reforgeBase;
  const enhFloor = ascended ? model.maxEnhBase : model.enhMin;
  const canAscendNow = model.canAscend && model.reforgeBase > 0 && !ascended && enh === model.maxEnhBase && reforge === model.reforgeBase;

  const setEnh = useCallback((v: number) => {
    setEnhRaw(Math.max(ascended ? model.maxEnhBase : model.enhMin, Math.min(ascended ? 15 : model.maxEnhBase, v)));
  }, [model, ascended]);

  const setReforge = useCallback((v: number) => {
    setReforgeRaw(Math.max(0, Math.min(ascended ? model.reforgeBase + model.reforgeBonus : model.reforgeBase, v)));
  }, [model, ascended]);

  const toggleAscend = useCallback(() => {
    setAscended((a) => {
      if (a) { // de-ascend → clamp back to the standard caps (+10 / base reforge)
        setEnhRaw((e) => Math.min(e, model.maxEnhBase));
        setReforgeRaw((r) => Math.min(r, model.reforgeBase));
        return false;
      }
      // ascend only when prerequisites are exactly met
      return model.canAscend && model.reforgeBase > 0 && enh === model.maxEnhBase && reforge === model.reforgeBase;
    });
  }, [model, enh, reforge]);

  const setChoice = useCallback((slot: number, opt: number) => setChoiceRaw((c) => ({ ...c, [slot]: opt })), []);
  return { tier, enh, reforge, ascended, choice, maxEnh, maxReforge, enhFloor, canAscendNow, setTier, setEnh, setReforge, toggleAscend, setChoice };
}
type Build = ReturnType<typeof useBuild>;
type Formula = ReturnType<typeof makeFormula>;

// ── primitives (FlashNum / RangeRef / sliders) ──

function FlashNum({ value, suffix = '', prefix = '', color = STAT_HEX, style }: { value: React.ReactNode; suffix?: string; prefix?: string; color?: string; style?: React.CSSProperties }) {
  const prev = useRef(value);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (prev.current !== value) {
      setOn(true);
      const id = setTimeout(() => setOn(false), 600);
      prev.current = value;
      return () => clearTimeout(id);
    }
  }, [value]);
  return (
    <span style={{ transition: 'color .25s ease, text-shadow .25s ease, transform .25s ease', display: 'inline-block', ...(on ? { color, textShadow: `0 0 14px ${color}aa`, transform: 'translateY(-1px) scale(1.06)' } : {}), ...style }}>{prefix}{value}{suffix}</span>
  );
}

function LiveLabel({ k }: { k: keyof typeof LIVE_LABELS }) {
  const { lang } = useI18n();
  return <>{lRec(LIVE_LABELS[k], lang)}</>;
}

function StepSlider({ value, hardMax, lo, onChange, accentHex, word, label, mark, asc = false }: { value: number; hardMax: number; lo: number; onChange: (v: number) => void; accentHex: string; word: string; label: string; mark?: number; asc?: boolean }) {
  const span = (hardMax - lo) || 1;
  const pct = ((value - lo) / span) * 100;
  const markPct = mark != null ? ((mark - lo) / span) * 100 : null;
  const ascended = asc;            // ascension active (prereqs met) → fuchsia accent
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 font-mono text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
      <div className="relative flex h-6 flex-1 items-center rounded focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-sky-500/50">
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/8" />
        <div className="absolute left-0 h-1.5 rounded-full" style={{ width: `${pct}%`, background: ascended ? FUCHSIA_HEX : accentHex }} />
        {markPct != null && <div className="absolute top-1/2 h-3 w-px -translate-y-1/2" style={{ left: `${markPct}%`, background: FUCHSIA_HEX }} title="Singularity Ascension" />}
        <div className="pointer-events-none absolute" style={{ left: `${pct}%`, width: 12, height: 12, borderRadius: 3, transform: 'translateX(-50%) rotate(45deg)', background: ascended ? FUCHSIA_HEX : accentHex, boxShadow: `0 0 8px ${(ascended ? FUCHSIA_HEX : accentHex)}aa` }} />
        <input type="range" min={lo} max={hardMax} step={1} value={value} onChange={(e) => onChange(+e.target.value)}
          aria-label={label} aria-valuemin={lo} aria-valuemax={hardMax} aria-valuenow={value} aria-valuetext={`${word}${value} / ${word}${hardMax}`}
          className="absolute m-0 h-6 cursor-pointer opacity-0" style={{ left: -2, right: -2, width: 'calc(100% + 4px)' }} />
      </div>
      <span className="w-12 shrink-0 text-right font-bold leading-none" style={{ color: ascended ? FUCHSIA_HEX : accentHex, fontSize: 14 }}>
        <FlashNum value={value} prefix={word} color={ascended ? FUCHSIA_HEX : accentHex} />
        <span className="font-mono text-[9px] text-zinc-600">/{word}{hardMax}</span>
      </span>
    </div>
  );
}

function TierTabs({ tier, onSet, accentHex }: { tier: number; onSet: (t: number) => void; accentHex: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 font-mono text-[10px] uppercase tracking-wider text-zinc-500"><LiveLabel k="breakthrough" /></span>
      <div className="flex flex-1 gap-1">
        {[0, 1, 2, 3, 4].map((tt) => {
          const active = tt === tier;
          return (
            <button key={tt} onClick={() => onSet(tt)} aria-pressed={active} className="h-7 flex-1 rounded font-mono text-xs font-bold transition-all"
              style={{ border: `1px solid ${active ? accentHex : 'rgba(255,255,255,0.1)'}`, background: active ? `${accentHex}1f` : 'rgba(255,255,255,0.02)', color: active ? accentHex : '#9aa1b2' }}>
              T{tt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── value helpers ──

function slotValue(model: LiveModel, f: Formula, slot: LiveMainSlot, optIdx: number, tier: number, enh: number, ascended: boolean) {
  if (slot.type === 'fixed') return { key: slot.key, value: f.mainAt(slot.base, slot.key, enh, tier, ascended), unit: f.isPercent(slot.key) ? '%' : '' };
  const opt = slot.options[optIdx] ?? slot.options[0];
  const value = model.type === 'talisman' && opt.levels ? f.talismanStat(opt.levels, enh) : f.mainAt(opt.base, opt.key, enh, tier, ascended);
  return { key: opt.key, value, unit: f.isPercent(opt.key) ? '%' : '' };
}

function effectivePool(model: LiveModel, build: Build): LiveSubOpt[] {
  const chosen = model.mains.map((s, i) => s.type === 'choice' ? (s.options[build.choice[i] ?? 0]?.key ?? null) : null).filter((x): x is string => !!x);
  const excl = new Set([...model.excluded, ...chosen]);
  return model.pool.filter((p) => !excl.has(p.key));
}

// ── content components ──

// ── content components ──

// Actual main stat(s) — always present (e.g. ATK flat on a weapon, fixed armor mains).
function FixedMainList({ model, f, build, accentHex }: { model: LiveModel; f: Formula; build: Build; accentHex: string }) {
  const fixed = model.mains.filter((s): s is Extract<LiveMainSlot, { type: 'fixed' }> => s.type === 'fixed');
  return (
    <div className="flex flex-col gap-2">
      {fixed.map((slot) => {
        const v = slotValue(model, f, slot, 0, build.tier, build.enh, build.ascended);
        return (
          <div key={slot.key} className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-bold text-zinc-100"><StatInline name={slot.key} /></span>
            <FlashNum value={v.value} suffix={v.unit} color={accentHex} style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 15, fontWeight: 700, color: accentHex }} />
          </div>
        );
      })}
    </div>
  );
}

// Possible main stats — the `choice` slot: every option with its live value; one selectable.
function PossibleMainList({ model, f, build, accentHex }: { model: LiveModel; f: Formula; build: Build; accentHex: string }) {
  return (
    <div className="flex flex-col gap-3">
      {model.mains.map((slot, i) => slot.type === 'choice' && (
        <div key={i} className="flex flex-col gap-1.5">
          {slot.options.map((opt, oi) => {
            const sel = (build.choice[i] ?? 0) === oi;
            const v = slotValue(model, f, slot, oi, build.tier, build.enh, build.ascended);
            return (
              <button key={opt.key} onClick={() => build.setChoice(i, oi)} aria-pressed={sel}
                className="flex items-center justify-between gap-3 rounded-lg border px-2.5 py-2 text-left transition-colors"
                style={{ borderColor: sel ? accentHex : 'rgba(255,255,255,0.1)', background: sel ? `${accentHex}14` : 'transparent' }}>
                <span className="text-sm text-zinc-200"><StatInline name={opt.key} /></span>
                <FlashNum value={v.value} suffix={v.unit} color={accentHex} style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 14, fontWeight: 700, color: sel ? accentHex : '#d4d8e0' }} />
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Possible substats — the full reforge pool (reforge→value linkage TBD), shown as a value range.
function PossibleSubstats({ pool, f }: { pool: LiveSubOpt[]; f: Formula }) {
  if (pool.length === 0) return <p className="text-sm text-zinc-500">—</p>;
  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      {pool.map((s) => {
        const unit = f.isPercent(s.key) ? '%' : '';
        const mn = f.subValue(s.step, 1, s.key);
        const mx = f.subValue(s.step, s.maxSegments, s.key);
        return (
          <div key={s.key} className="flex items-center justify-between gap-2.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5">
            <span className="min-w-0 truncate text-sm text-zinc-300"><StatInline name={s.key} /></span>
            <span className="whitespace-nowrap font-mono text-xs tabular-nums text-zinc-400">+{mn}{unit}<span className="mx-1 text-zinc-600">~</span>+{mx}{unit}</span>
          </div>
        );
      })}
    </div>
  );
}

// passive text with in-game <color=#hex>…</color> tags + newlines
function GameText({ text }: { text: string }) {
  const re = /<color=#([0-9a-fA-F]{6,8})>([\s\S]*?)<\/color>/g;
  const out: React.ReactNode[] = [];
  let last = 0; let m: RegExpExecArray | null; let k = 0;
  const pushPlain = (s: string) => {
    s.split(/\\n|\n/).forEach((seg, i) => { if (i > 0) out.push(<br key={`b${k++}`} />); if (seg) out.push(<span key={`t${k++}`}>{seg}</span>); });
  };
  while ((m = re.exec(text))) {
    if (m.index > last) pushPlain(text.slice(last, m.index));
    out.push(<span key={`c${k++}`} style={{ color: `#${m[1].slice(0, 6)}`, fontWeight: 700 }}>{m[2]}</span>);
    last = re.lastIndex;
  }
  if (last < text.length) pushPlain(text.slice(last));
  return <span className="text-sm leading-relaxed text-zinc-300">{out}</span>;
}

function PassiveModule({ model, build, accentHex }: { model: LiveModel; build: Build; accentHex: string }) {
  const { lang } = useI18n();
  const p = model.passive;
  if (p) return <GameText text={renderPassive(p, lang, build.tier)} />;
  return <CuratedEffectModule effect={model.effect} useTiers={model.useTiers} build={build} accentHex={accentHex} />;
}

function CuratedEffectModule({ effect, useTiers, build, accentHex }: { effect: EffectModel; useTiers: boolean; build: Build; accentHex: string }) {
  if (!effect) return null;
  const color = effect.isBuff ? BUFF_HEX : accentHex;
  const at = useTiers ? build.tier : build.enh;
  let txt = effect.steps.length ? effect.steps[0].text : '';
  for (const s of effect.steps) if (at >= s.from) txt = s.text;
  return (
    <div className="flex flex-col gap-3.5">
      {effect.name && (
        <span className="inline-flex items-center gap-2 self-start rounded-full px-3 py-1 text-sm font-semibold" style={{ border: `1px solid ${color}44`, background: `${color}14`, color }}>
          {effect.icon && <span className="relative inline-block h-5 w-5 shrink-0"><Image src={`/images/ui/effect/${effect.icon}.webp`} alt={effect.name} fill sizes="20px" className="object-contain" /></span>}
          {effect.name}
        </span>
      )}
      {txt && <span className="text-sm leading-relaxed text-zinc-300">{formatEffectText(txt)}</span>}
    </div>
  );
}

function SetEffectBlock({ tag, blk, tier, lang }: { tag: string; blk: LiveSetEffectBlock; tier: number; lang: Lang }) {
  return (
    <div className="min-w-60 flex-1 rounded-lg border border-zinc-700/50 bg-slate-950/40 p-3.5">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="rounded border border-buff/30 bg-buff/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-buff">{tag}</span>
      </div>
      <span className="text-sm text-zinc-300">{renderSetEffect(blk, lang, tier)}</span>
    </div>
  );
}

function SetEffectsModule({ setPassive, tier }: { setPassive: LiveSetPassive; tier: number }) {
  const { lang } = useI18n();
  if (!setPassive) return null;
  return (
    <div className="flex flex-wrap gap-3">
      <SetEffectBlock tag="2-Piece" blk={setPassive.twoPc} tier={tier} lang={lang} />
      <SetEffectBlock tag="4-Piece" blk={setPassive.fourPc} tier={tier} lang={lang} />
    </div>
  );
}

function ArmorPiecesModule({ model, f, build, accentHex, set }: { model: LiveModel; f: Formula; build: Build; accentHex: string; set: { rarity: ItemRarity; image_prefix: string } }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {model.pieces.map((p) => (
        <div key={p.slot} className="flex items-center gap-3 rounded-lg border border-zinc-700/50 bg-zinc-900/40 p-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded">
            <Image src={getRarityBgPath(set.rarity)} alt={`${set.rarity} rarity`} fill sizes="48px" className="object-cover" />
            <div className="absolute inset-0.5"><Image src={`/images/equipment/TI_Equipment_${p.slot}_${set.image_prefix}.webp`} alt={p.slot} fill sizes="44px" className="object-contain" /></div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500">{t(ARMOR_PIECE_I18N[p.slot] as Parameters<typeof t>[0])}</div>
            {p.mains.map((slot, i) => {
              const v = slotValue(model, f, slot, 0, build.tier, build.enh, build.ascended);
              return (
                <div key={i} className="flex items-baseline justify-between gap-2 py-0.5">
                  <span className="text-sm text-zinc-300"><StatInline name={v.key} /></span>
                  <FlashNum value={v.value} suffix={v.unit} color={accentHex} style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 14, fontWeight: 700, color: accentHex }} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ArmorSubstatsModule({ model, f }: { model: LiveModel; f: Formula }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {model.pieces.map((p) => {
        const eff = p.pool.filter((o) => !p.excluded.includes(o.key));
        if (eff.length === 0) return null;
        return (
          <div key={p.slot} className="rounded-lg border border-zinc-700/50 bg-zinc-900/40 p-3">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-zinc-500">{t(ARMOR_PIECE_I18N[p.slot] as Parameters<typeof t>[0])}</div>
            <PossibleSubstats pool={eff} f={f} />
          </div>
        );
      })}
    </div>
  );
}

// ── CONFIGURE bar ──

function ConfigureBar({ model, build, accentHex }: { model: LiveModel; build: Build; accentHex: string }) {
  const { lang } = useI18n();
  const word = model.useTiers ? '+' : '';
  return (
    <section className="mb-3.5 overflow-hidden rounded-xl border md:sticky md:top-3 md:z-5" style={{ borderColor: `${accentHex}40`, background: 'rgba(30,36,54,0.72)', boxShadow: '0 8px 30px rgba(0,0,0,0.35)' }}>
      <div className="flex items-center gap-2 border-b border-white/5 px-3.5 py-2.5" style={{ background: `${accentHex}12` }}>
        <span className="font-mono text-xs font-bold opacity-70" style={{ color: accentHex }}>[</span>
        <span className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-100">{lRec(LIVE_LABELS.configure, lang)}</span>
        <span className="font-mono text-xs font-bold opacity-70" style={{ color: accentHex }}>]</span>
      </div>
      <div className="flex flex-col gap-2.5 px-3.5 py-3">
        <StepSlider value={build.enh} hardMax={build.maxEnh} lo={build.enhFloor} onChange={build.setEnh} accentHex={accentHex} word={word}
          label={lRec(model.useTiers ? LIVE_LABELS.enhancement : LIVE_LABELS.level, lang)} mark={model.canAscend ? model.maxEnhBase : undefined} asc={build.ascended} />
        {model.useTiers && <TierTabs tier={build.tier} onSet={build.setTier} accentHex={accentHex} />}
        {build.maxReforge > 0 && (
          <StepSlider value={build.reforge} hardMax={build.maxReforge} lo={0} onChange={build.setReforge} accentHex={accentHex} word=""
            label={`${lRec(LIVE_LABELS.reforge, lang)} ★${model.star}`} asc={build.ascended} />
        )}
        {model.canAscend && model.reforgeBase > 0 && (
          <div className="flex items-center gap-3">
            <span className="w-24 shrink-0" />
            <button onClick={build.toggleAscend} disabled={!build.ascended && !build.canAscendNow} aria-pressed={build.ascended}
              className="flex h-7 flex-1 items-center justify-center gap-1.5 rounded font-mono text-[11px] font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              style={{ border: `1px solid ${FUCHSIA_HEX}${build.ascended ? '' : '77'}`, background: build.ascended ? `${FUCHSIA_HEX}22` : 'transparent', color: FUCHSIA_HEX }}>
              <span>✦</span>{lRec(build.ascended ? LIVE_LABELS.ascended : LIVE_LABELS.ascend, lang)}
              {!build.ascended && !build.canAscendNow && <span className="font-mono text-[9px] normal-case text-zinc-500">· +{model.maxEnhBase} · {model.reforgeBase}/{model.reforgeBase}</span>}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

// ── view ──

type EDModule = { key: string; title: string; span?: 1 | 2; ascension?: boolean; node: React.ReactNode };

export function EquipmentInteractiveInner(props: EquipmentViewProps) {
  const {
    equipment, recoCharacters, totalRecoCount, eeOwner, eeCfCompanion, bossMap,
    weaponStatRanges, accessoryStatRanges, weaponAscendedRanges, accessoryAscendedRanges,
    armorSetStatRanges, armorSetAscendedRanges, liveDetail, lang,
  } = props;
  const { t, href } = useI18n();
  const equipName = l(equipment.data, 'name', lang);
  useBreadcrumbOverride(equipName);

  const rarityKey = (equipment.type === 'ee' ? 'legendary' : String(equipment.data.rarity).toLowerCase()) as ItemRarity;
  const accentHex = RARITY_HEX[rarityKey] ?? RARITY_HEX.normal;
  const rarityLabel = t(`sys.rarity.${rarityKey}` as Parameters<typeof t>[0]);
  const classLabel = (cls: string) => t(`sys.class.${cls.toLowerCase()}` as Parameters<typeof t>[0]);

  const model = buildModel(props);
  const f = liveDetail ? makeFormula(liveDetail.meta) : null;
  const build = useBuild(model);

  // hero icon + chips
  let heroIcon: React.ReactNode = null;
  let typeLabel = '';
  let cls: string | null = null;
  let rank: string | null = null;
  if (equipment.type === 'weapon') {
    const w = equipment.data; typeLabel = t('equip.tab.weapons'); cls = w.class ?? null;
    heroIcon = <EquipmentIcon src={`equipment/${w.image}`} rarity={w.rarity} alt={equipName} size={80} overlaySize={24} effectIcon={w.effect_icon} classType={w.class} level={w.level} />;
  } else if (equipment.type === 'amulet') {
    const a = equipment.data; typeLabel = t('equip.tab.accessories'); cls = a.class ?? null;
    heroIcon = <EquipmentIcon src={`equipment/${a.image}`} rarity={a.rarity} alt={equipName} size={80} overlaySize={24} effectIcon={a.effect_icon} classType={a.class} level={a.level} />;
  } else if (equipment.type === 'talisman') {
    const tl = equipment.data; typeLabel = t('equip.tab.talismans');
    heroIcon = <EquipmentIcon src={`equipment/${tl.image}`} rarity={tl.rarity} alt={equipName} size={80} overlaySize={24} effectIcon={tl.effect_icon} level={tl.level} />;
  } else if (equipment.type === 'set') {
    const s = equipment.data; typeLabel = t('equip.tab.sets'); cls = s.class ?? null;
    heroIcon = <EquipmentIcon src={`equipment/TI_Equipment_Armor_${s.image_prefix}`} rarity={s.rarity} alt={equipName} size={80} overlaySize={24} effectIcon={s.set_icon} level={6} />;
  } else if (equipment.type === 'ee' && eeOwner) {
    const ee = equipment.data; typeLabel = t('equip.tab.ee'); rank = ee.rank ?? null;
    heroIcon = (
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
        <Image src={getRarityBgPath('legendary')} alt="Legendary rarity" fill sizes="80px" className="object-cover" />
        <div className="absolute inset-2"><Image src={`/images/characters/ee/${eeOwner.id}.webp`} alt={equipName} fill sizes="64px" className="object-contain" /></div>
      </div>
    );
  }

  // EE main stat (no datamine detail → interpolate the known range by level)
  const eeMainVal = model.eeMain ? lerpRound(model.eeMain.range[0], model.eeMain.range[1], (build.enh - model.enhMin) / ((model.maxEnhBase - model.enhMin) || 1)) : null;

  // modules
  const modules: EDModule[] = [];
  if ((model.type === 'weapon' || model.type === 'accessory') && f) {
    const eff = effectivePool(model, build);
    const fixedMains = model.mains.filter((s) => s.type === 'fixed');
    const choiceMains = model.mains.filter((s) => s.type === 'choice');
    if (fixedMains.length > 0) modules.push({ key: 'mainfixed', title: t('equip.detail.mainstat'), span: 1, node: <FixedMainList model={model} f={f} build={build} accentHex={accentHex} /> });
    if (choiceMains.length > 0) modules.push({ key: 'mainposs', title: t('equip.detail.mainstats'), span: 1, node: <PossibleMainList model={model} f={f} build={build} accentHex={accentHex} /> });
    if (eff.length > 0) modules.push({ key: 'sub', title: lRec(LIVE_LABELS.substats, lang), span: 2, node: <PossibleSubstats pool={eff} f={f} /> });
    if (model.passive || model.effect) modules.push({ key: 'eff', title: model.passive ? lRec(model.passive.name, lang) : t('page.character.ee.effect'), span: 2, node: <PassiveModule model={model} build={build} accentHex={accentHex} /> });
    const ascStd = model.type === 'weapon' ? weaponStatRanges : accessoryStatRanges;
    const ascEnd = model.type === 'weapon' ? weaponAscendedRanges : accessoryAscendedRanges;
    if (ascEnd && Object.keys(ascEnd).length > 0) modules.push({ key: 'asc', title: lRec(ASCENSION_LABELS.title, lang), span: 2, ascension: true, node: <AscensionContent slot={model.type === 'weapon' ? 'weapons' : 'accessories'} standardRanges={ascStd} ascendedRanges={ascEnd} lang={lang} /> });
    const src = equipment.data as SrcLike;
    if (src.source || src.boss) modules.push({ key: 'src', title: t('equip.filter.source'), span: 1, node: <EquipmentSource source={src.source ?? undefined} boss={src.boss ?? undefined} bossMap={bossMap} lang={lang} linkable /> });
  } else if (model.type === 'talisman' && f) {
    const tl = equipment.data as SrcLike;
    modules.push({ key: 'mainposs', title: t('equip.detail.mainstats'), span: 1, node: <PossibleMainList model={model} f={f} build={build} accentHex={accentHex} /> });
    if (model.effect) modules.push({ key: 'eff', title: t('page.character.ee.effect'), span: 1, node: <CuratedEffectModule effect={model.effect} useTiers={model.useTiers} build={build} accentHex={accentHex} /> });
    if (tl.source || tl.boss) modules.push({ key: 'src', title: t('equip.filter.source'), span: 2, node: <EquipmentSource source={tl.source ?? undefined} boss={tl.boss ?? undefined} bossMap={bossMap} lang={lang} linkable /> });
  } else if (model.type === 'armor' && f) {
    const s = equipment.data as SrcLike & { rarity: ItemRarity; image_prefix: string };
    modules.push({ key: 'seteff', title: t('equip.detail.set_effects'), span: 2, node: <SetEffectsModule setPassive={model.setPassive} tier={build.tier} /> });
    modules.push({ key: 'pieces', title: t('equip.detail.mainstat'), span: 2, node: <ArmorPiecesModule model={model} f={f} build={build} accentHex={accentHex} set={s} /> });
    if (model.pieces.some((p) => p.pool.some((o) => !p.excluded.includes(o.key)))) modules.push({ key: 'sub', title: lRec(LIVE_LABELS.substats, lang), span: 2, node: <ArmorSubstatsModule model={model} f={f} /> });
    if (armorSetAscendedRanges && (['Helmet', 'Armor', 'Gloves', 'Shoes'] as ArmorPiece[]).some((p) => armorSetAscendedRanges[p] && Object.keys(armorSetAscendedRanges[p]).length > 0)) {
      modules.push({ key: 'asc', title: lRec(ASCENSION_LABELS.title, lang), span: 2, ascension: true, node: <AscensionContentForSet standardRanges={armorSetStatRanges} ascendedRanges={armorSetAscendedRanges} lang={lang} /> });
    }
    if (s.source || s.boss) modules.push({ key: 'src', title: t('equip.filter.source'), span: 1, node: <EquipmentSource source={s.source ?? undefined} boss={s.boss ?? undefined} bossMap={bossMap} lang={lang} linkable /> });
  } else if (equipment.type === 'ee' && eeOwner) {
    const ee = equipment.data;
    modules.push({ key: 'owner', title: t('equip.detail.owner'), span: 1, node: (
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"><CharacterRefCard char={eeOwner} />{eeCfCompanion && <CharacterRefCard char={eeCfCompanion} />}</div>
    ) });
    if (model.eeMain) modules.push({ key: 'main', title: t('equip.detail.mainstat'), span: 1, node: (
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-bold text-zinc-100">{model.eeMain.label}</span>
        <FlashNum value={eeMainVal ?? '—'} suffix="%" color={accentHex} style={{ fontWeight: 700, fontSize: 18, color: accentHex }} />
      </div>
    ) });
    if (model.effect) modules.push({ key: 'eff', title: t('page.character.ee.effect'), span: 2, node: <CuratedEffectModule effect={model.effect} useTiers={false} build={build} accentHex={accentHex} /> });
    if (ee.buff.length > 0 || ee.debuff.length > 0) {
      const bdTitle = ee.buff.length > 0 && ee.debuff.length > 0 ? `${t('characters.filters.buffs')} / ${t('characters.filters.debuffs')}` : ee.buff.length > 0 ? t('characters.filters.buffs') : t('characters.filters.debuffs');
      modules.push({ key: 'buffs', title: bdTitle, span: 2, node: <BuffDebuffDisplay buffs={ee.buff} debuffs={ee.debuff} /> });
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <Link href={href('/equipment')} className="mb-4 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-zinc-500 transition-colors hover:text-zinc-300">
        <span aria-hidden="true">←</span> {t('equip.detail.back')}
      </Link>

      <div className="panel-warning mb-3.5 px-3.5 py-2 text-xs text-amber-200/80">
        Preview · interactive build — drives main / substats / passive from the real item-stats data.
      </div>

      <div className="mb-3.5 overflow-hidden rounded-xl border bg-zinc-900/60" style={{ borderColor: `${accentHex}3a` }}>
        <div className="flex items-center gap-3 p-4 md:gap-4 md:p-5" style={{ background: `linear-gradient(135deg, ${accentHex}1a 0%, transparent 50%)` }}>
          {heroIcon}
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: accentHex }}>{typeLabel}</span>
              <span className="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider" style={{ border: `1px solid ${accentHex}77`, background: `${accentHex}18`, color: accentHex }}>{rarityLabel}</span>
              {model.star > 0 && <span className="font-mono text-[11px] font-bold text-amber-300">{'★'.repeat(model.star)}</span>}
              {cls && <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">{classLabel(cls)}</span>}
              {rank && <span className="rounded-full px-2 py-0.5 font-mono text-[10px] font-bold" style={{ border: `1px solid ${STAT_HEX}55`, color: STAT_HEX }}>Rank {rank}</span>}
            </div>
            <h1 className="m-0 pb-0 text-2xl font-bold leading-tight text-white after:hidden md:text-4xl">{equipName}</h1>
          </div>
        </div>
      </div>

      <ConfigureBar model={model} build={build} accentHex={accentHex} />

      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
        {modules.map((m) => <Module key={m.key} title={m.title} span={m.span} ascension={m.ascension} accentHex={accentHex}>{m.node}</Module>)}
        {recoCharacters.length > 0 && (
          <Module key="reco" title={t('equip.detail.recommended_by')} span={2} accentHex={accentHex}>
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
              {recoCharacters.map((char) => <CharacterRefCard key={char.id} char={char} />)}
            </div>
            {totalRecoCount > recoCharacters.length && (
              <p className="mt-3 text-center text-sm text-zinc-500">{t('equip.detail.and_more').replace('{n}', String(totalRecoCount - recoCharacters.length))}</p>
            )}
          </Module>
        )}
      </div>
    </div>
  );
}
