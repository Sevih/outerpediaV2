'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useI18n } from '@/lib/contexts/I18nContext';
import type { TranslationKey } from '@/i18n/locales/en';
import type { Lang } from '@/lib/i18n/config';
import type { Effect } from '@/types/effect';
import type { RoleType, SkillKey, ChainType, GiftType } from '@/types/enums';
import { CHAIN_TYPES, CHAIN_TYPE_LABELS, ROLES, GIFTS, GIFT_LABELS, SKILL_SOURCES } from '@/types/enums';
import { l } from '@/lib/i18n/localize';
import { FilterPill, FilterSelect } from '@/app/components/ui/FilterPills';
import type { FilterSelectOption } from '@/app/components/ui/FilterPills';
import { EffectGroupGrid } from './EffectGroupGrid';
import { LogicToggle, Eyebrow, TONE } from './FilterAtoms';

type TabKey = 'combat' | 'effects' | 'bonus' | 'tags';

type DrawerTagMeta = {
  label: string;
  image?: string;
  desc?: string;
  type: string;
} & Record<string, string | undefined>;

export type DrawerTagGroup = {
  type: string;
  items: { key: string; meta: DrawerTagMeta }[];
};

export type AdvancedFiltersPanelProps = {
  lang: Lang;

  // Combat
  chainFilter: string[];
  onToggleChain: (v: ChainType) => void;
  roleFilter: RoleType[];
  onToggleRole: (v: RoleType) => void;
  giftFilter: string[];
  onToggleGift: (v: GiftType) => void;

  // Effects
  buffGroups: { title: string; effects: string[] }[];
  debuffGroups: { title: string; effects: string[] }[];
  buffsMap: Map<string, Effect>;
  debuffsMap: Map<string, Effect>;
  selectedBuffs: string[];
  onToggleBuff: (v: string) => void;
  selectedDebuffs: string[];
  onToggleDebuff: (v: string) => void;
  effectLogic: 'AND' | 'OR';
  onEffectLogicChange: (v: 'AND' | 'OR') => void;
  effectsLoaded: boolean;

  // Sources
  sourceFilter: SkillKey[];
  onToggleSource: (v: SkillKey) => void;
  showUniqueEffects: boolean;
  onToggleShowUnique: () => void;

  // Team Bonus
  teamBonusFilter: string[];
  onSetTeamBonus: (v: string[]) => void;
  teamBonusOptions: FilterSelectOption[];

  // Tags
  tagGroups: DrawerTagGroup[];
  tagFilter: string[];
  onToggleTag: (v: string) => void;
  tagLogic: 'AND' | 'OR';
  onTagLogicChange: (v: 'AND' | 'OR') => void;
  tagsLoaded: boolean;
};

/**
 * The advanced-filters body (tab strip + active tab content), shared between
 * the mobile/tablet overlay drawer and the persistent xl+ sidebar. Holds its
 * own active-tab state; all filter state lives in the parent.
 */
export default function AdvancedFiltersPanel(props: AdvancedFiltersPanelProps) {
  const {
    lang,
    chainFilter, onToggleChain, roleFilter, onToggleRole, giftFilter, onToggleGift,
    buffGroups, debuffGroups, buffsMap, debuffsMap,
    selectedBuffs, onToggleBuff, selectedDebuffs, onToggleDebuff,
    effectLogic, onEffectLogicChange, effectsLoaded,
    sourceFilter, onToggleSource, showUniqueEffects, onToggleShowUnique,
    teamBonusFilter, onSetTeamBonus, teamBonusOptions,
    tagGroups, tagFilter, onToggleTag, tagLogic, onTagLogicChange, tagsLoaded,
  } = props;

  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabKey>('combat');

  const counts: Record<TabKey, number> = {
    combat: chainFilter.length + roleFilter.length + giftFilter.length,
    effects: selectedBuffs.length + selectedDebuffs.length + sourceFilter.length + (showUniqueEffects ? 1 : 0),
    bonus: teamBonusFilter.length,
    tags: tagFilter.length,
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'combat', label: t('characters.filters.tab.combat') },
    { key: 'effects', label: t('characters.filters.tab.effects') },
    { key: 'bonus', label: t('characters.filters.tab.bonus') },
    { key: 'tags', label: t('characters.filters.tab.tags') },
  ];

  return (
    <>
      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-zinc-800/80 px-3 py-2.5">
        {tabs.map(tab => {
          const on = tab.key === activeTab;
          const n = counts[tab.key];
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              aria-pressed={on}
              style={{
                background: on ? `${TONE.cyan}1f` : '#18181b',
                borderColor: on ? `${TONE.cyan}66` : '#27272a',
                color: on ? TONE.cyan : '#a1a1aa',
              }}
              className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs transition"
            >
              {tab.label}
              {n > 0 && (
                <span
                  style={{
                    background: on ? TONE.cyan : '#27272a',
                    color: on ? '#0a0a0a' : '#a1a1aa',
                  }}
                  className="rounded px-1.5 font-mono text-[9px] font-bold"
                >
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {activeTab === 'combat' && (
          <CombatTab
            chainFilter={chainFilter}
            onToggleChain={onToggleChain}
            roleFilter={roleFilter}
            onToggleRole={onToggleRole}
            giftFilter={giftFilter}
            onToggleGift={onToggleGift}
          />
        )}
        {activeTab === 'effects' && (
          <EffectsTab
            buffGroups={buffGroups}
            debuffGroups={debuffGroups}
            buffsMap={buffsMap}
            debuffsMap={debuffsMap}
            selectedBuffs={selectedBuffs}
            onToggleBuff={onToggleBuff}
            selectedDebuffs={selectedDebuffs}
            onToggleDebuff={onToggleDebuff}
            effectLogic={effectLogic}
            onEffectLogicChange={onEffectLogicChange}
            effectsLoaded={effectsLoaded}
            sourceFilter={sourceFilter}
            onToggleSource={onToggleSource}
            showUniqueEffects={showUniqueEffects}
            onToggleShowUnique={onToggleShowUnique}
            lang={lang}
          />
        )}
        {activeTab === 'bonus' && (
          <BonusTab
            value={teamBonusFilter[0] ?? null}
            onChange={v => onSetTeamBonus(v ? [v] : [])}
            options={teamBonusOptions}
          />
        )}
        {activeTab === 'tags' && (
          <TagsTab
            tagGroups={tagGroups}
            tagFilter={tagFilter}
            onToggleTag={onToggleTag}
            tagLogic={tagLogic}
            onTagLogicChange={onTagLogicChange}
            tagsLoaded={tagsLoaded}
            lang={lang}
          />
        )}
      </div>
    </>
  );
}

// ── Tab components ──

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 mt-3 text-xs uppercase tracking-wide text-zinc-300 first:mt-0">{children}</p>;
}

function CombatTab({
  chainFilter, onToggleChain,
  roleFilter, onToggleRole,
  giftFilter, onToggleGift,
}: {
  chainFilter: string[]; onToggleChain: (v: ChainType) => void;
  roleFilter: RoleType[]; onToggleRole: (v: RoleType) => void;
  giftFilter: string[]; onToggleGift: (v: GiftType) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>{t('characters.filters.chains')}</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {CHAIN_TYPES.map(c => (
            <FilterPill
              key={c}
              active={chainFilter.includes(c)}
              onClick={() => onToggleChain(c)}
              className="h-8 px-3"
            >
              {t(`characters.chains.${CHAIN_TYPE_LABELS[c].toLowerCase()}` as TranslationKey)}
            </FilterPill>
          ))}
        </div>
      </div>
      <div>
        <SectionLabel>{t('characters.filters.roles')}</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {ROLES.map(r => (
            <FilterPill
              key={r}
              active={roleFilter.includes(r)}
              onClick={() => onToggleRole(r)}
              className="h-8 px-3"
            >
              {t(`filters.roles.${r}`)}
            </FilterPill>
          ))}
        </div>
      </div>
      <div>
        <SectionLabel>{t('characters.filters.gifts')}</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {GIFTS.map(g => (
            <FilterPill
              key={g}
              active={giftFilter.includes(g)}
              onClick={() => onToggleGift(g)}
              className="h-8 px-3"
            >
              {t(`characters.gifts.${GIFT_LABELS[g]}` as TranslationKey)}
            </FilterPill>
          ))}
        </div>
      </div>
    </div>
  );
}

function EffectsTab({
  buffGroups, debuffGroups, buffsMap, debuffsMap,
  selectedBuffs, onToggleBuff, selectedDebuffs, onToggleDebuff,
  effectLogic, onEffectLogicChange, effectsLoaded,
  sourceFilter, onToggleSource, showUniqueEffects, onToggleShowUnique,
  lang,
}: {
  buffGroups: { title: string; effects: string[] }[];
  debuffGroups: { title: string; effects: string[] }[];
  buffsMap: Map<string, Effect>;
  debuffsMap: Map<string, Effect>;
  selectedBuffs: string[]; onToggleBuff: (v: string) => void;
  selectedDebuffs: string[]; onToggleDebuff: (v: string) => void;
  effectLogic: 'AND' | 'OR'; onEffectLogicChange: (v: 'AND' | 'OR') => void;
  effectsLoaded: boolean;
  sourceFilter: SkillKey[]; onToggleSource: (v: SkillKey) => void;
  showUniqueEffects: boolean; onToggleShowUnique: () => void;
  lang: Lang;
}) {
  const { t } = useI18n();

  if (!effectsLoaded) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-zinc-500">
        {t('characters.loading')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Eyebrow>{t('characters.filters.match_logic')}</Eyebrow>
        <LogicToggle value={effectLogic} onChange={onEffectLogicChange} />
      </div>

      {/* Source filter — narrows where the buff/debuff must come from */}
      <div>
        <SectionLabel>{t('characters.filters.sources.filterBySource')}</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {SKILL_SOURCES.map(source => (
            <FilterPill
              key={source.key}
              active={sourceFilter.includes(source.key)}
              onClick={() => onToggleSource(source.key)}
              className="h-8 px-2.5 text-xs"
            >
              {t(source.labelKey as TranslationKey)}
            </FilterPill>
          ))}
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 transition hover:border-zinc-700">
        <input
          type="checkbox"
          checked={showUniqueEffects}
          onChange={onToggleShowUnique}
          className="size-4 accent-cyan-500"
        />
        <span className="flex-1 text-sm text-zinc-200">{t('characters.filters.unique')}</span>
      </label>

      <div>
        <p className="mb-2 text-center text-xs uppercase tracking-wide text-cyan-300">
          {t('characters.filters.buffs')}
        </p>
        <EffectGroupGrid
          groups={buffGroups}
          effectsMap={buffsMap}
          selected={selectedBuffs}
          type="buff"
          lang={lang}
          onToggle={onToggleBuff}
          className="grid-cols-1 gap-3 sm:grid-cols-2"
        />
      </div>

      <div className="border-t border-zinc-800" />

      <div>
        <p className="mb-2 text-center text-xs uppercase tracking-wide text-red-300">
          {t('characters.filters.debuffs')}
        </p>
        <EffectGroupGrid
          groups={debuffGroups}
          effectsMap={debuffsMap}
          selected={selectedDebuffs}
          type="debuff"
          lang={lang}
          onToggle={onToggleDebuff}
          className="grid-cols-1 gap-3 sm:grid-cols-2"
        />
      </div>
    </div>
  );
}

function BonusTab({
  value, onChange, options,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  options: FilterSelectOption[];
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      <SectionLabel>{t('characters.filters.teamBonus')}</SectionLabel>
      <FilterSelect
        placeholder={t('common.all')}
        options={options}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

function TagsTab({
  tagGroups, tagFilter, onToggleTag, tagLogic, onTagLogicChange, tagsLoaded, lang,
}: {
  tagGroups: DrawerTagGroup[];
  tagFilter: string[];
  onToggleTag: (v: string) => void;
  tagLogic: 'AND' | 'OR';
  onTagLogicChange: (v: 'AND' | 'OR') => void;
  tagsLoaded: boolean;
  lang: Lang;
}) {
  const { t } = useI18n();

  if (!tagsLoaded) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-zinc-500">
        {t('characters.loading')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Eyebrow>{t('characters.filters.match_logic')}</Eyebrow>
        <LogicToggle value={tagLogic} onChange={onTagLogicChange} tone={TONE.indigo} />
      </div>
      {tagGroups.map(group => (
        <div key={group.type}>
          <p className="mb-2 text-xs uppercase tracking-wide text-zinc-400">
            {t(`characters.tags.types.${group.type}` as TranslationKey)}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.items.map(({ key, meta }) => (
              <FilterPill
                key={key}
                title={meta.desc ? l(meta, 'desc', lang) : undefined}
                active={tagFilter.includes(key)}
                onClick={() => onToggleTag(key)}
                className="h-8 gap-1.5 px-2.5"
              >
                {meta.image && (
                  <span className="relative size-4 shrink-0">
                    <Image src={meta.image} alt="" fill sizes="16px" className="object-contain" />
                  </span>
                )}
                <span>{l(meta, 'label', lang)}</span>
              </FilterPill>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
