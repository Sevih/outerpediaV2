'use client';

import { useState } from 'react';
import type { Weapon, Amulet, Talisman, ArmorSet, ResolvedCharacterReco } from '@/types/equipment';
import { useI18n } from '@/lib/contexts/I18nContext';
import { WeaponMiniCard, AmuletMiniCard, TalismanMiniCard, SetMiniCard, SubstatPrioBar } from '@/app/components/equipment';

type Props = {
  reco: ResolvedCharacterReco;
  weapons: Weapon[];
  amulets: Amulet[];
  talismans: Talisman[];
  sets: ArmorSet[];
};

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
          {/* Row 1: Weapon | Amulet | Set */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Weapons */}
            {build.Weapon && build.Weapon.length > 0 && (
              <GearCategory label={t('page.character.gear.weapon')}>
                {build.Weapon.map((w) => {
                  const data = weapons.find((wp) => wp.name === w.name);
                  return data ? (
                    <WeaponMiniCard key={w.name} weapon={data} lang={lang} mainStat={w.mainStat} />
                  ) : (
                    <p key={w.name} className="text-sm text-zinc-400">{w.name}</p>
                  );
                })}
              </GearCategory>
            )}

            {/* Amulets */}
            {build.Amulet && build.Amulet.length > 0 && (
              <GearCategory label={t('page.character.gear.amulet')}>
                {build.Amulet.map((a) => {
                  const data = amulets.find((am) => am.name === a.name);
                  return data ? (
                    <AmuletMiniCard key={a.name} amulet={data} lang={lang} mainStat={a.mainStat} />
                  ) : (
                    <p key={a.name} className="text-sm text-zinc-400">{a.name}</p>
                  );
                })}
              </GearCategory>
            )}

            {/* Sets */}
            {build.Set && build.Set.length > 0 && (
              <GearCategory label={t('page.character.gear.set')}>
                {build.Set.map((combo, i) => (
                  <SetMiniCard key={i} combo={combo} sets={sets} lang={lang} />
                ))}
              </GearCategory>
            )}
          </div>

          {/* Row 2: Talisman | Substat | Notes */}
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Talismans */}
            {build.Talisman && build.Talisman.length > 0 && (
              <GearCategory label={t('page.character.gear.talisman')}>
                {build.Talisman.map((name) => {
                  const data = talismans.find((t) => t.name === name);
                  return data ? (
                    <TalismanMiniCard key={name} talisman={data} lang={lang} />
                  ) : (
                    <p key={name} className="text-sm text-zinc-400">{name}</p>
                  );
                })}
              </GearCategory>
            )}

            {/* Substat priority */}
            {build.SubstatPrio && (
              <GearCategory label={t('page.character.gear.substat_prio')}>
                <SubstatPrioBar prio={build.SubstatPrio} />
              </GearCategory>
            )}

            {/* Notes */}
            {build.Note && (
              <GearCategory label={t('page.character.gear.note')}>
                <p className="whitespace-pre-line text-sm text-zinc-300">{build.Note}</p>
              </GearCategory>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function GearCategory({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-200">
        {label}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
