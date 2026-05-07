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
import { ITEM_RARITY_TEXT, ITEM_RARITY_BG } from '@/lib/theme';

const statUnit = (stat: string) => stat.includes('%') || stat === 'CHC' || stat === 'CHD' ? '%' : '';

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

export default function EquipmentDetailClient(props: Props) {
  return (
    <I18nProvider lang={props.lang} messages={props.messages}>
      <EffectsProvider buffMap={props.buffMap} debuffMap={props.debuffMap}>
        <EquipmentDetailInner {...props} />
      </EffectsProvider>
    </I18nProvider>
  );
}

function EquipmentDetailInner({ equipment, recoCharacters, totalRecoCount, eeOwner, eeCfCompanion, bossMap, weaponStatRanges, accessoryStatRanges, armorSetStatRanges, weaponAscendedRanges, accessoryAscendedRanges, armorSetAscendedRanges, talismanStatRanges, eeStatRange, lang }: Props) {
  const { t, href } = useI18n();
  const equipName = l(equipment.data, 'name', lang);
  useBreadcrumbOverride(equipName);

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-6 md:px-6">
      <Link href={href('/equipment')} className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300">
        <span aria-hidden="true">&larr;</span> {t('equip.detail.back')}
      </Link>
      {equipment.type === 'weapon' && <WeaponDetail weapon={equipment.data} lang={lang} bossMap={bossMap} statRanges={weaponStatRanges} ascendedRanges={weaponAscendedRanges} />}
      {equipment.type === 'amulet' && <AmuletDetail amulet={equipment.data} lang={lang} bossMap={bossMap} statRanges={accessoryStatRanges} ascendedRanges={accessoryAscendedRanges} />}
      {equipment.type === 'talisman' && <TalismanDetail talisman={equipment.data} lang={lang} bossMap={bossMap} statRanges={talismanStatRanges} />}
      {equipment.type === 'set' && <SetDetail set={equipment.data} lang={lang} bossMap={bossMap} statRanges={armorSetStatRanges} ascendedRanges={armorSetAscendedRanges} />}
      {equipment.type === 'ee' && eeOwner && <EEDetail ee={equipment.data} owner={eeOwner} cfCompanion={eeCfCompanion} lang={lang} statRange={eeStatRange} />}

      {/* Recommended characters */}
      {recoCharacters.length > 0 && (
        <section>
          <h2>{t('equip.detail.recommended_by')}</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {recoCharacters.map((char) => (
              <CharacterRefCard key={char.id} char={char} />
            ))}
          </div>
          {totalRecoCount > recoCharacters.length && (
            <p className="mt-3 text-center text-sm text-zinc-500">
              {t('equip.detail.and_more').replace('{n}', String(totalRecoCount - recoCharacters.length))}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

// ── Singularity Ascension ──
//
// Labels live inline as LangMaps (matching the convention used by gear/index.tsx).
// They could be promoted to messages.json later if reused elsewhere.

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
      <span className="tabular-nums">
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

/** Ascension section for single-item slots (weapons + accessories). */
function AscensionSection({
  slot,
  standardRanges,
  ascendedRanges,
  lang,
}: {
  slot: 'weapons' | 'accessories';
  standardRanges: Record<string, [number, number]> | null;
  ascendedRanges: Record<string, number> | null;
  lang: Lang;
}) {
  if (!ascendedRanges || Object.keys(ascendedRanges).length === 0) return null;

  const labels = buildAscensionLabels(lang);
  const bonusEffects = getBonusEffectsForSlot(slot);
  const effectNames = Object.fromEntries(
    bonusEffects.map(e => [e.key, e.name[lang] ?? e.name.en ?? e.key])
  );

  return (
    <section className="card border border-fuchsia-700/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="after:hidden text-fuchsia-300">{lRec(ASCENSION_LABELS.title, lang)}</h3>
        <span className="text-xs text-zinc-500">{lRec(ASCENSION_LABELS.ascendedStats, lang)}</span>
      </div>

      <div className="mt-3 space-y-1.5">
        {Object.entries(ascendedRanges).map(([stat, ascMax]) => (
          <StatComparisonRow key={stat} stat={stat} standardMax={standardRanges?.[stat]?.[1]} ascendedMax={ascMax} />
        ))}
      </div>

      <div className="mt-4">
        <h4 className="mb-2 text-sm font-semibold text-zinc-400">{lRec(ASCENSION_LABELS.steps_title, lang)}</h4>
        <AscensionStepsTable labels={labels.steps} />
      </div>

      {bonusEffects.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-zinc-400">{lRec(ASCENSION_LABELS.bonus_title, lang)}</h4>
            <GradeLegend label={lRec(ASCENSION_LABELS.gradeLegend, lang)} />
          </div>
          <AscensionBonusEffectsTable
            effects={bonusEffects as BonusEffect[]}
            effectNames={effectNames}
            labels={labels.bonus}
            mode="simple"
          />
        </div>
      )}
    </section>
  );
}

/** Ascension section for armor sets (4 pieces, defensive options). */
function AscensionSectionForSet({
  standardRanges,
  ascendedRanges,
  lang,
}: {
  standardRanges: ArmorSetStatRanges | null;
  ascendedRanges: Record<ArmorPiece, Record<string, number>> | null;
  lang: Lang;
}) {
  if (!ascendedRanges) return null;
  const pieces: ArmorPiece[] = ['Helmet', 'Armor', 'Gloves', 'Shoes'];
  const hasAny = pieces.some(p => ascendedRanges[p] && Object.keys(ascendedRanges[p]).length > 0);
  if (!hasAny) return null;

  const labels = buildAscensionLabels(lang);
  // Defensive options are shared by all 4 pieces — pick any defensive slot.
  const bonusEffects = getBonusEffectsForSlot('Helmet');
  const effectNames = Object.fromEntries(
    bonusEffects.map(e => [e.key, e.name[lang] ?? e.name.en ?? e.key])
  );

  return (
    <section className="card border border-fuchsia-700/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="after:hidden text-fuchsia-300">{lRec(ASCENSION_LABELS.title, lang)}</h3>
        <span className="text-xs text-zinc-500">{lRec(ASCENSION_LABELS.ascendedStats, lang)}</span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {pieces.map((piece) => {
          const stats = ascendedRanges[piece];
          if (!stats || Object.keys(stats).length === 0) return null;
          const standard = standardRanges?.[piece] ?? {};
          return (
            <div key={piece} className="rounded-lg border border-zinc-700/50 bg-zinc-900/40 p-3">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                {lRec(ARMOR_PIECE_LABELS_LANG[piece], lang)}
              </div>
              <div className="space-y-1">
                {Object.entries(stats).map(([stat, ascMax]) => (
                  <StatComparisonRow key={stat} stat={stat} standardMax={standard[stat]?.[1]} ascendedMax={ascMax} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <h4 className="mb-2 text-sm font-semibold text-zinc-400">{lRec(ASCENSION_LABELS.steps_title, lang)}</h4>
        <AscensionStepsTable labels={labels.steps} />
      </div>

      {bonusEffects.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-zinc-400">{lRec(ASCENSION_LABELS.bonus_title, lang)}</h4>
            <GradeLegend label={lRec(ASCENSION_LABELS.gradeLegend, lang)} />
          </div>
          <AscensionBonusEffectsTable
            effects={bonusEffects as BonusEffect[]}
            effectNames={effectNames}
            labels={labels.bonus}
            mode="simple"
          />
        </div>
      )}
    </section>
  );
}

// ── Weapon detail ──

function WeaponDetail({ weapon, lang, bossMap, statRanges, ascendedRanges }: { weapon: Weapon; lang: Lang; bossMap: BossDisplayMap; statRanges: Record<string, [number, number]> | null; ascendedRanges: Record<string, number> | null }) {
  const { t } = useI18n();
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
        typeLabel={t('equip.tab.weapons')}
        badges={<>
          <TypeBadge label={t('equip.tab.weapons')} />
          <RarityBadge rarity={weapon.rarity} />
          {weapon.class && <ClassBadge classType={weapon.class} />}
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

      <EffectSection effectName={effectName} effectIcon={weapon.effect_icon} effectDesc1={effectDesc1} effectDesc4={effectDesc4} />
      <AscensionSection slot="weapons" standardRanges={statRanges} ascendedRanges={ascendedRanges} lang={lang} />
      <SourceSection source={weapon.source} boss={weapon.boss} bossMap={bossMap} lang={lang} />
    </>
  );
}

// ── Amulet detail ──

function AmuletDetail({ amulet, lang, bossMap, statRanges, ascendedRanges }: { amulet: Amulet; lang: Lang; bossMap: BossDisplayMap; statRanges: Record<string, [number, number]> | null; ascendedRanges: Record<string, number> | null }) {
  const { t } = useI18n();
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
        typeLabel={t('equip.tab.accessories')}
        badges={<>
          <TypeBadge label={t('equip.tab.accessories')} />
          <RarityBadge rarity={amulet.rarity} />
          {amulet.class && <ClassBadge classType={amulet.class} />}
        </>}
      />
      <EffectSection effectName={effectName} effectIcon={amulet.effect_icon} effectDesc1={effectDesc1} effectDesc4={effectDesc4} />
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
                    <span className="tabular-nums text-zinc-400">{range[0]}{statUnit(stat)} — {range[1]}{statUnit(stat)}</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
      <AscensionSection slot="accessories" standardRanges={statRanges} ascendedRanges={ascendedRanges} lang={lang} />
      <SourceSection source={amulet.source} boss={amulet.boss} bossMap={bossMap} lang={lang} />
    </>
  );
}

// ── Talisman detail ──

function TalismanDetail({ talisman, lang, bossMap, statRanges }: { talisman: Talisman; lang: Lang; bossMap: BossDisplayMap; statRanges: TalismanStatRanges | null }) {
  const { t } = useI18n();
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
        typeLabel={t('equip.tab.talismans')}
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
              <p><span className="text-zinc-500">Lv. 10 </span>{formatEffectText(effectDesc4)}</p>
            )}
          </div>
        </section>
      )}
      {statRanges && Object.keys(statRanges).length > 0 && (
        <section className="card p-4">
          <h3 className="after:hidden">{t('equip.detail.mainstats')}</h3>
          <div className="mt-3 space-y-1.5 text-sm">
            {Object.entries(statRanges).map(([stat, [min, max]]) => (
              <div key={stat} className="flex items-center justify-between">
                <span className="font-bold text-zinc-200"><StatInline name={stat} /></span>
                <span className="tabular-nums text-zinc-400">{min}% — {max}%</span>
              </div>
            ))}
          </div>
        </section>
      )}
      <SourceSection source={talisman.source ?? undefined} boss={talisman.boss ?? undefined} bossMap={bossMap} lang={lang} />
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

function SetDetail({ set, lang, bossMap, statRanges, ascendedRanges }: { set: ArmorSet; lang: Lang; bossMap: BossDisplayMap; statRanges: ArmorSetStatRanges | null; ascendedRanges: Record<ArmorPiece, Record<string, number>> | null }) {
  const { t } = useI18n();
  const name = l(set, 'name', lang);
  const effect21 = l(set, 'effect_2_1', lang);
  const effect24 = l(set, 'effect_2_4', lang);
  const effect41 = l(set, 'effect_4_1', lang);
  const effect44 = l(set, 'effect_4_4', lang);

  return (
    <>
      <HeroSection
        icon={<EquipmentIcon src={`equipment/TI_Equipment_Armor_${set.image_prefix}`} rarity={set.rarity} alt={name} size={96} overlaySize={28} effectIcon={set.set_icon} level={6} />}
        name={name}
        typeLabel={t('equip.tab.sets')}
        badges={<>
          <TypeBadge label={t('equip.tab.sets')} />
          <RarityBadge rarity={set.rarity} />
          {set.class && <ClassBadge classType={set.class} />}
        </>}
      />

      <section className="card p-4">
        <div className="flex items-center gap-2">
          {set.set_icon && (
            <div className="relative h-6 w-6 shrink-0">
              <Image src={`/images/ui/effect/${set.set_icon}.webp`} alt={name} fill sizes="24px" className="object-contain" />
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
                {(effect21 || effect24) && <td className="py-1.5 align-top text-zinc-300">{effect24 && effect24 !== effect21 ? formatEffectText(effect24) : effect21 ? formatEffectText(effect21) : '—'}</td>}
                {(effect41 || effect44) && <td className="py-1.5 align-top text-zinc-300">{effect44 && effect44 !== effect41 ? formatEffectText(effect44) : effect41 ? formatEffectText(effect41) : '—'}</td>}
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
                    <Image src={getRarityBgPath(set.rarity)} alt={`${set.rarity} rarity`} fill sizes="56px" className="object-cover" />
                    <div className="absolute inset-0.5">
                      <Image src={`/images/equipment/TI_Equipment_${piece}_${set.image_prefix}.webp`} alt={`${name} ${piece}`} fill sizes="52px" className="object-contain" />
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
                          <td className="py-0.5 text-right tabular-nums text-zinc-400">{min}{statUnit(stat)}</td>
                          <td className="py-0.5 text-right tabular-nums text-zinc-300">{max}{statUnit(stat)}</td>
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

      <AscensionSectionForSet standardRanges={statRanges} ascendedRanges={ascendedRanges} lang={lang} />
      <SourceSection source={set.source} boss={set.boss} bossMap={bossMap} lang={lang} />
    </>
  );
}

// ── EE detail ──

function EEDetail({ ee, owner, cfCompanion, lang, statRange }: { ee: ExclusiveEquipment; owner: CharacterRef; cfCompanion: CharacterRef | null; lang: Lang; statRange: EEStatRange | null }) {
  const { t } = useI18n();
  const name = l(ee, 'name', lang);
  const mainStat = l(ee, 'mainStat', lang);
  const effect = l(ee, 'effect', lang);
  const effect10 = l(ee, 'effect10', lang);

  const eeIcon = (
    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg">
      <Image src={getRarityBgPath('legendary')} alt="Legendary rarity" fill sizes="96px" className="object-cover" />
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
        typeLabel={t('equip.tab.ee')}
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
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          <CharacterRefCard char={owner} />
          {cfCompanion && <CharacterRefCard char={cfCompanion} />}
        </div>
      </section>

      {/* Main stat */}
      {mainStat && (
        <section className="card p-4">
          <h3 className="after:hidden">{t('equip.detail.mainstat')}</h3>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="font-bold text-zinc-200">{mainStat}</span>
            {statRange && (
              <span className="tabular-nums text-zinc-400">
                {statRange.range[0]}% — {statRange.range[1]}%
              </span>
            )}
          </div>
        </section>
      )}

      {/* Effects */}
      {effect && (
        <section className="card p-4">
          <h3 className="after:hidden">{t('page.character.ee.effect')}</h3>
          <div className="mt-2 space-y-2 text-sm text-zinc-300">
            <p><span className="text-zinc-500">Lv. 1 </span>{formatEffectText(effect)}</p>
            {effect10 && effect10 !== effect && (
              <p><span className="text-zinc-500">Lv. 10 </span>{formatEffectText(effect10)}</p>
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

function HeroSection({ icon, name, typeLabel, badges }: { icon: React.ReactNode; name: string; typeLabel: string; badges: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      {icon}
      <div className="flex flex-col gap-2">
        <h1 className="h1-page">{name} <span className="sr-only">— {typeLabel}</span></h1>
        <div className="flex flex-wrap items-center gap-2">
          {badges}
        </div>
      </div>
    </div>
  );
}

function EffectSection({ effectName, effectIcon, effectDesc1, effectDesc4 }: {
  effectName: string | null;
  effectIcon: string | null;
  effectDesc1: string | null;
  effectDesc4: string | null;
}) {
  const { t } = useI18n();
  if (!effectName && !effectDesc1) return null;

  return (
    <section className="card p-4">
      <h3 className="after:hidden">{t('page.character.ee.effect')}</h3>

      {effectName && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-zinc-500/40 px-3 py-1">
          {effectIcon && (
            <div className="relative h-5 w-5 shrink-0">
              <Image src={`/images/ui/effect/${effectIcon}.webp`} alt={effectName ?? 'Effect'} fill sizes="20px" className="object-contain" />
            </div>
          )}
          <span className="text-sm text-buff">{effectName}</span>
        </div>
      )}

      <div className="mt-3 space-y-2 text-sm text-zinc-300">
        {effectDesc1 && <p><span className="text-zinc-500">T0 </span>{formatEffectText(effectDesc1)}</p>}
        {effectDesc4 && effectDesc4 !== effectDesc1 && (
          <p><span className="text-zinc-500">T4 </span>{formatEffectText(effectDesc4)}</p>
        )}
      </div>
    </section>
  );
}

function SourceSection({ source, boss, bossMap, lang }: {
  source?: string;
  boss?: string | string[];
  bossMap: BossDisplayMap;
  lang: Lang;
}) {
  const { t } = useI18n();
  if (!source && !boss) return null;

  return (
    <section>
      <h3>{t('equip.filter.source')}</h3>
      <div className="mt-2">
        <EquipmentSource source={source} boss={boss} bossMap={bossMap} lang={lang} linkable />
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

function ClassBadge({ classType }: { classType: string }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-1 rounded-full bg-zinc-700 px-2.5 py-0.5">
      <div className="relative h-4 w-4 shrink-0">
        <Image src={`/images/ui/class/CM_Class_${classType}.webp`} alt={classType} fill sizes="16px" className="object-contain" />
      </div>
      <span className="text-xs text-zinc-300">{t(`sys.class.${classType.toLowerCase()}` as Parameters<typeof t>[0])}</span>
    </div>
  );
}

function CharacterRefCard({ char }: { char: CharacterRef }) {
  const { href } = useI18n();
  const content = (
    <div className="card-interactive flex flex-col items-center gap-2 p-3">
      <CharacterPortrait id={char.id} name={char.name} size="md" showIcons />
      <div className="w-full text-center font-bold text-zinc-100">
        <FitText max={14} min={9}>{char.name}</FitText>
      </div>
    </div>
  );

  if (char.slug) {
    return <Link href={href(`/characters/${char.slug}`)}>{content}</Link>;
  }
  return content;
}
