'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Tabs from '@/app/components/ui/Tabs';
import CharacterPortrait from '@/app/components/character/CharacterPortrait';
import nameToId from '@data/generated/characters-name-to-id.json';
import charIndex from '@data/generated/characters-index.json';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import type { TeamData } from '@/types/team';

const nameMap = nameToId as Record<string, string>;
const indexMap = charIndex as Record<string, Record<string, unknown>>;

type Props = {
  teamData: TeamData;
  defaultStage?: string;
};

export default function StageBasedTeamSelector({ teamData, defaultStage }: Props) {
  const { lang, t } = useI18n();
  const stages = Object.keys(teamData);
  const [activeStage, setActiveStage] = useState(
    defaultStage && stages.includes(defaultStage) ? defaultStage : stages[0]
  );

  const stageData = teamData[activeStage];
  if (!stageData) return null;

  return (
    <div className="space-y-4">
      <h3>
        {t('guides.team_selector')}
      </h3>

      {stages.length > 1 && (
        <Tabs
          items={stages}
          value={activeStage}
          onChange={setActiveStage}
        />
      )}

      {/* Icon for stage element */}
      {stageData.icon && (
        <div className="flex items-center gap-2">
          <span className="relative h-6 w-6">
            <Image
              src={`/images/ui/elem/${stageData.icon}.webp`}
              alt={stageData.icon}
              fill
              sizes="24px"
              className="object-contain"
            />
          </span>
          <span className="text-sm font-medium text-zinc-300">{activeStage}</span>
        </div>
      )}

      {/* Team grid: each row is a group of alternatives */}
      <div className="space-y-3">
        {stageData.team.map((group, gi) => (
          <div
            key={gi}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-white/5 bg-neutral-900/50 p-3"
          >
            {group.map((charName) => {
              const charId = nameMap[charName];
              if (!charId) {
                return (
                  <span key={charName} className="text-xs text-red-500">
                    {charName}
                  </span>
                );
              }
              const entry = indexMap[charId];
              const localizedName = entry ? l(entry, 'Fullname', lang) : charName;
              const slug = (entry?.slug as string) ?? charName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
              return (
                <Link
                  key={charName}
                  href={`/${lang}/characters/${slug}`}
                  className="group flex flex-col items-center gap-1"
                >
                  <CharacterPortrait
                    id={charId}
                    name={localizedName}
                    size="md"
                    showIcons
                    className="transition-transform group-hover:scale-105"
                  />
                  <span className="max-w-16 truncate text-center text-xs text-zinc-400 group-hover:text-zinc-200">
                    {localizedName.split(' ').pop()}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
