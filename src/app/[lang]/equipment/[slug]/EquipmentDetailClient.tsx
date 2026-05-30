'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Weapon, Amulet, Talisman, ArmorSet, ExclusiveEquipment, BossDisplayMap } from '@/types/equipment';
import type { EquipmentLookup, ArmorSetStatRanges, TalismanStatRanges, EEStatRange } from '@/lib/data/equipment';
import type { ArmorPiece } from '@/lib/data/stat-ranges-v2';
import type { Effect } from '@/types/effect';
import type { Lang } from '@/lib/i18n/config';
import type { Messages } from '@/i18n';
import type { ItemLiveBundle } from '@/lib/equipment-formula';
import { I18nProvider, useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import { EffectsProvider } from '@/app/components/character/BuffDebuffDisplay';
import BuffDebuffDisplay from '@/app/components/character/BuffDebuffDisplay';
import EquipmentIcon from '@/app/components/equipment/EquipmentIcon';
import EquipmentSource from '@/app/components/equipment/EquipmentSource';
import { useBreadcrumbOverride } from '@/lib/contexts/BreadcrumbContext';
import { l } from '@/lib/i18n/localize';
import { getRarityBgPath } from '@/lib/format-text';
import type { ItemRarity } from '@/lib/theme';
import {
  statUnit, RARITY_HEX, STAT_HEX, HUD_LABELS, ASCENSION_LABELS,
  Module, StatRow, ListStats, EEMainStat, EffectContent, CharacterRefCard,
  SetEffectsContent, ArmorPiecesContent, AscensionContent, AscensionContentForSet,
  type CharacterRef, type EDModule,
} from './equipment-console-shared';
import { EquipmentInteractiveInner } from './EquipmentDetailInteractive';

type Props = {
  equipment: EquipmentLookup;
  recoCharacters: CharacterRef[];
  totalRecoCount: number;
  eeOwner: CharacterRef | null;
  eeCfCompanion: CharacterRef | null;
  bossMap: BossDisplayMap;
  buffMap: Record<string, Effect>;
  debuffMap: Record<string, Effect>;
  weaponStatRanges: Record<string, [number, number]> | null;
  accessoryStatRanges: Record<string, [number, number]> | null;
  armorSetStatRanges: ArmorSetStatRanges | null;
  weaponAscendedRanges: Record<string, number> | null;
  accessoryAscendedRanges: Record<string, number> | null;
  armorSetAscendedRanges: Record<ArmorPiece, Record<string, number>> | null;
  talismanStatRanges: TalismanStatRanges | null;
  eeStatRange: EEStatRange | null;
  liveDetail: ItemLiveBundle | null;
  messages: Messages;
  lang: Lang;
};

export type EquipmentViewProps = Props;

type EDKpi = { label: string; value: string; color?: string };

export default function EquipmentDetailClient(props: Props) {
  // Interactive progression preview is gated behind ?build=live (client-only flag,
  // no SSR/SEO impact). Production default stays the accurate static view.
  const [live, setLive] = useState(false);
  useEffect(() => {
    setLive(new URLSearchParams(window.location.search).get('build') === 'live');
  }, []);

  return (
    <I18nProvider lang={props.lang} messages={props.messages}>
      <EffectsProvider buffMap={props.buffMap} debuffMap={props.debuffMap}>
        {live ? <EquipmentInteractiveInner {...props} /> : <EquipmentDetailInner {...props} />}
      </EffectsProvider>
    </I18nProvider>
  );
}

function EquipmentDetailInner({
  equipment, recoCharacters, totalRecoCount, eeOwner, eeCfCompanion, bossMap,
  weaponStatRanges, accessoryStatRanges, armorSetStatRanges,
  weaponAscendedRanges, accessoryAscendedRanges, armorSetAscendedRanges,
  talismanStatRanges, eeStatRange, lang,
}: Props) {
  const { t, href } = useI18n();
  const equipName = l(equipment.data, 'name', lang);
  useBreadcrumbOverride(equipName);

  const rarityKey = (equipment.type === 'ee' ? 'legendary' : String(equipment.data.rarity).toLowerCase()) as ItemRarity;
  const accentHex = RARITY_HEX[rarityKey] ?? RARITY_HEX.normal;
  const rarityLabel = t(`sys.rarity.${rarityKey}` as Parameters<typeof t>[0]);

  let heroIcon: React.ReactNode = null;
  let typeLabel = '';
  const kpis: EDKpi[] = [];
  const modules: EDModule[] = [];
  const pushKpi = (label: string, value: string, color?: string) => { if (kpis.length < 4) kpis.push({ label, value, color }); };
  const classLabel = (cls: string) => t(`sys.class.${cls.toLowerCase()}` as Parameters<typeof t>[0]);

  if (equipment.type === 'weapon') {
    const w: Weapon = equipment.data;
    typeLabel = t('equip.tab.weapons');
    heroIcon = <EquipmentIcon src={`equipment/${w.image}`} rarity={w.rarity} alt={equipName} size={88} overlaySize={26} effectIcon={w.effect_icon} classType={w.class} level={w.level} />;

    pushKpi(lRec(HUD_LABELS.rarity, lang), rarityLabel, accentHex);
    if (w.class) pushKpi(lRec(HUD_LABELS.class, lang), classLabel(w.class));
    const atk = weaponStatRanges?.['ATK'];
    if (atk) pushKpi('ATK', `${atk[0]} – ${atk[1]}`, STAT_HEX);

    if (atk) {
      const secondary = weaponStatRanges ? Object.entries(weaponStatRanges).filter(([k]) => k !== 'ATK') : [];
      modules.push({ key: 'stats', title: t('equip.detail.mainstats'), span: 1, node: (
        <div>
          <StatRow stat="ATK" primary accentHex={accentHex}>{atk[0]} – {atk[1]}</StatRow>
          {secondary.length > 0 && <div className="my-1 border-t border-white/5" />}
          {secondary.map(([s, [mi, ma]]) => <StatRow key={s} stat={s}>{mi}% – {ma}%</StatRow>)}
        </div>
      ) });
    }
    const eName = w.effect_name ? l(w, 'effect_name', lang) : null;
    const e1 = w.effect_desc1 ? l(w, 'effect_desc1', lang) : null;
    const e4 = w.effect_desc4 ? l(w, 'effect_desc4', lang) : null;
    if (eName || e1) modules.push({ key: 'effect', title: t('page.character.ee.effect'), span: 1, node: (
      <EffectContent effectName={eName} effectIcon={w.effect_icon} rows={[{ lvl: 'T0', text: e1 }, { lvl: 'T4', text: e4 && e4 !== e1 ? e4 : null }]} accentHex={accentHex} />
    ) });
    if (weaponAscendedRanges && Object.keys(weaponAscendedRanges).length > 0) modules.push({ key: 'asc', title: lRec(ASCENSION_LABELS.title, lang), span: 2, ascension: true, node: (
      <AscensionContent slot="weapons" standardRanges={weaponStatRanges} ascendedRanges={weaponAscendedRanges} lang={lang} />
    ) });
    if (w.source || w.boss) modules.push({ key: 'source', title: t('equip.filter.source'), span: 1, node: (
      <EquipmentSource source={w.source} boss={w.boss} bossMap={bossMap} lang={lang} linkable />
    ) });

  } else if (equipment.type === 'amulet') {
    const a: Amulet = equipment.data;
    typeLabel = t('equip.tab.accessories');
    heroIcon = <EquipmentIcon src={`equipment/${a.image}`} rarity={a.rarity} alt={equipName} size={88} overlaySize={26} effectIcon={a.effect_icon} classType={a.class} level={a.level} />;
    const mainStats = a.mainStats ?? [];

    pushKpi(lRec(HUD_LABELS.rarity, lang), rarityLabel, accentHex);
    if (a.class) pushKpi(lRec(HUD_LABELS.class, lang), classLabel(a.class));
    if (mainStats.length > 0) {
      const r0 = accessoryStatRanges?.[mainStats[0]];
      if (r0) pushKpi(mainStats[0], `${r0[0]}${statUnit(mainStats[0])} – ${r0[1]}${statUnit(mainStats[0])}`, STAT_HEX);
    }

    const eName = a.effect_name ? l(a, 'effect_name', lang) : null;
    const e1 = a.effect_desc1 ? l(a, 'effect_desc1', lang) : null;
    const e4 = a.effect_desc4 ? l(a, 'effect_desc4', lang) : null;
    if (eName || e1) modules.push({ key: 'effect', title: t('page.character.ee.effect'), span: 1, node: (
      <EffectContent effectName={eName} effectIcon={a.effect_icon} rows={[{ lvl: 'T0', text: e1 }, { lvl: 'T4', text: e4 && e4 !== e1 ? e4 : null }]} accentHex={accentHex} />
    ) });
    if (mainStats.length > 0) modules.push({ key: 'stats', title: t('equip.detail.mainstats'), span: 1, node: (
      <ListStats stats={mainStats.map(s => ({ stat: s, range: accessoryStatRanges?.[s] ?? null }))} accentHex={accentHex} />
    ) });
    if (accessoryAscendedRanges && Object.keys(accessoryAscendedRanges).length > 0) modules.push({ key: 'asc', title: lRec(ASCENSION_LABELS.title, lang), span: 2, ascension: true, node: (
      <AscensionContent slot="accessories" standardRanges={accessoryStatRanges} ascendedRanges={accessoryAscendedRanges} lang={lang} />
    ) });
    if (a.source || a.boss) modules.push({ key: 'source', title: t('equip.filter.source'), span: 1, node: (
      <EquipmentSource source={a.source} boss={a.boss} bossMap={bossMap} lang={lang} linkable />
    ) });

  } else if (equipment.type === 'talisman') {
    const tl: Talisman = equipment.data;
    typeLabel = t('equip.tab.talismans');
    heroIcon = <EquipmentIcon src={`equipment/${tl.image}`} rarity={tl.rarity} alt={equipName} size={88} overlaySize={26} effectIcon={tl.effect_icon} level={tl.level} />;
    const statEntries = talismanStatRanges ? Object.entries(talismanStatRanges) : [];

    pushKpi(lRec(HUD_LABELS.rarity, lang), rarityLabel, accentHex);
    statEntries.slice(0, 2).forEach(([s, [mi, ma]]) => pushKpi(s, `${mi}% – ${ma}%`, STAT_HEX));

    const eName = l(tl, 'effect_name', lang)?.replace('Action Point', 'AP').replace('Chain Point', 'CP') ?? null;
    const e1 = l(tl, 'effect_desc1', lang);
    const e4 = l(tl, 'effect_desc4', lang);
    if (eName || e1) modules.push({ key: 'effect', title: t('page.character.ee.effect'), span: 2, node: (
      <EffectContent effectName={eName} effectIcon={tl.effect_icon} isBuff rows={[{ lvl: 'Lv.0', text: e1 }, { lvl: 'Lv.10', text: e4 && e4 !== e1 ? e4 : null }]} accentHex={accentHex} />
    ) });
    if (statEntries.length > 0) modules.push({ key: 'stats', title: t('equip.detail.mainstats'), span: 1, node: (
      <ListStats stats={statEntries.map(([s, r]) => ({ stat: s, range: r }))} accentHex={accentHex} />
    ) });
    if (tl.source || tl.boss) modules.push({ key: 'source', title: t('equip.filter.source'), span: 1, node: (
      <EquipmentSource source={tl.source ?? undefined} boss={tl.boss ?? undefined} bossMap={bossMap} lang={lang} linkable />
    ) });

  } else if (equipment.type === 'set') {
    const s: ArmorSet = equipment.data;
    typeLabel = t('equip.tab.sets');
    heroIcon = <EquipmentIcon src={`equipment/TI_Equipment_Armor_${s.image_prefix}`} rarity={s.rarity} alt={equipName} size={88} overlaySize={26} effectIcon={s.set_icon} level={6} />;

    pushKpi(lRec(HUD_LABELS.rarity, lang), rarityLabel, accentHex);
    if (s.class) pushKpi(lRec(HUD_LABELS.class, lang), classLabel(s.class));
    pushKpi(lRec(HUD_LABELS.pieces, lang), '4', STAT_HEX);

    modules.push({ key: 'seteff', title: t('equip.detail.set_effects'), span: 2, node: <SetEffectsContent set={s} lang={lang} /> });
    if (armorSetStatRanges) modules.push({ key: 'pieces', title: t('equip.detail.mainstat'), span: 2, node: (
      <ArmorPiecesContent set={s} statRanges={armorSetStatRanges} accentHex={accentHex} lang={lang} />
    ) });
    if (armorSetAscendedRanges && (['Helmet', 'Armor', 'Gloves', 'Shoes'] as ArmorPiece[]).some(p => armorSetAscendedRanges[p] && Object.keys(armorSetAscendedRanges[p]).length > 0)) {
      modules.push({ key: 'asc', title: lRec(ASCENSION_LABELS.title, lang), span: 2, ascension: true, node: (
        <AscensionContentForSet standardRanges={armorSetStatRanges} ascendedRanges={armorSetAscendedRanges} lang={lang} />
      ) });
    }
    if (s.source || s.boss) modules.push({ key: 'source', title: t('equip.filter.source'), span: 1, node: (
      <EquipmentSource source={s.source} boss={s.boss} bossMap={bossMap} lang={lang} linkable />
    ) });

  } else if (equipment.type === 'ee' && eeOwner) {
    const ee: ExclusiveEquipment = equipment.data;
    typeLabel = t('equip.tab.ee');
    heroIcon = (
      <div className="relative h-22 w-22 shrink-0 overflow-hidden rounded-xl">
        <Image src={getRarityBgPath('legendary')} alt="Legendary rarity" fill sizes="88px" className="object-cover" />
        <div className="absolute inset-2">
          <Image src={`/images/characters/ee/${eeOwner.id}.webp`} alt={equipName} fill sizes="72px" className="object-contain" />
        </div>
      </div>
    );
    const mainStat = l(ee, 'mainStat', lang);
    const effect = l(ee, 'effect', lang);
    const effect10 = l(ee, 'effect10', lang);

    pushKpi(lRec(HUD_LABELS.rarity, lang), rarityLabel, accentHex);
    if (ee.rank) pushKpi(lRec(HUD_LABELS.rank, lang), ee.rank, STAT_HEX);

    modules.push({ key: 'owner', title: t('equip.detail.owner'), span: 1, node: (
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <CharacterRefCard char={eeOwner} />
        {eeCfCompanion && <CharacterRefCard char={eeCfCompanion} />}
      </div>
    ) });
    if (mainStat) modules.push({ key: 'stats', title: t('equip.detail.mainstat'), span: 1, node: (
      <EEMainStat label={mainStat} range={eeStatRange?.range ?? null} accentHex={accentHex} />
    ) });
    if (effect) modules.push({ key: 'effect', title: t('page.character.ee.effect'), span: 2, node: (
      <EffectContent rows={[{ lvl: 'Lv.1', text: effect }, { lvl: 'Lv.10', text: effect10 && effect10 !== effect ? effect10 : null }]} accentHex={accentHex} />
    ) });
    if (ee.buff.length > 0 || ee.debuff.length > 0) {
      const bdTitle = ee.buff.length > 0 && ee.debuff.length > 0
        ? `${t('characters.filters.buffs')} / ${t('characters.filters.debuffs')}`
        : ee.buff.length > 0 ? t('characters.filters.buffs') : t('characters.filters.debuffs');
      modules.push({ key: 'buffs', title: bdTitle, span: 2, node: <BuffDebuffDisplay buffs={ee.buff} debuffs={ee.debuff} /> });
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      {/* breadcrumb / back */}
      <Link href={href('/equipment')} className="mb-4 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-zinc-500 transition-colors hover:text-zinc-300">
        <span aria-hidden="true">←</span> {t('equip.detail.back')}
      </Link>

      {/* HUD HERO BAR */}
      <div className="mb-3.5 overflow-hidden rounded-xl border bg-zinc-900/60" style={{ borderColor: `${accentHex}3a` }}>
        <div className="flex items-center gap-3 p-4 md:gap-4 md:p-5" style={{ background: `linear-gradient(135deg, ${accentHex}1a 0%, transparent 50%)` }}>
          {heroIcon}
          <div className="min-w-0 flex-1">
            <div className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: accentHex }}>{typeLabel}</div>
            <h1 className="m-0 pb-0 text-2xl font-bold leading-tight text-white after:hidden md:text-4xl">{equipName}</h1>
          </div>
        </div>
        {kpis.length > 0 && (
          <div className="grid border-t border-white/5" style={{ gridTemplateColumns: `repeat(${kpis.length}, minmax(0, 1fr))` }}>
            {kpis.map((k, i) => (
              <div key={i} className={`min-w-0 px-3 py-2.5 md:px-4 md:py-3 ${i ? 'border-l border-white/5' : ''}`}>
                <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{k.label}</div>
                <div className="mt-0.5 truncate text-sm font-bold md:text-lg" style={k.color ? { color: k.color } : { color: '#e4e4e7' }}>{k.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DASHBOARD GRID */}
      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
        {modules.map((m) => (
          <Module key={m.key} title={m.title} span={m.span} ascension={m.ascension} accentHex={accentHex}>{m.node}</Module>
        ))}
        {recoCharacters.length > 0 && (
          <Module key="reco" title={t('equip.detail.recommended_by')} span={2} accentHex={accentHex}>
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
              {recoCharacters.map((char) => <CharacterRefCard key={char.id} char={char} />)}
            </div>
            {totalRecoCount > recoCharacters.length && (
              <p className="mt-3 text-center text-sm text-zinc-500">
                {t('equip.detail.and_more').replace('{n}', String(totalRecoCount - recoCharacters.length))}
              </p>
            )}
          </Module>
        )}
      </div>
    </div>
  );
}
