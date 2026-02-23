'use client';

import RestrictionIcons from './RestrictionIcons';
import { useI18n } from '@/lib/contexts/I18nContext';

type TowerRestrictionTabsProps = {
  restrictionSets: string[][];
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export default function TowerRestrictionTabs({
  restrictionSets,
  value,
  onChange,
  className,
}: TowerRestrictionTabsProps) {
  const { t } = useI18n();

  return (
    <div className={className}>
      <p className="mb-2 text-xs text-zinc-400">{t('tower.select_set')}</p>
      <div className="flex flex-wrap gap-2" role="tablist">
        {restrictionSets.map((restrictions, i) => {
          const key = String(i);
          const isActive = key === value;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(key)}
              className={[
                'relative flex min-w-14 flex-col items-center gap-1 rounded px-3 py-1.5 text-sm font-medium transition-all',
                isActive
                  ? 'tab-game-active bg-linear-to-b from-amber-500/15 to-transparent text-amber-300 border-t-2 border-t-amber-400/60 border-x border-b border-amber-500/20 shadow-[0_2px_16px_rgba(251,191,36,0.1)]'
                  : 'border border-zinc-700/40 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 hover:border-zinc-600/30',
              ].join(' ')}
            >
              <span className={[
                'text-[10px] font-medium leading-none',
                isActive ? 'text-amber-400/70' : 'text-zinc-500',
              ].join(' ')}>
                {t('tower.set').replace('{n}', String(i + 1))}
              </span>
              {restrictions.length > 0 && (
                <RestrictionIcons restrictions={restrictions} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
