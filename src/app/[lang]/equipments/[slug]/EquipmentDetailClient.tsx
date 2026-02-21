'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Weapon, Amulet, Talisman, ArmorSet, ExclusiveEquipment, BossDisplayMap } from '@/types/equipment';
import type { EquipmentLookup, ArmorSetStatRanges } from '@/lib/data/equipment';
import type { Effect } from '@/types/effect';
import type { Lang } from '@/lib/i18n/config';
import type { Messages } from '@/i18n';
import { I18nProvider, useI18n } from '@/lib/contexts/I18nContext';
import { EffectsProvider } from '@/app/components/character/BuffDebuffDisplay';
import BuffDebuffDisplay from '@/app/components/character/BuffDebuffDisplay';
import EquipmentIcon from '@/app/components/equipment/EquipmentIcon';
import EquipmentSource from '@/app/components/equipment/EquipmentSource';
import CharacterPortrait from '@/app/components/character/CharacterPortrait';
import StatInline from '@/app/components/inline/StatInline';
import FitText from '@/app/components/ui/FitText';
import { useBreadcrumbOverride } from '@/lib/contexts/BreadcrumbContext';
import { l } from '@/lib/i18n/localize';
import { formatEffectText, formatScaledEffect, getRarityBgPath } from '@/lib/format-text';
import type { ItemRarity } from '@/lib/theme';
import { ITEM_RARITY_TEXT, ITEM_RARITY_BG } from '@/lib/theme';

type CharacterRef = {
  id: string;
  name: string;
  slug: string | null;
  element: string | null;
  classType: string | null;
};

type Props = {
  equipment: EquipmentLookup;
  recoCharacters: CharacterRef[];
  eeOwner: CharacterRef | null;
  bossMap: BossDisplayMap;
  buffMap: Record<string, Effect>;
  debuffMap: Record<string, Effect>;
  weaponStatRanges: Record<string, [number, number]> | null;
  accessoryStatRanges: Record<string, [number, number]> | null;
  armorSetStatRanges: ArmorSetStatRanges | null;
  messages: Messages;
  lang: Lang;
};

export default function EquipmentDetailClient(props: Props) {
  return (
    <I18nProvider lang={props.lang} messages={props.messages}>
      <EffectsProvider buffMap={props.buffMap} debuffMap={props.debuffMap}>
        <EquipmentDetailInner {...props} />
      </EffectsProvider>
    </I18nProvider>
  );
}

function EquipmentDetailInner({ equipment, recoCharacters, eeOwner, bossMap, weaponStatRanges, accessoryStatRanges, armorSetStatRanges, lang }: Props) {
  const { t } = useI18n();
  const equipName = l(equipment.data, 'name', lang);
  useBreadcrumbOverride(equipName);

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-6 md:px-6">
      <Link href={`/${lang}/equipments`} className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300">
        <span aria-hidden="true">&larr;</span> {t('equip.detail.back')}
      </Link>
      {equipment.type === 'weapon' && <WeaponDetail weapon={equipment.data} lang={lang} bossMap={bossMap} statRanges={weaponStatRanges} t={t} />}
      {equipment.type === 'amulet' && <AmuletDetail amulet={equipment.data} lang={lang} bossMap={bossMap} statRanges={accessoryStatRanges} t={t} />}
      {equipment.type === 'talisman' && <TalismanDetail talisman={equipment.data} lang={lang} bossMap={bossMap} t={t} />}
      {equipment.type === 'set' && <SetDetail set={equipment.data} lang={lang} bossMap={bossMap} statRanges={armorSetStatRanges} t={t} />}
      {equipment.type === 'ee' && eeOwner && <EEDetail ee={equipment.data} owner={eeOwner} lang={lang} />}

      {/* Recommended characters */}
      {recoCharacters.length > 0 && (
        <section>
          <h2>{t('equip.detail.recommended_by')}</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {recoCharacters.map((char) => (
              <CharacterRefCard key={char.id} char={char} lang={lang} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Weapon detail ──

function WeaponDetail({ weapon, lang, bossMap, statRanges, t }: { weapon: Weapon; lang: Lang; bossMap: BossDisplayMap; statRanges: Record<string, [number, number]> | null; t: ReturnType<typeof useI18n>['t'] }) {
  const name = l(weapon, 'name', lang);
  const effectName = weapon.effect_name ? l(weapon, 'effect_name', lang) : null;
  const effectDesc1 = weapon.effect_desc1 ? l(weapon, 'effect_desc1', lang) : null;
  const effectDesc4 = weapon.effect_desc4 ? l(weapon, 'effect_desc4', lang) : null;

  const atkRange = statRanges?.['ATK'] ?? null;
  const secondaryStats = statRanges
    ? Object.entries(statRanges).filter(([k]) => k !== 'ATK')
    : [];

  return (
    <>
      <HeroSection
        icon={<EquipmentIcon src={`equipment/${weapon.image}`} rarity={weapon.rarity} alt={name} size={96} overlaySize={28} effectIcon={weapon.effect_icon} classType={weapon.class} level={weapon.level} />}
        name={name}
        badges={<>
          <TypeBadge label={t('equip.tab.weapons')} />
          <RarityBadge rarity={weapon.rarity} />
          {weapon.class && <ClassBadge classType={weapon.class} t={t} />}
        </>}
      />

      {/* Main stats */}
      {atkRange && (
        <section className="card p-4">
          <h3 className="after:hidden">{t('equip.detail.mainstats')}</h3>
          <div className="mt-3 space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-bold text-zinc-200"><StatInline name="ATK" /></span>
              <span className="tabular-nums text-zinc-300">{atkRange[0]} — {atkRange[1]}</span>
            </div>
            {secondaryStats.length > 0 && (
              <>
                <hr className="border-zinc-700/50" />
                {secondaryStats.map(([stat, [min, max]]) => (
                  <div key={stat} className="flex items-center justify-between">
                    <span className="text-zinc-400"><StatInline name={stat} /></span>
                    <span className="tabular-nums text-zinc-500">{min}% — {max}%</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </section>
      )}

      <EffectSection effectName={effectName} effectIcon={weapon.effect_icon} effectDesc1={effectDesc1} effectDesc4={effectDesc4} t={t} />
      <SourceSection source={weapon.source} boss={weapon.boss} equipName={weapon.name} bossMap={bossMap} lang={lang} t={t} />
    </>
  );
}

// ── Amulet detail ──

function AmuletDetail({ amulet, lang, bossMap, statRanges, t }: { amulet: Amulet; lang: Lang; bossMap: BossDisplayMap; statRanges: Record<string, [number, number]> | null; t: ReturnType<typeof useI18n>['t'] }) {
  const name = l(amulet, 'name', lang);
  const effectName = amulet.effect_name ? l(amulet, 'effect_name', lang) : null;
  const effectDesc1 = amulet.effect_desc1 ? l(amulet, 'effect_desc1', lang) : null;
  const effectDesc4 = amulet.effect_desc4 ? l(amulet, 'effect_desc4', lang) : null;

  const mainStats = amulet.mainStats ?? [];

  return (
    <>
      <HeroSection
        icon={<EquipmentIcon src={`equipment/${amulet.image}`} rarity={amulet.rarity} alt={name} size={96} overlaySize={28} effectIcon={amulet.effect_icon} classType={amulet.class} level={amulet.level} />}
        name={name}
        badges={<>
          <TypeBadge label={t('equip.tab.accessories')} />
          <RarityBadge rarity={amulet.rarity} />
          {amulet.class && <ClassBadge classType={amulet.class} t={t} />}
        </>}
      />
      <EffectSection effectName={effectName} effectIcon={amulet.effect_icon} effectDesc1={effectDesc1} effectDesc4={effectDesc4} t={t} />
      {mainStats.length > 0 && (
        <section className="card p-4">
          <h3 className="after:hidden">{t('equip.detail.mainstats')}</h3>
          <div className="mt-3 space-y-1.5 text-sm">
            {mainStats.map((stat) => {
              const range = statRanges?.[stat];
              return (
                <div key={stat} className="flex items-center justify-between">
                  <span className="font-bold text-zinc-200"><StatInline name={stat} /></span>
                  {range && (
                    <span className="tabular-nums text-zinc-400">{range[0]}% — {range[1]}%</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
      <SourceSection source={amulet.source} boss={amulet.boss} equipName={amulet.name} bossMap={bossMap} lang={lang} t={t} />
    </>
  );
}

// ── Talisman detail ──

function TalismanDetail({ talisman, lang, bossMap, t }: { talisman: Talisman; lang: Lang; bossMap: BossDisplayMap; t: ReturnType<typeof useI18n>['t'] }) {
  const name = l(talisman, 'name', lang);
  const effectName = l(talisman, 'effect_name', lang)
    ?.replace('Action Point', 'AP')
    .replace('Chain Point', 'CP');
  const effectDesc1 = l(talisman, 'effect_desc1', lang);
  const effectDesc4 = l(talisman, 'effect_desc4', lang);

  return (
    <>
      <HeroSection
        icon={<EquipmentIcon src={`equipment/${talisman.image}`} rarity={talisman.rarity} alt={name} size={96} overlaySize={28} effectIcon={talisman.effect_icon} level={talisman.level} />}
        name={name}
        badges={<>
          <TypeBadge label={t('equip.tab.talismans')} />
          <RarityBadge rarity={talisman.rarity} />
          {effectName && <span className="rounded-full bg-zinc-700 px-2.5 py-0.5 text-xs text-buff">{effectName}</span>}
        </>}
      />
      {effectDesc1 && (
        <section className="card p-4">
          <h3 className="after:hidden">{t('page.character.ee.effect')}</h3>
          <div className="mt-2 space-y-2 text-sm text-zinc-300">
            <p><span className="text-zinc-500">Lv. 0 </span>{formatEffectText(effectDesc1)}</p>
            {effectDesc4 && effectDesc4 !== effectDesc1 && (
              <p><span className="text-zinc-500">Lv. 10 </span>{formatScaledEffect(effectDesc4, effectDesc1)}</p>
            )}
          </div>
        </section>
      )}
      <SourceSection source={talisman.source ?? undefined} boss={talisman.boss ?? undefined} equipName={talisman.name} bossMap={bossMap} lang={lang} t={t} />
    </>
  );
}

// ── Set detail ──

const ARMOR_PIECE_KEYS = ['Helmet', 'Armor', 'Gloves', 'Shoes'] as const;
const ARMOR_PIECE_I18N: Record<string, string> = {
  Helmet: 'equip.detail.piece.helmet',
  Armor: 'equip.detail.piece.armor',
  Gloves: 'equip.detail.piece.gloves',
  Shoes: 'equip.detail.piece.shoes',
};

function SetDetail({ set, lang, bossMap, statRanges, t }: { set: ArmorSet; lang: Lang; bossMap: BossDisplayMap; statRanges: ArmorSetStatRanges | null; t: ReturnType<typeof useI18n>['t'] }) {
  const name = l(set, 'name', lang);
  const effect21 = l(set, 'effect_2_1', lang);
  const effect24 = l(set, 'effect_2_4', lang);
  const effect41 = l(set, 'effect_4_1', lang);
  const effect44 = l(set, 'effect_4_4', lang);

  return (
    <>
      <HeroSection
        icon={<EquipmentIcon src={`equipment/TI_Equipment_Armor_${set.image_prefix}`} rarity={set.rarity} alt={name} size={96} overlaySize={28} effectIcon={set.set_icon} />}
        name={name}
        badges={<>
          <TypeBadge label={t('equip.tab.sets')} />
          <RarityBadge rarity={set.rarity} />
          {set.class && <ClassBadge classType={set.class} t={t} />}
        </>}
      />

      <section className="card p-4">
        <div className="flex items-center gap-2">
          {set.set_icon && (
            <div className="relative h-6 w-6 shrink-0">
              <Image src={`/images/ui/effect/${set.set_icon}.webp`} alt="" fill sizes="24px" className="object-contain" />
            </div>
          )}
          <h3 className="after:hidden">{name} — {t('equip.detail.set_effects')}</h3>
        </div>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-zinc-500">
              <th className="pb-1 text-left font-normal" />
              {(effect21 || effect24) && <th className="pb-1 text-left font-bold text-buff">{t('equip.set.2piece')}</th>}
              {(effect41 || effect44) && <th className="pb-1 text-left font-bold text-buff">{t('equip.set.4piece')}</th>}
            </tr>
          </thead>
          <tbody>
            {(effect21 || effect41) && (
              <tr>
                <td className="w-10 py-1.5 align-top text-zinc-500">T0</td>
                {(effect21 || effect24) && <td className="py-1.5 align-top text-zinc-300">{effect21 ? formatEffectText(effect21) : '—'}</td>}
                {(effect41 || effect44) && <td className="py-1.5 align-top text-zinc-300">{effect41 ? formatEffectText(effect41) : '—'}</td>}
              </tr>
            )}
            {(effect24 || effect44) && (effect24 !== effect21 || effect44 !== effect41) && (
              <tr>
                <td className="w-10 py-1.5 align-top text-zinc-500">T4</td>
                {(effect21 || effect24) && <td className="py-1.5 align-top text-zinc-300">{effect24 && effect24 !== effect21 ? formatScaledEffect(effect24, effect21) : effect21 ? formatEffectText(effect21) : '—'}</td>}
                {(effect41 || effect44) && <td className="py-1.5 align-top text-zinc-300">{effect44 && effect44 !== effect41 ? formatScaledEffect(effect44, effect41) : effect41 ? formatEffectText(effect41) : '—'}</td>}
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Armor piece stats */}
      {statRanges && (
        <section>
          <h3>{t('equip.detail.mainstat')}</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ARMOR_PIECE_KEYS.map((piece) => {
              const stats = statRanges[piece];
              if (!stats || Object.keys(stats).length === 0) return null;
              return (
                <div key={piece} className="card flex items-center gap-3 p-3">
                  {/* Icon */}
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded">
                    <Image src={getRarityBgPath(set.rarity)} alt="" fill sizes="56px" className="object-cover" />
                    <div className="absolute inset-0.5">
                      <Image src={`/images/equipment/TI_Equipment_${piece}_${set.image_prefix}.webp`} alt="" fill sizes="52px" className="object-contain" />
                    </div>
                  </div>
                  {/* Table */}
                  <table className="flex-1 text-sm">
                    <thead>
                      <tr className="text-xs text-zinc-500">
                        <th className="pb-1 text-left font-normal">{t(ARMOR_PIECE_I18N[piece] as Parameters<typeof t>[0])}</th>
                        <th className="pb-1 text-right font-normal">Lv.0 T0</th>
                        <th className="pb-1 text-right font-normal">Lv.10 T4</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(stats).map(([stat, [min, max]]) => (
                        <tr key={stat}>
                          <td className="py-0.5 text-zinc-300"><StatInline name={stat} /></td>
                          <td className="py-0.5 text-right tabular-nums text-zinc-400">{min}{stat !== 'DEF' ? '%' : ''}</td>
                          <td className="py-0.5 text-right tabular-nums text-zinc-300">{max}{stat !== 'DEF' ? '%' : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <SourceSection source={set.source} boss={set.boss} equipName={set.name} bossMap={bossMap} lang={lang} t={t} />
    </>
  );
}

// ── EE detail ──

function EEDetail({ ee, owner, lang }: { ee: ExclusiveEquipment; owner: CharacterRef; lang: Lang }) {
  const { t } = useI18n();
  const name = l(ee, 'name', lang);
  const mainStat = l(ee, 'mainStat', lang);
  const effect = l(ee, 'effect', lang);
  const effect10 = l(ee, 'effect10', lang);

  const eeIcon = (
    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg">
      <Image src={getRarityBgPath('legendary')} alt="" fill sizes="96px" className="object-cover" />
      <div className="absolute inset-2">
        <Image src={`/images/characters/ee/${owner.id}.webp`} alt={name} fill sizes="80px" className="object-contain" />
      </div>
    </div>
  );

  return (
    <>
      <HeroSection
        icon={eeIcon}
        name={name}
        badges={<>
          <TypeBadge label={t('equip.tab.ee')} />
          {ee.rank && (
            <div className="relative h-7 w-7 shrink-0">
              <Image src={`/images/ui/rank/IG_Event_Rank_${ee.rank}.webp`} alt={`Rank ${ee.rank}`} fill sizes="28px" className="object-contain" />
            </div>
          )}
        </>}
      />

      {/* Owner */}
      <section>
        <h3>{t('equip.detail.owner')}</h3>
        <div className="mt-2">
          <CharacterRefCard char={owner} lang={lang} />
        </div>
      </section>

      {/* Main stat */}
      {mainStat && (
        <section>
          <h3>{t('equip.detail.mainstat')}</h3>
          <span className="mt-2 inline-block rounded bg-zinc-800 px-3 py-1 text-sm text-zinc-300">{mainStat}</span>
        </section>
      )}

      {/* Effects */}
      {effect && (
        <section className="card p-4">
          <h3 className="after:hidden">{t('page.character.ee.effect')}</h3>
          <div className="mt-2 space-y-2 text-sm text-zinc-300">
            <p><span className="text-zinc-500">Lv. 1 </span>{formatEffectText(effect)}</p>
            {effect10 && effect10 !== effect && (
              <p><span className="text-zinc-500">Lv. 10 </span>{formatScaledEffect(effect10, effect)}</p>
            )}
          </div>
        </section>
      )}

      {/* Buffs / Debuffs */}
      {(ee.buff.length > 0 || ee.debuff.length > 0) && (
        <section>
          <h3>{ee.buff.length > 0 && ee.debuff.length > 0 ? `${t('characters.filters.buffs')} / ${t('characters.filters.debuffs')}` : ee.buff.length > 0 ? t('characters.filters.buffs') : t('characters.filters.debuffs')}</h3>
          <div className="mt-2">
            <BuffDebuffDisplay buffs={ee.buff} debuffs={ee.debuff} />
          </div>
        </section>
      )}
    </>
  );
}

// ── Shared sub-components ──

function HeroSection({ icon, name, badges }: { icon: React.ReactNode; name: string; badges: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      {icon}
      <div className="flex flex-col gap-2">
        <h1 className="h1-page">{name}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {badges}
        </div>
      </div>
    </div>
  );
}

function EffectSection({ effectName, effectIcon, effectDesc1, effectDesc4, t }: {
  effectName: string | null;
  effectIcon: string | null;
  effectDesc1: string | null;
  effectDesc4: string | null;
  t: ReturnType<typeof useI18n>['t'];
}) {
  if (!effectName && !effectDesc1) return null;

  return (
    <section className="card p-4">
      <h3 className="after:hidden">{t('page.character.ee.effect')}</h3>

      {effectName && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-zinc-500/40 px-3 py-1">
          {effectIcon && (
            <div className="relative h-5 w-5 shrink-0">
              <Image src={`/images/ui/effect/${effectIcon}.webp`} alt="" fill sizes="20px" className="object-contain" />
            </div>
          )}
          <span className="text-sm text-buff">{effectName}</span>
        </div>
      )}

      <div className="mt-3 space-y-2 text-sm text-zinc-300">
        {effectDesc1 && <p><span className="text-zinc-500">T0 </span>{formatEffectText(effectDesc1)}</p>}
        {effectDesc4 && effectDesc4 !== effectDesc1 && (
          <p><span className="text-zinc-500">T4 </span>{formatScaledEffect(effectDesc4, effectDesc1)}</p>
        )}
      </div>
    </section>
  );
}

function SourceSection({ source, boss, equipName, bossMap, lang, t }: {
  source?: string;
  boss?: string;
  equipName: string;
  bossMap: BossDisplayMap;
  lang: Lang;
  t: ReturnType<typeof useI18n>['t'];
}) {
  if (!source && !boss) return null;

  return (
    <section>
      <h3>{t('equip.filter.source')}</h3>
      <div className="mt-2">
        <EquipmentSource source={source} boss={boss} equipName={equipName} bossMap={bossMap} lang={lang} />
      </div>
    </section>
  );
}

function TypeBadge({ label }: { label: string }) {
  return <span className="rounded-full bg-zinc-700 px-2.5 py-0.5 text-xs text-zinc-300">{label}</span>;
}

function RarityBadge({ rarity }: { rarity: ItemRarity }) {
  const { t } = useI18n();
  const key = rarity.toLowerCase() as ItemRarity;
  const textCls = ITEM_RARITY_TEXT[key] ?? ITEM_RARITY_TEXT.normal;
  const bgCls = ITEM_RARITY_BG[key] ?? ITEM_RARITY_BG.normal;
  const label = t(`sys.rarity.${key}` as Parameters<typeof t>[0]);
  return <span className={`rounded-full px-2.5 py-0.5 text-xs ${bgCls} ${textCls}`}>{label}</span>;
}

function ClassBadge({ classType, t }: { classType: string; t: ReturnType<typeof useI18n>['t'] }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-zinc-700 px-2.5 py-0.5">
      <div className="relative h-4 w-4 shrink-0">
        <Image src={`/images/ui/class/CM_Class_${classType}.webp`} alt={classType} fill sizes="16px" className="object-contain" />
      </div>
      <span className="text-xs text-zinc-300">{t(`sys.class.${classType.toLowerCase()}` as Parameters<typeof t>[0])}</span>
    </div>
  );
}

function CharacterRefCard({ char, lang }: { char: CharacterRef; lang: Lang }) {
  const content = (
    <div className="card-interactive flex flex-col items-center gap-2 p-3">
      <CharacterPortrait id={char.id} name={char.name} size="md" showIcons />
      <div className="w-full text-center font-bold text-zinc-100">
        <FitText max={14} min={9}>{char.name}</FitText>
      </div>
    </div>
  );

  if (char.slug) {
    return <Link href={`/${lang}/characters/${char.slug}`}>{content}</Link>;
  }
  return content;
}
