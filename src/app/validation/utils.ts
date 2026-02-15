export type DiffEntry = {
  path: string
  type: 'added' | 'removed' | 'changed'
  merge: 'v1' | 'v2' | 'none'  // which version will be used on validate
  v1?: unknown
  v2?: unknown
}

// Fields that are expected to only exist in V2 (new extraction fields)
const IGNORED_V2_ONLY_FIELDS = new Set([
  'true_desc_levels',
  'classification',
  'range',
])

// Fields merged from V1 on validation
const V1_MERGE_FIELDS = new Set(['tags'])

// Top-level fields to skip entirely in diff (merged from V1, diff is noise)
const ALWAYS_IGNORED_FIELDS = new Set(['tags'])

// Skill fields to skip when added (always present in V2 format, even if empty)
const IGNORED_ADDED_SKILL_FIELDS = new Set(['dual_buff', 'dual_debuff'])

// Skill array fields where V1 superset of V2 means keep V1 (manual extras)
const SKILL_SUPERSET_FIELDS = new Set(['buff', 'debuff', 'dual_buff', 'dual_debuff'])

// Normalize string for comparison: strip color tags, brackets, normalize whitespace
function normalizeForCompare(s: string): string {
  return s
    .replace(/<color=#[0-9a-fA-F]{6}>(.*?)<\/color>/g, '$1')
    .replace(/[【】]/g, '')
    .replace(/\\n/g, ' ')
    .replace(/[\s\u3000]+/g, ' ')
    .trim()
    .toLowerCase()
}

function isObject(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === 'object' && !Array.isArray(val)
}

function arraysEqual(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false
  return a.every((val, i) => deepEqual(val, b[i]))
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a !== typeof b) return false

  if (Array.isArray(a) && Array.isArray(b)) {
    return arraysEqual(a, b)
  }

  if (isObject(a) && isObject(b)) {
    const keysA = Object.keys(a)
    const keysB = Object.keys(b)
    if (keysA.length !== keysB.length) return false
    return keysA.every(key => deepEqual(a[key], b[key]))
  }

  return false
}

function truncateValue(val: unknown): unknown {
  if (typeof val === 'string' && val.length > 300) {
    return val.slice(0, 300) + '...'
  }
  if (isObject(val)) {
    return '{...}'
  }
  if (Array.isArray(val)) {
    if (val.length > 3) return `[${val.length} items]`
    return val.map(truncateValue)
  }
  return val
}

function getMergeSource(path: string): DiffEntry['merge'] {
  const topKey = path.split('.')[0]
  if (V1_MERGE_FIELDS.has(topKey)) return 'v1'
  return 'v2'
}

export function deepDiff(
  v1: unknown,
  v2: unknown,
  currentPath = '',
  isSkillChild = false,
  isTranscendChild = false,
): DiffEntry[] {
  const diffs: DiffEntry[] = []

  // Both null/undefined
  if (v1 == null && v2 == null) return diffs

  // One is null
  if (v1 == null) {
    diffs.push({ path: currentPath || '(root)', type: 'added', merge: getMergeSource(currentPath), v2: truncateValue(v2) })
    return diffs
  }
  if (v2 == null) {
    diffs.push({ path: currentPath || '(root)', type: 'removed', merge: getMergeSource(currentPath), v1: truncateValue(v1) })
    return diffs
  }

  // Different types
  if (typeof v1 !== typeof v2 || Array.isArray(v1) !== Array.isArray(v2)) {
    diffs.push({ path: currentPath || '(root)', type: 'changed', merge: getMergeSource(currentPath), v1: truncateValue(v1), v2: truncateValue(v2) })
    return diffs
  }

  // Arrays
  if (Array.isArray(v1) && Array.isArray(v2)) {
    if (!arraysEqual(v1, v2)) {
      const fieldName = currentPath.split('.').pop() || ''

      // Skip diff when V1 is superset for buff/debuff in skills (V1 had manual extras)
      if (isSkillChild && SKILL_SUPERSET_FIELDS.has(fieldName)) {
        const v1Arr = v1 as string[]
        const v2Arr = v2 as string[]
        const v1Set = new Set(v1Arr)
        if (v1Arr.length >= v2Arr.length && v2Arr.every(item => v1Set.has(item as string))) {
          return diffs
        }
      }

      // Skip diff when string arrays only differ by case
      if (v1.length === v2.length && v1.every((val, i) =>
        typeof val === 'string' && typeof v2[i] === 'string' &&
        normalizeForCompare(val) === normalizeForCompare(v2[i] as string)
      )) {
        return diffs
      }

      diffs.push({ path: currentPath, type: 'changed', merge: getMergeSource(currentPath), v1: truncateValue(v1), v2: truncateValue(v2) })
    }
    return diffs
  }

  // Objects
  if (isObject(v1) && isObject(v2)) {
    const allKeys = new Set([...Object.keys(v1), ...Object.keys(v2)])

    for (const key of allKeys) {
      const childPath = currentPath ? `${currentPath}.${key}` : key
      const inV1 = key in v1
      const inV2 = key in v2

      // Skip top-level fields always ignored (e.g. tags, merged from V1)
      if (!currentPath && ALWAYS_IGNORED_FIELDS.has(key)) continue

      // Skip ignored V2-only fields inside skills
      if (isSkillChild && IGNORED_V2_ONLY_FIELDS.has(key) && !inV1 && inV2) continue

      // Skip removed entries inside transcend (V1 has different key structure)
      if (isTranscendChild && inV1 && !inV2) continue

      // Skip added dual_buff/dual_debuff inside skills (always present in V2)
      if (isSkillChild && IGNORED_ADDED_SKILL_FIELDS.has(key) && !inV1 && inV2) continue

      const nextIsSkillChild = isSkillChild || key === 'skills'
      const nextIsTranscendChild = key === 'transcend'

      if (!inV1 && inV2) {
        diffs.push({ path: childPath, type: 'added', merge: getMergeSource(childPath), v2: truncateValue(v2[key]) })
      } else if (inV1 && !inV2) {
        diffs.push({ path: childPath, type: 'removed', merge: getMergeSource(childPath), v1: truncateValue(v1[key]) })
      } else {
        diffs.push(...deepDiff(v1[key], v2[key], childPath, nextIsSkillChild, nextIsTranscendChild))
      }
    }

    return diffs
  }

  // Primitives
  if (v1 !== v2) {
    // Ignore differences that are only color tag additions
    if (typeof v1 === 'string' && typeof v2 === 'string' && normalizeForCompare(v1) === normalizeForCompare(v2)) {
      return diffs
    }
    diffs.push({ path: currentPath, type: 'changed', merge: getMergeSource(currentPath), v1, v2 })
  }

  return diffs
}

export function groupDiffsBySection(diffs: DiffEntry[]): Record<string, DiffEntry[]> {
  const groups: Record<string, DiffEntry[]> = {}

  for (const diff of diffs) {
    const parts = diff.path.split('.')
    let section = parts[0]

    // Group skill sub-diffs under their skill key
    if (section === 'skills' && parts.length > 1) {
      section = `skills.${parts[1]}`
    }

    if (!groups[section]) groups[section] = []
    groups[section].push(diff)
  }

  return groups
}
