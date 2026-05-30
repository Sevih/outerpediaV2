'use client';

// Interactive equipment detail view (Console direction). Default view for /equipment/<slug>.
// Renders client-only.
//
// Driven by REAL data: data/equipment/item-stats-detail.json via the data layer
// (getItemLiveDetail → liveDetail prop). Mechanics:
//   • Enhancement 0→10 (→15 if canAscend, Singularity) → main stat(s)
//   • Breakthrough T0→T4 → main stat(s) + passive/effect text
//   • Reforge 0→N (N = stars, +3 if 6★) → secondary stats only (from the real pool,
//     excluding fixed mains + the chosen choice-main)
// EE falls back to the eeStatRange/curated effect if not yet in item-stats-detail.json.

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
import { makeFormula, renderPassive, renderSetEffect, renderTalismanTier, type LiveMainSlot, type LiveSubOpt, type LivePassive, type LiveTalismanPassive, type LiveSetPassive, type LiveSetEffectBlock, type LiveEEMainStat } from '@/lib/equipment-formula';
import {
  RARITY_HEX, STAT_HEX, BUFF_HEX, FUCHSIA_HEX, ASCENSION_LABELS,
  ARMOR_PIECE_I18N, Module, CharacterRefInline, AscensionContent, AscensionContentForSet,
  type EDModule,
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
  priority:        { en: 'Priority',        jp: '優先度',     kr: '우선도',     zh: '优先级' },
  unlockPriority:  { en: 'Unlock Priority', jp: '解放優先度', kr: '해금 우선도', zh: '解锁优先级' },
  upgradePriority: { en: 'Upgrade Priority', jp: '強化優先度', kr: '강화 우선도', zh: '强化优先级' },
} satisfies Record<string, LangMap>;

const lerpRound = (f: number, p: number, b: number) => Math.round(f + (p - f) * b);

// Ascended item name — suffix is data-driven (SYS_SINGULAR_ENHANCE_COMPLETE_ADD_NAME),
// the gradient is the in-game CUITextGradient2: vertical, cyan (top) → violet → magenta (bottom).
const SINGULARITY_NAME = { en: '{0} - [Singularity]', jp: '{0} - [特異点]', kr: '{0} - [특이점]', zh: '{0} - [奇点]' } satisfies LangMap;
const SINGULARITY_NAME_GRADIENT = 'linear-gradient(180deg, #16EBF1 0%, #9D51FF 50%, #E02BCD 100%)';

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
  talismanPassive: LiveTalismanPassive;
  pieces: { slot: ArmorPiece; mains: LiveMainSlot[]; pool: LiveSubOpt[]; excluded: string[] }[];
  setPassive: LiveSetPassive;
  effect: EffectModel;          // curated fallback if EE liveDetail missing
  eeMain: { label: string; range: [number, number] } | null;  // legacy lerp fallback for EE
  eeMainStats: LiveEEMainStat[]; // EE datamine-driven (2 slots with 11 levels each)
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
    mains: [], pool: [], excluded: [], passive: null, talismanPassive: null, pieces: [], setPassive: null, effect: null, eeMain: null, eeMainStats: [],
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
        talismanPassive: it.talismanPassive ?? null,
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
    if (it.kind === 'ee') {
      return {
        ...blank, type: 'ee', useTiers: false, star: it.star, canAscend: false, maxSubStats,
        eeMainStats: it.eeMainStats ?? [],
        talismanPassive: it.talismanPassive ?? null,
      };
    }
  }

  if (equipment.type === 'ee') {
    // Legacy fallback: only triggers if the EE isn't in item-stats-detail.json yet.
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
  const [ascended, setAscended] = useState(false);
  const [choice, setChoiceRaw] = useState<Record<number, number>>({});

  // Singularity Ascension is an explicit activation (button). It's only available once the
  // prerequisite is met — legendary 6★ gear AT +10. Once ascended, enhancement extends to +15,
  // the available reforge attempts go base → base + bonus, and the main uses the ascended table.
  // Reforge is no longer a user-driven slider — `maxReforge` is just the count available to show.
  const maxEnh = ascended ? 15 : model.maxEnhBase;
  const maxReforge = ascended ? model.reforgeBase + model.reforgeBonus : model.reforgeBase;
  const enhFloor = ascended ? model.maxEnhBase : model.enhMin;
  const canAscendNow = model.canAscend && model.reforgeBase > 0 && !ascended && enh === model.maxEnhBase;

  const setEnh = useCallback((v: number) => {
    setEnhRaw(Math.max(ascended ? model.maxEnhBase : model.enhMin, Math.min(ascended ? 15 : model.maxEnhBase, v)));
  }, [model, ascended]);

  const toggleAscend = useCallback(() => {
    setAscended((a) => {
      if (a) { // de-ascend → clamp enhancement back to the standard cap (+10)
        setEnhRaw((e) => Math.min(e, model.maxEnhBase));
        return false;
      }
      return model.canAscend && model.reforgeBase > 0 && enh === model.maxEnhBase;
    });
  }, [model, enh]);

  const setChoice = useCallback((slot: number, opt: number) => setChoiceRaw((c) => ({ ...c, [slot]: opt })), []);
  return { tier, enh, ascended, choice, maxEnh, maxReforge, enhFloor, canAscendNow, setTier, setEnh, toggleAscend, setChoice };
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
      <span className="w-24 shrink-0 text-[10px] uppercase tracking-wider text-zinc-300">{label}</span>
      <div className="relative flex h-6 flex-1 items-center rounded focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-sky-500/50">
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/8" />
        <div className="absolute left-0 h-1.5 rounded-full" style={{ width: `${pct}%`, background: ascended ? FUCHSIA_HEX : accentHex }} />
        {markPct != null && <div className="absolute top-1/2 h-3 w-px -translate-y-1/2" style={{ left: `${markPct}%`, background: FUCHSIA_HEX }} title="Singularity Ascension" />}
        <div className="pointer-events-none absolute" style={{ left: `${pct}%`, width: 12, height: 12, borderRadius: 3, transform: 'translateX(-50%) rotate(45deg)', background: ascended ? FUCHSIA_HEX : accentHex }} />
        <input type="range" min={lo} max={hardMax} step={1} value={value} onChange={(e) => onChange(+e.target.value)}
          aria-label={label} aria-valuemin={lo} aria-valuemax={hardMax} aria-valuenow={value} aria-valuetext={`${word}${value} / ${word}${hardMax}`}
          className="absolute m-0 h-6 cursor-pointer opacity-0" style={{ left: -2, right: -2, width: 'calc(100% + 4px)' }} />
      </div>
      <span className="w-12 shrink-0 text-right font-bold leading-none" style={{ color: ascended ? FUCHSIA_HEX : accentHex, fontSize: 14 }}>
        <FlashNum value={value} prefix={word} color={ascended ? FUCHSIA_HEX : accentHex} />
        <span className="text-[9px] text-zinc-600">/{word}{hardMax}</span>
      </span>
    </div>
  );
}

function TierTabs({ tier, onSet, accentHex }: { tier: number; onSet: (t: number) => void; accentHex: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-[10px] uppercase tracking-wider text-zinc-300"><LiveLabel k="breakthrough" /></span>
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

// % vs flat is decided per stat occurrence (the data layer carries it from the
// generator, derived from the in-game `OAT_ADD` vs `OAT_RATE` pair — EFF/RES are flat on
// gear, % on talismans). Fall back to the global statMeta if the per-slot flag is missing.
function slotValue(model: LiveModel, f: Formula, slot: LiveMainSlot, optIdx: number, tier: number, enh: number, ascended: boolean) {
  const pct = (key: string, p: boolean | undefined) => (p ?? f.isPercent(key)) ? '%' : '';
  if (slot.type === 'fixed') return { key: slot.key, value: f.mainAt(slot.base, slot.key, enh, tier, ascended), unit: pct(slot.key, slot.percent) };
  const opt = slot.options[optIdx] ?? slot.options[0];
  const value = model.type === 'talisman' && opt.levels ? f.talismanStat(opt.levels, enh) : f.mainAt(opt.base, opt.key, enh, tier, ascended);
  return { key: opt.key, value, unit: pct(opt.key, opt.percent) };
}

// Exclusion main↔sub is per (key, percent) pair, NOT just key.
// On accessories, the main stat can be EFF flat — that must NOT exclude EFF % from the sub pool
// (they are effectively different stats: OAT_ADD vs OAT_RATE in-game).
const slotSig = (key: string, percent?: boolean) => `${key}|${!!percent}`;

function effectivePool(model: LiveModel, build: Build): LiveSubOpt[] {
  const excl = new Set<string>();
  model.mains.forEach((s, i) => {
    if (s.type === 'fixed') excl.add(slotSig(s.key, s.percent));
    else {
      const opt = s.options[build.choice[i] ?? 0];
      if (opt) excl.add(slotSig(opt.key, opt.percent));
    }
  });
  return model.pool.filter((p) => !excl.has(slotSig(p.key, p.percent)));
}

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

// Possible substats — the full reforge pool. Reforge procs land on random stats in-game,
// so there is no deterministic reforge→value mapping: per stat we show the per-proc gain
// (1 segment = the minimum) and the max (maxSegments procs).
function PossibleSubstats({ pool, f }: { pool: LiveSubOpt[]; f: Formula }) {
  if (pool.length === 0) return <p className="text-sm text-zinc-500">—</p>;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] leading-snug text-zinc-500">
        <span className="text-zinc-400">min</span> → <span className="text-zinc-300">max</span>
      </p>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {pool.map((s) => {
          // Per-occurrence `percent` from the generator (OAT_ADD = flat, OAT_RATE = %),
          // falls back to the global statMeta if absent.
          const unit = (s.percent ?? f.isPercent(s.key)) ? '%' : '';
          const perProc = f.subValue(s.step, 1, s.key, s.percent);
          const max = f.subValue(s.step, s.maxSegments, s.key, s.percent);
          return (
            <div key={s.key} className="flex items-center justify-between gap-2.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5">
              <span className="min-w-0 truncate text-sm text-zinc-300"><StatInline name={s.key} /></span>
              <span className="flex shrink-0 items-baseline gap-2.5 whitespace-nowrap font-mono text-xs tabular-nums">
                <span className="text-zinc-300">+{perProc}{unit}</span>
                <span className="text-zinc-600">→</span>
                <span className="font-semibold text-zinc-200">+{max}{unit}</span>
              </span>
            </div>
          );
        })}
      </div>
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

// Multi-tier passive — used by talismans AND EE (Exclusive Equipment). Both share the same
// shape (`LiveTalismanPassive`: name + tiers[]). One row per tier; eyebrow shows the in-game
// unlock level.
//   • Additive tier (`isAdd=true`)  → ALWAYS rendered; greyed-out until enh ≥ unlockLevel
//     (the player sees what unlocks at +10 and that it stacks on the base).
//   • Upgrade tier (`isAdd=false`)  → swap mode: shows only one row at a time. Below the
//     unlock the base row is visible; from `unlockLevel` onwards the upgrade row replaces
//     it (same effect, just a stronger value — showing both side-by-side is misleading).
function MultiTierPassiveModule({ passive, enh, accentHex }: { passive: LiveTalismanPassive; enh: number; accentHex: string }) {
  const { lang } = useI18n();
  if (!passive) return null;
  const name = passive.name?.[lang] ?? passive.name?.en ?? '';
  const upgradeTier = passive.tiers.find((t, i) => i > 0 && !t.isAdd);
  return (
    <div className="flex flex-col gap-3">
      {name && (
        <span className="inline-flex items-center gap-2 self-start rounded-full px-3 py-1 text-sm font-semibold" style={{ border: `1px solid ${accentHex}44`, background: `${accentHex}14`, color: accentHex }}>
          {name}
        </span>
      )}
      <div className="flex flex-col gap-2">
        {passive.tiers.map((tier, i) => {
          // Upgrade pattern: hide the base while the upgrade is active, hide the upgrade while it isn't.
          if (upgradeTier) {
            if (i === 0 && enh >= upgradeTier.unlockLevel) return null;
            if (tier === upgradeTier && enh < upgradeTier.unlockLevel) return null;
          }
          // Base tier (unlockLevel=1) is the unmodified state — active from +0 onwards.
          // Only later tiers (e.g. unlockLevel=10) need the enhance to reach their threshold.
          const active = tier.unlockLevel <= 1 || enh >= tier.unlockLevel;
          const eyebrow = tier.unlockLevel <= 1 ? 'Base' : `+${tier.unlockLevel} · ${tier.isAdd ? 'additional' : 'upgraded'}`;
          return (
            <div key={i} className={`flex flex-col gap-1 rounded-lg border px-3 py-2.5 transition-opacity ${active ? '' : 'opacity-40'}`}
              style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
              <span className="text-[10px] uppercase tracking-wider text-zinc-400">{eyebrow}</span>
              <span className="text-sm leading-relaxed text-zinc-300">{formatEffectText(renderTalismanTier(tier, lang))}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// EE owner full-art — the owning character (and CF companion if any) rendered with the big
// `characters/full/IMG_<id>.webp` portrait instead of a small card.
function EEOwnerFullArt({ owner, companion }: { owner: { id: string; name: string; slug: string | null }; companion?: { id: string; name: string; slug: string | null } | null }) {
  const { href } = useI18n();
  const list = companion ? [owner, companion] : [owner];
  return (
    <div className={`grid items-stretch gap-2 ${list.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {list.map((c) => {
        const inner = (
          <div className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio: '3 / 4' }}>
            <Image src={`/images/characters/full/IMG_${c.id}.webp`} alt={c.name} fill sizes="(max-width: 768px) 50vw, 240px" className="object-cover object-top" />
            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 via-black/40 to-transparent px-2 py-2">
              <span className="block truncate text-xs font-semibold text-zinc-100">{c.name}</span>
            </div>
          </div>
        );
        return c.slug
          ? <Link key={c.id} href={href(`/characters/${c.slug}`)} className="block transition-opacity hover:opacity-90">{inner}</Link>
          : <div key={c.id}>{inner}</div>;
      })}
    </div>
  );
}

// EE rank badges — two paired rows: "Unlock Priority" (curated `rank`) and "Upgrade Priority"
// (curated `rank10`, value at +10). Both rendered as the in-game IG_Event_Rank_<letter> tile.
const RANK_LETTERS = new Set(['A', 'B', 'C', 'D', 'E', 'S', 'SS', 'SSS']);
function EERankBadges({ rank, rank10 }: { rank: string | null | undefined; rank10: string | null | undefined }) {
  const { lang } = useI18n();
  const rows = [
    { label: lRec(LIVE_LABELS.unlockPriority, lang), value: rank },
    { label: lRec(LIVE_LABELS.upgradePriority, lang), value: rank10 },
  ];
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => {
        const v = (r.value ?? '').toUpperCase();
        const known = RANK_LETTERS.has(v);
        return (
          <div key={r.label} className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-zinc-100">{r.label}</span>
            {known
              ? <Image src={`/images/ui/rank/IG_Event_Rank_${v}.webp`} alt={`Rank ${v}`} width={32} height={32} className="shrink-0" />
              : <span className="text-sm text-zinc-500">—</span>}
          </div>
        );
      })}
    </div>
  );
}

// EE main stats — two fixed slots, both with explicit 11-value lookup tables (no formula).
// • Conditional %-stat (e.g. "Reduced DMG Taken vs Earth") — label includes the "vs <element>"
// • Flat secondary (HIT_AP / KILL_AP) — generic "Gains AP when …" label
function EEMainStatsModule({ stats, enh, accentHex }: { stats: LiveEEMainStat[]; enh: number; accentHex: string }) {
  const { lang } = useI18n();
  if (stats.length === 0) return <p className="text-sm text-zinc-500">—</p>;
  return (
    <div className="flex flex-col gap-2.5">
      {stats.map((s) => {
        const value = s.levels[Math.max(0, Math.min(enh, s.levels.length - 1))];
        const label = s.label?.[lang] ?? s.label?.en ?? s.key;
        const unit = s.percent ? '%' : '';
        return (
          <div key={s.key} className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold text-zinc-100">{label}</span>
            <FlashNum value={value} suffix={unit} color={accentHex} style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 15, fontWeight: 700, color: accentHex }} />
          </div>
        );
      })}
    </div>
  );
}

function SetEffectBlock({ tag, blk, tier, lang }: { tag: string; blk: LiveSetEffectBlock; tier: number; lang: Lang }) {
  return (
    <div className="min-w-60 flex-1 rounded-lg border border-zinc-700/50 bg-slate-950/40 p-3.5">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="rounded border border-buff/30 bg-buff/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-buff">{tag}</span>
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

// Armor pieces — vertical stack of selectable cards (one per slot). Clicking a piece
// updates `selectedPiece`, which drives the adjacent substats column.
function ArmorPiecesColumn({ model, f, build, accentHex, set, selectedPiece, onSelect }: {
  model: LiveModel; f: Formula; build: Build; accentHex: string;
  set: { rarity: ItemRarity; image_prefix: string };
  selectedPiece: ArmorPiece; onSelect: (slot: ArmorPiece) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-2.5">
      {model.pieces.map((p) => {
        const sel = p.slot === selectedPiece;
        return (
          <button key={p.slot} type="button" onClick={() => onSelect(p.slot)} aria-pressed={sel}
            className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors"
            style={{ borderColor: sel ? accentHex : 'rgba(255,255,255,0.1)', background: sel ? `${accentHex}14` : 'transparent' }}>
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded">
              <Image src={getRarityBgPath(set.rarity)} alt={`${set.rarity} rarity`} fill sizes="48px" className="object-cover" />
              <div className="absolute inset-0.5"><Image src={`/images/equipment/TI_Equipment_${p.slot}_${set.image_prefix}.webp`} alt={p.slot} fill sizes="44px" className="object-contain" /></div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 text-[10px] uppercase tracking-wider" style={{ color: sel ? accentHex : '#6b7283' }}>{t(ARMOR_PIECE_I18N[p.slot] as Parameters<typeof t>[0])}</div>
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
          </button>
        );
      })}
    </div>
  );
}

// Substats column for the currently selected armor piece (driven by ArmorPiecesColumn's
// selection). Shows the piece name as context, then the effective pool via PossibleSubstats.
function ArmorSelectedSubstats({ model, f, selectedPiece }: { model: LiveModel; f: Formula; selectedPiece: ArmorPiece }) {
  const { t } = useI18n();
  const piece = model.pieces.find((p) => p.slot === selectedPiece);
  if (!piece) return <p className="text-sm text-zinc-500">—</p>;
  // Same key+percent exclusion as accessories: an EFF flat main stat must not exclude EFF % subs.
  // Only fixed mains are excluded (matches previous fixed_main_keys behavior — armor has no
  // choice-selection UI here).
  const excl = new Set<string>();
  piece.mains.forEach((s) => { if (s.type === 'fixed') excl.add(slotSig(s.key, s.percent)); });
  const eff = piece.pool.filter((o) => !excl.has(slotSig(o.key, o.percent)));
  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{t(ARMOR_PIECE_I18N[piece.slot] as Parameters<typeof t>[0])}</div>
      {eff.length === 0 ? <p className="text-sm text-zinc-500">—</p> : <PossibleSubstats pool={eff} f={f} />}
    </div>
  );
}

// ── CONFIGURE bar ──

function ConfigureBar({ model, build, accentHex }: { model: LiveModel; build: Build; accentHex: string }) {
  const { lang } = useI18n();
  const word = model.useTiers ? '+' : '';
  return (
    <section className="overflow-hidden rounded-xl border border-zinc-700/50" style={{ backgroundColor: '#0f172bcc' }}>
      <div className="flex items-center gap-2 border-b border-white/5 px-3.5 py-2.5" style={{ background: '#1e293980' }}>
        <span className="text-xs font-bold uppercase tracking-wider text-white">{lRec(LIVE_LABELS.configure, lang)}</span>
      </div>
      <div className="flex flex-col gap-2.5 px-3.5 py-3">
        <StepSlider value={build.enh} hardMax={build.maxEnh} lo={build.enhFloor} onChange={build.setEnh} accentHex={accentHex} word={word}
          label={lRec(model.useTiers ? LIVE_LABELS.enhancement : LIVE_LABELS.level, lang)} mark={model.canAscend ? model.maxEnhBase : undefined} asc={build.ascended} />
        {model.useTiers && <TierTabs tier={build.tier} onSet={build.setTier} accentHex={accentHex} />}
        {model.reforgeBase > 0 && (
          <div className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-[10px] uppercase tracking-wider text-zinc-300">{lRec(LIVE_LABELS.reforge, lang)}</span>
            <div className="flex flex-1 items-center gap-2">
              <FlashNum value={build.maxReforge} color={build.ascended ? FUCHSIA_HEX : accentHex} style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 15, fontWeight: 700, color: build.ascended ? FUCHSIA_HEX : accentHex }} />
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">available</span>
              {build.ascended && model.reforgeBonus > 0 && <span className="text-[10px] font-bold" style={{ color: FUCHSIA_HEX }}>(+{model.reforgeBonus} ✦)</span>}
            </div>
          </div>
        )}
        {model.canAscend && model.reforgeBase > 0 && (
          <div className="flex items-center gap-3">
            <span className="w-24 shrink-0" />
            <button onClick={build.toggleAscend} disabled={!build.ascended && !build.canAscendNow} aria-pressed={build.ascended}
              className="flex h-7 flex-1 items-center justify-center gap-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              style={{ border: `1px solid ${FUCHSIA_HEX}${build.ascended ? '' : '77'}`, background: build.ascended ? `${FUCHSIA_HEX}22` : 'transparent', color: FUCHSIA_HEX }}>
              <span>✦</span>{lRec(build.ascended ? LIVE_LABELS.ascended : LIVE_LABELS.ascend, lang)}
              {!build.ascended && !build.canAscendNow && <span className="text-[9px] normal-case text-zinc-500">· needs +{model.maxEnhBase}</span>}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

// ── view ──

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

  const model = useMemo(() => buildModel(props), [props]);
  const f = useMemo(() => (liveDetail ? makeFormula(liveDetail.meta) : null), [liveDetail]);
  const build = useBuild(model);
  // Selected armor piece (drives the paired substats column). Unused for non-armor models.
  const [selectedPiece, setSelectedPiece] = useState<ArmorPiece>('Helmet');

  // hero icon + chips
  let heroIcon: React.ReactNode = null;
  let typeLabel = '';
  let cls: string | null = null;
  // Live build → icon overlay: +N from `build.enh`, T<n> from `build.tier` (hidden at T0).
  // Talisman has no breakthrough, so tier stays undefined.
  const overlayTier = model.useTiers && build.tier > 0 ? build.tier : undefined;
  if (equipment.type === 'weapon') {
    const w = equipment.data; typeLabel = t('equip.tab.weapons'); cls = w.class ?? null;
    heroIcon = <EquipmentIcon src={`equipment/${w.image}`} rarity={w.rarity} alt={equipName} size={80} overlaySize={18} effectIcon={w.effect_icon} classType={w.class} level={w.level} ascended={build.ascended} enhanceLevel={build.enh} tier={overlayTier} />;
  } else if (equipment.type === 'amulet') {
    const a = equipment.data; typeLabel = t('equip.tab.accessories'); cls = a.class ?? null;
    heroIcon = <EquipmentIcon src={`equipment/${a.image}`} rarity={a.rarity} alt={equipName} size={80} overlaySize={18} effectIcon={a.effect_icon} classType={a.class} level={a.level} ascended={build.ascended} enhanceLevel={build.enh} tier={overlayTier} />;
  } else if (equipment.type === 'talisman') {
    const tl = equipment.data; typeLabel = t('equip.tab.talismans');
    heroIcon = <EquipmentIcon src={`equipment/${tl.image}`} rarity={tl.rarity} alt={equipName} size={80} overlaySize={18} effectIcon={tl.effect_icon} level={tl.level} ascended={build.ascended} enhanceLevel={build.enh} />;
  } else if (equipment.type === 'set') {
    const s = equipment.data; typeLabel = t('equip.tab.sets'); cls = s.class ?? null;
    heroIcon = <EquipmentIcon src={`equipment/TI_Equipment_Armor_${s.image_prefix}`} rarity={s.rarity} alt={equipName} size={80} overlaySize={18} effectIcon={s.set_icon} level={6} ascended={build.ascended} enhanceLevel={build.enh} tier={overlayTier} />;
  } else if (equipment.type === 'ee' && eeOwner) {
    typeLabel = t('equip.tab.ee');
    heroIcon = <EquipmentIcon
      src={`characters/ee/${eeOwner.id}`} rarity="legendary" alt={equipName}
      size={80} overlaySize={18}
      effectIcon="TI_Icon_UO_EXCLUSIVE"
      secondaryEffectIcon="TI_Icon_UO_Up"
      level={6}
      enhanceLevel={build.enh}
    />;
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
    if (model.talismanPassive) modules.push({ key: 'eff', title: t('page.character.ee.effect'), span: 1, node: <MultiTierPassiveModule passive={model.talismanPassive} enh={build.enh} accentHex={accentHex} /> });
    if (tl.source || tl.boss) modules.push({ key: 'src', title: t('equip.filter.source'), span: 2, node: <EquipmentSource source={tl.source ?? undefined} boss={tl.boss ?? undefined} bossMap={bossMap} lang={lang} linkable /> });
  } else if (model.type === 'armor' && f) {
    const s = equipment.data as SrcLike & { rarity: ItemRarity; image_prefix: string };
    modules.push({ key: 'seteff', title: t('equip.detail.set_effects'), span: 2, node: <SetEffectsModule setPassive={model.setPassive} tier={build.tier} /> });
    modules.push({ key: 'pieces', title: t('equip.detail.mainstat'), span: 2, node: <ArmorPiecesColumn model={model} f={f} build={build} accentHex={accentHex} set={s} selectedPiece={selectedPiece} onSelect={setSelectedPiece} /> });
    if (model.pieces.some((p) => {
      const ex = new Set<string>();
      p.mains.forEach((s) => { if (s.type === 'fixed') ex.add(slotSig(s.key, s.percent)); });
      return p.pool.some((o) => !ex.has(slotSig(o.key, o.percent)));
    })) modules.push({ key: 'sub', title: lRec(LIVE_LABELS.substats, lang), span: 2, node: <ArmorSelectedSubstats model={model} f={f} selectedPiece={selectedPiece} /> });
    if (armorSetAscendedRanges && (['Helmet', 'Armor', 'Gloves', 'Shoes'] as ArmorPiece[]).some((p) => armorSetAscendedRanges[p] && Object.keys(armorSetAscendedRanges[p]).length > 0)) {
      modules.push({ key: 'asc', title: lRec(ASCENSION_LABELS.title, lang), span: 2, ascension: true, node: <AscensionContentForSet standardRanges={armorSetStatRanges} ascendedRanges={armorSetAscendedRanges} lang={lang} /> });
    }
    if (s.source || s.boss) modules.push({ key: 'src', title: t('equip.filter.source'), span: 1, node: <EquipmentSource source={s.source ?? undefined} boss={s.boss ?? undefined} bossMap={bossMap} lang={lang} linkable /> });
  } else if (equipment.type === 'ee' && eeOwner) {
    const ee = equipment.data;
    // Rank priorities — ABOVE the mainstat in the left column. `rank` = Unlock Priority
    // (curated guidance for getting the EE), `rank10` = Upgrade Priority (value at +10).
    if (ee.rank || ee.rank10) {
      modules.push({ key: 'eerank', title: lRec(LIVE_LABELS.priority, lang), span: 1, node: <EERankBadges rank={ee.rank} rank10={ee.rank10} /> });
    }
    // Datamine-driven main stat (2 displayed values, both per-level). Title stays singular —
    // they're not "possible" stats, both are always granted. Falls back to the legacy
    // lerp-based single-stat display if liveDetail wasn't resolved (EE not yet in the dataset).
    if (model.eeMainStats.length > 0) {
      modules.push({ key: 'mainfixed', title: t('equip.detail.mainstat'), span: 1, node: <EEMainStatsModule stats={model.eeMainStats} enh={build.enh} accentHex={accentHex} /> });
    } else if (model.eeMain) {
      modules.push({ key: 'mainfixed', title: t('equip.detail.mainstat'), span: 1, node: (
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-bold text-zinc-100">{model.eeMain.label}</span>
          <FlashNum value={eeMainVal ?? '—'} suffix="%" color={accentHex} style={{ fontWeight: 700, fontSize: 18, color: accentHex }} />
        </div>
      ) });
    }
    // Owner full-art module — paired with mainstat on the right.
    modules.push({ key: 'owner', title: t('equip.detail.owner'), span: 1, node: (
      <EEOwnerFullArt owner={eeOwner} companion={eeCfCompanion} />
    ) });
    // Datamine passive (multi-tier) takes precedence; curated effect kept as fallback.
    if (model.talismanPassive) {
      modules.push({ key: 'eff', title: t('page.character.ee.effect'), span: 1, node: <MultiTierPassiveModule passive={model.talismanPassive} enh={build.enh} accentHex={accentHex} /> });
    } else if (model.effect) {
      modules.push({ key: 'eff', title: t('page.character.ee.effect'), span: 2, node: <CuratedEffectModule effect={model.effect} useTiers={false} build={build} accentHex={accentHex} /> });
    }
    if (ee.buff.length > 0 || ee.debuff.length > 0) {
      const bdTitle = ee.buff.length > 0 && ee.debuff.length > 0 ? `${t('characters.filters.buffs')} / ${t('characters.filters.debuffs')}` : ee.buff.length > 0 ? t('characters.filters.buffs') : t('characters.filters.debuffs');
      modules.push({ key: 'buffs', title: bdTitle, span: 2, node: <BuffDebuffDisplay buffs={ee.buff} debuffs={ee.debuff} /> });
    }
  }

  // Layout: pair a vertical stack of modules (left) with a single companion module (right).
  //   • weapon/accessory: [Main Stat, Possible Main Stats] | [Substats]; eff/seteff above
  //   • armor: [selectable pieces] | [piece substats]; eff/seteff above
  //   • EE: [Rank, Main Stat, Effect, Buffs] | [Owner Full Art]; owner spans the full height
  const moduleByKey = (k: string) => modules.find((m) => m.key === k);
  const baseLeft = (['eerank', 'mainfixed', 'mainposs', 'pieces'] as const).map(moduleByKey).filter((m): m is EDModule => !!m);
  const subModule = moduleByKey('sub');
  const ownerModule = moduleByKey('owner');
  const rightCompanion = subModule ?? ownerModule;
  const pairStats = baseLeft.length > 0 && !!rightCompanion;
  // When pairing with `owner` (EE), stack eff + buffs in the left column too — the full-art
  // companion takes the full right-column height; otherwise eff floats above the pair.
  const extraLeft = pairStats && ownerModule && !subModule
    ? [moduleByKey('eff'), moduleByKey('buffs')].filter((m): m is EDModule => !!m)
    : [];
  const leftStat = [...baseLeft, ...extraLeft];
  const effModule = pairStats && subModule ? (moduleByKey('eff') ?? moduleByKey('seteff')) : undefined;
  // Effect on the left, source on the right — paired in a row above the stat block.
  // Source falls back to restModules when effModule is absent.
  const srcModule = effModule ? moduleByKey('src') : undefined;
  const restExclude = new Set<string>();
  if (pairStats) {
    ['eerank', 'mainfixed', 'mainposs', 'pieces', 'sub', 'owner'].forEach((k) => restExclude.add(k));
    extraLeft.forEach((m) => restExclude.add(m.key));
    if (effModule) ['eff', 'seteff'].forEach((k) => restExclude.add(k));
    if (srcModule) restExclude.add('src');
  }
  const restModules = restExclude.size > 0 ? modules.filter((m) => !restExclude.has(m.key)) : modules;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6" style={{ fontFamily: 'var(--font-game)' }}>
      <Link href={href('/equipment')} className="mb-4 inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-zinc-500 transition-colors hover:text-zinc-300">
        <span aria-hidden="true">←</span> {t('equip.detail.back')}
      </Link>

      <div className="mb-3.5 grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <div className="overflow-hidden rounded-xl border bg-zinc-900/60" style={{ borderColor: `${accentHex}3a` }}>
          <div className="flex h-full items-center gap-3 p-4 md:gap-4 md:p-5">
            {heroIcon}
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: accentHex }}>{typeLabel}</span>
                <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ border: `1px solid ${accentHex}77`, background: `${accentHex}18`, color: accentHex }}>{rarityLabel}</span>
                {model.star > 0 && <span className="text-[11px] font-bold text-amber-300">{'★'.repeat(model.star)}</span>}
                {cls && <span className="text-[10px] uppercase tracking-wider text-zinc-400">{classLabel(cls)}</span>}
              </div>
              <h1 className="m-0 pb-0 text-2xl font-bold leading-tight after:hidden md:text-4xl"
                style={build.ascended
                  ? { background: SINGULARITY_NAME_GRADIENT, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', whiteSpace: 'pre-line' }
                  : { color: accentHex, transition: 'color .25s ease' }}>
                {build.ascended ? lRec(SINGULARITY_NAME, lang).replace('{0}', equipName).replace('- [', '-\n[') : equipName}
              </h1>
            </div>
          </div>
        </div>

        <ConfigureBar model={model} build={build} accentHex={accentHex} />
      </div>

      {effModule && (
        <div className={`mb-3 ${srcModule ? 'grid grid-cols-1 items-start gap-3 md:grid-cols-2' : ''}`}>
          <Module key={effModule.key} title={effModule.title} ascension={effModule.ascension} accentHex={accentHex}>{effModule.node}</Module>
          {srcModule && (
            <Module key={srcModule.key} title={srcModule.title} ascension={srcModule.ascension} accentHex={accentHex}>{srcModule.node}</Module>
          )}
        </div>
      )}

      {pairStats && rightCompanion && (
        <div className="mb-3 grid grid-cols-1 items-start gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            {leftStat.map((m) => <Module key={m.key} title={m.title} accentHex={accentHex}>{m.node}</Module>)}
          </div>
          <Module key={rightCompanion.key} title={rightCompanion.title} accentHex={accentHex}>{rightCompanion.node}</Module>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
        {restModules.map((m) => <Module key={m.key} title={m.title} span={m.span} ascension={m.ascension} accentHex={accentHex}>{m.node}</Module>)}
        {recoCharacters.length > 0 && (
          <Module key="reco" title={t('equip.detail.recommended_by')} span={2} accentHex={accentHex}>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6">
              {recoCharacters.map((char) => <CharacterRefInline key={char.id} char={char} />)}
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
