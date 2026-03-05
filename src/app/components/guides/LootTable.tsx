'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import { slugifyEquipment, formatEffectText, formatScaledEffect } from '@/lib/format-text';
import EquipmentIcon from '@/app/components/equipment/EquipmentIcon';
import type { ItemRarity } from '@/lib/theme';

import weaponsData from '@data/equipment/weapon.json';
import amuletsData from '@data/equipment/accessory.json';
import setsData from '@data/equipment/sets.json';

type GearItem = {
  name: string;
  rarity: string;
  image: string;
  effect_name?: string | null;
  effect_desc1?: string | null;
  effect_desc4?: string | null;
  effect_icon?: string | null;
  class?: string | null;
  boss?: string | string[];
  level?: number;
};

type SetItem = {
  name: string;
  rarity: string;
  set_icon: string;
  image_prefix: string;
  effect_2_1: string;
  effect_4_1: string;
  effect_2_4: string;
  effect_4_4: string;
  class?: string | null;
  boss?: string | string[];
};

function matchesBoss(boss: string | string[] | undefined, id: string): boolean {
  if (!boss) return false;
  return Array.isArray(boss) ? boss.includes(id) : boss === id;
}

type Props = {
  bossId: string;
};

export default function LootTable({ bossId }: Props) {
  const { lang, t, href } = useI18n();
  const [expanded, setExpanded] = useState(false);

  const weapons = (weaponsData as GearItem[]).filter(w => matchesBoss(w.boss, bossId));
  const amulets = (amuletsData as GearItem[]).filter(a => matchesBoss(a.boss, bossId));
  const sets = (setsData as SetItem[]).filter(s => matchesBoss(s.boss, bossId));

  if (weapons.length === 0 && amulets.length === 0 && sets.length === 0) return null;

  const allGear = [...weapons, ...amulets];

  return (
    <div className="mt-6">
      <h3
        onClick={() => setExpanded(v => !v)}
        className="flex cursor-pointer items-center gap-2 text-xl font-bold hover:text-zinc-300 transition-colors"
      >
        <span className={`text-sm transition-transform ${expanded ? 'rotate-90' : ''}`}>&#9654;</span>
        Loot Table
      </h3>

      {/* Collapsed: icon strip */}
      {!expanded && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {allGear.map(g => (
            <Link key={g.name} href={href(`/equipments/${slugifyEquipment(g.name)}`)}>
              <EquipmentIcon
                src={`equipment/${g.image}`}
                rarity={g.rarity as ItemRarity}
                alt={l(g as never, 'name', lang)}
                size={44}
                overlaySize={13}
                effectIcon={g.effect_icon}
                classType={g.class}
                level={g.level}
              />
            </Link>
          ))}
          {sets.map(s => (
            <Link key={s.name} href={href(`/equipments/${slugifyEquipment(s.name)}`)}>
              <EquipmentIcon
                src={`equipment/TI_Equipment_Armor_${s.image_prefix}`}
                rarity={s.rarity as ItemRarity}
                alt={l(s as never, 'name', lang)}
                size={44}
                overlaySize={13}
                effectIcon={s.set_icon}
              />
            </Link>
          ))}
        </div>
      )}

      {/* Expanded: full cards */}
      {expanded && (
        <div className="mt-4 space-y-5">
          {weapons.length > 0 && (
            <LootSection title={t('equip.tab.weapons')}>
              {weapons.map(w => {
                const effectDesc = l(w as never, 'effect_desc4', lang) as string || l(w as never, 'effect_desc1', lang) as string;
                return (
                  <Link
                    key={w.name}
                    href={href(`/equipments/${slugifyEquipment(w.name)}`)}
                    className="card flex items-center gap-3 p-3 transition-colors hover:bg-zinc-800/80"
                  >
                    <EquipmentIcon
                      src={`equipment/${w.image}`}
                      rarity={w.rarity as ItemRarity}
                      alt={l(w as never, 'name', lang)}
                      size={56}
                      overlaySize={16}
                      effectIcon={w.effect_icon}
                      classType={w.class}
                      level={w.level}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-equipment">{l(w as never, 'name', lang)}</p>
                      {w.effect_name && (
                        <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-zinc-500/30 px-2 py-0.5">
                          {w.effect_icon && (
                            <div className="relative h-3.5 w-3.5 shrink-0">
                              <Image src={`/images/ui/effect/${w.effect_icon}.webp`} alt="" fill sizes="14px" className="object-contain" />
                            </div>
                          )}
                          <span className="text-[11px] text-buff">{l(w as never, 'effect_name', lang)}</span>
                        </div>
                      )}
                      {effectDesc && (
                        <p className="mt-1 text-xs text-zinc-400">{formatScaledEffect(effectDesc, w.effect_desc1)}</p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </LootSection>
          )}

          {amulets.length > 0 && (
            <LootSection title={t('equip.tab.accessories')}>
              {amulets.map(a => {
                const effectDesc = l(a as never, 'effect_desc4', lang) as string || l(a as never, 'effect_desc1', lang) as string;
                return (
                  <Link
                    key={a.name}
                    href={href(`/equipments/${slugifyEquipment(a.name)}`)}
                    className="card flex items-center gap-3 p-3 transition-colors hover:bg-zinc-800/80"
                  >
                    <EquipmentIcon
                      src={`equipment/${a.image}`}
                      rarity={a.rarity as ItemRarity}
                      alt={l(a as never, 'name', lang)}
                      size={56}
                      overlaySize={16}
                      effectIcon={a.effect_icon}
                      classType={a.class}
                      level={a.level}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-equipment">{l(a as never, 'name', lang)}</p>
                      {a.effect_name && (
                        <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-zinc-500/30 px-2 py-0.5">
                          {a.effect_icon && (
                            <div className="relative h-3.5 w-3.5 shrink-0">
                              <Image src={`/images/ui/effect/${a.effect_icon}.webp`} alt="" fill sizes="14px" className="object-contain" />
                            </div>
                          )}
                          <span className="text-[11px] text-buff">{l(a as never, 'effect_name', lang)}</span>
                        </div>
                      )}
                      {effectDesc && (
                        <p className="mt-1 text-xs text-zinc-400">{formatScaledEffect(effectDesc, a.effect_desc1)}</p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </LootSection>
          )}

          {sets.length > 0 && (
            <LootSection title={t('equip.tab.sets')}>
              {sets.map(s => {
                const effect2 = (l(s as never, 'effect_2_4', lang) || l(s as never, 'effect_2_1', lang)) as string;
                const effect4 = (l(s as never, 'effect_4_4', lang) || l(s as never, 'effect_4_1', lang)) as string;
                return (
                  <Link
                    key={s.name}
                    href={href(`/equipments/${slugifyEquipment(s.name)}`)}
                    className="card flex items-center gap-3 p-3 transition-colors hover:bg-zinc-800/80"
                  >
                    <EquipmentIcon
                      src={`equipment/TI_Equipment_Armor_${s.image_prefix}`}
                      rarity={s.rarity as ItemRarity}
                      alt={l(s as never, 'name', lang)}
                      size={56}
                      overlaySize={16}
                      effectIcon={s.set_icon}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-equipment">{l(s as never, 'name', lang)}</p>
                      <div className="mt-0.5 text-[11px] leading-tight">
                        {effect2 && <p><span className="text-buff">2: </span><span className="text-zinc-400">{formatEffectText(effect2)}</span></p>}
                        {effect4 && <p><span className="text-buff">4: </span><span className="text-zinc-400">{formatEffectText(effect4)}</span></p>}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </LootSection>
          )}
        </div>
      )}
    </div>
  );
}

function LootSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">{title}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {children}
      </div>
    </div>
  );
}
