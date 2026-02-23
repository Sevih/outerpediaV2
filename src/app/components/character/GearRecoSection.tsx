'use client';

import { useState } from 'react';
import type { Weapon, Amulet, Talisman, ArmorSet, ResolvedCharacterReco, BossDisplayMap } from '@/types/equipment';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import parseText from '@/lib/parse-text';
import { WeaponMiniCard, AmuletMiniCard, TalismanMiniCard, SetMiniCard, SubstatPrioBar } from '@/app/components/equipment';
import Tabs from '@/app/components/ui/Tabs';

type Props = {
  reco: ResolvedCharacterReco;
  weapons: Weapon[];
  amulets: Amulet[];
  talismans: Talisman[];
  sets: ArmorSet[];
  bossMap: BossDisplayMap;
};

export default function GearRecoSection({ reco, weapons, amulets, talismans, sets, bossMap }: Props) {
  const { lang, t } = useI18n();
  const buildNames = Object.keys(reco);
  const [activeBuild, setActiveBuild] = useState(buildNames[0] ?? '');

  if (!buildNames.length) {
    return (
      <section id="gear">
        <h2 className="mb-4 text-2xl font-bold">{t('page.character.toc.gear')}</h2>
        <p className="text-sm text-zinc-500">{t('page.character.no_reco')}</p>
      </section>
    );
  }

  const build = reco[activeBuild];

  return (
    <section id="gear">
      <h2 className="mb-4 text-2xl font-bold">{t('page.character.toc.gear')}</h2>

      <Tabs
        items={buildNames}
        value={activeBuild}
        onChange={setActiveBuild}
        hashPrefix="build"
        className="mb-4"
      />

      {build && (
        <div className="card grid grid-cols-1 gap-6 rounded-xl p-4 md:grid-cols-3">
          {/* Col 1: Weapon + Talisman — contents on mobile so children flatten into the single-col grid */}
          <div className="contents md:block md:space-y-6">
            {build.Weapon && build.Weapon.length > 0 && (
              <div className="order-1 md:order-0">
                <GearCategory label={t('page.character.gear.weapon')}>
                  {build.Weapon.map((w, i) => {
                    const data = weapons.find((wp) => wp.name === w.name);
                    return data ? (
                      <WeaponMiniCard key={`${w.name}-${i}`} weapon={data} lang={lang} mainStat={w.mainStat} bossMap={bossMap} />
                    ) : (
                      <p key={`${w.name}-${i}`} className="text-sm text-zinc-400">{w.name}</p>
                    );
                  })}
                </GearCategory>
              </div>
            )}

            {build.Talisman && build.Talisman.length > 0 && (
              <div className="order-4 md:order-0">
                <GearCategory label={t('page.character.gear.talisman')}>
                  {build.Talisman.map((name, i) => {
                    const data = talismans.find((t) => t.name === name);
                    return data ? (
                      <TalismanMiniCard key={`${name}-${i}`} talisman={data} lang={lang} />
                    ) : (
                      <p key={`${name}-${i}`} className="text-sm text-zinc-400">{name}</p>
                    );
                  })}
                </GearCategory>
              </div>
            )}
          </div>

          {/* Col 2: Amulet + Substat + Note */}
          <div className="contents md:block md:space-y-6">
            {build.Amulet && build.Amulet.length > 0 && (
              <div className="order-2 md:order-0">
                <GearCategory label={t('page.character.gear.amulet')}>
                  {build.Amulet.map((a, i) => {
                    const data = amulets.find((am) => am.name === a.name);
                    return data ? (
                      <AmuletMiniCard key={`${a.name}-${i}`} amulet={data} lang={lang} mainStat={a.mainStat} bossMap={bossMap} />
                    ) : (
                      <p key={`${a.name}-${i}`} className="text-sm text-zinc-400">{a.name}</p>
                    );
                  })}
                </GearCategory>
              </div>
            )}

            {build.SubstatPrio && (
              <div className="order-5 md:order-0">
                <GearCategory label={t('page.character.gear.substat_prio')}>
                  <SubstatPrioBar prio={build.SubstatPrio} />
                </GearCategory>
              </div>
            )}

            {l(build, 'Note', lang) && (
              <div className="order-6 md:order-0">
                <GearCategory label={t('page.character.gear.note')}>
                  <p className="text-sm leading-relaxed text-zinc-300">{parseText(l(build, 'Note', lang))}</p>
                </GearCategory>
              </div>
            )}
          </div>

          {/* Col 3: Set */}
          <div className="contents md:block">
            {build.Set && build.Set.length > 0 && (
              <div className="order-3 md:order-0">
                <GearCategory label={t('page.character.gear.set')}>
                  {build.Set.map((combo, i) => (
                    <SetMiniCard key={i} combo={combo} sets={sets} lang={lang} bossMap={bossMap} />
                  ))}
                </GearCategory>
              </div>
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
