'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import CharacterPortrait from '@/app/components/character/CharacterPortrait';
import FitText from '@/app/components/ui/FitText';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import { splitCharacterName } from '@/lib/character-name';
import parseText from '@/lib/parse-text';
import nameToId from '@data/generated/characters-name-to-id.json';
import charIndex from '@data/generated/characters-index.json';
import type { CharacterIndex } from '@/types/character';
import type { Lang } from '@/lib/i18n/config';
import type { SuffixLang } from '@/lib/i18n/config';
import type { TFunction, TranslationKey } from '@/i18n';
import type {
  RequirementsData,
  RequirementEntry,
  RequirementStats,
  RequirementEquipment,
} from '@/types/team';

const nameMap = nameToId as Record<string, string>;
const indexMap = charIndex as Record<string, CharacterIndex>;

type Props = {
  data: RequirementsData;
};

/* -- Stat / equipment mapping --------------------------------- */

const STAT_ORDER: (keyof RequirementStats)[] = [
  'spd', 'eff', 'atk', 'def', 'hp', 'chc', 'chd', 'trans',
];

const STAT_I18N: Record<string, TranslationKey> = {
  spd: 'sys.stat.spd',
  eff: 'sys.stat.eff',
  atk: 'sys.stat.atk',
  def: 'sys.stat.def',
  hp: 'sys.stat.hp',
  chc: 'sys.stat.chc',
  chd: 'sys.stat.chd',
  trans: 'sys.stat.trans',
};

const EQUIP_ORDER: (keyof RequirementEquipment)[] = [
  'weapon', 'amulet', 'talisman', 'set', 'ee',
];

const EQUIP_I18N: Record<string, TranslationKey> = {
  weapon: 'equip.tab.weapons',
  amulet: 'equip.tab.accessories',
  talisman: 'equip.tab.talismans',
  set: 'equip.tab.sets',
  ee: 'equip.tab.ee',
};

function hasStats(s?: RequirementStats): s is RequirementStats {
  if (!s) return false;
  return STAT_ORDER.some((k) => s[k] !== undefined);
}

function hasEquipment(eq?: RequirementEquipment): eq is RequirementEquipment {
  if (!eq) return false;
  return EQUIP_ORDER.some((k) => eq[k] && eq[k].length > 0);
}

function getSpd(entry: RequirementEntry): number | null {
  if (!entry.stats?.spd) return null;
  const parsed = parseFloat(entry.stats.spd);
  return isNaN(parsed) ? null : parsed;
}

function resolveNotes(entry: RequirementEntry, lang: string): string[] | undefined {
  if (lang !== 'en') {
    const key = `notes_${lang}` as keyof RequirementEntry;
    const localized = entry[key] as string[] | undefined;
    if (localized && localized.length > 0) return localized;
  }
  return entry.notes;
}

function resolveFooterNote(data: RequirementsData, lang: string): string | undefined {
  if (lang !== 'en') {
    const key = `note_${lang as SuffixLang}` as keyof RequirementsData;
    const localized = data[key] as string | undefined;
    if (localized) return localized;
  }
  return data.note;
}

/* -- Component ------------------------------------------------ */

export default function RequirementsList({ data }: Props) {
  const { lang, t } = useI18n();

  const note = resolveFooterNote(data, lang);

  const sorted = useMemo(() => {
    const hasAnySpd = data.entries.some((e) => getSpd(e) !== null);
    if (!hasAnySpd) return data.entries;
    return [...data.entries].sort((a, b) => {
      const sa = getSpd(a);
      const sb = getSpd(b);
      if (sa === null && sb === null) return 0;
      if (sa === null) return 1;
      if (sb === null) return 1;
      return sb - sa;
    });
  }, [data.entries]);

  return (
    <div className="rounded-lg border border-neutral-700/50 overflow-hidden">
      <div className="border-b border-neutral-700/50 bg-neutral-800/60 px-4 py-2 text-center">
        <span className="text-sm font-semibold uppercase tracking-wide text-neutral-200">
          {t('requirements.title')}
        </span>
      </div>

      {/* Desktop — 2 columns */}
      <div className="hidden md:grid md:grid-cols-2">
        {sorted.map((entry, idx) => (
          <EntryCard key={entry.character} entry={entry} idx={idx} lang={lang} t={t} layout="desktop" />
        ))}
      </div>

      {/* Mobile — stacked */}
      <div className="divide-y divide-neutral-600/60 md:hidden">
        {sorted.map((entry) => (
          <EntryCard key={entry.character} entry={entry} idx={0} lang={lang} t={t} layout="mobile" />
        ))}
      </div>

      {note && (
        <div className="border-t border-neutral-700/50 bg-neutral-800/40 px-4 py-2 text-center">
          <p className="text-sm text-neutral-400">{parseText(note)}</p>
        </div>
      )}
    </div>
  );
}

/* -- Entry card ----------------------------------------------- */

function EntryCard({
  entry,
  idx,
  lang,
  t,
  layout,
}: {
  entry: RequirementEntry;
  idx: number;
  lang: string;
  t: TFunction;
  layout: 'desktop' | 'mobile';
}) {
  const charId = nameMap[entry.character];
  const char = charId ? indexMap[charId] : undefined;
  const localizedName = char
    ? (l(char, 'Fullname', lang as Lang) as string)
    : entry.character;
  const nameParts = charId ? splitCharacterName(charId, localizedName, lang as Lang) : null;
  const entryNotes = resolveNotes(entry, lang);

  if (layout === 'mobile') {
    return (
      <div className="px-3 py-2.5">
        <div className="mb-1.5 flex items-center gap-2">
          {charId && (
            <Link href={`/${lang}/characters/${char?.slug ?? ''}`} className="shrink-0">
              <CharacterPortrait id={charId} name={localizedName} size="xs" />
            </Link>
          )}
          <CharName char={char} name={localizedName} />
        </div>
        <div className="ml-1 space-y-1">
          <StatsRow stats={entry.stats} t={t} />
          <PrioRow prio={entry.prio} t={t} />
          <EquipmentBlock equipment={entry.equipment} t={t} />
          <NotesBlock notes={entryNotes} />
        </div>
      </div>
    );
  }

  // Desktop
  return (
    <div
      className={[
        'flex items-center gap-3 px-3 py-2.5 border-neutral-600/60',
        idx >= 2 ? 'border-t' : '',
        idx % 2 === 1 ? 'border-l' : '',
      ].join(' ')}
    >
      <Link
        href={`/${lang}/characters/${char?.slug ?? ''}`}
        title={localizedName}
        className="flex w-20 shrink-0 flex-col items-center gap-1"
      >
        {charId && (
          <CharacterPortrait id={charId} name={localizedName} size="md" />
        )}
        <CharName char={char} name={localizedName} prefix={nameParts?.prefix} fit />
      </Link>
      <div className="min-w-0 flex-1 space-y-1.5">
        <StatsRow stats={entry.stats} t={t} />
        <PrioRow prio={entry.prio} t={t} />
        <EquipmentBlock equipment={entry.equipment} t={t} />
        <NotesBlock notes={entryNotes} />
      </div>
    </div>
  );
}

/* -- Sub-components ------------------------------------------- */

function CharName({ char, name, prefix, fit }: { char?: CharacterIndex; name: string; prefix?: string | null; fit?: boolean }) {
  const color = char ? 'text-sky-400' : 'text-red-500';
  if (fit) {
    const baseName = prefix ? name.replace(prefix, '').trim() : name;
    return (
      <div className="w-full text-center leading-tight" style={{ fontFamily: 'var(--font-geist-sans)' }}>
        {prefix && (
          <FitText max={9} min={7} className={`font-medium ${color}`}>{prefix}</FitText>
        )}
        <FitText max={13} min={8} className={`font-medium ${color}`}>{baseName}</FitText>
      </div>
    );
  }
  return <span className={`text-sm font-medium ${color}`}>{name}</span>;
}

function StatsRow({ stats, t }: { stats?: RequirementStats; t: TFunction }) {
  if (!hasStats(stats)) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {STAT_ORDER.map((key) => {
        const value = stats[key];
        if (value === undefined) return null;
        return (
          <span key={key} className="inline-flex items-center gap-1.5 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-sky-400/80">
              {t(STAT_I18N[key])}
            </span>
            <span className="text-neutral-200">{parseText(value)}</span>
          </span>
        );
      })}
    </div>
  );
}

function PrioRow({ prio, t }: { prio?: string[]; t: TFunction }) {
  if (!prio || prio.length === 0) return null;
  return (
    <div className="inline-flex items-center gap-1 text-sm text-neutral-300">
      <span className="text-xs font-semibold uppercase tracking-wide text-sky-400/80">
        {t('requirements.prio')}
      </span>
      {prio.map((s, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && <span className="text-neutral-600">&gt;</span>}
          {parseText(s)}
        </span>
      ))}
    </div>
  );
}

function EquipmentBlock({ equipment, t }: { equipment?: RequirementEquipment; t: TFunction }) {
  if (!hasEquipment(equipment)) return null;
  return (
    <div className="space-y-0.5">
      {EQUIP_ORDER.map((key) => {
        const items = equipment[key];
        if (!items || items.length === 0) return null;
        return (
          <div key={key} className="flex items-center gap-1.5 text-sm">
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-sky-400/80">
              {t(EQUIP_I18N[key])}
            </span>
            <span className="text-neutral-200">
              {items.map((v, i) => (
                <span key={i}>
                  {i > 0 && ', '}
                  {parseText(v)}
                </span>
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function NotesBlock({ notes }: { notes?: string[] }) {
  if (!notes || notes.length === 0) return null;
  return (
    <div className="space-y-0.5">
      {notes.map((n, i) => (
        <div key={i} className="flex gap-1.5 text-sm text-neutral-200">
          <span className="shrink-0 text-neutral-600">-</span>
          <span>{parseText(n)}</span>
        </div>
      ))}
    </div>
  );
}
