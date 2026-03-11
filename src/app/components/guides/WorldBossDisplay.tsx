'use client';

import { use, useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import CharacterPortrait from '@/app/components/character/CharacterPortrait';
import Tabs from '@/app/components/ui/Tabs';
import BuffDebuffDisplay, { EffectsProvider } from '@/app/components/character/BuffDebuffDisplay';
import ElementInline from '@/app/components/inline/ElementInline';
import ClassInline from '@/app/components/inline/ClassInline';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import { ELEMENT_TEXT } from '@/lib/theme';
import { effectMapsPromise } from '@/lib/data/effects-client';
import type { Boss, BossSkill } from '@/types/boss';
import type { Effect } from '@/types/effect';
import type { ElementType } from '@/types/enums';
import type { LangMap } from '@/types/common';
import type { Lang } from '@/lib/i18n/config';

type WorldBossMode = 'Normal' | 'Hard' | 'Very Hard' | 'Extreme';

type WorldBossConfig = {
  boss1Key: string;
  boss2Key: string;
  boss1Ids: Partial<Record<WorldBossMode, string>>;
  boss2Ids: Partial<Record<WorldBossMode, string>>;
};

type Props = {
  config: WorldBossConfig;
  defaultMode?: WorldBossMode;
  /** Pre-loaded boss data keyed by ID — rendered at SSR time (no loading state) */
  preloadedBosses?: Record<string, Boss>;
};

const ALL_MODES: WorldBossMode[] = ['Normal', 'Hard', 'Very Hard', 'Extreme'];

const bossCache = new Map<string, Boss>();

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

/** Parse boss skill description: <color> tags, element/class names → inline components */
function formatBossDesc(text: string, lang: Lang): React.ReactNode {
  if (!text) return null;

  // Normalize literal \n to real newlines so \b word boundaries work after line breaks
  const normalized = text.replace(/\\n/g, '\n');

  const elemMap = ELEMENT_TOKENS[lang];
  const classMap = CLASS_TOKENS[lang];

  // Sort tokens longest-first to avoid partial matches
  const allTokens = [...Object.keys(elemMap), ...Object.keys(classMap)]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join('|');

  // EN uses word boundaries; CJK does not
  const wb = lang === 'en' ? '\\b' : '';
  const tokenOnly = new RegExp(`${wb}(${allTokens})${wb}`, 'g');
  const tokenRegex = new RegExp(
    `<color=(#[0-9a-fA-F]{6})>(.*?)<\\/color>|\\n|${wb}(${allTokens})${wb}`,
    'g',
  );

  let key = 0;

  // Parse element/class tokens inside a text fragment
  function parseTokens(fragment: string): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    let li = 0;
    let m: RegExpExecArray | null;
    tokenOnly.lastIndex = 0;
    while ((m = tokenOnly.exec(fragment)) !== null) {
      if (m.index > li) nodes.push(fragment.slice(li, m.index));
      const tok = m[1];
      if (elemMap[tok]) nodes.push(<ElementInline key={key++} element={elemMap[tok]} />);
      else if (classMap[tok]) nodes.push(<ClassInline key={key++} name={classMap[tok]} />);
      li = tokenOnly.lastIndex;
    }
    if (li < fragment.length) nodes.push(fragment.slice(li));
    return nodes;
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(normalized)) !== null) {
    if (match.index > lastIndex) {
      parts.push(normalized.slice(lastIndex, match.index));
    }

    if (match[1]) {
      // Color tag — also parse inner content for element/class tokens
      parts.push(<span key={key++} style={{ color: match[1] }}>{parseTokens(match[2])}</span>);
    } else if (match[0] === '\n') {
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

  if (lastIndex < normalized.length) {
    parts.push(normalized.slice(lastIndex));
  }

  return parts;
}

/** Normalize ST_ short names to full BT_STAT|ST_ format */
function resolveGroup(name: string, buffMap: Record<string, Effect>, debuffMap: Record<string, Effect>): string {
  if (name.startsWith('ST_')) return `BT_STAT|${name}`;
  const effect = debuffMap[name] ?? buffMap[name];
  return effect?.group ?? name;
}

function ImmuneList({ immuneStr, statImmuneStr }: { immuneStr: string; statImmuneStr: string }) {
  const { t } = useI18n();
  const { buffMap, debuffMap } = use(effectMapsPromise);
  const raw: string[] = [];
  if (immuneStr) raw.push(...immuneStr.split(',').map((s) => resolveGroup(s.trim(), buffMap, debuffMap)).filter(Boolean));
  if (statImmuneStr) raw.push(...statImmuneStr.split(',').map((s) => resolveGroup(s.trim(), buffMap, debuffMap)).filter(Boolean));
  const items = [...new Set(raw)];
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
  if (!name || !desc) return null;

  const isPassive = skill.type.startsWith('SKT_MONSTER');

  return (
    <div className={`p-3 ${isPassive ? 'panel-highlight' : 'card'}`}>
      <div className="flex items-start gap-2">
        <span className="relative h-8 w-8 shrink-0 rounded">
          <Image
            src={`/images/characters/${(skill.icon.split('_').pop() ?? '').startsWith('2') ? '' : 'boss/'}skills/${skill.icon}.webp`}
            alt={name}
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

function BossCard({ boss, lang }: { boss: Boss; lang: Lang }) {
  const name = lRec(boss.Name, lang);
  const element = boss.element as ElementType;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="card flex items-center gap-3 p-3">
        {boss.icons.startsWith('2') ? (
          <CharacterPortrait id={boss.icons} size="md" name={name} />
        ) : (
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-white/10">
            <Image
              src={`/images/characters/boss/portrait/MT_${boss.icons}.webp`}
              alt={name}
              fill
              sizes="64px"
              className="object-cover"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <div>
            <p className="text-base font-bold text-zinc-100">{name}</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="relative h-4 w-4">
                  <Image
                    src={`/images/ui/elem/CM_Element_${element}.webp`}
                    alt={element}
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
                    alt={boss.class}
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
          <ImmuneList immuneStr={boss.BuffImmune} statImmuneStr={boss.StatBuffImmune} />
        </div>
      </div>

      {/* Skills */}
      {boss.skills
        .filter((s) => lRec(s.name as LangMap, lang) && lRec(s.description as LangMap, lang))
        .map((skill, i) => (
          <SkillCard key={i} skill={skill} lang={lang} />
        ))}
    </div>
  );
}

export default function WorldBossDisplay({ config, defaultMode = 'Extreme', preloadedBosses }: Props) {
  const { lang: rawLang } = useI18n();
  const lang = rawLang as Lang;
  const { buffMap, debuffMap } = use(effectMapsPromise);
  const [mode, setMode] = useState<WorldBossMode>(defaultMode);

  // Resolve preloaded bosses for default mode (available at SSR time)
  const preloadedBoss1 = preloadedBosses?.[config.boss1Ids[defaultMode] ?? ''] ?? null;
  const preloadedBoss2 = preloadedBosses?.[config.boss2Ids[defaultMode] ?? ''] ?? null;

  const [boss1, setBoss1] = useState<Boss | null>(preloadedBoss1);
  const [boss2, setBoss2] = useState<Boss | null>(preloadedBoss2);
  const [loading, setLoading] = useState(!preloadedBoss1 && !preloadedBoss2);

  // Determine which modes are available
  const availableModes = ALL_MODES.filter(
    (m) => config.boss1Ids[m] || config.boss2Ids[m]
  );

  const loadBoss = useCallback(async (id: string | undefined): Promise<Boss | null> => {
    if (!id) return null;
    // Check preloaded data first
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
    if (mode === defaultMode && (preloadedBoss1 || preloadedBoss2)) {
      setBoss1(preloadedBoss1);
      setBoss2(preloadedBoss2);
      return;
    }

    setLoading(true);
    Promise.all([
      loadBoss(config.boss1Ids[mode]),
      loadBoss(config.boss2Ids[mode]),
    ]).then(([b1, b2]) => {
      setBoss1(b1);
      setBoss2(b2);
      setLoading(false);
    });
  }, [mode, config, loadBoss, defaultMode, preloadedBoss1, preloadedBoss2]);

  const activeBosses = [boss1, boss2].filter(Boolean) as Boss[];

  return (
    <EffectsProvider buffMap={buffMap} debuffMap={debuffMap}>
      <div className="space-y-4">
        {availableModes.length > 1 && (
          <Tabs
            items={availableModes}
            value={mode}
            onChange={(v) => setMode(v as WorldBossMode)}
          />
        )}

        {loading ? (
          <div className="py-8 text-center text-sm text-zinc-500">Loading...</div>
        ) : activeBosses.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-500">No boss data</div>
        ) : (
          <div className={`grid gap-4 ${activeBosses.length > 1 ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
            {activeBosses.map((boss) => (
              <BossCard key={boss.id} boss={boss} lang={lang} />
            ))}
          </div>
        )}
      </div>
    </EffectsProvider>
  );
}
