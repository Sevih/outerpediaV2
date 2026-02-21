import type { Metadata } from 'next';
import type { Lang } from '@/lib/i18n/config';
import { createPageMetadata, getMonthYear } from '@/lib/seo';
import { getT, loadMessages } from '@/i18n';
import { getWeapons, getAmulets, getTalismans, getArmorSets, getExclusiveEquipment } from '@/lib/data/equipment';
import { getCharactersForList } from '@/lib/data/characters';
import { getBuffs, getDebuffs } from '@/lib/data/effects';
import { getBossDisplayMap } from '@/lib/data/bosses';
import type { Effect } from '@/types/effect';
import type { SourceFilterOption } from '@/types/equipment';
import { IE_BOSS_MAP } from '@/types/equipment';
import { l as loc } from '@/lib/i18n/localize';
import EquipmentsPageClient from './EquipmentsPageClient';

export const revalidate = 86400;

/** Build source filter options from actual equipment data */
function computeSourceFilters(
  items: Array<{ source?: string; boss?: string; name: string }>,
): SourceFilterOption[] {
  const bosses: SourceFilterOption[] = [];
  const ieGroups: SourceFilterOption[] = [];
  const others: SourceFilterOption[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    // Boss-based (Special Request etc.)
    if (item.boss && !seen.has(item.boss)) {
      seen.add(item.boss);
      bosses.push({ key: item.boss, bossKeys: [item.boss] });
    }
    // Irregular Extermination — group by raid name
    if (item.source === 'Irregular Extermination') {
      for (const [ieName, ieBosses] of Object.entries(IE_BOSS_MAP)) {
        const ieKey = `ie:${ieName}`;
        if (item.name.includes(ieName) && !seen.has(ieKey)) {
          seen.add(ieKey);
          ieGroups.push({ key: ieKey, bossKeys: ieBosses });
        }
      }
    }
    // Other named sources (Event Shop, Adventure License, …)
    if (item.source && !item.boss && item.source !== 'Irregular Extermination') {
      const srcKey = `source:${item.source}`;
      if (!seen.has(srcKey)) {
        seen.add(srcKey);
        const i18nKey = `equip.source.${item.source.toLowerCase().replace(/ /g, '_')}`;
        others.push({ key: srcKey, bossKeys: [], i18nKey });
      }
    }
  }

  return [...bosses, ...ieGroups, ...others];
}

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const l = lang as Lang;
  const t = await getT(l);
  const monthYear = getMonthYear(l);
  return createPageMetadata({
    lang: l,
    path: '/equipments',
    title: t('page.equipments.meta_title', { monthYear }),
    description: t('page.equipments.description', { monthYear }),
  });
}

export default async function EquipmentsPage({ params }: Props) {
  const { lang } = await params;
  const l = lang as Lang;

  const [messages, weapons, amulets, talismans, sets, ee, characters, buffsArr, debuffsArr] = await Promise.all([
    loadMessages(l),
    getWeapons(),
    getAmulets(),
    getTalismans(),
    getArmorSets(),
    getExclusiveEquipment(),
    getCharactersForList(),
    getBuffs(),
    getDebuffs(),
  ]);

  const buffMap: Record<string, Effect> = {};
  for (const b of buffsArr) buffMap[b.name] = b;
  const debuffMap: Record<string, Effect> = {};
  for (const d of debuffsArr) debuffMap[d.name] = d;

  // Build character ID → localized name + class map for EE tab
  const eeCharNames: Record<string, string> = {};
  const eeCharClasses: Record<string, string> = {};
  for (const char of characters) {
    eeCharNames[char.ID] = loc(char, 'Fullname', l);
    eeCharClasses[char.ID] = char.Class;
  }

  // Compute source filter options dynamically from actual equipment data
  const gearSourceFilters = computeSourceFilters([...weapons, ...amulets]);
  const setSourceFilters = computeSourceFilters(sets);

  // Collect distinct mainStats values from amulets (sorted for stable UI)
  const mainStatsOptions = [...new Set(amulets.flatMap(a => a.mainStats ?? []))].sort();

  // Collect all boss names (from items + filter bossKeys) for display map
  const bossNames = new Set<string>();
  for (const w of weapons) if (w.boss) bossNames.add(w.boss);
  for (const a of amulets) if (a.boss) bossNames.add(a.boss);
  for (const s of sets) if (s.boss) bossNames.add(s.boss);
  for (const f of [...gearSourceFilters, ...setSourceFilters]) {
    for (const bk of f.bossKeys) bossNames.add(bk);
  }
  const bossMap = await getBossDisplayMap([...bossNames]);

  return (
    <div className="mx-auto px-4 py-6 md:px-6">
      <h1 className="mx-auto text-center text-3xl font-bold">{messages['page.equipments.title']}</h1>
      <p className="mt-1 mb-6 text-center text-sm text-zinc-400">
        {messages['common.updated']?.replace('{monthYear}', getMonthYear(l))}
      </p>
      <EquipmentsPageClient
        weapons={weapons}
        amulets={amulets}
        talismans={talismans}
        sets={sets}
        ee={ee}
        eeCharNames={eeCharNames}
        eeCharClasses={eeCharClasses}
        gearSourceFilters={gearSourceFilters}
        setSourceFilters={setSourceFilters}
        mainStatsOptions={mainStatsOptions}
        bossMap={bossMap}
        buffMap={buffMap}
        debuffMap={debuffMap}
        lang={l}
        messages={messages}
      />
    </div>
  );
}
