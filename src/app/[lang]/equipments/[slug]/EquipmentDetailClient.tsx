'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Weapon, Amulet, Talisman, ArmorSet, ExclusiveEquipment, BossDisplayMap } from '@/types/equipment';
import type { EquipmentLookup } from '@/lib/data/equipment';
import type { Effect } from '@/types/effect';
import type { Lang } from '@/lib/i18n/config';
import type { Messages } from '@/i18n';
import { I18nProvider, useI18n } from '@/lib/contexts/I18nContext';
import { EffectsProvider } from '@/app/components/character/BuffDebuffDisplay';
import BuffDebuffDisplay from '@/app/components/character/BuffDebuffDisplay';
import EquipmentIcon from '@/app/components/equipment/EquipmentIcon';
import EquipmentSource from '@/app/components/equipment/EquipmentSource';
import { l } from '@/lib/i18n/localize';
import { formatEffectText, formatScaledEffect, getRarityBgPath } from '@/lib/format-text';

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

function EquipmentDetailInner({ equipment, recoCharacters, eeOwner, bossMap, lang }: Props) {
  const { t } = useI18n();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
      {equipment.type === 'weapon' && <WeaponDetail weapon={equipment.data} lang={lang} bossMap={bossMap} t={t} />}
      {equipment.type === 'amulet' && <AmuletDetail amulet={equipment.data} lang={lang} bossMap={bossMap} t={t} />}
      {equipment.type === 'talisman' && <TalismanDetail talisman={equipment.data} lang={lang} bossMap={bossMap} t={t} />}
      {equipment.type === 'set' && <SetDetail set={equipment.data} lang={lang} bossMap={bossMap} t={t} />}
      {equipment.type === 'ee' && eeOwner && <EEDetail ee={equipment.data} owner={eeOwner} lang={lang} />}

      {/* Recommended characters */}
      {recoCharacters.length > 0 && (
        <section className="mt-8">
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

function WeaponDetail({ weapon, lang, bossMap, t }: { weapon: Weapon; lang: Lang; bossMap: BossDisplayMap; t: ReturnType<typeof useI18n>['t'] }) {
  const name = l(weapon, 'name', lang);
  const effectName = weapon.effect_name ? l(weapon, 'effect_name', lang) : null;
  const effectDesc1 = weapon.effect_desc1 ? l(weapon, 'effect_desc1', lang) : null;
  const effectDesc4 = weapon.effect_desc4 ? l(weapon, 'effect_desc4', lang) : null;

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
      <EffectSection effectName={effectName} effectIcon={weapon.effect_icon} effectDesc1={effectDesc1} effectDesc4={effectDesc4} levelLabel="Lv. 5" t={t} />
      <SourceSection source={weapon.source} boss={weapon.boss} equipName={weapon.name} bossMap={bossMap} lang={lang} t={t} />
    </>
  );
}

// ── Amulet detail ──

function AmuletDetail({ amulet, lang, bossMap, t }: { amulet: Amulet; lang: Lang; bossMap: BossDisplayMap; t: ReturnType<typeof useI18n>['t'] }) {
  const name = l(amulet, 'name', lang);
  const effectName = amulet.effect_name ? l(amulet, 'effect_name', lang) : null;
  const effectDesc1 = amulet.effect_desc1 ? l(amulet, 'effect_desc1', lang) : null;
  const effectDesc4 = amulet.effect_desc4 ? l(amulet, 'effect_desc4', lang) : null;

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
      <EffectSection effectName={effectName} effectIcon={amulet.effect_icon} effectDesc1={effectDesc1} effectDesc4={effectDesc4} levelLabel="Lv. 5" t={t} />
      {amulet.mainStats && amulet.mainStats.length > 0 && (
        <section className="mt-6">
          <h3>{t('equip.detail.mainstats')}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {amulet.mainStats.map((stat) => (
              <span key={stat} className="rounded bg-zinc-800 px-2.5 py-1 text-sm text-zinc-300">{stat}</span>
            ))}
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
        <section className="card mt-6 p-4">
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

function SetDetail({ set, lang, bossMap, t }: { set: ArmorSet; lang: Lang; bossMap: BossDisplayMap; t: ReturnType<typeof useI18n>['t'] }) {
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

      <section className="card mt-6 space-y-4 p-4">
        {/* 2-piece bonus */}
        {(effect21 || effect24) && (
          <div>
            <h4 className="text-buff after:hidden">{t('equip.set.2piece')}</h4>
            <div className="mt-1 space-y-1 text-sm text-zinc-300">
              {effect21 && <p><span className="text-zinc-500">Lv. 0 </span>{formatEffectText(effect21)}</p>}
              {effect24 && effect24 !== effect21 && (
                <p><span className="text-zinc-500">Lv. 10 </span>{formatScaledEffect(effect24, effect21)}</p>
              )}
            </div>
          </div>
        )}
        {/* 4-piece bonus */}
        {(effect41 || effect44) && (
          <div>
            <h4 className="text-buff after:hidden">{t('equip.set.4piece')}</h4>
            <div className="mt-1 space-y-1 text-sm text-zinc-300">
              {effect41 && <p><span className="text-zinc-500">Lv. 0 </span>{formatEffectText(effect41)}</p>}
              {effect44 && effect44 !== effect41 && (
                <p><span className="text-zinc-500">Lv. 10 </span>{formatScaledEffect(effect44, effect41)}</p>
              )}
            </div>
          </div>
        )}
      </section>

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

  return (
    <>
      {/* Hero with EE icon */}
      <div className="flex items-start gap-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg">
          <Image src={getRarityBgPath('legendary')} alt="" fill sizes="96px" className="object-cover" />
          <div className="absolute inset-2">
            <Image src={`/images/characters/ee/${owner.id}.webp`} alt={name} fill sizes="80px" className="object-contain" />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="h1-page">{name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge label={t('equip.tab.ee')} />
            {ee.rank && (
              <div className="relative h-7 w-7 shrink-0">
                <Image src={`/images/ui/rank/IG_Event_Rank_${ee.rank}.webp`} alt={`Rank ${ee.rank}`} fill sizes="28px" className="object-contain" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Owner */}
      <section className="mt-6">
        <h3>{t('equip.detail.owner')}</h3>
        <div className="mt-2">
          <CharacterRefCard char={owner} lang={lang} />
        </div>
      </section>

      {/* Main stat */}
      {mainStat && (
        <section className="mt-6">
          <h3>{t('equip.detail.mainstat')}</h3>
          <span className="mt-2 inline-block rounded bg-zinc-800 px-3 py-1 text-sm text-zinc-300">{mainStat}</span>
        </section>
      )}

      {/* Effects */}
      {effect && (
        <section className="card mt-6 p-4">
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
        <section className="mt-6">
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

function EffectSection({ effectName, effectIcon, effectDesc1, effectDesc4, levelLabel, t }: {
  effectName: string | null;
  effectIcon: string | null;
  effectDesc1: string | null;
  effectDesc4: string | null;
  levelLabel: string;
  t: ReturnType<typeof useI18n>['t'];
}) {
  if (!effectName && !effectDesc1) return null;

  return (
    <section className="card mt-6 p-4">
      <h3 className="after:hidden">{t('page.character.ee.effect')}</h3>

      {effectName && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-zinc-500/40 px-3 py-1">
          {effectIcon && (
            <div className="relative h-5 w-5 shrink-0">
              <Image src={`/images/ui/effect/${effectIcon}.webp`} alt="" fill sizes="20px" className="object-contain" />
            </div>
          )}
          <span className="text-sm text-buff">{levelLabel} {effectName}</span>
        </div>
      )}

      <div className="mt-3 space-y-2 text-sm text-zinc-300">
        {effectDesc1 && <p><span className="text-zinc-500">Lv. 0 </span>{formatEffectText(effectDesc1)}</p>}
        {effectDesc4 && effectDesc4 !== effectDesc1 && (
          <p><span className="text-zinc-500">{levelLabel} </span>{formatScaledEffect(effectDesc4, effectDesc1)}</p>
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
    <section className="mt-6">
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

function RarityBadge({ rarity }: { rarity: string }) {
  const { t } = useI18n();
  const colors: Record<string, string> = {
    legendary: 'bg-rarity-3/20 text-rarity-3',
    epic: 'bg-blue-900/30 text-blue-400',
    superior: 'bg-green-900/30 text-green-400',
    normal: 'bg-zinc-700 text-zinc-400',
  };
  const cls = colors[rarity.toLowerCase()] ?? colors.normal;
  const label = t(`sys.rarity.${rarity.toLowerCase()}` as Parameters<typeof t>[0]);
  return <span className={`rounded-full px-2.5 py-0.5 text-xs ${cls}`}>{label}</span>;
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
    <div className="card flex items-center gap-3 p-3 transition-colors hover:bg-zinc-800/80">
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
        <Image
          src={`/images/characters/atb/IG_Turn_${char.id}.webp`}
          alt={char.name}
          fill
          sizes="48px"
          className="object-contain"
        />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-zinc-100">{char.name}</p>
        {char.element && char.classType && (
          <div className="flex items-center gap-1.5">
            <div className="relative h-4 w-4 shrink-0">
              <Image src={`/images/ui/elem/${char.element.toLowerCase()}.webp`} alt={char.element} fill sizes="16px" className="object-contain" />
            </div>
            <div className="relative h-4 w-4 shrink-0">
              <Image src={`/images/ui/class/CM_Class_${char.classType}.webp`} alt={char.classType} fill sizes="16px" className="object-contain" />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (char.slug) {
    return <Link href={`/${lang}/characters/${char.slug}`}>{content}</Link>;
  }
  return content;
}
