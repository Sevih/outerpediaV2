import React from 'react';

/**
 * Parse game effect text with <color=#HEX>text</color> tags and line breaks.
 * Returns a ReactNode array suitable for inline rendering.
 */
export function formatEffectText(text: string): React.ReactNode {
  if (!text) return null;

  const parts: React.ReactNode[] = [];
  // Match <color=#HEX>text</color> (case insensitive)
  const regex = /<color=(#[0-9a-fA-F]{6})>(.*?)<\/color>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    // Text before the match
    if (match.index > lastIndex) {
      parts.push(...splitLineBreaks(text.slice(lastIndex, match.index), key));
      key += 10;
    }
    // Colored span
    parts.push(
      <span key={`c${key++}`} style={{ color: match[1] }}>
        {match[2]}
      </span>
    );
    lastIndex = regex.lastIndex;
  }

  // Remaining text after last match
  if (lastIndex < text.length) {
    parts.push(...splitLineBreaks(text.slice(lastIndex), key));
  }

  return parts.length === 1 ? parts[0] : parts;
}

/** Split text on \n and insert <br /> elements */
function splitLineBreaks(text: string, startKey: number): React.ReactNode[] {
  const lines = text.split(/\\n|\n/);
  const result: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) result.push(<br key={`br${startKey + i}`} />);
    if (lines[i]) result.push(lines[i]);
  }
  return result;
}

/**
 * Convert a string to kebab-case.
 */
export function toKebabCase(input: string): string {
  return input
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .toLowerCase();
}

/**
 * Get the rarity background image path.
 * Maps game rarities to TI_Slot_* images in /images/items/.
 */
export function getRarityBgPath(rarity: string): string {
  const map: Record<string, string> = {
    normal: 'Normal',
    superior: 'Magic',
    epic: 'Rare',
    legendary: 'Unique',
  };
  return `/images/items/TI_Slot_${map[rarity.toLowerCase()] ?? 'Normal'}.png`;
}
