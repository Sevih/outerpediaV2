'use client';

import { type ReactNode, use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatEffectText, stripColorTags } from '@/lib/format-text';
import SharedStarIcons, { YellowStars } from '@/app/components/ui/StarIcons';
import { starRowForLabel, starRowForLevel } from '@/lib/stars';
import ElementInline from '@/app/components/inline/ElementInline';
import ClassInline from '@/app/components/inline/ClassInline';
import CharacterPortrait from '@/app/components/character/CharacterPortrait';
import CharacterInline from '@/app/components/inline/CharacterInline';
import type { WithLocalizedFields } from '@/types/common';
import type { ElementType, ClassType } from '@/types/enums';
import type { Lang } from '@/lib/i18n/config';
import { l, lRec } from '@/lib/i18n/localize';
import { useI18n } from '@/lib/contexts/I18nContext';
import parseText from '@/lib/parse-text';
import { getCharByName, characterNameToId as nameMap } from '@/lib/character-client';

/* ===================== Types ===================== */
export type Impact = { pve: string; pvp: string };

interface BaseHeroReview {
  name: string;
  review: string;
  recommended_pve: string;
  recommended_pvp: string;
  impact: Record<'3' | '4' | '5' | '6', Impact>;
}

export type HeroReview = WithLocalizedFields<BaseHeroReview, 'review'>;

export interface PremiumLimitedData {
  Premium: HeroReview[];
  Limited: HeroReview[];
}

export interface Entry {
  name: string;
  stars: number;
  op: '>' | '>=' | null;
}

export type TabKey = 'Premium' | 'Limited';

/* ===================== Tab Config ===================== */
export const TAB_CONFIG: { key: TabKey; icon: string }[] = [
  { key: 'Premium', icon: '/images/ui/tags/premium.webp' },
  { key: 'Limited', icon: '/images/ui/tags/limited.webp' },
];

/* ===================== Priority Data ===================== */
type PriorityData = {
  PREMIUM_ORDER_1ST: Entry[];
  PREMIUM_ORDER_2ND: Entry[];
  PREMIUM_ORDER_3RD: Entry[];
  TRANSCEND_PRIORITY: Entry[];
};
const priorityPromise = import('@data/guides/premium-priorities.json').then(m => m.default as PriorityData);

/* ===================== Localized Labels ===================== */
export const LABELS = {
  title: {
    en: 'Premium & Limited — Reviews & Transcendence Sweetspots',
    jp: 'プレミアム＆限定 — レビュー＆超越スイートスポット',
    kr: '프리미엄 & 한정 — 리뷰 & 초월 스위트스팟',
    zh: '高级与限定 — 评测与超越甜点',
  },
  intro: {
    en: 'Quick recommendations for Premium and Limited banners. See PvE/PvP targets and the key transcendence sweetspots (3★→6★) for each hero.',
    jp: 'プレミアムおよび限定バナーのおすすめガイド。各ヒーローのPvE/PvP目標と重要な超越スイートスポット（3★→6★）をご覧ください。',
    kr: '프리미엄 및 한정 배너 추천 가이드입니다. 각 영웅의 PvE/PvP 목표와 주요 초월 스위트스팟(3★→6★)을 확인하세요.',
    zh: '高级和限定卡池快速推荐指南。查看每位英雄的PvE/PvP目标和关键超越甜点（3★→6★）。',
  },
  recommendedChoices: {
    en: 'Recommended Choices',
    jp: 'おすすめの選択',
    kr: '추천 선택',
    zh: '推荐选择',
  },
  priority1st: {
    en: '1st Priority',
    jp: '第1優先',
    kr: '1순위',
    zh: '第一优先',
  },
  priority2nd: {
    en: '2nd Priority',
    jp: '第2優先',
    kr: '2순위',
    zh: '第二优先',
  },
  priority3rd: {
    en: '3rd Priority',
    jp: '第3優先',
    kr: '3순위',
    zh: '第三优先',
  },
  transcendPriority: {
    en: 'Transcendence Priority',
    jp: '超越優先順位',
    kr: '초월 우선순위',
    zh: '超越优先级',
  },
  transcendFocusNote: {
    en: 'Focus on transcending these heroes first for maximum impact.',
    jp: '最大の効果を得るため、まずこれらのヒーローの超越を優先してください。',
    kr: '최대 효과를 위해 이 영웅들의 초월을 먼저 집중하세요.',
    zh: '为获得最大效果，请优先超越这些英雄。',
  },
  recommendedTargets: {
    en: 'Recommended targets',
    jp: '推奨目標',
    kr: '추천 목표',
    zh: '推荐目标',
  },
  transcendImpact: {
    en: 'Transcendence impact',
    jp: '超越の影響',
    kr: '초월 영향',
    zh: '超越影响',
  },
  colStar: {
    en: '★',
    jp: '★',
    kr: '★',
    zh: '★',
  },
  noEntries: {
    en: 'No entries for {tab} yet.',
    jp: '{tab}のエントリはまだありません。',
    kr: '{tab}에 대한 항목이 아직 없습니다.',
    zh: '{tab}暂无条目。',
  },
} as const;

/* ===================== Star Icons ===================== */

function StarLevel({ label, size = 16 }: { label: string; size?: number }) {
  const stars = starRowForLabel(label);
  if (!stars.length) return <span>{label}</span>;
  return <SharedStarIcons stars={stars} size={size} />;
}

/* ===================== TranscendDisplay ===================== */
type TransMap = Record<string, string | null>;

type Step = { key: string; label: string };

const TRANSCEND_ORDER: Step[] = [
  { key: '1', label: 'Lv 1' },
  { key: '2', label: 'Lv 2' },
  { key: '3', label: 'Lv 3' },
  { key: '4', label: 'Lv 4' },
  { key: '4_1', label: 'Lv 4' },
  { key: '4_2', label: 'Lv 4+' },
  { key: '5', label: 'Lv 5' },
  { key: '5_1', label: 'Lv 5' },
  { key: '5_2', label: 'Lv 5+' },
  { key: '5_3', label: 'Lv 5++' },
  { key: '6', label: 'Lv 6' },
];

/* starRowForLevel now imported from @/lib/stars — uses level keys ('1', '4_2', etc.) */

function sanitizeTransText(input: string) {
  const rAtkDefHp = /^ATK DEF HP \+\d+%$/i;
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !rAtkDefHp.test(line))
    .join('\n');
}

export function TranscendDisplay({
  character,
  levels,
}: {
  character: string;
  levels?: string[];
}) {
  const { lang } = useI18n();
  const [data, setData] = useState<TransMap | null>(null);

  const charId = nameMap[character];

  useEffect(() => {
    if (!charId) return;
    let cancelled = false;

    import(`@data/character/${charId}.json`)
      .then((mod) => {
        const d = mod.default ?? mod;
        const t = d.transcend ?? d.transcends ?? d.transcendance ?? null;
        if (!cancelled) setData(t);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });

    return () => { cancelled = true; };
  }, [charId]);

  const steps = useMemo(
    () =>
      TRANSCEND_ORDER.filter((s) => {
        if (levels && !levels.includes(s.key)) return false;
        if (!data) return false;
        const v = l(data, s.key, lang) || data[s.key];
        return typeof v === 'string' && v.trim().length > 0;
      }),
    [data, levels, lang],
  );

  if (!data || steps.length === 0) return null;

  return (
    <div className="space-y-3 text-white">
      {steps.map(({ key, label }) => {
        const raw = l(data, key, lang) || data[key] || '';
        const clean = sanitizeTransText(stripColorTags(raw as string));
        if (!clean) return null;

        return (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-xs opacity-80">{label}</div>
              <SharedStarIcons stars={starRowForLevel(key)} size={18} />
            </div>
            <div className="whitespace-pre-line text-xs leading-tight">{formatEffectText(clean)}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ===================== UI Components ===================== */

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[11px] uppercase tracking-wide">
      {children}
    </span>
  );
}

function TargetDisplay({ value }: { value: string }) {
  if (!value) return <span>—</span>;

  const parts = value.match(/\d+(?:\s*\([^)]*\))?|[^\d]+/g) || [];

  return (
    <div className="space-y-1 text-center text-sm text-neutral-200">
      {parts.map((part, idx) => {
        const num = parseInt(part, 10);
        if (!isNaN(num)) {
          const extra = part.replace(/^\d+\s*/, '');
          return (
            <div key={idx}>
              <YellowStars count={num} /> {extra}
            </div>
          );
        }
        return <div key={idx}>{part.trim()}</div>;
      })}
    </div>
  );
}

function RecoTargets({ pve, pvp }: { pve: string; pvp: string }) {
  const cols: { title: string; image: string; border: string; value: string }[] = [
    { title: 'PvE', image: '/images/ui/nav/pve.webp', border: 'border-sky-500/40', value: pve },
    { title: 'PvP', image: '/images/ui/nav/pvp.webp', border: 'border-red-500/40', value: pvp },
  ];

  return (
    <div className="grid grid-cols-2 divide-x divide-neutral-800">
      {cols.map(({ title, image, border, value }) => (
        <div key={title} className="flex flex-col items-center gap-2 px-4 py-2">
          <div className={`relative h-14 w-14 rounded-lg border-2 ${border} overflow-hidden bg-neutral-800/50`}>
            <Image src={image} alt={title} fill sizes="56px" className="object-contain p-2" />
          </div>
          <h4 className="mx-auto">{title}</h4>
          <TargetDisplay value={value || '—'} />
        </div>
      ))}
    </div>
  );
}

function ImpactTable({ impact, lang }: { impact: HeroReview['impact']; lang: Lang }) {
  const rows = ['3', '4', '5', '6'] as const;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left opacity-80">
            <th className="py-1 pr-2">{lRec(LABELS.colStar, lang)}</th>
            <th className="py-1 pr-2">PvE</th>
            <th className="py-1 pr-2">PvP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r} className="border-t border-white/5">
              <td className="py-1 pr-2 font-medium"><StarLevel label={r} /></td>
              <td className="py-1 pr-2"><StarLevel label={impact[r]?.pve || '—'} /></td>
              <td className="py-1 pr-2"><StarLevel label={impact[r]?.pvp || '—'} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ===================== CharacterCard ===================== */

export function CharacterCard({
  name,
  stars,
  isPriority = false,
}: {
  name: string;
  stars: number;
  isPriority?: boolean;
}) {
  const result = getCharByName(name);
  const id = result?.id;
  const char = result?.char;
  const slug = char?.slug;
  const href = slug ? `/characters/${slug}` : '#';

  return (
    <Link href={href as never} prefetch={false} className="relative shrink-0 text-center shadow transition hover:shadow-lg">
      {id ? (
        <CharacterPortrait id={id} size={{ base: 'sm', md: 'md' }} showIcons forceStar={stars} priority={isPriority} />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-neutral-600 bg-neutral-800/50 text-xs text-neutral-400">
          ?
        </div>
      )}
    </Link>
  );
}

/* ===================== PremiumPriorityRow ===================== */

function PremiumPriorityRow({ title, entries }: { title: string; entries: Entry[] }) {
  return (
    <div className="space-y-2">
      <h4 className="mx-auto text-center">{title}</h4>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {entries.map((e, i) => (
          <CharacterCard key={`${e.name}-${i}`} name={e.name} stars={e.stars} isPriority={i === 0} />
        ))}
      </div>
    </div>
  );
}

/* ===================== PremiumPullingOrder ===================== */

export function PremiumPullingOrder({ lang }: { lang: Lang }) {
  const priorityData = use(priorityPromise);

  return (
    <section className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-6">
      <h2 className="mx-auto text-center">{lRec(LABELS.recommendedChoices, lang)}</h2>

      <div className="space-y-5">
        <PremiumPriorityRow title={lRec(LABELS.priority1st, lang)} entries={priorityData.PREMIUM_ORDER_1ST} />
        <PremiumPriorityRow title={lRec(LABELS.priority2nd, lang)} entries={priorityData.PREMIUM_ORDER_2ND} />
        <PremiumPriorityRow title={lRec(LABELS.priority3rd, lang)} entries={priorityData.PREMIUM_ORDER_3RD} />
      </div>

      <div className="mt-5 border-t border-white/10 pt-5">
        <h4 className="mx-auto mb-3 text-center">
          {lRec(LABELS.transcendPriority, lang)}
        </h4>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {priorityData.TRANSCEND_PRIORITY.map((e, i) => (
            <CharacterCard key={`${e.name}-${i}`} name={e.name} stars={e.stars} isPriority={i === 0} />
          ))}
        </div>
        <p className="mt-3 text-center text-xs opacity-70">
          {lRec(LABELS.transcendFocusNote, lang)}
        </p>
      </div>
    </section>
  );
}

/* ===================== HeroCard ===================== */

export function HeroCard({ h, lang }: { h: HeroReview; lang: Lang }) {
  const result = getCharByName(h.name);
  const charId = result?.id;
  const char = result?.char;
  const element = char?.Element as ElementType | undefined;
  const cls = char?.Class as ClassType | undefined;
  const name = char ? l(char, 'Fullname', lang) : h.name;

  type AllowedTag = 'limited' | 'seasonal' | 'collab';
  const isAllowedTag = (t: string): t is AllowedTag =>
    t === 'limited' || t === 'seasonal' || t === 'collab';

  const tags: string[] = Array.isArray(char?.tags) ? char!.tags : char?.tags ? [char.tags as string] : [];
  const specialTag = tags.find(isAllowedTag);

  return (
    <section className="rounded-md border border-neutral-800 bg-black/30 p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 flex items-center gap-3 text-xl font-semibold">
          {charId && (
            <Image
              src={`/images/characters/atb/IG_Turn_${charId}.webp`}
              alt={name}
              width={40}
              height={40}
              className="h-10 w-10 rounded-lg object-contain"
              unoptimized
            />
          )}

          <CharacterInline name={h.name} />

          {specialTag && (
            <Image
              src={`/images/ui/tags/${specialTag}.webp`}
              alt={`${specialTag} tag`}
              width={60}
              height={60}
              style={{ width: 60, height: 60 }}
              className="object-cover"
              unoptimized
            />
          )}
        </h2>

        <div className="flex items-center gap-2 text-xs opacity-80">
          {element && <Badge><ElementInline element={element} /></Badge>}
          {cls && <Badge><ClassInline name={cls} /></Badge>}
        </div>
      </header>

      <p className="mt-3 mb-4 whitespace-pre-line text-sm text-neutral-200">{parseText(l(h as unknown as Record<string, unknown>, 'review', lang))}</p>

      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="w-full max-w-4xl rounded border border-neutral-800 p-4">
            <h2 className="mx-auto text-center">{lRec(LABELS.recommendedTargets, lang)}</h2>
            <RecoTargets pve={h.recommended_pve} pvp={h.recommended_pvp} />
          </div>

          <div className="rounded-md border border-neutral-800 p-3">
            <h2 className="mx-auto text-center">{lRec(LABELS.transcendImpact, lang)}</h2>
            <ImpactTable impact={h.impact} lang={lang} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-md border border-neutral-800 p-3">
            <TranscendDisplay character={h.name} levels={['4_1']} />
          </div>

          <div className="rounded-md border border-neutral-800 p-3">
            <TranscendDisplay character={h.name} levels={['5_1']} />
          </div>

          <div className="rounded-md border border-neutral-800 p-3">
            <TranscendDisplay character={h.name} levels={['6']} />
          </div>
        </div>
      </div>
    </section>
  );
}
