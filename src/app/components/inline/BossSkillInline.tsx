'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import { formatBossDesc } from '@/app/components/guides/boss-shared';
import type { Boss, BossSkill } from '@/types/boss';
import type { Lang } from '@/lib/i18n/config';
import InlineTooltip from './InlineTooltip';

type Props = {
  /** Boss skill English name (matched against skill.name.en) */
  skill: string;
  /** Boss id, e.g. "60000002" */
  bossId: string;
};

// Module-level cache for loaded boss data
const bossCache = new Map<string, Boss>();

/** Boss skill icons live under boss/skills unless they reference a character (id starting with 2). */
function skillIconPath(icon: string): string {
  const tail = icon.split('_').pop() ?? '';
  const dir = tail.startsWith('2') ? '' : 'boss/';
  return `/images/characters/${dir}skills/${icon}.webp`;
}

export default function BossSkillInline({ skill, bossId }: Props) {
  const { lang: rawLang } = useI18n();
  const lang = rawLang as Lang;
  const [bossData, setBossData] = useState<Boss | null>(bossCache.get(bossId) ?? null);
  const [loading, setLoading] = useState(!bossCache.has(bossId));

  useEffect(() => {
    const cached = bossCache.get(bossId);
    if (cached) {
      setBossData(cached);
      setLoading(false);
      return;
    }

    import(`@data/boss/${bossId}.json`)
      .then((mod) => {
        const data = (mod.default ?? mod) as Boss;
        bossCache.set(bossId, data);
        setBossData(data);
      })
      .catch(() => setBossData(null))
      .finally(() => setLoading(false));
  }, [bossId]);

  if (loading) {
    return <span className="text-neutral-400">[{skill}]</span>;
  }

  const skillData: BossSkill | undefined = bossData?.skills.find(
    (s) => s.name.en === skill,
  );

  if (!skillData) {
    return <span className="text-red-500">[{skill}]</span>;
  }

  const skillName = lRec(skillData.name, lang);
  const bossName = bossData ? lRec(bossData.Name, lang) : '';
  const desc = lRec(skillData.description, lang);
  const iconPath = skillIconPath(skillData.icon);

  const tooltip = (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="relative h-8 w-8 shrink-0">
          <Image src={iconPath} alt={skillName} fill sizes="32px" className="object-contain" />
        </span>
        <div>
          <span className="text-sm font-bold text-equipment">{skillName}</span>
          {bossName && <div className="text-xs text-neutral-400">{bossName}</div>}
        </div>
      </div>
      {desc && (
        <p className="text-xs text-neutral-200">{formatBossDesc(desc, lang)}</p>
      )}
    </div>
  );

  return (
    <InlineTooltip content={tooltip}>
      <button type="button" className="cursor-default">
        <span className="inline-flex items-center gap-0.5 align-middle text-equipment">
          <span className="relative inline-block h-4.5 w-4.5 shrink-0">
            <Image src={iconPath} alt={skillName} fill sizes="18px" className="object-contain" />
          </span>
          <span className="underline">{skillName}</span>
        </span>
      </button>
    </InlineTooltip>
  );
}
