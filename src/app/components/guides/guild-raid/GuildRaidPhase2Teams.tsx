'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Tabs from '@/app/components/ui/Tabs';
import CarouselSlot from '@/app/components/guides/CarouselSlot';
import CombatFootage from '@/app/components/guides/CombatFootage';
import TurnOrderDisplay from '@/app/components/guides/TurnOrderDisplay';
import RequirementsList from '@/app/components/guides/RequirementsList';
import parseText from '@/lib/parse-text';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import GeasIcon from './GeasIcon';
import { formatRatio, parseRatio } from './geas-helpers';
import type { Lang } from '@/types/common';
import type { NoteEntry } from '@/types/team';
import type { GuildRaidPhase2Data, GeasPool } from '@/types/guild-raid';

type Props = {
  teams: GuildRaidPhase2Data;
  pool: GeasPool;
  defaultTeam?: string;
  onTeamChange?: (key: string) => void;
};

function GeasBadge({ id, pool, lang }: { id: number; pool: GeasPool; lang: Lang }) {
  const g = pool[String(id)];
  if (!g) return null;
  const isPositive = parseFloat(g.ratio) > 0;

  return (
    <div
      className="flex items-center gap-1.5 rounded border border-white/5 bg-white/2 px-1.5 py-1"
      title={lRec(g.text, lang)}
    >
      <GeasIcon
        iconName={g.IconName}
        level={g.level}
        variant={isPositive ? 'debuff' : 'buff'}
        size={24}
      />
      <span
        className={[
          'text-[11px] font-bold',
          isPositive ? 'text-emerald-400' : 'text-red-400',
        ].join(' ')}
      >
        {formatRatio(g.ratio)}
      </span>
    </div>
  );
}

export default function GuildRaidPhase2Teams({ teams, pool, defaultTeam, onTeamChange }: Props) {
  const { lang: rawLang, t } = useI18n();
  const lang = rawLang as Lang;

  const teamKeys = Object.keys(teams);
  const [activeTeam, setActiveTeam] = useState(
    defaultTeam && teamKeys.includes(defaultTeam) ? defaultTeam : teamKeys[0],
  );

  const handleTeamChange = (key: string) => {
    setActiveTeam(key);
    onTeamChange?.(key);
  };

  const data = teams[activeTeam];

  const notes = useMemo((): NoteEntry[] | undefined => {
    if (!data) return undefined;
    if (lang !== 'en') {
      const localized = data[`note_${lang}` as keyof typeof data] as NoteEntry[] | undefined;
      if (localized && localized.length > 0) return localized;
    }
    return data.note as NoteEntry[] | undefined;
  }, [data, lang]);

  const multiplier = useMemo(() => {
    if (!data?.geasActive) return null;
    const { bonus, malus } = data.geasActive;
    let sum = 0;
    for (const id of bonus) {
      const g = pool[String(id)];
      if (g) sum += parseRatio(g.ratio);
    }
    for (const id of malus) {
      const g = pool[String(id)];
      if (g) sum += parseRatio(g.ratio);
    }
    return 1 + sum;
  }, [data, pool]);

  if (!data) return null;

  /* Tab labels — with icon if provided */
  const tabLabels = teamKeys.map((key) => {
    const entry = teams[key];
    if (!entry.icon) return key;
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="relative h-4 w-4 shrink-0">
          <Image
            src={`/images/ui/${entry.icon}.webp`}
            alt={key}
            fill
            sizes="16px"
            className="object-contain"
          />
        </span>
        {key}
      </span>
    );
  });

  return (
    <div className="space-y-4">
      <h3>{t('guides.team_selector')}</h3>

      {teamKeys.length > 1 && (
        <Tabs items={teamKeys} labels={tabLabels} value={activeTeam} onChange={handleTeamChange} />
      )}

      {/* Active geas */}
      {data.geasActive && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h5 className="after:hidden">{t('guildraid.active_geas')}</h5>
            {multiplier !== null && (
              <span className="text-sm font-bold text-amber-300">
                +{Math.round((multiplier - 1) * 100)}%
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.geasActive.bonus.map((id) => (
              <GeasBadge key={`b-${id}`} id={id} pool={pool} lang={lang} />
            ))}
            {data.geasActive.malus.map((id) => (
              <GeasBadge key={`m-${id}`} id={id} pool={pool} lang={lang} />
            ))}
          </div>
        </div>
      )}

      {/* Team carousel grid */}
      <div className="flex justify-center overflow-x-hidden">
        <div className="carousel-grid">
          {data.team.map((group, gi) => (
            <CarouselSlot key={`${activeTeam}-${gi}`} characters={group} />
          ))}
        </div>
      </div>

      {/* Notes — inline (no box) */}
      {notes && notes.length > 0 && (
        <div className="space-y-2 text-sm text-zinc-300">
          {notes.map((entry, i) => {
            if (entry.type === 'p') {
              return <p key={i}>{parseText(entry.string)}</p>;
            }
            if (entry.type === 'ul') {
              return (
                <ul key={i} className="list-disc space-y-1 pl-5">
                  {entry.items.map((item, j) => (
                    <li key={j}>{parseText(item)}</li>
                  ))}
                </ul>
              );
            }
            if (entry.type === 'turn-order') {
              return <TurnOrderDisplay key={i} order={entry.order} note={entry.note} />;
            }
            return null;
          })}
        </div>
      )}

      {/* Requirements */}
      {data.requirements && <RequirementsList data={data.requirements} />}

      {/* Video */}
      {data.video && data.video.videoId && (
        <CombatFootage
          videoId={data.video.videoId}
          title={data.video.title}
          author={data.video.author}
        />
      )}
    </div>
  );
}
