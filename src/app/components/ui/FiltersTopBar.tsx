'use client';

import type { ElementType, RarityType, ClassType, RoleType } from '@/types/enums';
import { ELEMENTS, CLASSES, RARITIES, ROLES } from '@/types/enums';
import { useI18n } from '@/lib/contexts/I18nContext';
import { FilterSearch, FilterPill } from './FilterPills';
import { ElementIconPill, ClassIconPill, StarPill } from '@/app/components/characters/filters/FilterAtoms';

type Props = {
  query: string;
  onQueryChange: (v: string) => void;
  placeholder?: string;

  /** When provided, renders the element icon row. */
  elementFilter?: string[];
  onToggleElement?: (v: ElementType) => void;

  /** When provided, renders the class icon row. */
  classFilter?: string[];
  onToggleClass?: (v: ClassType) => void;

  /** When provided, renders the rarity stars row. */
  rarityFilter?: RarityType[];
  onToggleRarity?: (v: RarityType) => void;

  /** When provided, renders the role pills row. */
  roleFilter?: RoleType[];
  onToggleRole?: (v: RoleType) => void;

  /** Extra controls rendered at the end of the bar (sort, view density, etc.). */
  trailing?: React.ReactNode;
};

/**
 * Compact top toolbar for filter-heavy pages.
 * Search on the left, then each filter group is a labeled column.
 * Wraps to multiple rows on narrow viewports.
 */
export default function FiltersTopBar({
  query, onQueryChange, placeholder,
  elementFilter, onToggleElement,
  classFilter, onToggleClass,
  rarityFilter, onToggleRarity,
  roleFilter, onToggleRole,
  trailing,
}: Props) {
  const { t } = useI18n();
  const showElements = elementFilter && onToggleElement;
  const showClasses = classFilter && onToggleClass;
  const showRarities = rarityFilter && onToggleRarity;
  const showRoles = roleFilter && onToggleRole;

  return (
    <div className="flex flex-wrap items-end justify-center gap-x-4 gap-y-3 rounded-xl border border-zinc-800 bg-slate-800/50 px-3 py-2.5 backdrop-blur-sm md:justify-start">
      <div className="w-full md:w-72">
        <FilterSearch value={query} onChange={onQueryChange} placeholder={placeholder} />
      </div>

      {showElements && (
        <>
          <FilterBarDivider />
          <FilterBarGroup label={t('filters.elements')}>
            {ELEMENTS.map(el => (
              <ElementIconPill
                key={el}
                element={el}
                active={elementFilter!.includes(el)}
                onClick={() => onToggleElement!(el)}
              />
            ))}
          </FilterBarGroup>
        </>
      )}

      {showClasses && (
        <>
          <FilterBarDivider />
          <FilterBarGroup label={t('filters.classes')}>
            {CLASSES.map(cls => (
              <ClassIconPill
                key={cls}
                classType={cls}
                active={classFilter!.includes(cls)}
                onClick={() => onToggleClass!(cls)}
              />
            ))}
          </FilterBarGroup>
        </>
      )}

      {showRarities && (
        <>
          <FilterBarDivider />
          <FilterBarGroup label={t('filters.rarity')}>
            {RARITIES.map(r => (
              <StarPill
                key={r}
                stars={r}
                active={rarityFilter!.includes(r)}
                onClick={() => onToggleRarity!(r)}
              />
            ))}
          </FilterBarGroup>
        </>
      )}

      {showRoles && (
        <>
          <FilterBarDivider />
          <FilterBarGroup label={t('characters.filters.roles')}>
            {ROLES.map(r => (
              <FilterPill
                key={r}
                active={roleFilter!.includes(r)}
                onClick={() => onToggleRole!(r)}
                className="h-8 px-3"
              >
                {t(`filters.roles.${r}`)}
              </FilterPill>
            ))}
          </FilterBarGroup>
        </>
      )}

      {trailing && <div className="flex items-end gap-2 md:ml-auto">{trailing}</div>}
    </div>
  );
}

export function FilterBarDivider() {
  return <span className="hidden h-9 w-px self-end bg-zinc-700/70 md:block" aria-hidden />;
}

export function FilterBarGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-center font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
        {label}
      </span>
      <div className="flex flex-wrap items-center justify-center gap-1">
        {children}
      </div>
    </div>
  );
}
