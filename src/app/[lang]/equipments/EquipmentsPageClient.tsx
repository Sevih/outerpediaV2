'use client';

import { useState, useMemo } from 'react';
import type { Weapon, Amulet, Talisman, ArmorSet, ExclusiveEquipment } from '@/types/equipment';
import type { Item, ItemType } from '@/types/item';
import type { Lang } from '@/lib/i18n/config';
import type { Messages } from '@/i18n';
import Tabs from '@/app/components/ui/Tabs';
import { WeaponCard, AmuletCard, TalismanCard, SetCard, EECard, ItemCard } from '@/app/components/equipment';

const TAB_KEYS = ['weapons', 'accessories', 'sets', 'talismans', 'ee', 'items'] as const;
type TabKey = (typeof TAB_KEYS)[number];

const ITEM_TYPES: ItemType[] = ['material', 'present'];

type Props = {
  weapons: Weapon[];
  amulets: Amulet[];
  talismans: Talisman[];
  sets: ArmorSet[];
  ee: Record<string, ExclusiveEquipment>;
  eeCharNames: Record<string, string>;
  items: Item[];
  lang: Lang;
  messages: Messages;
};

export default function EquipmentsPageClient({
  weapons, amulets, talismans, sets, ee, eeCharNames, items, lang, messages,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('weapons');
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemType | null>(null);

  const tabLabels = TAB_KEYS.map((k) => messages[`equip.tab.${k}`]);

  const eeEntries = useMemo(
    () => Object.entries(ee),
    [ee],
  );

  const EXCLUDED_TYPES = new Set<string>(['box', 'currency', 'costume', 'gem']);
  const EXCLUDED_NAMES = new Set([
    'Clear Ticket',
    'Normal Recruitment Ticket',
    'Normal Recruitment Ticket (Event)',
    'Limited Recruitment Ticket (Event)',
  ]);
  const INCLUDED_NAMES = new Set([
    'Call of the Demiurge',
    'Call of the Demiurge (Event)',
  ]);

  const TYPE_ORDER: Record<string, number> = { gem: 0, material: 1, present: 2, currency: 3 };

  const baseItems = useMemo(
    () => items
      .filter((i) =>
        INCLUDED_NAMES.has(i.name)
        || (
          !EXCLUDED_TYPES.has(i.type)
          && !EXCLUDED_NAMES.has(i.name)
          && !i.name.match(/^Supreme .+ Evolution Stone$/)
        ),
      )
      .sort((a, b) =>
        (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99)
        || a.name.localeCompare(b.name),
      ),
    [items],
  );

  const filteredItems = useMemo(
    () => itemTypeFilter ? baseItems.filter((i) => i.type === itemTypeFilter) : baseItems,
    [baseItems, itemTypeFilter],
  );

  return (
    <div className="flex flex-col gap-6">
      <Tabs
        items={[...TAB_KEYS]}
        labels={tabLabels}
        value={activeTab}
        onChange={(v) => setActiveTab(v as TabKey)}
        hashPrefix="tab"
        className="justify-center"
      />

      {/* Weapons */}
      {activeTab === 'weapons' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {weapons.map((w, i) => (
            <WeaponCard key={i} weapon={w} lang={lang} />
          ))}
        </div>
      )}

      {/* Accessories */}
      {activeTab === 'accessories' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {amulets.map((a, i) => (
            <AmuletCard key={i} amulet={a} lang={lang} />
          ))}
        </div>
      )}

      {/* Armor Sets */}
      {activeTab === 'sets' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {sets.map((s, i) => (
            <SetCard key={i} set={s} lang={lang} />
          ))}
        </div>
      )}

      {/* Talismans */}
      {activeTab === 'talismans' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {talismans.map((t, i) => (
            <TalismanCard key={i} talisman={t} lang={lang} />
          ))}
        </div>
      )}

      {/* Exclusive Equipment */}
      {activeTab === 'ee' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {eeEntries.map(([charId, eeItem]) => (
            <EECard
              key={charId}
              ee={eeItem}
              charId={charId}
              charName={eeCharNames[charId] ?? charId}
              lang={lang}
            />
          ))}
        </div>
      )}

      {/* Items */}
      {activeTab === 'items' && (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setItemTypeFilter(null)}
              className={[
                'rounded-full px-3 py-1 text-sm font-medium transition ring-1',
                itemTypeFilter === null
                  ? 'bg-yellow-500/20 text-yellow-300 ring-yellow-400/40'
                  : 'bg-zinc-800 text-zinc-300 ring-white/10 hover:bg-zinc-700',
              ].join(' ')}
            >
              {messages['equip.filter.all']}
            </button>
            {ITEM_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setItemTypeFilter(type === itemTypeFilter ? null : type)}
                className={[
                  'rounded-full px-3 py-1 text-sm font-medium transition ring-1',
                  itemTypeFilter === type
                    ? 'bg-yellow-500/20 text-yellow-300 ring-yellow-400/40'
                    : 'bg-zinc-800 text-zinc-300 ring-white/10 hover:bg-zinc-700',
                ].join(' ')}
              >
                {messages[`equip.items.${type}`]}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {filteredItems.map((item) => (
              <ItemCard key={item.id} item={item} lang={lang} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
