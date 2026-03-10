'use client';

import Image from 'next/image';
import ItemInline from '@/app/components/inline/ItemInline';
import StatInline from '@/app/components/inline/StatInline';
import SharedStarIcons, { YellowStars } from '@/app/components/ui/StarIcons';
import { getRarityBgPath } from '@/lib/format-text';
import type { StarColor } from '@/lib/stars';
import type { Lang } from '@/lib/i18n/config';
import { l } from '@/lib/i18n/localize';

import weaponsData from '@data/equipment/weapon.json';
import setsData from '@data/equipment/sets.json';
const statValues: Record<string, string[]> = {
  'ATK%': ['4%', '8%', '12%', '16%', '20%', '24%'],
  CHC: ['3%', '6%', '9%', '12%', '15%', '18%'],
  CHD: ['4%', '8%', '12%', '16%', '20%', '24%'],
  SPD: ['3', '6', '9', '12', '15', '18'],
};

// ============================================================================
// TYPES
// ============================================================================

export type TabKey = 'basics' | 'upgrading' | 'obtaining' | 'faq';

export type GearRarity = 'normal' | 'superior' | 'epic' | 'legendary';

export type EnhancementExample = {
  rarity: GearRarity;
  star: number;
  atkBase: number;
  atkMax: number;
};

export type GearPrioritySlotKey = 'weapons' | 'accessories' | 'gloves' | 'otherArmor';

export type EquipmentClass = 'ranger' | 'striker' | 'healer' | 'defender' | 'mage' | null;

// ============================================================================
// CONSTANTS
// ============================================================================

export const HAMMER_ITEMS = ["Apprentice's Hammer", "Expert's Hammer", "Master's Hammer", "Artisan's Hammer"] as const;
export const CATALYST_ITEMS = ['Normal Reforge Catalyst', 'Superior Reforge Catalyst', 'Epic Reforge Catalyst', 'Legendary Reforge Catalyst'] as const;
export const GLUNITE_ITEMS = ['Glunite', 'Refined Glunite', 'Event Glunite', 'Armor Glunite'] as const;
export const ENHANCEMENT_EXAMPLES: EnhancementExample[] = [
  { rarity: 'normal', star: 1, atkBase: 18, atkMax: 90 },
  { rarity: 'epic', star: 2, atkBase: 54, atkMax: 270 },
  { rarity: 'legendary', star: 1, atkBase: 30, atkMax: 150 },
];
export const PERFECT_SUBSTATS = ['ATK%', 'CHC', 'CHD', 'SPD'] as const;
const CHANGE_STAT_MODES: { key: string; item: string }[] = [
  { key: 'changeAll', item: 'Transistone (Total)' },
  { key: 'selectChange', item: 'Transistone (Individual)' },
];

export const GEAR_PRIORITY: { rank: number; slotKey: GearPrioritySlotKey; color: string }[] = [
  { rank: 1, slotKey: 'weapons', color: 'red' },
  { rank: 2, slotKey: 'accessories', color: 'purple' },
  { rank: 3, slotKey: 'gloves', color: 'amber' },
  { rank: 4, slotKey: 'otherArmor', color: 'blue' },
];

const UPGRADE_METHODS = [
  { key: 'enhance', color: 'green' },
  { key: 'reforge', color: 'purple' },
  { key: 'breakthrough', color: 'amber' },
  { key: 'changeStats', color: 'cyan' },
];

const OBTAINING_METHODS = [
  { key: 'farmBosses', color: 'green' },
  { key: 'craftArmor', color: 'blue' },
  { key: 'preciseCraft', color: 'purple' },
  { key: 'irregularBosses', color: 'amber' },
];

// ============================================================================
// LOCAL HELPER COMPONENTS
// ============================================================================

/** Build a star color array with orange + yellow stars */
function buildStarRow(yellow: number, orange = 0): StarColor[] {
  return [
    ...Array<StarColor>(orange).fill('o'),
    ...Array<StarColor>(yellow).fill('y'),
  ];
}

/** Inline star level display (e.g. "1★" or "6★") for text contexts */
export function StarLevel({ levelLabel, size = 14 }: { levelLabel: string; size?: number }) {
  const count = parseInt(levelLabel, 10) || 0;
  return <YellowStars count={count} size={size} />;
}

// ============================================================================
// EQUIPMENT CARD (visual example, not real data)
// ============================================================================

type EquipmentCardData = {
  type: 'Weapon' | 'Accessary' | 'Helmet' | 'Gloves' | 'Armor' | 'Shoes';
  rarity: GearRarity;
  star: number;
  reforge: number;
  tier: number | null;
  level: number | null;
  class: EquipmentClass;
  effect: number | null;
};

export function EquipmentCardInline({ data }: { data: EquipmentCardData }) {
  const realStar = data.star - data.reforge;
  const effet = data.effect !== null ? String(data.effect).padStart(2, '0') : null;
  const classLabel = data.class ? data.class.charAt(0).toUpperCase() + data.class.slice(1) : null;

  return (
    <div className="relative size-24 rounded-md">
      <div className="relative size-24 rounded-md">
        <div className="absolute inset-0 z-0">
          <Image src={getRarityBgPath(data.rarity)} alt="" fill sizes="96px" className="object-cover" />
        </div>
        <Image
          src={`/images/equipment/TI_Equipment_${data.type}_0${data.star}.webp`}
          alt="equipment"
          fill
          sizes="96px"
          className="relative z-10 object-contain"
        />
        <div className="absolute bottom-1 left-0 z-20 inline-flex w-full justify-center items-center">
          <SharedStarIcons stars={buildStarRow(realStar, data.reforge)} size={18} spacing={-3} />
        </div>
        {effet && (
          <div className="absolute top-2 right-2 z-20 translate-x-1/3 -translate-y-1/3">
            <Image
              src={
                ['Helmet', 'Gloves', 'Armor', 'Shoes'].includes(data.type)
                  ? `/images/ui/effect/TI_Icon_Set_Enchant_${effet}.webp`
                  : `/images/ui/effect/TI_Icon_UO_${data.type}_${effet}.webp`
              }
              alt="Effect"
              width={24}
              height={24}
              style={{ width: 24, height: 24 }}
            />
          </div>
        )}
        {classLabel && (
          <div className="absolute right-2 top-8 -translate-y-1/3 z-20 translate-x-1/3">
            <Image
              src={`/images/ui/class/CM_Class_${classLabel}.webp`}
              alt="Class"
              width={24}
              height={24}
              style={{ width: 24, height: 24 }}
            />
          </div>
        )}
        {data.tier !== null && (
          <div className="absolute top-12 left-0 z-30 italic font-bold text-white px-1 rounded">
            T{data.tier}
          </div>
        )}
        {data.level !== null && (
          <div
            className="absolute top-13 right-0 z-30 text-xs text-white px-1"
            style={{ background: 'linear-gradient(to left, rgba(0,0,0,1), rgba(0,0,0,0))' }}
          >
            +{data.level}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// EQUIPMENT INTRO (interactive property highlights)
// ============================================================================

import { useState } from 'react';

export type EquipmentPropertyKey = 'stars' | 'reforge' | 'rarity' | 'upgrade' | 'tier' | 'set' | 'class';
const PROPERTY_KEYS: EquipmentPropertyKey[] = ['stars', 'reforge', 'rarity', 'upgrade', 'tier', 'set', 'class'];

function OverlayBox({ className = '' }: { className?: string }) {
  return <div className={`absolute z-40 animate-pulse border-2 border-white rounded bg-yellow-300/30 ${className}`} />;
}

export function EquipmentIntro({ labels }: { labels: Record<EquipmentPropertyKey, string> }) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="flex gap-4">
      <ul className="list-disc list-inside space-y-1">
        {PROPERTY_KEYS.map((key) => (
          <li
            key={key}
            className="cursor-pointer transition-opacity"
            onMouseEnter={() => setHovered(key)}
            onMouseLeave={() => setHovered(null)}
          >
            {labels[key]}
          </li>
        ))}
      </ul>
      <div className="relative size-24 rounded-md shadow-lg overflow-hidden">
        <div className="relative h-full w-full transition-all duration-300">
          <div className={`absolute inset-0 z-0 transition-all duration-300 ${hovered && hovered !== 'rarity' ? 'grayscale opacity-50' : ''}`}>
            <Image src={getRarityBgPath('legendary')} alt="" fill sizes="96px" className="object-cover" />
          </div>
          <Image
            src="/images/equipment/TI_Equipment_Weapon_06.webp"
            alt="weapon"
            fill
            sizes="96px"
            className={`relative z-10 object-contain transition-all duration-300 ${hovered ? 'grayscale opacity-50' : ''}`}
          />
          <div className={`absolute bottom-1 left-0 z-20 inline-flex justify-center items-center w-full transition-all duration-300 ${hovered && hovered !== 'stars' && hovered !== 'reforge' ? 'grayscale opacity-50' : ''}`}>
            <SharedStarIcons stars={buildStarRow(4, 2)} size={18} spacing={-3} />
          </div>
          <div className={`absolute top-2 right-2 z-20 translate-x-1/3 -translate-y-1/3 transition-all duration-300 ${hovered && hovered !== 'set' ? 'grayscale opacity-50' : ''}`}>
            <Image src="/images/ui/effect/TI_Icon_UO_Weapon_08.webp" alt="Effect" width={24} height={24} style={{ width: 24, height: 24 }} />
          </div>
          <div className={`absolute right-2 top-8 -translate-y-1/3 z-20 translate-x-1/3 transition-all duration-300 ${hovered && hovered !== 'class' ? 'grayscale opacity-50' : ''}`}>
            <Image src="/images/ui/class/CM_Class_Ranger.webp" alt="Class" width={24} height={24} style={{ width: 24, height: 24 }} />
          </div>
          <div className={`absolute top-12 left-0 z-30 italic font-bold text-white px-1 rounded transition-all duration-300 ${hovered && hovered !== 'tier' ? 'grayscale opacity-50' : ''}`}>
            T1
          </div>
          <div
            className={`absolute top-13 right-0 z-30 text-xs text-white px-1 transition-all duration-300 ${hovered && hovered !== 'upgrade' ? 'grayscale opacity-50' : ''}`}
            style={{ background: 'linear-gradient(to left, rgba(0,0,0,1), rgba(0,0,0,0))' }}
          >
            +4
          </div>
        </div>
        {hovered === 'stars' && <OverlayBox className="bottom-1 h-5 w-full" />}
        {hovered === 'reforge' && <OverlayBox className="bottom-1 left-1 h-5 w-8" />}
        {hovered === 'upgrade' && <OverlayBox className="right-0 top-12.5 w-7 h-5" />}
        {hovered === 'tier' && <OverlayBox className="top-12 left-0 right-0 w-8 h-6" />}
        {hovered === 'class' && <OverlayBox className="right-0 top-5.5 w-6 h-7" />}
        {hovered === 'set' && <OverlayBox className="right-0 top-0 w-6 h-6" />}
      </div>
    </div>
  );
}

// ============================================================================
// SUBSTAT BARS
// ============================================================================

export function SubstatBar({ yellow, orange = 0 }: { yellow: number; orange?: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 6 }).map((_, i) => {
        const color = i < yellow ? 'bg-yellow-400' : i < yellow + orange ? 'bg-orange-400' : 'bg-gray-700';
        return <div key={i} className={`h-2 rounded-sm ${color}`} style={{ width: '50px' }} />;
      })}
    </div>
  );
}

export function SubstatBarWithValue({ stat, yellow, orange }: { stat: string; yellow: number; orange: number }) {
  const total = Math.min(yellow + orange, 6);
  const value = statValues[stat]?.[total - 1] ?? '?';

  return (
    <div className="w-fit">
      <div className="mb-1 flex items-center justify-between">
        <StatInline name={stat} />
        <span className="ml-4 text-sm text-white">{value}</span>
      </div>
      <SubstatBar yellow={yellow} orange={orange} />
    </div>
  );
}

// ============================================================================
// MATERIALS DISPLAY
// ============================================================================

export function MaterialsList({ label, items }: { label: string; items: readonly string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-neutral-400">{label}</span>
      {items.map((item) => (
        <ItemInline key={item} name={item} />
      ))}
    </div>
  );
}

// ============================================================================
// SUBSTAT COLOR LEGEND & PERFECT EXAMPLE
// ============================================================================

export function SubstatColorLegend({ labels }: { labels: { gray: string; yellow: string; orange: string } }) {
  return (
    <div className="mt-4">
      <SubstatBar yellow={2} orange={3} />
      <ul className="mt-3 list-inside list-disc space-y-1">
        <li><span className="text-neutral-400">{labels.gray.split('—')[0].trim()}</span> — {labels.gray.split('—')[1]?.trim()}</li>
        <li><span className="text-yellow-400">{labels.yellow.split('—')[0].trim()}</span> — {labels.yellow.split('—')[1]?.trim()}</li>
        <li><span className="text-orange-400">{labels.orange.split('—')[0].trim()}</span> — {labels.orange.split('—')[1]?.trim()}</li>
      </ul>
    </div>
  );
}

export function PerfectSubstatsExample() {
  return (
    <div className="inline-block rounded-lg bg-slate-900/50 p-4">
      <ul className="space-y-2">
        {PERFECT_SUBSTATS.map((stat) => (
          <li key={stat}><SubstatBarWithValue stat={stat} yellow={3} orange={0} /></li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// ENHANCEMENT COMPARISON
// ============================================================================

function EnhancementColumn({ example, labelText, labelColor }: { example: EnhancementExample; labelText: string; labelColor: string }) {
  return (
    <div className="flex w-40 flex-col items-center gap-4">
      <p className={`${labelColor} text-sm`}>{labelText}</p>
      <div className="flex flex-col items-center">
        <EquipmentCardInline data={{ type: 'Weapon', rarity: example.rarity, star: example.star, reforge: 0, tier: null, level: null, class: null, effect: null }} />
        <div className="mt-1 flex items-center gap-1 text-sm">
          <StatInline name="ATK" iconOnly /> {example.atkBase}
        </div>
      </div>
      <span className="text-neutral-500">↓</span>
      <div className="flex flex-col items-center">
        <EquipmentCardInline data={{ type: 'Weapon', rarity: example.rarity, star: example.star, reforge: 0, tier: null, level: 10, class: null, effect: null }} />
        <div className="mt-1 flex items-center gap-1 text-sm">
          <StatInline name="ATK" iconOnly /> {example.atkMax}
        </div>
      </div>
    </div>
  );
}

export function EnhancementComparisonGrid({ labels }: { labels: { normal: string; epic: string; legendary: string } }) {
  const labelConfigs = [
    { key: 'normal' as const, color: 'text-neutral-400' },
    { key: 'epic' as const, color: 'text-blue-400' },
    { key: 'legendary' as const, color: 'text-red-400' },
  ];

  return (
    <div className="flex flex-wrap justify-center gap-8">
      {ENHANCEMENT_EXAMPLES.map((example, idx) => (
        <EnhancementColumn key={example.rarity} example={example} labelText={labels[labelConfigs[idx].key]} labelColor={labelConfigs[idx].color} />
      ))}
    </div>
  );
}

// ============================================================================
// BREAKTHROUGH EXAMPLES
// ============================================================================

function highlightDifferences(t1Text: string | null, t4Text: string | null): React.ReactNode {
  if (!t4Text) return null;
  if (!t1Text) return <span className="text-green-400">{t4Text}</span>;

  const numberPattern = /(\d+(?:\.\d+)?%?)/g;
  const t1Numbers = t1Text.match(numberPattern) || [];
  const t4Numbers = t4Text.match(numberPattern) || [];

  if (t4Numbers.length === 0 || JSON.stringify(t1Numbers) === JSON.stringify(t4Numbers)) {
    return <span className="text-neutral-400">{t4Text}</span>;
  }

  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let t1Index = 0;
  let match: RegExpExecArray | null;

  const regex = /(\d+(?:\.\d+)?%?)/g;
  while ((match = regex.exec(t4Text)) !== null) {
    if (match.index > lastIndex) {
      result.push(<span key={`text-${lastIndex}`} className="text-neutral-400">{t4Text.slice(lastIndex, match.index)}</span>);
    }
    const t4Num = match[1];
    const t1Num = t1Numbers[t1Index];
    const isChanged = t1Num !== t4Num;
    result.push(<span key={`num-${match.index}`} className={isChanged ? 'text-green-400 font-medium' : 'text-neutral-400'}>{t4Num}</span>);
    lastIndex = regex.lastIndex;
    t1Index++;
  }

  if (lastIndex < t4Text.length) {
    result.push(<span key="text-end" className="text-neutral-400">{t4Text.slice(lastIndex)}</span>);
  }

  return <>{result}</>;
}

export function BreakthroughExamplesGrid({ lang }: { lang: Lang }) {
  const surefireGreatsword = weaponsData.find((w) => w.name === 'Surefire Greatsword');
  const immunitySet = setsData.find((s) => s.name === 'Immunity Set');
  const penetrationSet = setsData.find((s) => s.name === 'Penetration Set');

  return (
    <div className="flex flex-wrap justify-center gap-8">
      {surefireGreatsword && (
        <div className="flex min-w-50 flex-col items-center gap-4">
          <p className="font-medium text-amber-400">{l(surefireGreatsword, 'name', lang)}</p>
          <div className="flex flex-col items-center">
            <EquipmentCardInline data={{ type: 'Weapon', rarity: 'legendary', star: 6, reforge: 0, tier: null, level: null, class: (surefireGreatsword.class?.toLowerCase() ?? null) as EquipmentClass, effect: 11 }} />
            <div className="mt-2 text-center text-sm">
              <div className="flex items-center justify-center gap-1"><StatInline name="ATK" iconOnly /> 200</div>
              <p className="mt-1 max-w-45 text-neutral-400">{l(surefireGreatsword, 'effect_desc1', lang)}</p>
            </div>
          </div>
          <span className="text-neutral-500">↓ T4</span>
          <div className="flex flex-col items-center">
            <EquipmentCardInline data={{ type: 'Weapon', rarity: 'legendary', star: 6, reforge: 0, tier: 4, level: null, class: (surefireGreatsword.class?.toLowerCase() ?? null) as EquipmentClass, effect: 11 }} />
            <div className="mt-2 text-center text-sm">
              <div className="flex items-center justify-center gap-1"><StatInline name="ATK" iconOnly /> <span className="text-green-400">240</span></div>
              <p className="mt-1 max-w-45">
                {highlightDifferences(l(surefireGreatsword, 'effect_desc1', lang), l(surefireGreatsword, 'effect_desc4', lang))}
              </p>
            </div>
          </div>
        </div>
      )}

      {immunitySet && (
        <div className="flex min-w-50 flex-col items-center gap-4">
          <p className="font-medium text-amber-400">{l(immunitySet, 'name', lang)}</p>
          <div className="flex flex-col items-center">
            <EquipmentCardInline data={{ type: 'Armor', rarity: 'legendary', star: 6, reforge: 0, tier: null, level: null, class: null, effect: 19 }} />
            <div className="mt-2 text-center text-sm">
              <div className="flex items-center justify-center gap-1"><StatInline name="DEF" iconOnly /> 100</div>
              <p className="mt-1 max-w-45 text-neutral-400">2p: {l(immunitySet, 'effect_2_1', lang)}</p>
            </div>
          </div>
          <span className="text-neutral-500">↓ T4</span>
          <div className="flex flex-col items-center">
            <EquipmentCardInline data={{ type: 'Armor', rarity: 'legendary', star: 6, reforge: 0, tier: 4, level: null, class: null, effect: 19 }} />
            <div className="mt-2 text-center text-sm">
              <div className="flex items-center justify-center gap-1"><StatInline name="DEF" iconOnly /> <span className="font-medium text-green-400">120</span></div>
              <p className="mt-1 max-w-45">
                <span className="text-neutral-400">2p: </span>
                {highlightDifferences(l(immunitySet, 'effect_2_1', lang), l(immunitySet, 'effect_2_4', lang))}
              </p>
              <p className="max-w-45 text-green-400">4p: {l(immunitySet, 'effect_4_4', lang)}</p>
            </div>
          </div>
        </div>
      )}

      {penetrationSet && (
        <div className="flex min-w-50 flex-col items-center gap-4">
          <p className="font-medium text-amber-400">{l(penetrationSet, 'name', lang)}</p>
          <div className="flex flex-col items-center">
            <EquipmentCardInline data={{ type: 'Armor', rarity: 'legendary', star: 6, reforge: 0, tier: null, level: null, class: null, effect: 11 }} />
            <div className="mt-2 text-center text-sm">
              <div className="flex items-center justify-center gap-1"><StatInline name="DEF" iconOnly /> 100</div>
              <p className="mt-1 max-w-45 text-neutral-400">4p: {l(penetrationSet, 'effect_4_1', lang)}</p>
            </div>
          </div>
          <span className="text-neutral-500">↓ T4</span>
          <div className="flex flex-col items-center">
            <EquipmentCardInline data={{ type: 'Armor', rarity: 'legendary', star: 6, reforge: 0, tier: 4, level: null, class: null, effect: 11 }} />
            <div className="mt-2 text-center text-sm">
              <div className="flex items-center justify-center gap-1"><StatInline name="DEF" iconOnly /> <span className="font-medium text-green-400">120</span></div>
              <p className="mt-1 max-w-45 text-green-400">2p: {l(penetrationSet, 'effect_2_4', lang)}</p>
              <p className="mt-1 max-w-45">
                <span className="text-neutral-400">4p: </span>
                {highlightDifferences(l(penetrationSet, 'effect_4_1', lang), l(penetrationSet, 'effect_4_4', lang))}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SECTION HEADER
// ============================================================================

export function SectionHeader({ number, title, color }: { number: number; title: string; color: string }) {
  return (
    <h2 className={`text-xl font-bold text-${color}-400 flex items-center gap-2`}>
      <span className={`flex size-8 items-center justify-center rounded-full bg-${color}-500/20 text-sm`}>{number}</span>
      {title}
    </h2>
  );
}

// ============================================================================
// UPGRADE METHODS GRID
// ============================================================================

export function UpgradeMethodsGrid({ labels }: { labels: Record<string, { title: string; desc: string }> }) {
  return (
    <div className="mb-8 grid gap-4 md:grid-cols-2">
      {UPGRADE_METHODS.map(({ key, color }) => (
        <div key={key} className={`rounded-lg border border-${color}-500/30 bg-linear-to-br from-${color}-900/20 to-${color}-900/10 p-4`}>
          <p className={`font-semibold text-${color}-400`}>{labels[key].title}</p>
          <p className="text-sm text-neutral-400">{labels[key].desc}</p>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// CHANGE STATS MODES
// ============================================================================

export function ChangeStatsModesGrid({ labels }: { labels: Record<string, { title: string; desc: string }> }) {
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      {CHANGE_STAT_MODES.map(({ key, item }) => (
        <div key={key} className="rounded-lg border border-cyan-500/30 bg-cyan-900/20 p-4">
          <p className="mb-2 font-semibold text-cyan-300">{labels[key].title}</p>
          <p className="text-sm text-neutral-300">{labels[key].desc}</p>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-neutral-400">Cost:</span>
            <ItemInline name={item} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// GEAR PRIORITY LIST
// ============================================================================

export function GearPriorityList({ slots, descriptions }: { slots: Record<GearPrioritySlotKey, string>; descriptions: Record<GearPrioritySlotKey, string> }) {
  return (
    <div className="space-y-3">
      {GEAR_PRIORITY.map(({ rank, slotKey, color }) => (
        <div key={slotKey} className={`flex items-center gap-3 rounded-lg bg-${color}-900/20 p-3`}>
          <span className={`text-2xl font-bold text-${color}-400`}>{rank}</span>
          <div>
            <p className={`font-semibold text-${color}-300`}>{slots[slotKey]}</p>
            <p className="text-sm text-neutral-400">{descriptions[slotKey]}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// OBTAINING METHODS LIST
// ============================================================================

export function ObtainingMethodsList({ content }: { content: Record<string, { title: string; content: React.ReactNode }> }) {
  return (
    <div className="space-y-6">
      {OBTAINING_METHODS.map(({ key, color }, idx) => (
        <div key={key} className={`border-l-4 border-${color}-500 pl-4`}>
          <h2>
            {idx + 1}. {content[key].title}
          </h2>
          <div className="mt-2 text-neutral-300">{content[key].content}</div>
        </div>
      ))}
    </div>
  );
}
