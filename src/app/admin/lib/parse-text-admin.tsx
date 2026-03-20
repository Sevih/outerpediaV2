import React from 'react';
import buffsData from '@data/effects/buffs.json';
import debuffsData from '@data/effects/debuffs.json';

/**
 * Lightweight parseText for admin pages — no I18nProvider dependency.
 * Renders inline tags as simple styled spans with real effect names.
 */

// Build effect lookup: BT_* → label
const effectLabels: Record<string, string> = {};
for (const e of buffsData as { name: string; label: string }[]) effectLabels[e.name] = e.label;
for (const e of debuffsData as { name: string; label: string }[]) effectLabels[e.name] = e.label;

const TAG_STYLES: Record<string, string> = {
  B: 'text-green-400 font-medium',       // buff
  D: 'text-red-400 font-medium',         // debuff
  E: 'text-amber-400 font-medium',       // element
  C: 'text-blue-400 font-medium',        // class
  S: 'text-purple-400 font-medium',      // stat
  P: 'text-cyan-400 font-medium',        // character
  EE: 'text-orange-400 font-medium',     // exclusive equipment
  AS: 'text-teal-400 font-medium',       // armor set
  SK: 'text-pink-400 font-medium',       // skill
  'I-W': 'text-yellow-400 font-medium',  // weapon
  'I-A': 'text-yellow-400 font-medium',  // amulet
  'I-T': 'text-yellow-400 font-medium',  // talisman
  'I-I': 'text-yellow-400 font-medium',  // item
};

const TAG_REGEX = /\{((?:[BDSCEP])|EE|AS|SK|I-(?:W|A|T|I))\/([^}]+)\}/g;

function formatValue(type: string, value: string): string {
  // Buffs/debuffs → use real label from effects data
  if (type === 'B' || type === 'D') {
    return effectLabels[value] ?? value;
  }
  // Class|subclass → just show first part
  if (type === 'C' && value.includes('|')) return value.split('|')[0];
  // SK: character|skill → Character S1
  if (type === 'SK' && value.includes('|')) {
    const [char, skill] = value.split('|');
    return `${char} ${skill}`;
  }
  return value;
}

export default function parseTextAdmin(text: string): React.ReactNode {
  if (!text) return null;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  TAG_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TAG_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const [, tagType, value] = match;
    const style = TAG_STYLES[tagType] ?? 'text-zinc-300';
    const display = formatValue(tagType, value);

    parts.push(
      <span key={key++} className={style} title={value}>
        {display}
      </span>
    );

    lastIndex = TAG_REGEX.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 0 ? null : parts.length === 1 ? parts[0] : parts;
}
