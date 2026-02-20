import type { Metadata } from 'next';
import type { Lang } from '@/lib/i18n/config';
import { createPageMetadata, getMonthYear } from '@/lib/seo';
import { getT, loadMessages } from '@/i18n';
import { getWeapons, getAmulets, getTalismans, getArmorSets, getExclusiveEquipment } from '@/lib/data/equipment';
import { getCharactersForList } from '@/lib/data/characters';
import { getBuffs, getDebuffs } from '@/lib/data/effects';
import type { Effect } from '@/types/effect';
import { l as loc } from '@/lib/i18n/localize';
import EquipmentsPageClient from './EquipmentsPageClient';

export const revalidate = 86400;

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

  // Build character ID → localized name map for EE tab
  const eeCharNames: Record<string, string> = {};
  for (const char of characters) {
    eeCharNames[char.ID] = loc(char, 'Fullname', l);
  }

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
        buffMap={buffMap}
        debuffMap={debuffMap}
        lang={l}
        messages={messages}
      />
    </div>
  );
}
