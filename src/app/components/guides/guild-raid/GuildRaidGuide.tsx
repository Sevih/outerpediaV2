'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import CharacterPortrait from '@/app/components/character/CharacterPortrait';
import GuideTemplate from '@/app/components/guides/GuideTemplate';
import BossCompactDisplay from '@/app/components/guides/BossCompactDisplay';
import RecommendedCharacterList from '@/app/components/guides/RecommendedCharacterList';
import CarouselSlot from '@/app/components/guides/CarouselSlot';
import CombatFootage from '@/app/components/guides/CombatFootage';
import GeasUnlockList from './GeasUnlockList';
import GuildRaidPhase2Teams from './GuildRaidPhase2Teams';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { Boss } from '@/types/boss';
import type { LangMap } from '@/types/common';
import type {
  GeasPool,
  GeasUnlock,
  Phase1Data,
  GuildRaidPhase2Data,
} from '@/types/guild-raid';
import type { ElementType } from '@/types/enums';

/* -- Public types --------------------------------------------- */

export type GuildRaidVersionData = {
  label: LangMap;
  bossA: Boss;
  bossB: Boss;
  bossMain: Boss;
  geasA: Record<string, GeasUnlock>;
  geasB: Record<string, GeasUnlock>;
  phase1: Phase1Data;
  phase2: GuildRaidPhase2Data;
};

type Props = {
  title: LangMap;
  introduction: LangMap;
  pool: GeasPool;
  defaultVersion: string;
  versions: Record<string, GuildRaidVersionData>;
};

/* -- Side menu helpers ---------------------------------------- */

type Selection = 'mini-a' | 'mini-b' | 'main';

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="mt-3 mb-1 flex items-center gap-2 px-2 first:mt-0">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <span className="h-px flex-1 bg-zinc-700/50" />
    </div>
  );
}

function BossMenuItem({
  boss,
  label,
  isActive,
  onClick,
}: {
  boss: Boss;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const element = boss.element as ElementType;
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors',
        isActive
          ? 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30'
          : 'text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-100',
      ].join(' ')}
    >
      {boss.icons.startsWith('2') ? (
        <CharacterPortrait id={boss.icons} size="xxs" name="" />
      ) : (
        <span className="relative h-5 w-5 shrink-0 overflow-hidden rounded">
          <Image
            src={`/images/characters/boss/portrait/MT_${boss.icons}.webp`}
            alt={label}
            fill
            sizes="20px"
            className="object-cover"
          />
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {element && (
        <span className="relative h-4 w-4 shrink-0">
          <Image
            src={`/images/ui/elem/CM_Element_${element}.webp`}
            alt={element}
            fill
            sizes="16px"
            className="object-contain"
          />
        </span>
      )}
    </button>
  );
}

/* -- Version content ------------------------------------------ */

function GuildRaidContent({
  version,
  pool,
  versionKey,
}: {
  version: GuildRaidVersionData;
  pool: GeasPool;
  versionKey: string;
}) {
  const { lang, t } = useI18n();
  const [selected, setSelected] = useState<Selection>('mini-a');
  const [phase2Team, setPhase2Team] = useState<string | undefined>();
  const didReadHash = useRef(false);

  const teamKeys = Object.keys(version.phase2);

  const updateHash = useCallback((sel: Selection, team?: string) => {
    let suffix = sel as string;
    if (sel === 'main' && team) {
      suffix = `main/${encodeURIComponent(team)}`;
    }
    history.replaceState(null, '', `#${versionKey}/${suffix}`);
  }, [versionKey]);

  const handleSelect = useCallback((sel: Selection) => {
    setSelected(sel);
    updateHash(sel, sel === 'main' ? phase2Team : undefined);
  }, [updateHash, phase2Team]);

  const handleTeamChange = useCallback((team: string) => {
    setPhase2Team(team);
    updateHash('main', team);
  }, [updateHash]);

  useEffect(() => {
    if (didReadHash.current) return;
    didReadHash.current = true;

    const raw = decodeURIComponent(window.location.hash.slice(1));
    if (!raw) return;

    // Strip version prefix: "dec2025/mini-a" → "mini-a"
    const prefix = `${versionKey}/`;
    const content = raw.startsWith(prefix) ? raw.slice(prefix.length) : '';
    if (!content) return;

    if (content === 'mini-a' || content === 'mini-b') {
      setSelected(content);
    } else if (content.startsWith('main')) {
      setSelected('main');
      const teamPart = content.slice(5); // skip "main/"
      if (teamPart && teamKeys.includes(teamPart)) {
        setPhase2Team(teamPart);
      }
    }
  }, [versionKey, teamKeys]);

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start">
      {/* Left — side menu */}
      <div className="w-full shrink-0 md:sticky md:top-20 md:w-56">
        <div className="rounded-lg border border-zinc-700/50 bg-zinc-900/50 p-1.5">
          <div className="flex flex-col gap-0.5">
            <SectionHeader label={t('guides.tips.phase1')} />
            <BossMenuItem
              boss={version.bossA}
              label={lRec(version.bossA.Name, lang)}
              isActive={selected === 'mini-a'}
              onClick={() => handleSelect('mini-a')}
            />
            <BossMenuItem
              boss={version.bossB}
              label={lRec(version.bossB.Name, lang)}
              isActive={selected === 'mini-b'}
              onClick={() => handleSelect('mini-b')}
            />

            <SectionHeader label={t('guides.tips.phase2')} />
            <BossMenuItem
              boss={version.bossMain}
              label={lRec(version.bossMain.Name, lang)}
              isActive={selected === 'main'}
              onClick={() => handleSelect('main')}
            />
          </div>
        </div>
      </div>

      {/* Right — detail */}
      <div className="min-w-0 flex-1 space-y-6">
        {selected === 'mini-a' && (
          <>
            <BossCompactDisplay boss={version.bossA} iconOnlySkills={false} />
            <div className="grid gap-6 lg:grid-cols-2">
              <GeasUnlockList geas={version.geasA} pool={pool} />
              <RecommendedCharacterList entries={version.phase1.bossA.recommended} />
            </div>
            <hr className="border-neutral-700" />
            <div className="space-y-4">
              <div className="h2-style">{t('guides.team_selector')}</div>
              <div className="flex justify-center overflow-x-hidden">
                <div className="carousel-grid">
                  {version.phase1.bossA.team.map((group, gi) => (
                    <CarouselSlot key={`a-${gi}`} characters={group} />
                  ))}
                </div>
              </div>
            </div>
            {version.phase1.bossA.video && (
              <>
                <hr className="border-neutral-700" />
                <CombatFootage
                  videoId={version.phase1.bossA.video.videoId}
                  title={version.phase1.bossA.video.title}
                  author={version.phase1.bossA.video.author}
                />
              </>
            )}
          </>
        )}

        {selected === 'mini-b' && (
          <>
            <BossCompactDisplay boss={version.bossB} iconOnlySkills={false} />
            <div className="grid gap-6 lg:grid-cols-2">
              <GeasUnlockList geas={version.geasB} pool={pool} />
              <RecommendedCharacterList entries={version.phase1.bossB.recommended} />
            </div>
            <hr className="border-neutral-700" />
            <div className="space-y-4">
              <div className="h2-style">{t('guides.team_selector')}</div>
              <div className="flex justify-center overflow-x-hidden">
                <div className="carousel-grid">
                  {version.phase1.bossB.team.map((group, gi) => (
                    <CarouselSlot key={`b-${gi}`} characters={group} />
                  ))}
                </div>
              </div>
            </div>
            {version.phase1.bossB.video && (
              <>
                <hr className="border-neutral-700" />
                <CombatFootage
                  videoId={version.phase1.bossB.video.videoId}
                  title={version.phase1.bossB.video.title}
                  author={version.phase1.bossB.video.author}
                />
              </>
            )}
          </>
        )}

        {selected === 'main' && (
          <>
            <BossCompactDisplay boss={version.bossMain} iconOnlySkills={false} />
            <hr className="border-neutral-700" />
            <GuildRaidPhase2Teams
              teams={version.phase2}
              pool={pool}
              defaultTeam={phase2Team}
              onTeamChange={handleTeamChange}
            />
          </>
        )}
      </div>
    </div>
  );
}

/* -- Main component ------------------------------------------- */

export default function GuildRaidGuide({
  title,
  introduction,
  pool,
  defaultVersion,
  versions,
}: Props) {
  const { lang } = useI18n();
  const [resolvedVersion, setResolvedVersion] = useState(defaultVersion);

  // Read hash after mount to avoid hydration mismatch (server has no window.location)
  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (!hash) return;
    const slashIdx = hash.indexOf('/');
    const vKey = slashIdx === -1 ? hash : hash.slice(0, slashIdx);
    const keys = Object.keys(versions);
    if (keys.includes(vKey) && vKey !== defaultVersion) {
      setResolvedVersion(vKey);
    }
  }, [versions, defaultVersion]);

  const handleVersionChange = useCallback((key: string) => {
    setResolvedVersion(key);
    // Reset to mini-a on version change
    history.replaceState(null, '', `#${key}/mini-a`);
  }, []);

  return (
    <GuideTemplate
      key={resolvedVersion}
      title={lRec(title, lang)}
      introduction={lRec(introduction, lang)}
      defaultVersion={resolvedVersion}
      hashPrefix={undefined}
      onVersionChange={handleVersionChange}
      versions={Object.fromEntries(
        Object.entries(versions).map(([key, v]) => [
          key,
          {
            label: lRec(v.label, lang),
            content: <GuildRaidContent version={v} pool={pool} versionKey={key} />,
          },
        ]),
      )}
    />
  );
}
