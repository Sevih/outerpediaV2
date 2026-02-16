import React from 'react';
import ElementInline from '@/app/components/inline/ElementInline';
import ClassInline from '@/app/components/inline/ClassInline';
import StatInline from '@/app/components/inline/StatInline';
import EffectInline from '@/app/components/inline/EffectInline';
import CharacterInline from '@/app/components/inline/CharacterInline';
import WeaponInline from '@/app/components/inline/WeaponInline';
import AmuletInline from '@/app/components/inline/AmuletInline';
import TalismanInline from '@/app/components/inline/TalismanInline';
import SetInline from '@/app/components/inline/SetInline';
import EeInline from '@/app/components/inline/EeInline';
import ItemInline from '@/app/components/inline/ItemInline';
import SkillInline from '@/app/components/inline/SkillInline';

type SkillShorthand = 'S1' | 'S2' | 'S3' | 'Passive' | 'Chain';

/** Tag type → component factory */
const TAG_MAP: Record<string, (value: string, key: number) => React.ReactNode> = {
  B: (v, k) => <EffectInline key={k} name={v} type="buff" />,
  D: (v, k) => <EffectInline key={k} name={v} type="debuff" />,
  E: (v, k) => <ElementInline key={k} element={v} />,
  C: (v, k) => {
    const [name, subclass] = v.split('|');
    return <ClassInline key={k} name={name} subclass={subclass} />;
  },
  S: (v, k) => <StatInline key={k} name={v} />,
  P: (v, k) => <CharacterInline key={k} name={v} />,
  EE: (v, k) => <EeInline key={k} name={v} />,
  AS: (v, k) => <SetInline key={k} name={v} />,
  SK: (v, k) => {
    const [character, skill] = v.split('|');
    return <SkillInline key={k} character={character} skill={skill as SkillShorthand} />;
  },
  'I-W': (v, k) => <WeaponInline key={k} name={v} />,
  'I-A': (v, k) => <AmuletInline key={k} name={v} />,
  'I-T': (v, k) => <TalismanInline key={k} name={v} />,
  'I-I': (v, k) => <ItemInline key={k} name={v} />,
};

/**
 * Tag regex: matches {TYPE/value} patterns.
 * Supported: B, D, E, C, S, P, EE, AS, SK, I-W, I-A, I-T, I-I
 */
const TAG_REGEX = /\{((?:[BDSCEP])|EE|AS|SK|I-(?:W|A|T|I))\/([^}]+)\}/g;

/**
 * Parse text containing inline tags and line breaks into React nodes.
 *
 * Tags: {B/name}, {D/name}, {E/element}, {C/class}, {C/class|subclass},
 *       {S/stat}, {P/character}, {EE/character}, {AS/setname},
 *       {SK/character|S1}, {I-W/weapon}, {I-A/amulet}, {I-T/talisman}, {I-I/item}
 */
export default function parseText(text: string): React.ReactNode {
  if (!text) return null;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  // Reset regex state
  TAG_REGEX.lastIndex = 0;

  while ((match = TAG_REGEX.exec(text)) !== null) {
    // Text before the tag
    if (match.index > lastIndex) {
      parts.push(...splitLineBreaks(text.slice(lastIndex, match.index), key));
      key += 100;
    }

    const [, tagType, value] = match;
    const factory = TAG_MAP[tagType];

    if (factory) {
      parts.push(factory(value, key++));
    } else {
      // Unknown tag - render as-is
      parts.push(<span key={key++} className="text-red-500">{match[0]}</span>);
    }

    lastIndex = TAG_REGEX.lastIndex;
  }

  // Remaining text after last tag
  if (lastIndex < text.length) {
    parts.push(...splitLineBreaks(text.slice(lastIndex), key));
  }

  return parts.length === 0 ? null : parts.length === 1 ? parts[0] : parts;
}

/** Split text on line breaks and insert <br /> elements */
function splitLineBreaks(text: string, startKey: number): React.ReactNode[] {
  const lines = text.split(/\\n|\r?\n/);
  const result: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) result.push(<br key={`br${startKey + i}`} />);
    if (lines[i]) result.push(lines[i]);
  }
  return result;
}
