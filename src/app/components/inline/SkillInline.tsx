'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import nameToId from '@data/generated/characters-name-to-id.json';
import charIndex from '@data/generated/characters-index.json';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import { formatEffectText } from '@/lib/format-text';
import type { Character, SkillData } from '@/types/character';
import type { CharacterIndex } from '@/types/character';
import type { SkillKey } from '@/types/enums';
import InlineTooltip from './InlineTooltip';

const nameMap = nameToId as Record<string, string>;
const characters = charIndex as Record<string, CharacterIndex>;

type SkillShorthand = 'S1' | 'S2' | 'S3' | 'Passive' | 'Chain';

type Props = {
  character: string;
  skill: SkillShorthand;
};

const SKILL_MAP: Record<SkillShorthand, SkillKey> = {
  S1: 'SKT_FIRST',
  S2: 'SKT_SECOND',
  S3: 'SKT_ULTIMATE',
  Passive: 'SKT_CHAIN_PASSIVE',
  Chain: 'SKT_CHAIN_PASSIVE',
};

const SKILL_LABELS: Record<SkillShorthand, string> = {
  S1: 'Skill 1',
  S2: 'Skill 2',
  S3: 'Ultimate',
  Passive: 'Passive',
  Chain: 'Chain',
};

// Module-level cache for loaded character data
const charCache = new Map<string, Character>();

export default function SkillInline({ character, skill }: Props) {
  const { lang } = useI18n();
  const [charData, setCharData] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);

  const charId = nameMap[character];

  useEffect(() => {
    if (!charId) {
      setLoading(false);
      return;
    }

    // Check cache first
    const cached = charCache.get(charId);
    if (cached) {
      setCharData(cached);
      setLoading(false);
      return;
    }

    import(`@data/character/${charId}.json`)
      .then((mod) => {
        const data = (mod.default ?? mod) as Character;
        charCache.set(charId, data);
        setCharData(data);
      })
      .catch(() => setCharData(null))
      .finally(() => setLoading(false));
  }, [charId]);

  if (!charId) {
    return <span className="text-red-500">[{character}]</span>;
  }

  if (loading) {
    return <span className="text-neutral-400">[{character} {skill}]</span>;
  }

  if (!charData) {
    return <span className="text-red-500">[{character} {skill}]</span>;
  }

  const skillKey = SKILL_MAP[skill];
  const skillData = charData.skills?.[skillKey] as SkillData | undefined;

  if (!skillData) {
    return <span className="text-red-500">[{character} {skill}]</span>;
  }

  const skillName = l(skillData, 'name', lang);
  const char = characters[charId];
  const charName = char ? l(char, 'Fullname', lang) : character;

  // Get max level description (level 5, fallback to lower)
  const desc = getMaxLevelDesc(skillData, lang);

  // Skill icon path
  const iconPath = skillData.IconName.startsWith('Skill_ChainPassive')
    ? `/images/characters/chain/${skillData.IconName}.webp`
    : `/images/characters/skills/${skillData.IconName}.webp`;

  const tooltip = (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="relative h-8 w-8 shrink-0">
          <Image src={iconPath} alt="" fill sizes="32px" className="object-contain" />
        </span>
        <div>
          <span className="text-sm font-bold text-equipment">{skillName}</span>
          <div className="text-xs text-neutral-400">{charName} - {SKILL_LABELS[skill]}</div>
        </div>
      </div>
      <div className="flex gap-2 text-xs text-neutral-400">
        {skillData.cd && <span>CD: {skillData.cd}</span>}
        {skillData.wgr > 0 && <span>WGR: {skillData.wgr}</span>}
      </div>
      {desc && (
        <p className="text-xs text-neutral-200">{formatEffectText(desc)}</p>
      )}
    </div>
  );

  return (
    <InlineTooltip content={tooltip}>
      <button type="button" className="cursor-default">
        <span className="inline-flex items-center gap-0.5 align-middle text-equipment">
          <span className="relative inline-block h-4.5 w-4.5 shrink-0">
            <Image src={iconPath} alt="" fill sizes="18px" className="object-contain" />
          </span>
          <span className="underline">{skillName}</span>
        </span>
      </button>
    </InlineTooltip>
  );
}

/** Get the highest level description available, localized */
function getMaxLevelDesc(skill: SkillData, lang: string): string {
  const levels = skill.true_desc_levels;
  if (!levels) return '';

  // Try from highest to lowest level
  for (let lv = 5; lv >= 1; lv--) {
    const key = lang === 'en' ? String(lv) : `${lv}_${lang}`;
    if (levels[key]) return levels[key];
    // Fallback to English for this level
    if (levels[String(lv)]) return levels[String(lv)];
  }
  return '';
}
