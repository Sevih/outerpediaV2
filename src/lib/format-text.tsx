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
 * Format an effect description, highlighting numbers that scaled between two tiers.
 * Compares `baseDesc` (e.g. tier 1) with `desc` (e.g. tier 4) and wraps changed
 * numbers with #28d9ed color. Falls back to `formatEffectText` when no base is given.
 */
export function formatScaledEffect(
  desc: string,
  baseDesc?: string | null,
): React.ReactNode {
  if (!desc) return null;
  if (!baseDesc) return formatEffectText(desc);

  // Extract "real" numbers with surrounding +/-/% (skip digits inside <color=#HEX> attributes)
  const numTokenRe = /<color=[^>]*>|<\/color>|([+-]?\d+(?:\.\d+)?%?)/gi;

  function extractNumbers(s: string): string[] {
    const nums: string[] = [];
    let m: RegExpExecArray | null;
    const re = new RegExp(numTokenRe.source, numTokenRe.flags);
    while ((m = re.exec(s)) !== null) {
      if (m[1] !== undefined) nums.push(m[1]);
    }
    return nums;
  }

  const descNums = extractNumbers(desc);
  const baseNums = extractNumbers(baseDesc);

  if (descNums.length !== baseNums.length) return formatEffectText(desc);

  const changed = new Set<number>();
  for (let i = 0; i < descNums.length; i++) {
    if (descNums[i] !== baseNums[i]) changed.add(i);
  }

  if (changed.size === 0) return formatEffectText(desc);

  // Rebuild desc, wrapping changed numbers in <color=#28d9ed>
  let result = '';
  let lastIdx = 0;
  let numIdx = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(numTokenRe.source, numTokenRe.flags);

  while ((m = re.exec(desc)) !== null) {
    if (m[1] !== undefined) {
      result += desc.slice(lastIdx, m.index);
      result += changed.has(numIdx)
        ? `<color=#28d9ed>${m[1]}</color>`
        : m[1];
      lastIdx = re.lastIndex;
      numIdx++;
    }
  }
  result += desc.slice(lastIdx);

  return formatEffectText(result);
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
 * Maps game rarities to TI_Slot_* images in /images/ui/bg/.
 */
export function getRarityBgPath(rarity: string): string {
  const map: Record<string, string> = {
    normal: 'Normal',
    superior: 'Magic',
    epic: 'Rare',
    legendary: 'Unique',
  };
  return `/images/ui/bg/TI_Slot_${map[rarity.toLowerCase()] ?? 'Normal'}.webp`;
}
