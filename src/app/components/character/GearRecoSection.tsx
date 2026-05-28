'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import type { Weapon, Amulet, Talisman, ArmorSet, ResolvedCharacterReco, BossDisplayMap } from '@/types/equipment';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import parseText from '@/lib/parse-text';
import { formatEffectText } from '@/lib/format-text';
import { WeaponMiniCard, AmuletMiniCard, TalismanMiniCard, SetMiniCard, SubstatPrioBar } from '@/app/components/equipment';

type Props = {
  reco: ResolvedCharacterReco;
  weapons: Weapon[];
  amulets: Amulet[];
  talismans: Talisman[];
  sets: ArmorSet[];
  bossMap: BossDisplayMap;
};

const ACCENT = 'var(--cd-el)';

/** A slot tile: label, then N peer rows separated by hairlines. */
function SlotCard({ label, accentBg = false, children }: { label: string; accentBg?: boolean; children: ReactNode }) {
  return (
    <div
      className="card flex flex-col rounded-xl p-4"
      style={accentBg ? { background: `linear-gradient(135deg, color-mix(in srgb, ${ACCENT} 9%, transparent) 0%, transparent 55%), rgba(30,41,59,0.5)` } : undefined}
    >
      <h4 className="mb-1 border-b border-white/6 pb-2 font-mono text-[10px] font-semibold tracking-[0.18em] text-zinc-300 uppercase">{label}</h4>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="border-b border-white/6 py-2.5 first:pt-1 last:border-0 last:pb-0">{children}</div>;
}

/** 2pc / 4pc bonus lines for one set (4pc only when the set is actually run at 4). */
function SetEffectLines({ set, maxCount }: { set: ArmorSet; maxCount: number }) {
  const { lang, t } = useI18n();
  const e2 = l(set, 'effect_2_4', lang);
  const e4 = maxCount >= 4 ? l(set, 'effect_4_4', lang) : null;
  return (
    <>
      {e2 && <p className="text-xs leading-relaxed text-zinc-300"><span className="font-semibold text-buff">{t('equip.set.2piece')}</span> {formatEffectText(e2)}</p>}
      {e4 && <p className="text-xs leading-relaxed text-zinc-300"><span className="font-semibold text-buff">{t('equip.set.4piece')}</span> {formatEffectText(e4)}</p>}
    </>
  );
}

export default function GearRecoSection({ reco, weapons, amulets, talismans, sets, bossMap }: Props) {
  const { lang, t } = useI18n();
  const buildNames = Object.keys(reco);
  const [activeBuild, setActiveBuild] = useState(buildNames[0] ?? '');

  if (!buildNames.length) {
    return <p className="text-sm text-zinc-500">{t('page.character.no_reco')}</p>;
  }

  const build = reco[activeBuild];
  const weaponItems = build?.Weapon ?? [];
  const amuletItems = build?.Amulet ?? [];
  const talismanItems = build?.Talisman ?? [];
  const setCombos = build?.Set ?? [];
  const note = build ? l(build, 'Note', lang) : '';

  // Distinct armor sets referenced across all combos — shown once in a legend
  // (so N combos don't repeat effects). Track the max piece count each set is
  // actually run at, so we only surface the 4pc bonus when it's relevant.
  const legendMap = new Map<string, { set: ArmorSet; maxCount: number }>();
  for (const combo of setCombos) {
    for (const entry of combo) {
      const data = sets.find((s) => s.name === entry.name || s.name === `${entry.name} Set`);
      if (!data) continue;
      const existing = legendMap.get(data.name);
      if (existing) existing.maxCount = Math.max(existing.maxCount, entry.count);
      else legendMap.set(data.name, { set: data, maxCount: entry.count });
    }
  }
  const legendSets = [...legendMap.values()];

  return (
    <div className="flex flex-col gap-4">
      {/* Pill tabs */}
      <div className="inline-flex flex-wrap gap-1 self-start rounded-lg border border-white/6 bg-slate-900/60 p-1">
        {buildNames.map((b) => {
          const on = b === activeBuild;
          return (
            <button
              key={b}
              type="button"
              onClick={() => setActiveBuild(b)}
              style={on ? { color: ACCENT, backgroundColor: `color-mix(in srgb, ${ACCENT} 14%, transparent)`, borderColor: `color-mix(in srgb, ${ACCENT} 42%, transparent)` } : undefined}
              className={[
                'rounded-md border px-3.5 py-1.5 text-[13px] transition-colors',
                on ? 'font-semibold' : 'border-transparent text-zinc-400 hover:text-zinc-200',
              ].join(' ')}
            >
              {b}
            </button>
          );
        })}
      </div>

      {build && (
        <>
          {/* Loadout grid + substat gauge */}
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr] lg:items-start">
            <div className="grid gap-3 sm:grid-cols-2">
              {weaponItems.length > 0 && (
                <SlotCard label={t('page.character.gear.weapon')}>
                  {weaponItems.map((w, i) => {
                    const data = weapons.find((wp) => wp.name === w.name);
                    return (
                      <Row key={`${w.name}-${i}`}>
                        {data
                          ? <WeaponMiniCard weapon={data} lang={lang} mainStat={w.mainStat} bossMap={bossMap} />
                          : <p className="text-sm text-zinc-400">{w.name}</p>}
                      </Row>
                    );
                  })}
                </SlotCard>
              )}

              {amuletItems.length > 0 && (
                <SlotCard label={t('page.character.gear.amulet')}>
                  {amuletItems.map((a, i) => {
                    const data = amulets.find((am) => am.name === a.name);
                    return (
                      <Row key={`${a.name}-${i}`}>
                        {data
                          ? <AmuletMiniCard amulet={data} lang={lang} mainStat={a.mainStat} bossMap={bossMap} />
                          : <p className="text-sm text-zinc-400">{a.name}</p>}
                      </Row>
                    );
                  })}
                </SlotCard>
              )}

              {talismanItems.length > 0 && (
                <SlotCard label={t('page.character.gear.talisman')}>
                  {talismanItems.map((name, i) => {
                    const data = talismans.find((tl) => tl.name === name);
                    const suffix = name === "Executioner's Charm" ? ' +10' : '';
                    return (
                      <Row key={`${name}-${i}`}>
                        {data
                          ? <TalismanMiniCard talisman={data} lang={lang} nameSuffix={suffix} />
                          : <p className="text-sm text-zinc-400">{name}{suffix}</p>}
                      </Row>
                    );
                  })}
                </SlotCard>
              )}

              {setCombos.length > 0 && (
                <SlotCard label={t('page.character.gear.set')} accentBg>
                  {setCombos.map((combo, i) => (
                    <Row key={i}>
                      <SetMiniCard combo={combo} sets={sets} lang={lang} bossMap={bossMap} />
                    </Row>
                  ))}
                  {legendSets.length === 1 && (
                    <div className="mt-2 flex flex-col gap-1 border-t border-white/6 pt-2.5">
                      <SetEffectLines set={legendSets[0].set} maxCount={legendSets[0].maxCount} />
                    </div>
                  )}
                </SlotCard>
              )}
            </div>

            {build.SubstatPrio && (
              <div className="card flex flex-col gap-3 rounded-xl p-4">
                <h4 className="font-mono text-[10px] font-semibold tracking-[0.18em] uppercase" style={{ color: ACCENT }}>
                  {t('page.character.gear.substat_prio')}
                </h4>
                <SubstatPrioBar prio={build.SubstatPrio} />
              </div>
            )}
          </div>

          {/* Set effects — separate legend only when 2+ distinct sets are mixed */}
          {legendSets.length >= 2 && (
            <div className="card rounded-xl p-4">
              <h4 className="mb-3 font-mono text-[10px] font-semibold tracking-[0.18em] uppercase" style={{ color: ACCENT }}>
                {t('equip.detail.set_effects')}
              </h4>
              <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                {legendSets.map(({ set, maxCount }) => (
                  <div key={set.name} className="flex gap-2.5">
                    {set.set_icon && (
                      <div className="relative mt-0.5 h-6 w-6 shrink-0">
                        <Image src={`/images/ui/effect/${set.set_icon}.webp`} alt={l(set, 'name', lang)} fill sizes="24px" className="object-contain" />
                      </div>
                    )}
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-game text-sm font-semibold text-equipment">{l(set, 'name', lang)}</div>
                      <SetEffectLines set={set} maxCount={maxCount} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Note */}
          {note && (
            <div className="card flex gap-3 rounded-xl p-4">
              <h4 className="shrink-0 font-mono text-[10px] font-semibold tracking-[0.18em] uppercase" style={{ color: ACCENT }}>
                {t('page.character.gear.note')}
              </h4>
              <p className="flex-1 text-sm leading-relaxed text-zinc-300">{parseText(note)}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
