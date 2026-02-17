'use client';

import { useState } from 'react';
import { formatEffectText } from '@/lib/format-text';
import type { Transcendence } from '@/types/character';
import type { Lang } from '@/lib/i18n/config';
import { useI18n } from '@/lib/contexts/I18nContext';

type Props = {
  transcend: Transcendence;
};

const LEVELS = ['1', '2', '3', '4', '5', '6'] as const;

function getTranscendDesc(transcend: Transcendence, level: string, lang: Lang): string | null {
  if (lang === 'en') return transcend[level] ?? null;
  const localized = transcend[`${level}_${lang}`];
  return (localized as string) ?? transcend[level] ?? null;
}

export default function TranscendenceSlider({ transcend }: Props) {
  const { lang } = useI18n();
  const [selected, setSelected] = useState('6');
  const desc = getTranscendDesc(transcend, selected, lang);

  return (
    <div>
      {/* Level buttons */}
      <div className="mb-3 flex items-center gap-1">
        {LEVELS.map((lv) => {
          const hasDesc = getTranscendDesc(transcend, lv, lang);
          return (
            <button
              key={lv}
              onClick={() => setSelected(lv)}
              className={[
                'rounded px-3 py-1 text-sm font-semibold transition',
                lv === selected
                  ? 'bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-400/40'
                  : hasDesc
                    ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    : 'bg-zinc-800/50 text-zinc-600',
              ].join(' ')}
              disabled={!hasDesc}
            >
              {lv}
            </button>
          );
        })}
      </div>

      {/* Description */}
      <div className="min-h-16 rounded-lg border border-white/5 bg-zinc-900/50 p-3 text-sm leading-relaxed text-zinc-200">
        {desc ? formatEffectText(desc) : <span className="text-zinc-500">—</span>}
      </div>
    </div>
  );
}
