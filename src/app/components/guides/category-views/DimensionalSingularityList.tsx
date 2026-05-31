import path from 'path';
import Image from 'next/image';
import Link from 'next/link';
import type { CategoryViewProps } from './types';
import type { GuideMeta } from '@/types/guide';
import type { Boss } from '@/types/boss';
import type { TranslationKey } from '@/i18n';
import { lRec } from '@/lib/i18n/localize';
import { localePath } from '@/lib/navigation';
import { LANGUAGES } from '@/lib/i18n/config';
import { readJson } from '@/lib/data/_json';
import { getBoss } from '@/lib/data/bosses';
import { guideAccent } from '../guidesTheme';
import SingularityCountdown from './SingularityCountdown';

type RotationWeek = {
  startDate: string;
  endDate: string;
  groupId: number;
  bossIds: string[];
};

type RotationFile = {
  cycleLengthWeeks: number;
  startDayOfWeek: string;
  rotation: RotationWeek[];
  groups: { id: number; bossIds: string[] }[];
};

const ROTATION_PATH = path.join(process.cwd(), 'data/generated/singularity-rotation.json');

/** YYYY-MM-DD → Date in UTC. */
function parseISO(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function isoUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return isoUTC(d);
}

function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((parseISO(toISO).getTime() - parseISO(fromISO).getTime()) / 86400000);
}

/** Resolve a Lang to a BCP-47 locale tag we can pass to Intl. */
function intlLocale(lang: keyof typeof LANGUAGES): string {
  return LANGUAGES[lang].htmlLang;
}

function formatShortDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(parseISO(iso));
}

function formatWeekday(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(parseISO(iso));
}

/** Locate the rotation week that contains today; falls back to the first future week. */
function pickCurrentWeek(rotation: RotationWeek[], todayISO: string): { week: RotationWeek; index: number } {
  for (let i = 0; i < rotation.length; i++) {
    const w = rotation[i];
    if (w.startDate <= todayISO && todayISO <= w.endDate) return { week: w, index: i };
  }
  // If today is past the last entry, clamp to the last week so the UI still renders.
  const idx = rotation.findIndex((w) => w.startDate > todayISO);
  if (idx === -1) return { week: rotation[rotation.length - 1], index: rotation.length - 1 };
  return { week: rotation[idx], index: idx };
}

export default async function DimensionalSingularityList({ guides, lang, t }: CategoryViewProps) {
  const accent = guideAccent('dimensional-singularity');
  const locale = intlLocale(lang);

  const [rotation] = await Promise.all([readJson<RotationFile>(ROTATION_PATH)]);
  const todayISO = isoUTC(new Date());
  const { week: currentWeek } = pickCurrentWeek(rotation.rotation, todayISO);

  // Each rotation week starts on Wed; the weekend boss is active on the following Sat (Wed + 3).
  const satISO = addDays(currentWeek.startDate, 3);
  const daysToSat = daysBetween(todayISO, satISO);

  // Index guides by boss_id, then load full Boss JSON for class/element/icons.
  const guideByBossId = new Map<string, GuideMeta>();
  for (const g of guides) if (g.boss_id) guideByBossId.set(g.boss_id, g);

  const bossEntries = await Promise.all(
    guides.map(async (g) => [g.boss_id ?? '', g.boss_id ? await getBoss(g.boss_id) : null] as const),
  );
  const bossById = new Map<string, Boss | null>(bossEntries);

  // Determine which bosses are weekly vs weekend across the rotation:
  // - any boss appearing in positions 0..2 of any group → weekly
  // - any boss appearing in position 3 → weekend
  const weeklySet = new Set<string>();
  for (const g of rotation.groups) {
    g.bossIds.slice(0, 3).forEach((id) => weeklySet.add(id));
  }

  // Active boss IDs this week.
  const activeIds = new Set(currentWeek.bossIds);

  // Each rotation week starts on Wed; the 4 bossIds map to consecutive days:
  // index 0 → Wed, 1 → Thu, 2 → Fri, 3 → Sat. Derive day metadata from that.
  type DayInfo = {
    bossId: string;
    date: string;
    dayLabel: string;
    isToday: boolean;
    isPast: boolean;
  };
  const dayInfo: DayInfo[] = currentWeek.bossIds.map((bossId, i) => {
    const date = addDays(currentWeek.startDate, i);
    return {
      bossId,
      date,
      dayLabel: formatWeekday(date, locale),
      isToday: date === todayISO,
      isPast: date < todayISO,
    };
  });
  const weeklyInfo = dayInfo.slice(0, 3);
  const weekendInfo = dayInfo[3];
  const todayBossId = dayInfo.find((d) => d.isToday)?.bossId ?? null;

  // Counter values for headers.
  const dowStr = formatWeekday(todayISO, locale).toUpperCase();

  const liveLabel = t['guides.singularity.week.live'].replace('{dow}', dowStr);

  // Weekend rail copy: today / tomorrow / in N days.
  const weekendRail = daysToSat <= 0
    ? t['guides.singularity.weekend.today']
    : daysToSat === 1
      ? t['guides.singularity.weekend.tomorrow']
      : t['guides.singularity.weekend.in_days'].replace('{n}', String(daysToSat));
  const satDateStr = formatShortDate(satISO, locale);

  return (
    <div className="mt-6 flex flex-col gap-14">
      {todayBossId && (
        <ActiveThisWeek
          accent={accent}
          title={t['guides.singularity.week.title']}
          titleMobile={t['guides.singularity.week.title_mobile']}
          tagline={t['guides.singularity.week.tagline']}
          liveLabel={liveLabel}
          timerTemplate={t['guides.singularity.timer.next']}
          weeklyInfo={weeklyInfo}
          weekendInfo={weekendInfo}
          weekendRail={weekendRail}
          satDateStr={satDateStr}
          daySatOnlyLabel={t['guides.singularity.day.sat_only']}
          guideByBossId={guideByBossId}
          bossById={bossById}
          lang={lang}
        />
      )}
      <BossLibrary
        accent={accent}
        title={t['guides.singularity.library.title']}
        tagline={t['guides.singularity.library.tagline']}
        guides={guides}
        bossById={bossById}
        weeklySet={weeklySet}
        activeIds={activeIds}
        todayBossId={todayBossId}
        lang={lang}
        t={t}
      />
      <ModeInfo t={t} />
    </div>
  );
}

/* ─────────────────────────── Section header ─────────────────────────── */

type AccentProps = ReturnType<typeof guideAccent>;

function SectionHeader({
  accent, title, tagline,
}: {
  accent: AccentProps;
  title: string;
  tagline?: string;
}) {
  return (
    <header className="relative flex flex-col gap-2 border-b border-zinc-800 pb-4">
      <span className={`absolute -bottom-px left-0 h-0.5 w-14 rounded-full ${accent.stripe}`} aria-hidden />
      <h2 className="text-xl font-semibold tracking-tight text-zinc-100 md:text-2xl">{title}</h2>
      {tagline && <p className="hidden text-sm text-zinc-400 md:block">{tagline}</p>}
    </header>
  );
}

/* ─────────────────────────── Active this week ─────────────────────────── */

type DayInfo = {
  bossId: string;
  date: string;
  dayLabel: string;
  isToday: boolean;
  isPast: boolean;
};

function ActiveThisWeek({
  accent, title, titleMobile, tagline, liveLabel, timerTemplate,
  weeklyInfo, weekendInfo, weekendRail, satDateStr,
  daySatOnlyLabel,
  guideByBossId, bossById, lang,
}: {
  accent: AccentProps;
  title: string;
  titleMobile: string;
  tagline: string;
  liveLabel: string;
  timerTemplate: string;
  weeklyInfo: DayInfo[];
  weekendInfo: DayInfo | undefined;
  weekendRail: string;
  satDateStr: string;
  daySatOnlyLabel: string;
  guideByBossId: Map<string, GuideMeta>;
  bossById: Map<string, Boss | null>;
  lang: CategoryViewProps['lang'];
}) {
  // Resolve which boss is "today" + collect the other 3 bosses for the inactive rail.
  const allInfo: (DayInfo & { isWeekend: boolean })[] = [
    ...weeklyInfo.map((d) => ({ ...d, isWeekend: false })),
    ...(weekendInfo ? [{ ...weekendInfo, isWeekend: true }] : []),
  ];
  const today = allInfo.find((d) => d.isToday) ?? null;
  const others = allInfo.filter((d) => !d.isToday);

  const todayGuide = today ? guideByBossId.get(today.bossId) : null;
  const todayBoss = today ? bossById.get(today.bossId) ?? null : null;

  return (
    <section className="flex flex-col gap-5">
      <header className="relative flex flex-col gap-2 border-b border-zinc-800 pb-4">
        <span className={`absolute -bottom-px left-0 h-0.5 w-14 rounded-full ${accent.stripe}`} aria-hidden />
        <h2 className="text-xl font-semibold tracking-tight text-zinc-100 md:text-2xl">
          <span className="md:hidden">{titleMobile}</span>
          <span className="hidden md:inline">{title}</span>
        </h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em]">
          <span className={`inline-flex items-center gap-1.5 ${accent.text}`}>
            <span className="relative inline-flex size-2">
              <span className={`absolute inset-0 rounded-full ${accent.stripe} opacity-60 animate-ping`} aria-hidden />
              <span className={`relative inline-flex size-2 rounded-full ${accent.stripe}`} aria-hidden />
            </span>
            {liveLabel}
          </span>
          <span className="text-zinc-700" aria-hidden>·</span>
          <SingularityCountdown
            template={timerTemplate}
            className="tabular-nums text-zinc-400"
          />
        </div>
        <p className="hidden text-sm text-zinc-400 md:block">{tagline}</p>
      </header>

      {today && todayGuide && todayBoss && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[3fr_2fr]">
          {/* Left column — today's boss, the headline card (read first). */}
          <div className="min-w-0">
            <TodayBannerCard
              guide={todayGuide}
              boss={todayBoss}
              dayLabel={today.dayLabel}
              isWeekend={today.isWeekend}
              weekendDate={today.isWeekend ? satDateStr : null}
              weekendRail={today.isWeekend ? weekendRail : null}
              daySatOnlyLabel={daySatOnlyLabel}
              accent={accent}
              lang={lang}
            />
          </div>

          {/* Right column — 3 inactive bosses stacked (desktop only). */}
          <aside className="hidden flex-col gap-3 md:flex">
            {others.map((info) => {
              const guide = guideByBossId.get(info.bossId);
              const boss = bossById.get(info.bossId) ?? null;
              if (!guide || !boss) return null;
              return (
                <InactiveBannerCard
                  key={info.bossId}
                  guide={guide}
                  boss={boss}
                  dayLabel={info.dayLabel}
                  isPast={info.isPast}
                  isWeekend={info.isWeekend}
                  lang={lang}
                />
              );
            })}
          </aside>
        </div>
      )}
    </section>
  );
}

/* ─────────────────────────── Banner cards ─────────────────────────── */

function TodayBannerCard({
  guide, boss, dayLabel, isWeekend, weekendDate, weekendRail, daySatOnlyLabel, accent, lang,
}: {
  guide: GuideMeta;
  boss: Boss;
  dayLabel: string;
  isWeekend: boolean;
  weekendDate: string | null;
  weekendRail: string | null;
  daySatOnlyLabel: string;
  accent: AccentProps;
  lang: CategoryViewProps['lang'];
}) {
  const title = lRec(guide.title, lang);
  const description = lRec(guide.description, lang);

  const borderClass = isWeekend
    ? 'border-amber-500/60 ring-1 ring-amber-500/30'
    : 'border-violet-500/60 ring-1 ring-violet-500/40';
  const glowClass = isWeekend ? 'hover:shadow-[0_8px_28px_-12px_#fbbf24]' : accent.glow;

  return (
    <Link
      href={localePath(lang, `/guides/${guide.category}/${guide.slug}`)}
      className={[
        'group flex flex-col gap-3 transition-[transform,box-shadow] duration-150 hover:-translate-y-px',
        glowClass,
      ].join(' ')}
    >
      <div className={`relative aspect-680/94 w-full overflow-hidden rounded-lg border ${borderClass}`}>
        <Image
          src={`/images/guides/T_Singularity_${boss.icons}.webp`}
          alt={title}
          fill
          sizes="(max-width: 768px) 100vw, 66vw"
          className="object-cover"
        />
        <span
          className={`absolute inset-y-0 left-0 w-0.75 ${isWeekend ? 'bg-amber-400 shadow-[0_0_14px_#fbbf24]' : 'bg-violet-400 shadow-[0_0_14px_#a78bfa]'}`}
          aria-hidden
        />
      </div>

      <div className="flex items-start justify-between gap-3 px-0.5">
        <div className="min-w-0 flex-1">
          <h3 className="static line-clamp-1 pb-0 text-base font-semibold tracking-tight text-zinc-100 after:hidden sm:text-lg">
            {title}
          </h3>
          {description && (
            <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{description}</p>
          )}
          {isWeekend && weekendRail && (
            <p className="mt-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300/90">
              {weekendRail}{weekendDate ? ` · ${weekendDate}` : ''}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="flex items-center gap-1">
            <ClassIcon classType={boss.class} size={22} />
            <ElementIcon element={boss.element} size={22} />
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em]">
            <span className="relative inline-flex size-1.5">
              <span
                className={`absolute inset-0 rounded-full ${isWeekend ? 'bg-amber-400' : accent.stripe} opacity-60 animate-ping`}
                aria-hidden
              />
              <span
                className={`relative inline-flex size-1.5 rounded-full ${isWeekend ? 'bg-amber-400' : accent.stripe}`}
                aria-hidden
              />
            </span>
            <span className={isWeekend ? 'text-amber-300' : 'text-violet-300'}>
              {isWeekend ? daySatOnlyLabel : dayLabel}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function InactiveBannerCard({
  guide, boss, dayLabel, isPast, isWeekend, lang,
}: {
  guide: GuideMeta;
  boss: Boss;
  dayLabel: string;
  isPast: boolean;
  isWeekend: boolean;
  lang: CategoryViewProps['lang'];
  size?: 'sm' | 'md';
}) {
  const title = lRec(guide.title, lang);
  const borderClass = isWeekend ? 'border-amber-500/30' : 'border-zinc-800';

  return (
    <Link
      href={localePath(lang, `/guides/${guide.category}/${guide.slug}`)}
      className={[
        'group block transition-[transform,opacity] duration-150 hover:-translate-y-px',
        isPast ? 'opacity-50 hover:opacity-90' : 'opacity-90 hover:opacity-100',
      ].join(' ')}
    >
      <div className={`relative aspect-680/94 w-full overflow-hidden rounded-lg border ${borderClass}`}>
        <Image
          src={`/images/guides/T_Singularity_${boss.icons}.webp`}
          alt={title}
          fill
          sizes="(max-width: 768px) 100vw, 340px"
          className="object-cover"
        />
        {/* Top-right: class + element icons + day chip */}
        <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
          <ClassIcon classType={boss.class} size={16} />
          <ElementIcon element={boss.element} size={16} />
          <span
            className={[
              'inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em]',
              isWeekend
                ? 'border-amber-500/40 bg-amber-500/15 text-amber-200'
                : 'border-zinc-700 bg-zinc-900/70 text-zinc-200',
            ].join(' ')}
          >
            {dayLabel}
          </span>
        </div>
        {/* Bottom-right: boss name with strong shadow so the underlying banner stays clean */}
        <h3 className="absolute right-2 bottom-0 line-clamp-1 max-w-[80%] pb-0 text-right text-xs font-semibold tracking-tight text-zinc-50 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] after:hidden sm:text-sm">
          {title}
        </h3>
      </div>
    </Link>
  );
}

/* ── Class / Element icons (used by banner + library) ──────────────── */

function ClassIcon({ classType, size = 20 }: { classType: string; size?: number }) {
  return (
    <span
      className="relative inline-block shrink-0 rounded-md border border-zinc-700 bg-zinc-900/60 p-0.5"
      style={{ width: size + 6, height: size + 6 }}
      title={classType}
      aria-label={classType}
    >
      <Image
        src={`/images/ui/class/CM_Class_${classType}.webp`}
        alt=""
        fill
        sizes={`${size}px`}
        className="object-contain p-0.5"
        unoptimized
      />
    </span>
  );
}

function ElementIcon({ element, size = 20 }: { element: string; size?: number }) {
  return (
    <span
      className="relative inline-block shrink-0 rounded-md border border-zinc-700 bg-zinc-900/60 p-0.5"
      style={{ width: size + 6, height: size + 6 }}
      title={element}
      aria-label={element}
    >
      <Image
        src={`/images/ui/elem/CM_Element_${element}.webp`}
        alt=""
        fill
        sizes={`${size}px`}
        className="object-contain p-0.5"
        unoptimized
      />
    </span>
  );
}

/* ─────────────────────────── Boss library ─────────────────────────── */

function BossLibrary({
  accent, title, tagline,
  guides, bossById, weeklySet, activeIds, todayBossId, lang, t,
}: {
  accent: AccentProps;
  title: string;
  tagline: string;
  guides: GuideMeta[];
  bossById: Map<string, Boss | null>;
  weeklySet: Set<string>;
  activeIds: Set<string>;
  todayBossId: string | null;
  lang: CategoryViewProps['lang'];
  t: Record<TranslationKey, string>;
}) {
  // Sort: today's boss first, then other active, then weekly, then weekend.
  const sorted = [...guides].sort((a, b) => {
    const aToday = a.boss_id === todayBossId ? 0 : 1;
    const bToday = b.boss_id === todayBossId ? 0 : 1;
    if (aToday !== bToday) return aToday - bToday;
    const aActive = a.boss_id && activeIds.has(a.boss_id) ? 0 : 1;
    const bActive = b.boss_id && activeIds.has(b.boss_id) ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    const aWeekly = a.boss_id && weeklySet.has(a.boss_id) ? 0 : 1;
    const bWeekly = b.boss_id && weeklySet.has(b.boss_id) ? 0 : 1;
    if (aWeekly !== bWeekly) return aWeekly - bWeekly;
    return a.slug.localeCompare(b.slug);
  });

  return (
    <section className="flex flex-col gap-5">
      <SectionHeader
        accent={accent}
        title={title}
        tagline={tagline}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((guide) => {
          const boss = guide.boss_id ? bossById.get(guide.boss_id) ?? null : null;
          const isActive = guide.boss_id ? activeIds.has(guide.boss_id) : false;
          const isWeekly = guide.boss_id ? weeklySet.has(guide.boss_id) : false;
          const isToday = guide.boss_id === todayBossId;
          return (
            <LibraryCard
              key={guide.slug}
              guide={guide}
              boss={boss}
              isActive={isActive}
              isWeekly={isWeekly}
              isToday={isToday}
              accent={accent}
              daySatOnlyLabel={t['guides.singularity.day.sat_only']}
              lang={lang}
              t={t}
            />
          );
        })}
      </div>
    </section>
  );
}

function LibraryCard({
  guide, boss, isActive, isWeekly, isToday, accent,
  daySatOnlyLabel, lang, t,
}: {
  guide: GuideMeta;
  boss: Boss | null;
  isActive: boolean;
  isWeekly: boolean;
  isToday: boolean;
  accent: AccentProps;
  daySatOnlyLabel: string;
  lang: CategoryViewProps['lang'];
  t: Record<TranslationKey, string>;
}) {
  const title = lRec(guide.title, lang);
  const description = lRec(guide.description, lang);
  const iconId = boss?.icons;
  const avatarSrc = iconId
    ? `/images/guides/MT_Singularity_${iconId}.webp`
    : `/images/guides/${guide.icon}.webp`;

  return (
    <Link
      href={localePath(lang, `/guides/${guide.category}/${guide.slug}`)}
      className={[
        'group relative flex min-h-30 flex-col gap-3 overflow-hidden rounded-xl border p-4 transition-[transform,border-color,box-shadow] duration-150',
        isToday
          ? `border-violet-500/60 ring-1 ring-violet-500/40 bg-linear-to-b from-violet-500/15 to-slate-800/50 ${accent.glow}`
          : isActive
            ? `border-violet-500/40 bg-linear-to-b from-violet-500/8 to-slate-800/50 ${accent.glow}`
            : 'border-zinc-800 bg-slate-800/50 hover:border-violet-500/40',
        'hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-(--color-filter-ring) focus-visible:outline-none',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <span
          className={[
            'relative size-12 shrink-0 overflow-hidden rounded-lg border',
            isToday ? 'border-violet-500/60' : isActive ? 'border-violet-500/40' : 'border-zinc-700',
          ].join(' ')}
        >
          <Image
            src={avatarSrc}
            alt={title}
            fill
            sizes="48px"
            className="object-cover"
          />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3 className="static line-clamp-2 pb-0 text-sm font-semibold tracking-tight text-zinc-100 after:hidden">
            {title}
          </h3>
          {boss && (
            <div className="flex flex-wrap items-center gap-1.5">
              <ClassIcon classType={boss.class} size={18} />
              <ElementIcon element={boss.element} size={18} />
            </div>
          )}
        </div>
        {isToday && (
          <span className="relative inline-flex size-2 shrink-0">
            <span className={`absolute inset-0 rounded-full ${accent.stripe} opacity-60 animate-ping`} aria-hidden />
            <span className={`relative inline-flex size-2 rounded-full ${accent.stripe}`} aria-hidden />
          </span>
        )}
      </div>

      {description && <span className="sr-only">{description}</span>}

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-zinc-800 pt-2.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-zinc-500">
        {!isWeekly ? (
          <span className="rounded-md border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 text-amber-300">
            {daySatOnlyLabel}
          </span>
        ) : <span />}
        <span className="truncate">
          {t['page.guide.by'].replace('{author}', guide.author)} · {guide.last_updated}
        </span>
      </div>
    </Link>
  );
}

/* ─────────────────────────── Mode info box ─────────────────────────── */

function ModeInfo({ t }: { t: Record<TranslationKey, string> }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-slate-800/40 p-4 text-sm text-zinc-300 sm:p-5">
      <p className="leading-relaxed">{t['guides.singularity.info.intro']}</p>
      <p className="mt-2 text-zinc-400">{t['guides.singularity.info.unlock']}</p>
      <p className="mt-1 text-zinc-400">{t['guides.singularity.info.schedule']}</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-zinc-300">
        <li>{t['guides.singularity.info.feature.repel']}</li>
        <li>{t['guides.singularity.info.feature.ascension']}</li>
        <li>{t['guides.singularity.info.feature.ranking']}</li>
      </ul>
    </section>
  );
}
