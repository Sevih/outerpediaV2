const LANG_SUFFIXES = ['_jp', '_kr', '_zh'] as const

// Fields whose keys need localized ordering (1, 1_jp, 1_kr, 1_zh, 2, ...)
const LOCALIZED_KEY_FIELDS = new Set(['transcend', 'true_desc_levels', 'enhancement'])

// Get keys in localized order: 1, 1_jp, 1_kr, 1_zh, 2, 2_jp, ...
function getLocalizedKeyOrder(obj: Record<string, unknown>): string[] {
  const baseKeys = Object.keys(obj)
    .filter(k => /^\d+$/.test(k))
    .sort((a, b) => Number(a) - Number(b))

  const ordered: string[] = []
  for (const base of baseKeys) {
    ordered.push(base)
    for (const suffix of LANG_SUFFIXES) {
      const key = `${base}${suffix}`
      if (key in obj) ordered.push(key)
    }
  }
  return ordered
}

// Custom JSON stringify that respects localized key ordering
// (JS objects always sort integer keys first, breaking our desired order)
function stringifyValue(value: unknown, indent: number, fieldName: string): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value)

  const pad = ' '.repeat(indent)
  const childPad = ' '.repeat(indent + 2)

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const compact = JSON.stringify(value)
    if (compact.length < 80) return compact
    const items = value.map(item => `${childPad}${stringifyValue(item, indent + 2, '')}`)
    return `[\n${items.join(',\n')}\n${pad}]`
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = LOCALIZED_KEY_FIELDS.has(fieldName)
      ? getLocalizedKeyOrder(obj)
      : Object.keys(obj)
    if (keys.length === 0) return '{}'

    const entries = keys.map(key => {
      const val = stringifyValue(obj[key], indent + 2, key)
      return `${childPad}${JSON.stringify(key)}: ${val}`
    })
    return `{\n${entries.join(',\n')}\n${pad}}`
  }

  return JSON.stringify(value)
}

// Remove localized variants when they're identical to the base value
// e.g. if "2" === "2_jp" === "2_kr" === "2_zh", only keep "2"
function deduplicateLocalized(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const baseKeys = Object.keys(obj).filter(k => /^\d+$/.test(k))

  for (const base of baseKeys) {
    result[base] = obj[base]
    for (const suffix of LANG_SUFFIXES) {
      const key = `${base}${suffix}`
      if (key in obj && obj[key] !== obj[base]) {
        result[key] = obj[key]
      }
    }
  }
  return result
}

// Remove true_desc* keys from skill
function cleanSkill(skill: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(skill)) {
    if (key === 'true_desc' || /^true_desc_(jp|kr|zh)$/.test(key)) continue
    cleaned[key] = value
  }
  return cleaned
}

// Post-process character data: remove redundant fields, clean skills, reorder keys
export function postProcess(data: Record<string, unknown>): Record<string, unknown> {
  // Deduplicate transcend localized variants
  let transcend = data.transcend
  if (transcend && typeof transcend === 'object' && !Array.isArray(transcend)) {
    transcend = deduplicateLocalized(transcend as Record<string, unknown>)
  }

  // Clean skills (remove true_desc*)
  let skills = data.skills
  if (skills && typeof skills === 'object') {
    const src = skills as Record<string, Record<string, unknown>>
    const cleaned: Record<string, unknown> = {}
    for (const [skillKey, skillData] of Object.entries(src)) {
      cleaned[skillKey] = cleanSkill(skillData)
    }
    skills = cleaned
  }

  // Rebuild with correct key order: tags right after skill_priority
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (key === 'tags') continue // will be inserted after skill_priority
    if (key === 'transcend') { result[key] = transcend; continue }
    if (key === 'skills') { result[key] = skills; continue }
    result[key] = value
    if (key === 'skill_priority' && data.tags != null) {
      result.tags = data.tags
    }
  }
  // If tags exists but skill_priority doesn't, append at end
  if (data.tags != null && !('tags' in result)) {
    result.tags = data.tags
  }

  return result
}

// Merge V1 skill buff/debuff arrays when V1 is a superset of V2
// (V1 had manually-added entries the parser doesn't detect)
const SUPERSET_FIELDS = ['buff', 'debuff', 'dual_buff', 'dual_debuff']

export function mergeSkillSuperset(
  v2Data: Record<string, unknown>,
  v1Data: Record<string, unknown>,
): Record<string, unknown> {
  const v2Skills = v2Data.skills as Record<string, Record<string, unknown>> | undefined
  const v1Skills = v1Data.skills as Record<string, Record<string, unknown>> | undefined
  if (!v2Skills || !v1Skills) return v2Data

  const mergedSkills: Record<string, unknown> = {}
  for (const [skillKey, v2Skill] of Object.entries(v2Skills)) {
    const v1Skill = v1Skills[skillKey]
    if (!v1Skill) { mergedSkills[skillKey] = v2Skill; continue }

    const mergedSkill = { ...v2Skill }
    for (const field of SUPERSET_FIELDS) {
      const v1Arr = v1Skill[field]
      const v2Arr = v2Skill[field]
      if (!Array.isArray(v1Arr) || !Array.isArray(v2Arr)) continue
      if (v1Arr.length < v2Arr.length) continue

      const v1Set = new Set(v1Arr as string[])
      if ((v2Arr as string[]).every(item => v1Set.has(item))) {
        mergedSkill[field] = v1Arr
      }
    }
    mergedSkills[skillKey] = mergedSkill
  }

  return { ...v2Data, skills: mergedSkills }
}

// Serialize character data to JSON with proper localized key ordering
export function serializeCharacter(data: Record<string, unknown>): string {
  return stringifyValue(data, 0, '') + '\n'
}
