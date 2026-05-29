'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Weapon, Amulet, Talisman, ArmorSet, ExclusiveEquipment, BossDisplayMap } from '@/types/equipment';
import type { EquipmentLookup, ArmorSetStatRanges, TalismanStatRanges, EEStatRange } from '@/lib/data/equipment';
import type { ArmorPiece } from '@/lib/data/stat-ranges-v2';
import { getBonusEffectsForSlot, type BonusEffect } from '@/lib/data/ascension';
import { AscensionStepsTable, AscensionBonusEffectsTable, GradeLegend } from '@/app/[lang]/guides/_contents/general-guides/gear/helpers';
import type { Effect } from '@/types/effect';
import type { Lang } from '@/lib/i18n/config';
import type { Messages } from '@/i18n';
import { I18nProvider, useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { LangMap } from '@/types/common';
import { EffectsProvider } from '@/app/components/character/BuffDebuffDisplay';
import BuffDebuffDisplay from '@/app/components/character/BuffDebuffDisplay';
import EquipmentIcon from '@/app/components/equipment/EquipmentIcon';
import EquipmentSource from '@/app/components/equipment/EquipmentSource';
import CharacterPortrait from '@/app/components/character/CharacterPortrait';
import StatInline from '@/app/components/inline/StatInline';
import FitText from '@/app/components/ui/FitText';
import { useBreadcrumbOverride } from '@/lib/contexts/BreadcrumbContext';
import { l } from '@/lib/i18n/localize';
import { formatEffectText, getRarityBgPath } from '@/lib/format-text';
import type { ItemRarity } from '@/lib/theme';

const statUnit = (stat: string) => stat.includes('%') || stat === 'CHC' || stat === 'CHD' ? '%' : '';

// ── Console direction tokens ──
// Accent is driven by item RARITY (real equipment has no element). Hex values
// mirror the repo theme (globals.css @theme · item-rarity tokens).
const RARITY_HEX: Record<ItemRarity, string> = {
  normal: '#e5e7eb',
  superior: '#4ade80',
  epic: '#93c5fd',
  legendary: '#f87171',
};
const ELEMENT_HEX: Record<string, string> = {
  Fire: '#ff6b6b', Water: '#4dabf7', Earth: '#51cf66', Light: '#ffe066', Dark: '#cc5de8',
};
const BUFF_HEX = '#38bdf8';
const STAT_HEX = '#fbbf24';
const FUCHSIA_HEX = '#f0abfc';

// Short HUD labels — inline LangMaps (same convention as ASCENSION_LABELS below).
// Could be promoted to messages.json later if reused elsewhere.
const HUD_LABELS = {
  rarity: { en: 'Rarity', jp: 'レアリティ', kr: '등급', zh: '稀有度' },
  class:  { en: 'Class',  jp: 'クラス',     kr: '클래스', zh: '职业' },
  rank:   { en: 'Rank',   jp: 'ランク',     kr: '랭크',  zh: '阶位' },
  pieces: { en: 'Pieces', jp: '部位数',     kr: '부위',  zh: '部件' },
} satisfies Record<string, LangMap>;

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
  messages: Messages;
  lang: Lang;
};

type EDModule = { key: string; title: string; span?: 1 | 2; ascension?: boolean; node: React.ReactNode };
type EDKpi = { label: string; value: string; color?: string };

export default function EquipmentDetailClient(props: Props) {
  return (
    <I18nProvider lang={props.lang} messages={props.messages}>
      <EffectsProvider buffMap={props.buffMap} debuffMap={props.debuffMap}>
        <EquipmentDetailInner {...props} />
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

// ── Console shell primitives ──

function Module({ title, span, ascension, accentHex, children }: {
  title: string; span?: 1 | 2; ascension?: boolean; accentHex: string; children: React.ReactNode;
}) {
  const bracketColor = ascension ? FUCHSIA_HEX : accentHex;
  return (
    <section className={`flex min-w-0 flex-col overflow-hidden rounded-lg border bg-zinc-900/50 ${ascension ? 'border-fuchsia-700/30' : 'border-zinc-700/50'} ${span === 2 ? 'md:col-span-2' : ''}`}>
      <div
        className={`flex items-center gap-2 border-b border-white/5 px-3.5 py-2.5 ${ascension ? 'bg-fuchsia-500/5' : ''}`}
        style={ascension ? undefined : { backgroundColor: `${accentHex}0d` }}
      >
        <span className="font-mono text-xs font-bold opacity-70" style={{ color: bracketColor }}>[</span>
        <span className={`flex-1 font-mono text-xs font-bold uppercase tracking-wider ${ascension ? 'text-fuchsia-300' : 'text-zinc-100'}`}>{title}</span>
        <span className="font-mono text-xs font-bold opacity-70" style={{ color: bracketColor }}>]</span>
      </div>
      <div className="flex-1 p-4">{children}</div>
    </section>
  );
}

function StatRow({ stat, children, primary, accentHex }: { stat: string; children?: React.ReactNode; primary?: boolean; accentHex?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className={primary ? 'text-sm font-bold text-zinc-100' : 'text-sm text-zinc-300'}><StatInline name={stat} /></span>
      <span
        className={`whitespace-nowrap font-mono tabular-nums ${primary ? 'text-sm font-semibold' : 'text-xs text-zinc-400'}`}
        style={primary && accentHex ? { color: accentHex } : undefined}
      >{children}</span>
    </div>
  );
}

function ListStats({ stats, accentHex }: { stats: { stat: string; range: [number, number] | null }[]; accentHex: string }) {
  return (
    <div>
      {stats.map((s, i) => {
        const u = statUnit(s.stat);
        return (
          <div key={s.stat} className={i > 0 ? 'border-t border-white/5' : ''}>
            <StatRow stat={s.stat} primary={i === 0} accentHex={accentHex}>
              {s.range ? <>{s.range[0]}{u} – {s.range[1]}{u}</> : null}
            </StatRow>
          </div>
        );
      })}
    </div>
  );
}

function EEMainStat({ label, range, accentHex }: { label: string; range: [number, number] | null; accentHex: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-sm font-bold text-zinc-100">{label}</span>
      {range && <span className="whitespace-nowrap font-mono text-sm font-semibold tabular-nums" style={{ color: accentHex }}>{range[0]}% – {range[1]}%</span>}
    </div>
  );
}

function EffectContent({ effectName, effectIcon, isBuff, rows, accentHex }: {
  effectName?: string | null;
  effectIcon?: string | null;
  isBuff?: boolean;
  rows: { lvl: string; text: string | null }[];
  accentHex: string;
}) {
  const chipColor = isBuff ? BUFF_HEX : accentHex;
  if (!effectName && !rows.some((r) => r.text)) return null;
  return (
    <div className="flex flex-col gap-3.5">
      {effectName && (
        <span
          className="inline-flex items-center gap-2 self-start rounded-full px-3 py-1 text-sm font-semibold"
          style={{ border: `1px solid ${chipColor}44`, background: `${chipColor}14`, color: chipColor }}
        >
          {effectIcon && (
            <span className="relative inline-block h-5 w-5 shrink-0">
              <Image src={`/images/ui/effect/${effectIcon}.webp`} alt={effectName} fill sizes="20px" className="object-contain" />
            </span>
          )}
          {effectName}
        </span>
      )}
      <div className="flex flex-col gap-3">
        {rows.map((r, i) => r.text && (
          <div key={i} className="flex gap-2.5">
            <span
              className="h-fit shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide"
              style={i === 0
                ? { borderColor: 'rgba(255,255,255,0.12)', color: '#6b7283' }
                : { borderColor: `${FUCHSIA_HEX}44`, background: `${FUCHSIA_HEX}12`, color: FUCHSIA_HEX }}
            >{r.lvl}</span>
            <span className="text-sm leading-relaxed text-zinc-300">{formatEffectText(r.text)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CharacterRefCard({ char }: { char: CharacterRef }) {
  const { href } = useI18n();
  const elHex = char.element ? ELEMENT_HEX[char.element] : undefined;
  const content = (
    <div
      className="flex flex-col items-center gap-2 rounded-lg border border-zinc-700/50 bg-zinc-900/50 p-3 transition-colors hover:border-zinc-600"
      style={elHex ? { borderTopColor: elHex, borderTopWidth: 2 } : undefined}
    >
      <CharacterPortrait id={char.id} name={char.name} size="md" showIcons />
      <div className="w-full text-center text-sm font-bold text-zinc-100">
        <FitText max={14} min={9}>{char.name}</FitText>
      </div>
    </div>
  );
  if (char.slug) return <Link href={href(`/characters/${char.slug}`)}>{content}</Link>;
  return content;
}

// ── Set-specific content ──

const ARMOR_PIECE_KEYS = ['Helmet', 'Armor', 'Gloves', 'Shoes'] as const;
const ARMOR_PIECE_I18N: Record<string, string> = {
  Helmet: 'equip.detail.piece.helmet',
  Armor: 'equip.detail.piece.armor',
  Gloves: 'equip.detail.piece.gloves',
  Shoes: 'equip.detail.piece.shoes',
};

function SetEffectsContent({ set, lang }: { set: ArmorSet; lang: Lang }) {
  const { t } = useI18n();
  const effect21 = l(set, 'effect_2_1', lang);
  const effect24 = l(set, 'effect_2_4', lang);
  const effect41 = l(set, 'effect_4_1', lang);
  const effect44 = l(set, 'effect_4_4', lang);

  return (
    <table className="w-full text-sm">
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
            <td className="w-10 py-1.5 align-top text-fuchsia-300">T4</td>
            {(effect21 || effect24) && <td className="py-1.5 align-top text-zinc-300">{effect24 && effect24 !== effect21 ? formatEffectText(effect24) : effect21 ? formatEffectText(effect21) : '—'}</td>}
            {(effect41 || effect44) && <td className="py-1.5 align-top text-zinc-300">{effect44 && effect44 !== effect41 ? formatEffectText(effect44) : effect41 ? formatEffectText(effect41) : '—'}</td>}
          </tr>
        )}
      </tbody>
    </table>
  );
}

function ArmorPiecesContent({ set, statRanges, accentHex, lang }: { set: ArmorSet; statRanges: ArmorSetStatRanges; accentHex: string; lang: Lang }) {
  const { t } = useI18n();
  const name = l(set, 'name', lang);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {ARMOR_PIECE_KEYS.map((piece) => {
        const stats = statRanges[piece];
        if (!stats || Object.keys(stats).length === 0) return null;
        return (
          <div key={piece} className="flex items-center gap-3 rounded-lg border border-zinc-700/50 bg-zinc-900/40 p-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded">
              <Image src={getRarityBgPath(set.rarity)} alt={`${set.rarity} rarity`} fill sizes="56px" className="object-cover" />
              <div className="absolute inset-0.5">
                <Image src={`/images/equipment/TI_Equipment_${piece}_${set.image_prefix}.webp`} alt={`${name} ${piece}`} fill sizes="52px" className="object-contain" />
              </div>
            </div>
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
                    <td className="py-0.5 text-right font-mono tabular-nums text-zinc-500">{min}{statUnit(stat)}</td>
                    <td className="py-0.5 text-right font-mono tabular-nums" style={{ color: accentHex }}>{max}{statUnit(stat)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

// ── Singularity Ascension ──
//
// Labels live inline as LangMaps (matching the convention used by gear/index.tsx).

const ASCENSION_LABELS = {
  title: { en: 'Singularity Ascension', jp: '特異点昇華', kr: '특이점 승화', zh: '奇点升华' },
  ascendedStats: { en: '+10 T4 → +15 T4', jp: '+10 T4 → +15 T4', kr: '+10 T4 → +15 T4', zh: '+10 T4 → +15 T4' },
  steps_title: { en: 'Cost +11 → +15', jp: 'コスト +11 → +15', kr: '비용 +11 → +15', zh: '成本 +11 → +15' },
  steps_from: { en: 'Step', jp: '段階', kr: '단계', zh: '阶段' },
  steps_success: { en: 'Success', jp: '成功率', kr: '성공률', zh: '成功率' },
  steps_gold: { en: 'Gold', jp: 'ゴールド', kr: '골드', zh: '金币' },
  steps_chip: { en: 'Chip', jp: 'チップ', kr: '칩', zh: '芯片' },
  steps_hammer: { en: 'Hammer', jp: 'ハンマー', kr: '망치', zh: '锤子' },
  steps_mainStat: { en: 'Main Stat', jp: 'メインステ', kr: '메인 스탯', zh: '主属性' },
  steps_bonus: { en: 'Bonus', jp: 'ボーナス', kr: '보너스', zh: '加成' },
  bonus_title: { en: 'Possible Bonus Effect at +15', jp: '+15時のボーナス効果', kr: '+15 보너스 효과', zh: '+15额外效果' },
  bonus_effect: { en: 'Effect', jp: '効果', kr: '효과', zh: '效果' },
  bonus_chance: { en: 'Chance', jp: '確率', kr: '확률', zh: '概率' },
  bonus_range: { en: 'Range', jp: '範囲', kr: '범위', zh: '范围' },
  gradeLegend: { en: 'Grades:', jp: 'グレード:', kr: '등급:', zh: '等级:' },
} satisfies Record<string, LangMap>;

const ARMOR_PIECE_LABELS_LANG: Record<ArmorPiece, LangMap> = {
  Helmet: { en: 'Helmet', jp: 'ヘルメット', kr: '투구', zh: '头盔' },
  Armor: { en: 'Armor', jp: '鎧', kr: '갑옷', zh: '铠甲' },
  Gloves: { en: 'Gloves', jp: '手甲', kr: '장갑', zh: '手套' },
  Shoes: { en: 'Shoes', jp: '靴', kr: '신발', zh: '鞋' },
};

function buildAscensionLabels(lang: Lang) {
  return {
    steps: {
      from: lRec(ASCENSION_LABELS.steps_from, lang),
      success: lRec(ASCENSION_LABELS.steps_success, lang),
      gold: lRec(ASCENSION_LABELS.steps_gold, lang),
      chip: lRec(ASCENSION_LABELS.steps_chip, lang),
      hammer: lRec(ASCENSION_LABELS.steps_hammer, lang),
      mainStat: lRec(ASCENSION_LABELS.steps_mainStat, lang),
      bonus: lRec(ASCENSION_LABELS.steps_bonus, lang),
    },
    bonus: {
      effect: lRec(ASCENSION_LABELS.bonus_effect, lang),
      chance: lRec(ASCENSION_LABELS.bonus_chance, lang),
      range: lRec(ASCENSION_LABELS.bonus_range, lang),
    },
  };
}

function StatComparisonRow({ stat, standardMax, ascendedMax }: { stat: string; standardMax: number | undefined; ascendedMax: number }) {
  const unit = statUnit(stat);
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-zinc-300"><StatInline name={stat} /></span>
      <span className="font-mono tabular-nums">
        {standardMax !== undefined && (
          <>
            <span className="text-zinc-500">{standardMax}{unit}</span>
            <span className="mx-2 text-zinc-600">→</span>
          </>
        )}
        <span className="font-semibold text-fuchsia-300">{ascendedMax}{unit}</span>
      </span>
    </div>
  );
}

/** Ascension content for single-item slots (weapons + accessories). */
function AscensionContent({ slot, standardRanges, ascendedRanges, lang }: {
  slot: 'weapons' | 'accessories';
  standardRanges: Record<string, [number, number]> | null;
  ascendedRanges: Record<string, number> | null;
  lang: Lang;
}) {
  if (!ascendedRanges || Object.keys(ascendedRanges).length === 0) return null;

  const labels = buildAscensionLabels(lang);
  const bonusEffects = getBonusEffectsForSlot(slot);
  const effectNames = Object.fromEntries(bonusEffects.map((e) => [e.key, e.name[lang] ?? e.name.en ?? e.key]));

  return (
    <div className="flex flex-col gap-4">
      <div className="text-right font-mono text-xs uppercase tracking-wider text-zinc-500">{lRec(ASCENSION_LABELS.ascendedStats, lang)}</div>
      <div className="space-y-1.5">
        {Object.entries(ascendedRanges).map(([stat, ascMax]) => (
          <StatComparisonRow key={stat} stat={stat} standardMax={standardRanges?.[stat]?.[1]} ascendedMax={ascMax} />
        ))}
      </div>
      <div>
        <h4 className="mb-2 text-sm font-semibold text-zinc-400 after:hidden">{lRec(ASCENSION_LABELS.steps_title, lang)}</h4>
        <AscensionStepsTable labels={labels.steps} />
      </div>
      {bonusEffects.length > 0 && (
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-zinc-400 after:hidden">{lRec(ASCENSION_LABELS.bonus_title, lang)}</h4>
            <GradeLegend label={lRec(ASCENSION_LABELS.gradeLegend, lang)} />
          </div>
          <AscensionBonusEffectsTable effects={bonusEffects as BonusEffect[]} effectNames={effectNames} labels={labels.bonus} mode="simple" />
        </div>
      )}
    </div>
  );
}

/** Ascension content for armor sets (4 pieces, defensive options). */
function AscensionContentForSet({ standardRanges, ascendedRanges, lang }: {
  standardRanges: ArmorSetStatRanges | null;
  ascendedRanges: Record<ArmorPiece, Record<string, number>> | null;
  lang: Lang;
}) {
  if (!ascendedRanges) return null;
  const pieces: ArmorPiece[] = ['Helmet', 'Armor', 'Gloves', 'Shoes'];
  if (!pieces.some((p) => ascendedRanges[p] && Object.keys(ascendedRanges[p]).length > 0)) return null;

  const labels = buildAscensionLabels(lang);
  const bonusEffects = getBonusEffectsForSlot('Helmet');
  const effectNames = Object.fromEntries(bonusEffects.map((e) => [e.key, e.name[lang] ?? e.name.en ?? e.key]));

  return (
    <div className="flex flex-col gap-4">
      <div className="text-right font-mono text-xs uppercase tracking-wider text-zinc-500">{lRec(ASCENSION_LABELS.ascendedStats, lang)}</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {pieces.map((piece) => {
          const stats = ascendedRanges[piece];
          if (!stats || Object.keys(stats).length === 0) return null;
          const standard = standardRanges?.[piece] ?? {};
          return (
            <div key={piece} className="rounded-lg border border-fuchsia-700/20 bg-fuchsia-500/5 p-3">
              <div className="mb-1.5 font-mono text-xs uppercase tracking-wider text-fuchsia-300">{lRec(ARMOR_PIECE_LABELS_LANG[piece], lang)}</div>
              <div className="space-y-1">
                {Object.entries(stats).map(([stat, ascMax]) => (
                  <StatComparisonRow key={stat} stat={stat} standardMax={standard[stat]?.[1]} ascendedMax={ascMax} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div>
        <h4 className="mb-2 text-sm font-semibold text-zinc-400 after:hidden">{lRec(ASCENSION_LABELS.steps_title, lang)}</h4>
        <AscensionStepsTable labels={labels.steps} />
      </div>
      {bonusEffects.length > 0 && (
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-zinc-400 after:hidden">{lRec(ASCENSION_LABELS.bonus_title, lang)}</h4>
            <GradeLegend label={lRec(ASCENSION_LABELS.gradeLegend, lang)} />
          </div>
          <AscensionBonusEffectsTable effects={bonusEffects as BonusEffect[]} effectNames={effectNames} labels={labels.bonus} mode="simple" />
        </div>
      )}
    </div>
  );
}
