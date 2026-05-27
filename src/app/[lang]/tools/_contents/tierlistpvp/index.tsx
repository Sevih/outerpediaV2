import { getCharactersForList } from '@/lib/data/characters';
import { getRequestLang } from '@/lib/i18n/server';
import { loadMessages } from '@/i18n';
import { l as loc } from '@/lib/i18n/localize';
import { buildItemListJsonLd, buildUrl, getMonthYear } from '@/lib/seo';
import JsonLd from '@/app/components/seo/JsonLd';
import { tierListRankOrder } from '../_shared/tierlist';
import TierListPvpClient from './TierListPvpClient';

export default async function TierlistPvpTool() {
  const lang = getRequestLang();
  const [characters, t] = await Promise.all([getCharactersForList(), loadMessages(lang)]);

  const ranked = [...characters]
    .filter((c) => c.rank_pvp)
    .sort(tierListRankOrder((c) => c.rank_pvp))
    .map((c) => ({
      name: loc(c, 'Fullname', lang),
      url: buildUrl(lang, `/characters/${c.slug}`),
    }));

  const itemListJsonLd = buildItemListJsonLd({
    name: `${t['tools.tierlistpvp']} — ${getMonthYear(lang)}`,
    description: t['tools.tierlistpvp.desc'],
    url: buildUrl(lang, '/tierlistpvp'),
    items: ranked,
    itemListOrder: 'Descending',
  });

  return (
    <>
      <JsonLd data={itemListJsonLd} id="ld-tierlist" />
      <TierListPvpClient characters={characters} />
    </>
  );
}
