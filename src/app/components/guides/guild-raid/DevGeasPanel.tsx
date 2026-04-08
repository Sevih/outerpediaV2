'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { Lang } from '@/lib/i18n/config';
import type { GeasUnlock, GeasPool } from '@/types/guild-raid';

type Props = {
  geasA: Record<string, GeasUnlock>;
  geasB: Record<string, GeasUnlock>;
  pool: GeasPool;
};

function geasLabel(id: number, pool: GeasPool, lang: Lang): string {
  const g = pool[String(id)];
  if (!g) return `???`;
  return lRec(g.text, lang);
}

type Toggler = (id: number, kind: 'bonus' | 'malus') => void;

function BossSection({ label, geas, pool, lang, selBonus, selMalus, toggle }: {
  label: string;
  geas: Record<string, GeasUnlock>;
  pool: GeasPool;
  lang: Lang;
  selBonus: Set<number>;
  selMalus: Set<number>;
  toggle: Toggler;
}) {
  const slots = Object.keys(geas).sort((a, b) => Number(a) - Number(b));
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-bold text-amber-300">{label}</p>
      <table className="w-full border-collapse text-[10px] leading-snug">
        <thead>
          <tr className="text-left text-[9px] uppercase tracking-wider text-zinc-500">
            <th className="border-b border-zinc-700 px-1 py-1 font-semibold">Id</th>
            <th className="border-b border-zinc-700 px-1 py-1 font-semibold">Bonus</th>
            <th className="border-b border-zinc-700 px-1 py-1 font-semibold">Slot</th>
            <th className="border-b border-zinc-700 px-1 py-1 font-semibold">Id</th>
            <th className="border-b border-zinc-700 px-1 py-1 font-semibold">Malus</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => {
            const { bonus, malus } = geas[slot];
            const bOn = selBonus.has(bonus);
            const mOn = selMalus.has(malus);
            return (
              <tr key={slot} className="border-b border-zinc-800/70 last:border-b-0">
                <td
                  onClick={() => toggle(bonus, 'bonus')}
                  className={`cursor-pointer px-1 py-1 font-mono ${bOn ? 'bg-emerald-500/30 text-emerald-200' : 'text-amber-300 hover:bg-zinc-800/60'}`}
                >
                  {bonus}
                </td>
                <td
                  onClick={() => toggle(bonus, 'bonus')}
                  className={`cursor-pointer px-1 py-1 ${bOn ? 'bg-emerald-500/30 text-emerald-200' : 'text-emerald-300 hover:bg-zinc-800/60'}`}
                >
                  {geasLabel(bonus, pool, lang)}
                </td>
                <td className="px-1 py-1 text-center font-semibold text-zinc-400">{slot}</td>
                <td
                  onClick={() => toggle(malus, 'malus')}
                  className={`cursor-pointer px-1 py-1 font-mono ${mOn ? 'bg-red-500/30 text-red-200' : 'text-amber-300 hover:bg-zinc-800/60'}`}
                >
                  {malus}
                </td>
                <td
                  onClick={() => toggle(malus, 'malus')}
                  className={`cursor-pointer px-1 py-1 ${mOn ? 'bg-red-500/30 text-red-200' : 'text-red-300 hover:bg-zinc-800/60'}`}
                >
                  {geasLabel(malus, pool, lang)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function DevGeasPanel({ geasA, geasB, pool }: Props) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [selBonus, setSelBonus] = useState<Set<number>>(new Set());
  const [selMalus, setSelMalus] = useState<Set<number>>(new Set());

  if (process.env.NODE_ENV !== 'development') return null;

  const toggle: Toggler = (id, kind) => {
    const setter = kind === 'bonus' ? setSelBonus : setSelMalus;
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearAll = () => {
    setSelBonus(new Set());
    setSelMalus(new Set());
  };

  const snippet = `"geasActive": {
  "bonus": [${[...selBonus].join(',')}],
  "malus": [${[...selMalus].join(',')}]
},`;

  const copy = () => {
    navigator.clipboard?.writeText(snippet);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-50 rounded-full bg-amber-500 px-3 py-2 text-xs font-bold text-black shadow-lg ring-2 ring-amber-300/50 hover:bg-amber-400"
        title="Dev — Geas IDs"
      >
        {open ? '×' : 'Geas'}
      </button>

      {open && (
        <div className="fixed bottom-16 right-4 z-50 max-h-[80vh] w-md overflow-y-auto rounded-lg border border-amber-500/30 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-amber-400">
            Dev — Geas IDs
          </p>
          <div className="space-y-3">
            <BossSection
              label="Boss A"
              geas={geasA}
              pool={pool}
              lang={lang}
              selBonus={selBonus}
              selMalus={selMalus}
              toggle={toggle}
            />
            <BossSection
              label="Boss B"
              geas={geasB}
              pool={pool}
              lang={lang}
              selBonus={selBonus}
              selMalus={selMalus}
              toggle={toggle}
            />
          </div>

          <div className="mt-3 border-t border-zinc-700 pt-2">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                geasActive snippet
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={copy}
                  className="rounded bg-amber-500 px-2 py-0.5 text-[9px] font-bold text-black hover:bg-amber-400"
                >
                  Copy
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  className="rounded bg-zinc-700 px-2 py-0.5 text-[9px] font-bold text-zinc-200 hover:bg-zinc-600"
                >
                  Clear
                </button>
              </div>
            </div>
            <pre className="overflow-x-auto rounded bg-zinc-900 p-2 text-[10px] text-zinc-200">
              {snippet}
            </pre>
          </div>
        </div>
      )}
    </>
  );
}
