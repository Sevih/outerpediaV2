'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import type { Messages } from '@/i18n';
import { LANGUAGES, type Lang } from '@/lib/i18n/config';

export type BuffScheduleEntry = { date: string; type: string; raw: string };

type Props = {
  schedule: BuffScheduleEntry[];
  lang: Lang;
  t: Messages;
};

// Accent color per buff type — used for the marker dot until real icons land.
const BUFF_COLOR: Record<string, string> = {
  'frog-gold': 'bg-amber-400',
  'frog-food': 'bg-lime-400',
  'ark-raid': 'bg-red-400',
  'special-ecology': 'bg-emerald-400',
  'special-identification': 'bg-teal-400',
  'doppelganger': 'bg-fuchsia-400',
  'kate-workshop': 'bg-orange-400',
  'story-survey': 'bg-sky-400',
  'evolution-stone': 'bg-violet-400',
  'bounty-hunter': 'bg-yellow-400',
  'bandit-chase': 'bg-rose-400',
  other: 'bg-zinc-400',
};

// Buff-type icons live in /public/images/ui/buffs/<type>.webp. To enable a new
// one, drop the matching <type>.webp there and uncomment its line below. Types
// without an icon (or whose file is missing) fall back to the colored dot.
const BUFF_ICON: Record<string, string> = {
  'frog-gold': '/images/ui/buffs/TI_Item_Event_Gold.webp',
  'frog-food': '/images/ui/buffs/TI_Item_Event_User_Exp.webp',
  'kate-workshop': '/images/ui/buffs/kate-workshop.webp',
  'story-survey': '/images/ui/buffs/story-survey.webp',
  //'evolution-stone': '/images/ui/buffs/TI_Item_Event_DayWeek_Open.webp', // mode de jeu abandonné
  'ark-raid': '/images/ui/buffs/TI_Item_Event_DayWeek_Open.webp',
  'special-ecology': '/images/ui/buffs/TI_Item_Event_Boss_Reward_000.webp',
  'special-identification': '/images/ui/buffs/TI_Item_Event_Boss_Reward_000.webp',
  'doppelganger': '/images/ui/buffs/EBT_CHAR_PIECE_DROP.webp',
  // 'bounty-hunter': '/images/ui/buffs/bounty-hunter.webp', // mode de jeu abandonné
  // 'bandit-chase': '/images/ui/buffs/bandit-chase.webp', // mode de jeu abandonné
};

/** YYYY-MM-DD for a Date, in UTC (buffs run on UTC calendar days). */
function utcKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '0s';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

export default function BuffEventTimer({ schedule, lang, t }: Props) {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());
  const [expanded, setExpanded] = useState(false);
  const [failedIcons, setFailedIcons] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (schedule.length === 0) return null;
  // The "current" buff depends on the UTC date, which must be resolved on the
  // client: the homepage is cached via ISR, so a server-rendered day could be
  // stale. Rendering nothing until mount also keeps SSR/hydration output equal.
  if (!mounted) return null;

  const today = new Date(now);
  const todayKey = utcKey(today);
  const tomorrowKey = utcKey(new Date(now + 86400000));

  // today + every future day, already sorted ascending by the pipeline
  const upcoming = schedule.filter((e) => e.date >= todayKey);
  if (upcoming.length === 0) return null; // whole schedule is in the past

  const hasToday = upcoming[0].date === todayKey;
  const rows = expanded ? upcoming : upcoming.slice(0, 2);

  // Countdown to the next 00:00 UTC (when the buff rolls over)
  const nextReset = new Date(now);
  nextReset.setUTCHours(24, 0, 0, 0);
  const msToReset = nextReset.getTime() - now;

  const dateFmt = new Intl.DateTimeFormat(LANGUAGES[lang].htmlLang, {
    weekday: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

  const label = (type: string, raw: string) =>
    (t as Record<string, string>)[`buff.type.${type}`] ?? raw;

  const rowName = (date: string) => {
    if (date === todayKey) return t['home.buff.today'];
    if (date === tomorrowKey) return t['home.buff.tomorrow'];
    return dateFmt.format(new Date(`${date}T00:00:00Z`));
  };

  return (
    <div className="card-interactive flex flex-col justify-center gap-1.5 p-3 md:w-80">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          {t['home.buff.title']}
        </p>
        {hasToday && (
          <span className="font-mono text-xs tabular-nums text-zinc-400">
            {t['home.buff.changes_in'].replace('{time}', formatDuration(msToReset))}
          </span>
        )}
      </div>

      {!hasToday && (
        <p className="text-sm text-zinc-400">
          {t['home.buff.none']}
          {' — '}
          <span className="text-zinc-300">
            {t['home.buff.next_on'].replace('{date}', rowName(upcoming[0].date))}
          </span>
        </p>
      )}

      <ul
        className={
          expanded
            ? 'flex max-h-44 flex-col gap-1 overflow-y-auto pr-1'
            : 'flex flex-col gap-1'
        }
      >
        {rows.map((e) => {
          const isToday = e.date === todayKey;
          const icon = BUFF_ICON[e.type];
          const showIcon = icon && !failedIcons.has(e.type);
          return (
            <li
              key={e.date}
              className={`flex items-center gap-2 ${isToday ? '' : 'opacity-80'}`}
            >
              <span className="w-16 shrink-0 whitespace-nowrap text-xs font-semibold text-zinc-500">
                {rowName(e.date)}
              </span>
              {showIcon ? (
                <Image
                  src={icon}
                  alt=""
                  width={22}
                  height={22}
                  className="shrink-0"
                  onError={() => setFailedIcons((prev) => new Set(prev).add(e.type))}
                />
              ) : (
                <span
                  className={`size-2.5 shrink-0 rounded-full ${BUFF_COLOR[e.type] ?? BUFF_COLOR.other}`}
                  aria-hidden
                />
              )}
              <span
                className={`truncate text-sm ${isToday ? 'font-semibold text-zinc-100' : 'text-zinc-300'}`}
              >
                {label(e.type, e.raw)}
              </span>
            </li>
          );
        })}
      </ul>

      {upcoming.length > 2 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="self-start text-xs font-semibold text-cyan-400 hover:text-cyan-300"
        >
          {expanded ? t['home.buff.show_less'] : t['home.buff.show_all']}
        </button>
      )}
    </div>
  );
}
