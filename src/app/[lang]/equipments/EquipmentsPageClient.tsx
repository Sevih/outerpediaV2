'use client';

import { useState, useMemo } from 'react';
import type { Weapon, Amulet, Talisman, ArmorSet, ExclusiveEquipment } from '@/types/equipment';
import type { Lang } from '@/lib/i18n/config';
import type { Messages } from '@/i18n';
import Tabs from '@/app/components/ui/Tabs';
import { WeaponCard, AmuletCard, TalismanCard, SetCard, EECard } from '@/app/components/equipment';

const TAB_KEYS = ['weapons', 'accessories', 'sets', 'talismans', 'ee'] as const;
type TabKey = (typeof TAB_KEYS)[number];

type Props = {
  weapons: Weapon[];
  amulets: Amulet[];
  talismans: Talisman[];
  sets: ArmorSet[];
  ee: Record<string, ExclusiveEquipment>;
  eeCharNames: Record<string, string>;
  lang: Lang;
  messages: Messages;
};

export default function EquipmentsPageClient({
  weapons, amulets, talismans, sets, ee, eeCharNames, lang, messages,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('weapons');

  const tabLabels = TAB_KEYS.map((k) => messages[`equip.tab.${k}`]);

  const eeEntries = useMemo(
    () => Object.entries(ee),
    [ee],
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

    </div>
  );
}
