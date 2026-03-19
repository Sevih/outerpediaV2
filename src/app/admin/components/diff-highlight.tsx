'use client';

import type { ReactNode } from 'react';

/** Strip <color> tags for clean diffing */
function stripTags(s: string): string {
  return s.replace(/<\/?color[^>]*>/g, '');
}

/**
 * Word-level diff: returns marks array (true = changed) for each word.
 */
function diffWords(aWords: string[], bWords: string[]): [boolean[], boolean[]] {
  const aMarks: boolean[] = new Array(aWords.length).fill(false);
  const bMarks: boolean[] = new Array(bWords.length).fill(false);

  let ai = 0, bi = 0;
  const max = Math.max(aWords.length, bWords.length);
  while (ai < aWords.length || bi < bWords.length) {
    if (ai < aWords.length && bi < bWords.length && aWords[ai] === bWords[bi]) {
      ai++; bi++;
    } else {
      let foundA = -1, foundB = -1;
      for (let look = 1; look < Math.min(20, max); look++) {
        if (foundA === -1 && bi + look < bWords.length && aWords[ai] === bWords[bi + look]) foundA = look;
        if (foundB === -1 && ai + look < aWords.length && aWords[ai + look] === bWords[bi]) foundB = look;
        if (foundA !== -1 || foundB !== -1) break;
      }
      if (foundA !== -1 && (foundB === -1 || foundA <= foundB)) {
        for (let j = 0; j < foundA; j++) bMarks[bi + j] = true;
        bi += foundA;
      } else if (foundB !== -1) {
        for (let j = 0; j < foundB; j++) aMarks[ai + j] = true;
        ai += foundB;
      } else {
        if (ai < aWords.length) { aMarks[ai] = true; ai++; }
        if (bi < bWords.length) { bMarks[bi] = true; bi++; }
      }
    }
  }

  return [aMarks, bMarks];
}

/**
 * Render original text (with color tags) applying diff highlights.
 * Uses the stripped-text word marks to decide which characters are highlighted.
 */
function renderWithDiffHighlight(
  original: string,
  words: string[],
  marks: boolean[],
  diffClass: string,
  sameClass: string,
): ReactNode[] {
  // Build a per-character diff flag based on stripped text positions
  const stripped = stripTags(original);
  const charDiff: boolean[] = new Array(stripped.length).fill(false);

  let pos = 0;
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    // Find word position in stripped text from current pos
    const idx = stripped.indexOf(word, pos);
    if (idx >= 0) {
      if (marks[i]) {
        for (let j = idx; j < idx + word.length; j++) charDiff[j] = true;
      }
      pos = idx + word.length;
    }
  }

  // Now walk through original text, rendering with color tags and diff highlights
  const result: ReactNode[] = [];
  let key = 0;
  let strippedIdx = 0; // position in stripped text
  let currentColor: string | null = null;

  let i = 0;
  while (i < original.length) {
    // Check for opening color tag
    const openMatch = original.slice(i).match(/^<color=(#[0-9a-fA-F]{3,8})>/);
    if (openMatch) {
      currentColor = openMatch[1];
      i += openMatch[0].length;
      continue;
    }
    // Check for closing color tag
    if (original.slice(i, i + 8) === '</color>') {
      currentColor = null;
      i += 8;
      continue;
    }

    // Regular character — collect a run of same-style characters
    const isDiff = charDiff[strippedIdx] ?? false;
    const color = currentColor;
    let run = original[i];
    i++;
    strippedIdx++;

    while (i < original.length) {
      // Stop at tags
      if (original[i] === '<') break;
      const nextDiff = charDiff[strippedIdx] ?? false;
      if (nextDiff !== isDiff) break;
      run += original[i];
      i++;
      strippedIdx++;
    }

    const cls = isDiff ? diffClass : sameClass;
    if (color) {
      result.push(<span key={key++} className={cls} style={{ color }}>{run}</span>);
    } else {
      result.push(<span key={key++} className={cls}>{run}</span>);
    }
  }

  return result;
}

export function DiffHighlight({ existing, extracted }: { existing: string; extracted: string }) {
  const aStripped = stripTags(existing);
  const bStripped = stripTags(extracted);

  const aWords = aStripped.split(/(\s+)/);
  const bWords = bStripped.split(/(\s+)/);

  const [aMarks, bMarks] = diffWords(aWords, bWords);

  const delClass = 'bg-red-500/30 text-red-200';
  const addClass = 'bg-green-500/30 text-green-200';
  const sameClass = 'text-zinc-400';

  return (
    <div className="space-y-1.5">
      <div className="rounded bg-red-950/30 px-2 py-1.5 text-xs leading-relaxed whitespace-pre-wrap break-all">
        <span className="mr-1.5 font-semibold text-red-400/70">existing</span>
        {renderWithDiffHighlight(existing, aWords, aMarks, delClass, sameClass)}
      </div>
      <div className="rounded bg-green-950/30 px-2 py-1.5 text-xs leading-relaxed whitespace-pre-wrap break-all">
        <span className="mr-1.5 font-semibold text-green-400/70">extracte</span>
        {renderWithDiffHighlight(extracted, bWords, bMarks, addClass, sameClass)}
      </div>
    </div>
  );
}
