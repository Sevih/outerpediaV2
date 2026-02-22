'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import CharacterPortrait from '@/app/components/character/CharacterPortrait';
import BuffDebuffDisplay, { EffectsProvider } from '@/app/components/character/BuffDebuffDisplay';
import ElementInline from '@/app/components/inline/ElementInline';
import ClassInline from '@/app/components/inline/ClassInline';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import { ELEMENT_TEXT } from '@/lib/theme';
import buffsData from '@data/effects/buffs.json';
import debuffsData from '@data/effects/debuffs.json';
import bossIndex from '@data/generated/boss-index.json';
import type { Boss, BossSkill } from '@/types/boss';
import type { Effect } from '@/types/effect';
import type { ElementType } from '@/types/enums';
import type { LangMap } from '@/types/common';
import type { Lang } from '@/lib/i18n/config';

const buffMap: Record<string, Effect> = {};
for (const b of buffsData as Effect[]) buffMap[b.name] = b;
const debuffMap: Record<string, Effect> = {};
for (const d of debuffsData as Effect[]) debuffMap[d.name] = d;

/* ── Types ──────────────────────────────────────────────── */

type BossVersion = {
  id: string;
  label: LangMap;
  level?: number;
};

type BossIndexEntry = {
  modes: Record<string, { name: LangMap; versions: BossVersion[] }>;
};

type Props = {
  bossName: string;
  modeKey?: string;
  defaultBossId?: string;
  preloadedBosses?: Record<string, Boss>;
};

/* ── Locale-aware element / class token maps ──────────── */

const ELEMENT_TOKENS: Record<Lang, Record<string, string>> = {
  en: { Fire: 'Fire', Water: 'Water', Earth: 'Earth', Light: 'Light', Dark: 'Dark' },
  jp: { '火': 'Fire', '水': 'Water', '地': 'Earth', '光': 'Light', '闇': 'Dark' },
  kr: { '화속성': 'Fire', '수속성': 'Water', '지속성': 'Earth', '명속성': 'Light', '암속성': 'Dark' },
  zh: { '火属性': 'Fire', '水属性': 'Water', '土属性': 'Earth', '光属性': 'Light', '暗属性': 'Dark' },
};

const CLASS_TOKENS: Record<Lang, Record<string, string>> = {
  en: { Striker: 'Striker', Defender: 'Defender', Ranger: 'Ranger', Mage: 'Mage', Healer: 'Healer' },
  jp: { '攻撃型': 'Striker', '魔法型': 'Mage', '防御型': 'Defender', 'スピード型': 'Ranger', '回復型': 'Healer' },
  kr: { '공격형': 'Striker', '마법형': 'Mage', '방어형': 'Defender', '속도형': 'Ranger', '회복형': 'Healer' },
  zh: { '攻击型': 'Striker', '魔法型': 'Mage', '防御型': 'Defender', '速度型': 'Ranger', '恢复型': 'Healer' },
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatBossDesc(text: string, lang: Lang): React.ReactNode {
  if (!text) return null;

  const elemMap = ELEMENT_TOKENS[lang];
  const classMap = CLASS_TOKENS[lang];

  const allTokens = [...Object.keys(elemMap), ...Object.keys(classMap)]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join('|');

  const wb = lang === 'en' ? '\\b' : '';
  const tokenRegex = new RegExp(
    `<color=(#[0-9a-fA-F]{6})>(.*?)<\\/color>|\\\\n|\\n|${wb}(${allTokens})${wb}`,
    'g',
  );

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      parts.push(<span key={key++} style={{ color: match[1] }}>{match[2]}</span>);
    } else if (match[0] === '\\n' || match[0] === '\n') {
      parts.push(<br key={key++} />);
    } else if (match[3]) {
      const token = match[3];
      if (elemMap[token]) {
        parts.push(<ElementInline key={key++} element={elemMap[token]} />);
      } else if (classMap[token]) {
        parts.push(<ClassInline key={key++} name={classMap[token]} />);
      }
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function normalizeName(name: string): string {
  return name.startsWith('ST_') ? `BT_STAT|${name}` : name;
}

/* ── Sub-components ─────────────────────────────────────── */

function ImmuneList({ immuneStr, statImmuneStr }: { immuneStr: string; statImmuneStr: string }) {
  const { t } = useI18n();
  const items: string[] = [];
  if (immuneStr) items.push(...immuneStr.split(',').map((s) => normalizeName(s.trim())).filter(Boolean));
  if (statImmuneStr) items.push(...statImmuneStr.split(',').map((s) => normalizeName(s.trim())).filter(Boolean));
  if (items.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <h5 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 after:hidden">
        {t('guides.boss_display.immunities')}
      </h5>
      <BuffDebuffDisplay buffs={[]} debuffs={items} iconOnly />
    </div>
  );
}

function SkillCard({ skill, lang }: { skill: BossSkill; lang: Lang }) {
  const name = lRec(skill.name as LangMap, lang);
  const desc = lRec(skill.description as LangMap, lang);
  if (!name && !desc) return null;

  return (
    <div className="card p-3">
      <div className="flex items-start gap-2">
        <span className="relative h-8 w-8 shrink-0 rounded">
          <Image
            src={`/images/characters/${(skill.icon.split('_').pop() ?? '').startsWith('2') ? '' : 'boss/'}skills/${skill.icon}.webp`}
            alt=""
            fill
            sizes="32px"
            className="object-contain"
          />
        </span>
        <div className="flex-1 space-y-1">
          <p className="text-sm font-semibold text-zinc-200">{name}</p>
          {(skill.buff?.length || skill.debuff?.length) && (
            <BuffDebuffDisplay buffs={skill.buff ?? []} debuffs={skill.debuff ?? []} />
          )}
          {desc && (
            <p className="text-xs leading-relaxed text-zinc-400">
              {formatBossDesc(desc, lang)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function BossHeader({ boss, lang }: { boss: Boss; lang: Lang }) {
  const baseName = lRec(boss.Name, lang);
  const surname = lRec(boss.Surname as LangMap, lang);
  const displayName = boss.IncludeSurname && surname ? `${surname} ${baseName}` : baseName;
  const element = boss.element as ElementType;

  return (
    <div className="flex items-center gap-3 p-3">
      {boss.icons.startsWith('2') ? (
        <CharacterPortrait id={boss.icons} size="md" />
      ) : (
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-white/10">
          <Image
            src={`/images/characters/boss/portrait/MT_${boss.icons}.webp`}
            alt={displayName}
            fill
            sizes="64px"
            className="object-cover"
          />
        </div>
      )}
      <div>
        {!boss.IncludeSurname && surname && (
          <p className="text-xs text-zinc-400">{surname}</p>
        )}
        <p className="text-lg font-bold text-zinc-100">{displayName}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="relative h-4 w-4">
              <Image
                src={`/images/ui/elem/CM_Element_${element}.webp`}
                alt=""
                fill
                sizes="16px"
                className="object-contain"
              />
            </span>
            <span className={`text-xs ${ELEMENT_TEXT[element]}`}>{element}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="relative h-4 w-4">
              <Image
                src={`/images/ui/class/CM_Class_${boss.class}.webp`}
                alt=""
                fill
                sizes="16px"
                className="object-contain"
              />
            </span>
            <span className="text-xs text-zinc-400">{boss.class}</span>
          </span>
          <span className="text-xs text-zinc-500">Lv.{boss.level}</span>
        </div>
      </div>
    </div>
  );
}

function BossDetails({ boss, lang }: { boss: Boss; lang: Lang }) {
  return (
    <div className="space-y-2">
      <ImmuneList immuneStr={boss.BuffImmune} statImmuneStr={boss.StatBuffImmune} />
      {boss.skills
        .filter((s) => lRec(s.name as LangMap, lang) || lRec(s.description as LangMap, lang))
        .map((skill, i) => (
          <SkillCard key={i} skill={skill} lang={lang} />
        ))}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────── */

const bossCache = new Map<string, Boss>();

export default function BossDisplay({ bossName, modeKey, defaultBossId, preloadedBosses }: Props) {
  const { lang: rawLang } = useI18n();
  const lang = rawLang as Lang;

  // Resolve versions from boss-index
  const entry = (bossIndex as Record<string, BossIndexEntry>)[bossName];
  const modes = entry?.modes ?? {};
  const modeData = modeKey ? modes[modeKey] : Object.values(modes)[0];
  const versions = modeData?.versions ?? [];
  const defaultId = defaultBossId ?? versions[0]?.id;
  const [selectedId, setSelectedId] = useState(defaultId);

  const preloadedBoss = preloadedBosses?.[defaultId] ?? null;
  const [boss, setBoss] = useState<Boss | null>(preloadedBoss);
  const [loading, setLoading] = useState(!preloadedBoss);

  const loadBoss = useCallback(async (id: string): Promise<Boss | null> => {
    if (preloadedBosses?.[id]) return preloadedBosses[id];
    const cached = bossCache.get(id);
    if (cached) return cached;
    try {
      const mod = await import(`@data/boss/${id}.json`);
      const data = (mod.default ?? mod) as Boss;
      bossCache.set(id, data);
      return data;
    } catch {
      return null;
    }
  }, [preloadedBosses]);

  useEffect(() => {
    if (selectedId === defaultId && preloadedBoss) {
      setBoss(preloadedBoss);
      return;
    }

    setLoading(true);
    loadBoss(selectedId).then((b) => {
      setBoss(b);
      setLoading(false);
    });
  }, [selectedId, loadBoss, defaultId, preloadedBoss]);

  return (
    <EffectsProvider buffMap={buffMap} debuffMap={debuffMap}>
      <div className="space-y-4">
        {/* Boss identity header */}
        {loading ? (
          <div className="py-8 text-center text-sm text-zinc-500">Loading...</div>
        ) : boss ? (
          <>
            <BossHeader boss={boss} lang={lang} />

            {/* Stage selector — between header and details */}
            {versions.length > 1 && (
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-sky-500 transition-colors"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {lRec(v.label, lang)}
                  </option>
                ))}
              </select>
            )}

            <BossDetails boss={boss} lang={lang} />
          </>
        ) : (
          <div className="py-8 text-center text-sm text-zinc-500">No boss data</div>
        )}
      </div>
    </EffectsProvider>
  );
}
