'use client';

import { useMemo } from 'react';
import TurnOrderDisplay from '@/app/components/guides/TurnOrderDisplay';
import parseText from '@/lib/parse-text';
import type { NoteEntry } from '@/types/team';

type Variant = 'box' | 'inline';

type Props = {
  notes: NoteEntry[];
  localized?: NoteEntry[];
  variant?: Variant;
};

/**
 * Merge a base notes array with an optional localized array.
 *
 * Turn-order entries always come from the base array (they hold language-agnostic
 * data + an inner LangMap for the note). Text entries (`p`, `ul`) are pulled from
 * the localized array in order — i.e. the Nth text entry in localized overrides
 * the Nth text entry in base.
 */
function mergeNotes(base: NoteEntry[], localized?: NoteEntry[]): NoteEntry[] {
  if (!localized || localized.length === 0) return base;
  const localizedText = localized.filter((e) => e.type !== 'turn-order');
  let textIdx = 0;
  return base.map((entry) => {
    if (entry.type === 'turn-order') return entry;
    const override = localizedText[textIdx++];
    return override ?? entry;
  });
}

export default function TeamNotes({ notes, localized, variant = 'box' }: Props) {
  const merged = useMemo(() => mergeNotes(notes, localized), [notes, localized]);

  if (merged.length === 0) return null;

  const wrapperClass =
    variant === 'box'
      ? 'mt-4 space-y-2 rounded-lg border border-neutral-700 bg-neutral-800/50 p-4 text-sm text-zinc-300'
      : 'space-y-2 text-sm text-zinc-300';

  return (
    <div className={wrapperClass}>
      {merged.map((entry, i) => {
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
          return <TurnOrderDisplay key={i} order={entry.order} note={entry.note} />;
        }
        return null;
      })}
    </div>
  );
}
