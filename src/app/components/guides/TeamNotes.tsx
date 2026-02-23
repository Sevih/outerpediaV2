'use client';

import parseText from '@/lib/parse-text';
import type { NoteEntry } from '@/types/team';

type Props = {
  notes: NoteEntry[];
};

export default function TeamNotes({ notes }: Props) {
  if (notes.length === 0) return null;

  return (
    <div className="mt-4 space-y-2 rounded-lg border border-neutral-700 bg-neutral-800/50 p-4 text-sm text-zinc-300">
      {notes.map((entry, i) => {
        if (entry.type === 'p') {
          return <p key={i}>{parseText(entry.string)}</p>;
        }
        if (entry.type === 'ul') {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {entry.items.map((item, j) => (
                <li key={j}>{parseText(item)}</li>
              ))}
            </ul>
          );
        }
        if (entry.type === 'turn-order') {
          return (
            <div key={i} className="space-y-1">
              <div className="flex flex-wrap gap-3">
                {entry.order.map((o, j) => (
                  <span key={j} className="text-zinc-200">
                    {o.character}: <span className="text-sky-400">{o.speed}</span>
                  </span>
                ))}
              </div>
              {entry.note && <p className="text-xs text-zinc-400">{parseText(entry.note)}</p>}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
