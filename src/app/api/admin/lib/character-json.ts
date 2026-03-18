/**
 * Shared key ordering and serialization for character JSON files.
 * Used by both the extractor (POST) and the editor (PUT).
 */

export const TOP_LEVEL_KEY_ORDER = [
  'ID', 'Fullname', 'Fullname_jp', 'Fullname_kr', 'Fullname_zh',
  'Rarity', 'Element', 'Class', 'SubClass',
  'rank', 'rank_pvp', 'role', 'limited', 'rank_by_transcend', 'role_by_transcend', 'tags', 'skill_priority',
  'Chain_Type', 'gift', 'video',
  'VoiceActor', 'VoiceActor_jp', 'VoiceActor_kr', 'VoiceActor_zh',
  'hasCoreFusion', 'coreFusionId',
  'fusionType', 'originalCharacter', 'fusionRequirements', 'costPerLevel',
  'transcend', 'skills',
];

export const SKILL_KEY_ORDER = [
  'NameIDSymbol', 'IconName', 'SkillType',
  'name', 'name_jp', 'name_kr', 'name_zh',
  'true_desc_levels', 'enhancement',
  'wgr', 'cd', 'buff', 'debuff', 'offensive', 'target',
];

/** Reorder an object's keys according to a specified order, keeping extra keys at the end */
export function orderKeys<T extends Record<string, unknown>>(obj: T, keyOrder: string[] = TOP_LEVEL_KEY_ORDER): T {
  const ordered = {} as Record<string, unknown>;
  for (const key of keyOrder) {
    if (key in obj) ordered[key] = obj[key];
  }
  for (const key of Object.keys(obj)) {
    if (!(key in ordered)) ordered[key] = obj[key];
  }
  return ordered as T;
}

/** Order skills keys inside a character object */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function orderCharacterKeys(character: Record<string, any>): Record<string, any> {
  const ordered = orderKeys(character, TOP_LEVEL_KEY_ORDER);

  // Also order skill sub-objects
  if (ordered.skills && typeof ordered.skills === 'object') {
    const orderedSkills: Record<string, unknown> = {};
    for (const [sk, skill] of Object.entries(ordered.skills)) {
      if (skill && typeof skill === 'object' && !Array.isArray(skill)) {
        orderedSkills[sk] = orderKeys(skill as Record<string, unknown>, SKILL_KEY_ORDER);
      } else {
        orderedSkills[sk] = skill;
      }
    }
    ordered.skills = orderedSkills;
  }

  return ordered;
}

/** Detect line ending used in a raw string */
export function detectEol(raw: string): string {
  return raw.includes('\r\n') ? '\r\n' : '\n';
}

/** Stringify a character to JSON, matching the line endings of the original file */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function stringifyCharacter(character: Record<string, any>, originalRaw?: string): string {
  const ordered = orderCharacterKeys(character);
  const json = JSON.stringify(ordered, null, 2);
  const eol = originalRaw ? detectEol(originalRaw) : '\n';
  if (eol === '\r\n') {
    return json.replace(/\n/g, '\r\n') + '\r\n';
  }
  return json + '\n';
}
