import { getCharactersForList } from '@/lib/data/characters';
import { getRequestLang } from '@/lib/i18n/server';
import { loadMessages } from '@/i18n';
import { l as loc } from '@/lib/i18n/localize';
import { buildItemListJsonLd, buildUrl, getMonthYear } from '@/lib/seo';
import JsonLd from '@/app/components/seo/JsonLd';
import { tierListRankOrder } from '../_shared/tierlist';
import TierListPveClient from './TierListPveClient';

export default async function TierlistPveTool() {
  const lang = getRequestLang();
  const [characters, t] = await Promise.all([getCharactersForList(), loadMessages(lang)]);

  const ranked = [...characters]
    .filter((c) => c.rank)
    .sort(tierListRankOrder((c) => c.rank))
    .map((c) => ({
      name: loc(c, 'Fullname', lang),
      url: buildUrl(lang, `/characters/${c.slug}`),
    }));

  const itemListJsonLd = buildItemListJsonLd({
    name: `${t['tools.tierlistpve']} — ${getMonthYear(lang)}`,
    description: t['tools.tierlistpve.desc'],
    url: buildUrl(lang, '/tierlistpve'),
    items: ranked,
    itemListOrder: 'Descending',
  });

  return (
    <>
      <JsonLd data={itemListJsonLd} id="ld-tierlist" />
      <TierListPveClient characters={characters} />
    </>
  );
}
