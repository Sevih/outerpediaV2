'use client';

import { useState } from 'react';
import Image from 'next/image';
import Tabs from '@/app/components/ui/Tabs';
import CarouselSlot from '@/app/components/guides/CarouselSlot';
import { useI18n } from '@/lib/contexts/I18nContext';
import type { TeamData } from '@/types/team';

type Props = {
  teamData: TeamData;
  defaultStage?: string;
};

export default function StageBasedTeamSelector({ teamData, defaultStage }: Props) {
  const { t } = useI18n();
  const stages = Object.keys(teamData);
  const [activeStage, setActiveStage] = useState(
    defaultStage && stages.includes(defaultStage) ? defaultStage : stages[0],
  );

  const stageData = teamData[activeStage];
  if (!stageData) return null;

  return (
    <div className="space-y-4">
      <h3>{t('guides.team_selector')}</h3>

      {stages.length > 1 && (
        <Tabs
          items={stages}
          value={activeStage}
          onChange={setActiveStage}
        />
      )}

      {/* Element icon badge */}
      {stageData.icon && (
        <div className="flex items-center justify-center gap-2">
          <span className="relative h-6 w-6">
            <Image
              src={`/images/ui/elem/CM_Element_${stageData.icon.charAt(0).toUpperCase() + stageData.icon.slice(1)}.webp`}
              alt={stageData.icon}
              fill
              sizes="24px"
              className="object-contain"
            />
          </span>
          <span className="text-sm font-medium text-zinc-300">{activeStage}</span>
        </div>
      )}

      {/* Team carousel grid */}
      <div className="flex justify-center overflow-x-hidden">
        <div
          className="grid justify-items-center gap-y-3 gap-x-0 lg:gap-x-3"
          style={{ gridTemplateColumns: 'repeat(auto-fit, 200px)', maxWidth: '850px', justifyContent: 'center' }}
        >
          {stageData.team.map((group, gi) => (
            <CarouselSlot key={`${activeStage}-${gi}`} characters={group} />
          ))}
        </div>
      </div>
    </div>
  );
}
