'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type { Effect } from '@/types/effect';
import type { Lang } from '@/lib/i18n/config';
import type { TranslationKey } from '@/i18n/locales/en';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import EffectIcon from '@/app/components/character/EffectIcon';

type EffectGroup = { title: string; effects: string[] };

export function CheckboxSelect({
  title, effects, effectsMap, selected, type, lang, onToggle,
}: {
  title: string;
  effects: string[];
  effectsMap: Map<string, Effect>;
  selected: string[];
  type: 'buff' | 'debuff';
  lang: Lang;
  onToggle: (effectKey: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const count = effects.filter(k => selected.includes(k)).length;
  const border = type === 'buff' ? 'ring-cyan-500/50' : 'ring-red-500/50';
  const accent = type === 'buff' ? 'accent-cyan-500' : 'accent-red-500';
  const color = type === 'buff' ? 'text-cyan-300' : 'text-red-300';

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex w-full items-center justify-between rounded-lg bg-zinc-800 px-3 py-2 text-sm ring-1 ${open ? border : 'ring-zinc-700'}`}
      >
        <span className={`font-semibold ${color}`}>{title}</span>
        <span className="flex items-center gap-1.5">
          {count > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${type === 'buff' ? 'bg-cyan-500/30 text-cyan-300' : 'bg-red-500/30 text-red-300'}`}>
              {count}
            </span>
          )}
          <svg className={`h-4 w-4 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="absolute z-40 mt-1 max-h-60 w-full overflow-y-auto rounded-lg bg-zinc-800 shadow-xl ring-1 ring-zinc-600">
          {effects.map(effectKey => {
            const effect = effectsMap.get(effectKey);
            if (!effect) return null;
            const effectLabel = l(effect, 'label', lang);
            const isIrremovable = effect.icon.includes('Interruption');
            const imageFilter = isIrremovable ? '' : `${type}-icon`;
            const checked = selected.includes(effectKey);
            return (
              <label
                key={effectKey}
                className={`flex cursor-pointer select-none items-center gap-2 px-3 py-1.5 transition ${checked ? 'bg-zinc-700/60' : 'hover:bg-zinc-700/30'}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(effectKey)}
                  className={`${accent} size-4 shrink-0`}
                />
                <span className="relative size-5 shrink-0 rounded bg-black">
                  <Image
                    src={`/images/ui/effect/${effect.icon}.webp`}
                    alt={effectLabel}
                    fill
                    sizes="20px"
                    className={`object-contain ${imageFilter}`}
                  />
                </span>
                <span className="text-xs text-zinc-200">{effectLabel}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function EffectGroupGrid({
  groups, effectsMap, selected, type, lang, onToggle, className,
}: {
  groups: EffectGroup[];
  effectsMap: Map<string, Effect>;
  selected: string[];
  type: 'buff' | 'debuff';
  lang: Lang;
  onToggle: (effectKey: string) => void;
  className: string;
}) {
  const { t } = useI18n();
  const color = type === 'buff' ? 'text-cyan-300' : 'text-red-300';
  return (
    <>
      {/* Desktop: icon grid */}
      <div className={`hidden md:grid ${className}`}>
        {groups.map((group, i) => (
          <div key={`${type}-${i}`} className="rounded-xl bg-zinc-800/40 p-2 ring-1 ring-zinc-700">
            <p className={`mb-2 text-center font-semibold ${color}`}>
              {t(group.title as TranslationKey)}
            </p>
            <div className="grid grid-cols-7 justify-items-center gap-1">
              {group.effects.map(effectKey => {
                const effect = effectsMap.get(effectKey);
                if (!effect) return null;
                return (
                  <EffectIcon
                    key={effectKey}
                    effect={effect}
                    type={type}
                    lang={lang}
                    selected={selected.includes(effectKey)}
                    onClick={() => onToggle(effectKey)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Mobile: checkbox select dropdowns */}
      <div className="space-y-1.5 md:hidden">
        {groups.map((group, i) => (
          <CheckboxSelect
            key={`${type}-m-${i}`}
            title={t(group.title as TranslationKey)}
            effects={group.effects}
            effectsMap={effectsMap}
            selected={selected}
            type={type}
            lang={lang}
            onToggle={onToggle}
          />
        ))}
      </div>
    </>
  );
}
