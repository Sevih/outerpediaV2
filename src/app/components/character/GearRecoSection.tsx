'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { Weapon, Amulet, Talisman, ArmorSet, ResolvedCharacterReco } from '@/types/equipment';
import { l } from '@/lib/i18n/localize';
import { getRarityBgPath } from '@/lib/format-text';
import { useI18n } from '@/lib/contexts/I18nContext';

type Props = {
  reco: ResolvedCharacterReco;
  weapons: Weapon[];
  amulets: Amulet[];
  talismans: Talisman[];
  sets: ArmorSet[];
};

function findWeapon(weapons: Weapon[], name: string) {
  return weapons.find((w) => w.name === name);
}
function findAmulet(amulets: Amulet[], name: string) {
  return amulets.find((a) => a.name === name);
}
function findTalisman(talismans: Talisman[], name: string) {
  return talismans.find((t) => t.name === name);
}
function findSet(sets: ArmorSet[], name: string) {
  return sets.find((s) => s.name === name || s.name === `${name} Set`);
}

export default function GearRecoSection({ reco, weapons, amulets, talismans, sets }: Props) {
  const { lang, t } = useI18n();
  const buildNames = Object.keys(reco);
  const [activeBuild, setActiveBuild] = useState(buildNames[0] ?? '');

  if (!buildNames.length) {
    return (
      <section id="gear">
        <h2 className="mb-4 text-2xl font-bold">{t('page.character.gear.title')}</h2>
        <p className="text-sm text-zinc-500">{t('page.character.no_reco')}</p>
      </section>
    );
  }

  const build = reco[activeBuild];

  return (
    <section id="gear">
      <h2 className="mb-4 text-2xl font-bold">{t('page.character.gear.title')}</h2>

      {/* Build tabs */}
      {buildNames.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {buildNames.map((name) => (
            <button
              key={name}
              onClick={() => setActiveBuild(name)}
              className={[
                'rounded-full px-4 py-1.5 text-sm font-medium transition ring-1',
                name === activeBuild
                  ? 'bg-yellow-500/20 text-yellow-300 ring-yellow-400/40'
                  : 'bg-zinc-800 text-zinc-300 ring-white/10 hover:bg-zinc-700',
              ].join(' ')}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {build && (
        <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Weapons */}
            {build.Weapon && build.Weapon.length > 0 && (
              <GearCategory label={t('page.character.gear.weapon')}>
                {build.Weapon.map((w) => {
                  const data = findWeapon(weapons, w.name);
                  return (
                    <GearItem
                      key={w.name}
                      name={data ? l(data, 'name', lang) : w.name}
                      image={data?.image}
                      rarity={data?.rarity}
                      mainStat={w.mainStat}
                    />
                  );
                })}
              </GearCategory>
            )}

            {/* Amulets */}
            {build.Amulet && build.Amulet.length > 0 && (
              <GearCategory label={t('page.character.gear.amulet')}>
                {build.Amulet.map((a) => {
                  const data = findAmulet(amulets, a.name);
                  return (
                    <GearItem
                      key={a.name}
                      name={data ? l(data, 'name', lang) : a.name}
                      image={data?.image}
                      rarity={data?.rarity}
                      mainStat={a.mainStat}
                    />
                  );
                })}
              </GearCategory>
            )}

            {/* Sets */}
            {build.Set && build.Set.length > 0 && (
              <GearCategory label={t('page.character.gear.set')}>
                {build.Set.map((combo, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    {combo.map((piece) => {
                      const data = findSet(sets, piece.name);
                      return (
                        <span key={piece.name} className="inline-flex items-center gap-1 text-sm">
                          {data?.set_icon && (
                            <div className="relative h-6 w-6">
                              <Image
                                src={`/images/ui/effect/${data.set_icon}.webp`}
                                alt={piece.name}
                                fill
                                sizes="24px"
                                className="object-contain"
                              />
                            </div>
                          )}
                          <span className="text-zinc-200">
                            {data ? l(data, 'name', lang) : piece.name}
                          </span>
                          <span className="text-xs text-zinc-500">x{piece.count}</span>
                        </span>
                      );
                    })}
                  </div>
                ))}
              </GearCategory>
            )}

            {/* Talismans */}
            {build.Talisman && build.Talisman.length > 0 && (
              <GearCategory label={t('page.character.gear.talisman')}>
                {build.Talisman.map((name) => {
                  const data = findTalisman(talismans, name);
                  return (
                    <GearItem
                      key={name}
                      name={data ? l(data, 'name', lang) : name}
                      image={data?.image}
                      rarity={data?.rarity}
                    />
                  );
                })}
              </GearCategory>
            )}
          </div>

          {/* Substat priority */}
          {build.SubstatPrio && (
            <div className="mt-4">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {t('page.character.gear.substat_prio')}
              </h3>
              <p className="text-sm font-medium text-yellow-300">{build.SubstatPrio}</p>
            </div>
          )}

          {/* Notes */}
          {build.Note && (
            <div className="mt-3">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {t('page.character.gear.note')}
              </h3>
              <p className="whitespace-pre-line text-sm text-zinc-300">{build.Note}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function GearCategory({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function GearItem({
  name,
  image,
  rarity,
  mainStat,
}: {
  name: string;
  image?: string;
  rarity?: string;
  mainStat?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {image && (
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded">
          {rarity && (
            <Image
              src={getRarityBgPath(rarity)}
              alt=""
              fill
              sizes="40px"
              className="object-cover"
            />
          )}
          <Image
            src={`/images/items/${image}.webp`}
            alt={name}
            fill
            sizes="40px"
            className="relative object-contain p-0.5"
          />
        </div>
      )}
      <div>
        <p className="text-sm text-zinc-200">{name}</p>
        {mainStat && <p className="text-xs text-zinc-500">{mainStat}</p>}
      </div>
    </div>
  );
}
