'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import type { Transcendence } from '@/types/character';
import type { Lang } from '@/lib/i18n/config';
import { useI18n } from '@/lib/contexts/I18nContext';
import { formatEffectText } from '@/lib/format-text';
import { STAR_ICONS, starRowForLevel } from '@/lib/stars';

type Props = {
  transcend: Transcendence;
  rarity?: number;
};

type LevelId =
  | '1' | '2' | '3'
  | '4' | '4_1' | '4_2'
  | '5' | '5_1' | '5_2' | '5_3'
  | '6';

type Step = { label: string; key: LevelId };

/* ── i18n level labels ── */
const LEVEL_LABELS: Record<LevelId, string> = {
  '1': '1', '2': '2', '3': '3',
  '4': '4', '4_1': '4', '4_2': '4+',
  '5': '5', '5_1': '5', '5_2': '5+', '5_3': '5++',
  '6': '6',
};

/* ── Localize a transcend level ── */
function getDesc(transcend: Transcendence, level: string, lang: Lang): string | null {
  if (lang === 'en') return transcend[level] ?? null;
  return (transcend[`${level}_${lang}`] as string) ?? transcend[level] ?? null;
}

/* ── Parse "+X% Label" or "Label +X%" ── */
function parseNumericBonus(s: string): { kind: 'pct' | 'flat'; label: string; amount: number } | null {
  let m = s.match(/^\+(\d+)%\s+(.+)$/);
  if (m) return { kind: 'pct', amount: parseInt(m[1], 10), label: m[2].trim() };
  m = s.match(/^\+(\d+)\s+(.+)$/);
  if (m) return { kind: 'flat', amount: parseInt(m[1], 10), label: m[2].trim() };
  m = s.match(/^(.+?)\s*\+(\d+)%$/);
  if (m) return { kind: 'pct', amount: parseInt(m[2], 10), label: m[1].trim() };
  m = s.match(/^(.+?)\s*\+(\d+)$/);
  if (m) return { kind: 'flat', amount: parseInt(m[2], 10), label: m[1].trim() };
  return null;
}

/* ── Component ── */
export default function TranscendenceSlider({ transcend, rarity = 3 }: Props) {
  const { lang } = useI18n();

  const steps = useMemo<Step[]>(() => {
    const order: LevelId[] = rarity === 3
      ? ['3', '4_1', '4_2', '5_1', '5_2', '5_3', '6']
      : ['1', '2', '3', '4', '5', '6'];
    return order
      .filter((k) => getDesc(transcend, k, lang) != null)
      .map((k) => ({ key: k, label: LEVEL_LABELS[k] }));
  }, [transcend, lang, rarity]);

  const { initialIndex, minIndex } = useMemo(() => {
    if (!steps.length) return { initialIndex: 0, minIndex: 0 };
    const target = Math.min(Math.max(rarity, 1), 3).toString() as LevelId;
    const idx = steps.findIndex((s) => s.key === target);
    const valid = idx >= 0 ? idx : 0;
    return { initialIndex: valid, minIndex: valid };
  }, [steps, rarity]);

  const [index, setIndex] = useState(initialIndex);
  useEffect(() => setIndex(initialIndex), [initialIndex]);

  const currentKey = steps[index]?.key as LevelId | undefined;

  /* ── Cumulative bonus computation ── */
  const activeBonuses = useMemo(() => {
    if (!steps.length) return [] as string[];

    let lastAtkDefHpLine: string | null = null;
    const bonusMap: Record<string, number> = {};
    const uniqueEffects = new Map<string, string>();
    const otherBonuses = new Set<string>();

    for (let i = minIndex; i <= index; i++) {
      const raw = getDesc(transcend, steps[i].key, lang);
      if (!raw) continue;
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const mStats = trimmed.match(/^(?:ATK|Atk)\s+(?:DEF|Def)\s+(?:HP|Hp)\s*\+(\d+)%$/);
        if (mStats) {
          lastAtkDefHpLine = `ATK DEF HP +${mStats[1]}%`;
          continue;
        }

        const parsed = parseNumericBonus(trimmed);
        if (parsed) {
          const norm = parsed.label.replace(/\s+/g, ' ').trim();
          const k = parsed.kind === 'flat' ? `flat|${norm}` : norm;
          bonusMap[k] = (bonusMap[k] || 0) + parsed.amount;
          continue;
        }

        otherBonuses.add(trimmed);
      }
    }

    const result: string[] = [];
    if (lastAtkDefHpLine) result.push(lastAtkDefHpLine);
    for (const [label, value] of Object.entries(bonusMap)) {
      if (label.startsWith('flat|')) result.push(`+${value} ${label.slice(5)}`);
      else result.push(`+${value}% ${label}`);
    }
    for (const v of uniqueEffects.values()) result.push(v);
    for (const v of otherBonuses) result.push(v);
    return result;
  }, [index, minIndex, steps, transcend, lang]);

  if (!steps.length || !currentKey) return null;

  const progressPct = steps.length > 1
    ? ((index - minIndex) / (steps.length - 1 - minIndex)) * 100
    : 100;

  return (
    <div className="space-y-3">
      {/* Slider row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex grow items-center gap-2">
          <button
            onClick={() => setIndex((p) => Math.max(p - 1, minIndex))}
            disabled={index <= minIndex}
            className="flex h-6 w-6 items-center justify-center rounded bg-zinc-700 text-sm text-white hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Previous"
          >
            &ndash;
          </button>

          <div className="relative h-2 grow overflow-hidden rounded-full bg-zinc-700">
            <div
              className="absolute left-0 top-0 h-full bg-yellow-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
            <input
              type="range"
              min={minIndex}
              max={steps.length - 1}
              value={index}
              onChange={(e) => setIndex(Number(e.target.value))}
              className="absolute left-0 top-0 h-2 w-full cursor-pointer opacity-0"
              aria-label="Transcendence level"
            />
          </div>

          <button
            onClick={() => setIndex((p) => Math.min(p + 1, steps.length - 1))}
            disabled={index >= steps.length - 1}
            className="flex h-6 w-6 items-center justify-center rounded bg-zinc-700 text-sm text-white hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Next"
          >
            +
          </button>
        </div>

        {/* Stars */}
        <div className="flex gap-px">
          {starRowForLevel(currentKey).map((color, i) => (
            <Image key={i} src={STAR_ICONS[color]} alt="" width={18} height={18} className="object-contain" />
          ))}
        </div>
      </div>

      {/* Cumulative bonuses */}
      <div className="space-y-1.5">
        {activeBonuses.map((bonus, i) => {
          const match = bonus.match(/^ATK DEF HP \+(\d+)%$/);
          if (match) {
            return (
              <div key={i} className="flex items-center gap-1 text-xs text-white">
                <Image src="/images/ui/effect/CM_Stat_Icon_ATK.webp" alt="ATK" width={16} height={16} className="object-contain" />
                <Image src="/images/ui/effect/CM_Stat_Icon_DEF.webp" alt="DEF" width={16} height={16} className="object-contain" />
                <Image src="/images/ui/effect/CM_Stat_Icon_HP.webp" alt="HP" width={16} height={16} className="object-contain" />
                <span className="ml-1">+{match[1]}%</span>
              </div>
            );
          }
          return (
            <div key={i} className="whitespace-pre-line text-xs leading-tight text-white">
              {formatEffectText(bonus)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
