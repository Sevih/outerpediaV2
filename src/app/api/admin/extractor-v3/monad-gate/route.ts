import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { LANGS, type Lang } from '@/lib/i18n/config'

const JSON2_DIR = path.join(process.cwd(), 'data', 'admin', 'json2')

const LANG_COLUMNS: Record<Lang, string> = {
  en: 'English',
  jp: 'Japanese',
  kr: 'Korean',
  zh: 'China_Simplified',
}

type TextRow = Record<string, string>
type NodeTempletRow = Record<string, string>
type NodeStageRow = Record<string, string>
type EventRow = Record<string, string>
type RouteRow = Record<string, string>

function loadTable<T = Record<string, string>>(name: string): T[] {
  const filePath = path.join(JSON2_DIR, `${name}.json`)
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

function indexBy<T extends Record<string, string>>(rows: T[], key = 'ID'): Map<string, T> {
  const m = new Map<string, T>()
  for (const row of rows) if (row[key]) m.set(row[key], row)
  return m
}

/** Case-insensitive variant: indexes by the uppercased key. Used for text tables where the
 *  game data sometimes mixes casing (e.g. `SYS_MG01_R03_Ev03_1_SELECT_01`) against the
 *  consumer's (`EV03_1`). Lookups should also uppercase the query. */
function indexByCI<T extends Record<string, string>>(rows: T[], key = 'ID'): Map<string, T> {
  const m = new Map<string, T>()
  for (const row of rows) if (row[key]) m.set(row[key].toUpperCase(), row)
  return m
}

function groupBy<T extends Record<string, string>>(rows: T[], key: string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const row of rows) {
    const k = row[key]
    if (!k) continue
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(row)
  }
  return m
}

type LangMap = Record<Lang, string>

function resolveText(key: string | undefined, textIndex: Map<string, TextRow>): LangMap | null {
  if (!key) return null
  // Try exact match first, then uppercase fallback (text tables index on uppercase via indexByCI).
  const row = textIndex.get(key) ?? textIndex.get(key.toUpperCase())
  if (!row) return null
  const out = {} as LangMap
  for (const lang of LANGS) out[lang] = row[LANG_COLUMNS[lang]] ?? ''
  return out
}

// Split a resolved label into {label, need} by extracting the last parenthesised
// chunk from each language variant. The game bundles requirements inline
// (e.g. "Advance there. (Key Item: Fake ID)") so we peel them off for the UI.
function splitLabelAndNeed(full: LangMap): { label: LangMap; need: LangMap } {
  const labelOut = {} as LangMap
  const needOut = {} as LangMap
  for (const lang of LANGS) {
    const text = full[lang] ?? ''
    const m = text.match(/^([\s\S]*?)\s*[\(（]([^\(\)（）]+)[\)）]\s*$/)
    if (m) {
      labelOut[lang] = m[1].trim()
      needOut[lang] = m[2].trim()
    } else {
      labelOut[lang] = text
      needOut[lang] = ''
    }
  }
  return { label: labelOut, need: needOut }
}

// Game NodeType + icon/NodeName → site node type (see src/lib/monad/nodeTypes.ts).
// MGNT_EVENT is disambiguated via NodeName first because the icon is ambiguous: depth 4
// reuses CM_Monad_Node_Icon_08 for both EVENT_01 (Path of Fate) and EVENT_03 (Eldritch Realm).
function mapNodeType(stage: NodeStageRow): string {
  const nodeType = stage.NodeType
  const icon = stage.GateNodeImage
  const ending = stage.EndingImage
  const name = stage.NodeName ?? ''
  switch (nodeType) {
    case 'MGNT_START':
      return 'start'
    case 'MGNT_SCENARIO':
      return 'saga'
    case 'MGNT_ARTIFACT':
      return 'relic'
    case 'MGNT_CUBE':
      return 'cube'
    case 'MGNT_ENDING':
      if (ending?.includes('True')) return 'tending'
      if (ending?.includes('Bad')) return 'bending'
      if (ending?.includes('Normal')) return 'nending'
      return 'tending'
    case 'MGNT_EVENT':
      if (name.endsWith('_EVENT_02')) return 'moment'
      if (name.endsWith('_EVENT_03')) return 'eldritch'
      if (name.endsWith('_EVENT_01')) return 'path'
      // Fallback on icon for unknown name variants.
      if (icon === 'CM_Monad_Node_Icon_03') return 'moment'
      if (icon === 'CM_Monad_Node_Icon_09') return 'eldritch'
      return 'path'
    case 'MGNT_BATTLE':
      if (icon === 'CM_Monad_Node_Icon_02') return 'combat'
      if (icon === 'CM_Monad_Node_Icon_04') return 'elite'
      if (icon === 'CM_Monad_Node_Icon_06') return 'pinnacle'
      if (icon === 'CM_Monad_Node_Icon_07') return 'final'
      return 'unknown'
    default:
      return 'unknown'
  }
}

// Parse NextNodeIndex "-1,0,1" → [-1, 0, 1]
function parseIndex(raw: string | undefined): number[] {
  if (!raw) return [0]
  return raw.split(',').map((x) => parseInt(x.trim(), 10)).filter((n) => !Number.isNaN(n))
}

interface ExtractedNode {
  id: string
  x: number
  y: number
  type: string
  stageGroupId: string
  column: number
  row: number
  eventGroupId?: string
  dungeonId?: string
  stageLevel?: number
  recommendBp?: number
  givesItem?: LangMap
  truePath?: boolean
  altPath?: boolean
  /** Localised specific label from the stage (e.g. relic type "Knight's Relic"). */
  typeName?: LangMap
  /** Stable key into the shared stage-label table (e.g. "SYS_MONAD_GATE_NODE_NAME_ARTIFACT_02"). */
  stageNameKey?: string
  /** Items automatically granted when visiting the node (event with no actual choice). */
  autoGivesItemIds?: string[]
}

interface ExtractedEdge {
  from: string
  to: string
  label?: LangMap
  need?: LangMap
  gives?: LangMap
  truePath?: boolean
  /** Valid detour: not on the canonical path but still leads to a True Ending. */
  altPath?: boolean
  // Solver-internal constraints (item/gauge) captured from the game event, kept on the wire so
  // the admin UI can show them if needed.
  requireItemId?: string
  requireGauge?: number
  givesItemIds?: string[]
  gaugeDelta?: number
  // Source event coordinates (for compact serialisation)
  eventGroupId?: string
  eventEndId?: string
}

const ROW_CENTER = 5 // Row5 → y = 0

function extractGroup(
  groupId: string,
  nodeRows: NodeTempletRow[],
  stageIndex: Map<string, NodeStageRow>,
  eventByGroup: Map<string, EventRow[]>,
  textIndex: Map<string, TextRow>,
  itemIndex: Map<string, Record<string, string>>,
  textItemIndex: Map<string, TextRow>,
) {
  const entries = nodeRows.filter((r) => r.NodeGroupID === groupId)

  // Build the grid: key = `${col}:${row}` → node
  const grid = new Map<string, ExtractedNode>()
  let nodeCounter = 1

  for (const entry of entries) {
    const col = parseInt(entry.Column, 10)
    for (let r = 1; r <= 9; r++) {
      const rowKey = `Row${r}` as const
      const stageGroupId = entry[rowKey]
      if (!stageGroupId) continue
      const stage = stageIndex.get(stageGroupId)
      if (!stage) continue
      const id = `N${nodeCounter++}`
      const typeName = resolveText(stage.NodeName, textIndex) ?? undefined
      grid.set(`${col}:${r}`, {
        id,
        x: col - 1,
        y: ROW_CENTER - r,
        type: mapNodeType(stage),
        stageGroupId,
        column: col,
        row: r,
        eventGroupId: stage.EventGroupID,
        dungeonId: stage.DungeonID,
        stageLevel: entry.MonadGateStageLevel ? parseInt(entry.MonadGateStageLevel, 10) : undefined,
        recommendBp: entry.RecommendBattlePower ? parseInt(entry.RecommendBattlePower, 10) : undefined,
        typeName,
        stageNameKey: stage.NodeName || undefined,
      })
    }
  }

  // Build edges by walking NextNodeIndex per entry
  const edges: ExtractedEdge[] = []
  const seen = new Set<string>() // dedup `from:to`
  for (const entry of entries) {
    const col = parseInt(entry.Column, 10)
    const offsets = parseIndex(entry.NextNodeIndex)
    for (let r = 1; r <= 9; r++) {
      const rowKey = `Row${r}` as const
      if (!entry[rowKey]) continue
      const fromNode = grid.get(`${col}:${r}`)
      if (!fromNode) continue
      for (const off of offsets) {
        const destRow = r + off
        const toNode = grid.get(`${col + 1}:${destRow}`)
        if (!toNode) continue
        const pair = `${fromNode.id}:${toNode.id}`
        if (seen.has(pair)) continue
        seen.add(pair)
        edges.push({ from: fromNode.id, to: toNode.id })
      }
    }
  }

  // Resolve event labels + attach granted key items per-edge.
  //
  // Each event group is a small graph rooted at MGET_START. Intermediate events (MGET_NONE /
  // MGET_BATTLE) link to the next via MoveEventID; terminal events (MGET_END) carry NextNodeRow,
  // which maps to the destination row in the outer grid. We DFS forward from MGET_START to
  // accumulate GetKeyItemID along each branch, then apply the accumulated item list to the edge
  // reaching that terminal event.
  for (const node of grid.values()) {
    if (!node.eventGroupId) continue
    const events = eventByGroup.get(node.eventGroupId)
    if (!events) continue
    const eventById = new Map(events.map((e) => [e.ID, e]))
    const starts = events.filter((e) => e.EventType === 'MGET_START')

    // For every MGET_END reachable from a start, remember the chain of acquired items.
    const endItemIds = new Map<string, string[]>()
    const visit = (evId: string, acquired: string[], seen: Set<string>) => {
      if (seen.has(evId)) return
      const ev = eventById.get(evId)
      if (!ev) return
      const nextAcquired = ev.GetKeyItemID ? [...acquired, ev.GetKeyItemID] : acquired
      if (ev.EventType === 'MGET_END') {
        const existing = endItemIds.get(evId)
        if (!existing || existing.length < nextAcquired.length) endItemIds.set(evId, nextAcquired)
        return
      }
      const nextSeen = new Set(seen).add(evId)
      const moves = (ev.MoveEventID || '').split(',').map((s) => s.trim()).filter(Boolean)
      for (const nid of moves) visit(nid, nextAcquired, nextSeen)
    }
    for (const s of starts) {
      const moves = (s.MoveEventID || '').split(',').map((x) => x.trim()).filter(Boolean)
      for (const nid of moves) visit(nid, [], new Set([s.ID]))
    }

    // Auto-granted items: an MGET_END without NextNodeRow (or where no NextNodeRow can resolve)
    // represents an event where the player has no meaningful choice — the item is granted just
    // by visiting the node. We record these so the solver can add them to the carried items when
    // the node is entered, independently of which outgoing edge is taken.
    const autoIds: string[] = []
    for (const ev of events) {
      if (ev.EventType !== 'MGET_END') continue
      const nextRow = ev.NextNodeRow ? parseInt(ev.NextNodeRow, 10) : NaN
      if (!Number.isNaN(nextRow)) continue
      const acquired = endItemIds.get(ev.ID) ?? []
      for (const id of acquired) if (!autoIds.includes(id)) autoIds.push(id)
    }
    if (autoIds.length > 0) node.autoGivesItemIds = autoIds

    // Apply labels + need + gives to each edge corresponding to an MGET_END.
    for (const ev of events) {
      if (ev.EventType !== 'MGET_END') continue
      const nextRow = ev.NextNodeRow ? parseInt(ev.NextNodeRow, 10) : NaN
      if (Number.isNaN(nextRow)) continue
      const target = grid.get(`${node.column + 1}:${nextRow}`)
      if (!target) continue
      const edge = edges.find((e) => e.from === node.id && e.to === target.id)
      if (!edge || edge.label) continue

      const rawLabel = resolveText(ev.NameID, textIndex)
      if (rawLabel) {
        const hasRequirement = !!(ev.RequireItemID || ev.RequireThemeRuleGauge)
        if (hasRequirement) {
          const { label, need } = splitLabelAndNeed(rawLabel)
          edge.label = label
          if (Object.values(need).some((v) => v)) edge.need = need
        } else {
          edge.label = rawLabel
        }
      }

      // Attach solver constraints captured on the terminal event + chain
      if (ev.RequireItemID) edge.requireItemId = ev.RequireItemID
      if (ev.RequireThemeRuleGauge) edge.requireGauge = parseInt(ev.RequireThemeRuleGauge, 10)
      if (ev.ThemeRuleGaugeValue) edge.gaugeDelta = parseInt(ev.ThemeRuleGaugeValue, 10)
      edge.eventGroupId = node.eventGroupId
      edge.eventEndId = ev.ID

      const acquiredIds = endItemIds.get(ev.ID) ?? []
      if (acquiredIds.length > 0) edge.givesItemIds = acquiredIds

      if (acquiredIds.length === 0) continue
      const names: LangMap[] = []
      for (const itemId of acquiredIds) {
        const item = itemIndex.get(itemId)
        if (!item) continue
        const name = resolveText(item.NameID, textItemIndex)
        if (name) names.push(name)
      }
      if (names.length === 0) continue
      const merged = {} as LangMap
      for (const lang of LANGS) {
        merged[lang] = names.map((n) => n[lang] ?? '').filter(Boolean).join(' / ')
      }
      edge.gives = merged
    }

    // Passive auto events: MGET_END with no NextNodeRow represent an event with no actual choice
    // (the player just reads a line). The outgoing edge of the node still exists through
    // NodeTemplet's NextNodeIndex, so we propagate the event's label to every outgoing edge that
    // hasn't been labelled by a regular MGET_END above.
    //
    // Service event groups (character join/levelup, gauge ops) are skipped: their MGET_END records
    // describe which *choice* was picked (offense/defense/healing), not which *map edge* was taken,
    // and the player-side choice is orthogonal to map movement. Propagating the first END's label
    // to every outgoing edge would incorrectly stamp all three with the same text (e.g. "A hero
    // specialized in offense" ×3 on D4R1).
    const hasServiceEvent = events.some(
      (e) =>
        e.EventType === 'MGET_CHARACTER_JOIN' ||
        e.EventType === 'MGET_CHARACTER_LEVELUP' ||
        e.EventType === 'MGET_THEMERULE_GAUGE',
    )
    if (!hasServiceEvent) {
      const autoEnd = events.find(
        (ev) => ev.EventType === 'MGET_END' && !ev.NextNodeRow && ev.NameID,
      )
      if (autoEnd) {
        const rawLabel = resolveText(autoEnd.NameID, textIndex)
        if (rawLabel) {
          for (const edge of edges) {
            if (edge.from !== node.id || edge.label) continue
            edge.label = rawLabel
            edge.eventGroupId = node.eventGroupId
            edge.eventEndId = autoEnd.ID
          }
        }
      }
    }
  }

  // Aggregate all reachable items per node by union-ing the `gives` of its outgoing edges
  // and the auto-granted items of the node itself. Useful so the UI can flag at a glance that
  // visiting this node can grant a key item.
  for (const node of grid.values()) {
    const merged: Record<string, Set<string>> = { en: new Set(), jp: new Set(), kr: new Set(), zh: new Set() }
    for (const e of edges) {
      if (e.from !== node.id || !e.gives) continue
      for (const lang of LANGS) {
        const v = e.gives[lang]
        if (v) merged[lang].add(v)
      }
    }
    for (const itemId of node.autoGivesItemIds ?? []) {
      const item = itemIndex.get(itemId)
      if (!item) continue
      const name = resolveText(item.NameID, textItemIndex)
      if (!name) continue
      for (const lang of LANGS) if (name[lang]) merged[lang].add(name[lang]!)
    }
    if (Object.values(merged).every((s) => s.size === 0)) continue
    const out = {} as LangMap
    for (const lang of LANGS) out[lang] = Array.from(merged[lang]).join(' / ')
    node.givesItem = out
  }

  // Flatten for output
  const nodesOut = Array.from(grid.values())
    .sort((a, b) => {
      const numA = parseInt(a.id.slice(1), 10)
      const numB = parseInt(b.id.slice(1), 10)
      return numA - numB
    })

  return { nodes: nodesOut, edges }
}

/**
 * Forward BFS with state = (nodeId, itemSet, gauge) to find every node/edge lying on at least one
 * valid path from the start node to any `tending` (True Ending) node. Constraints honoured:
 *   - requireItemId: the item must have been collected upstream
 *   - requireGauge: the gauge must be >= threshold
 *   - gaugeDelta: edge modifier added to the running gauge (on top of per-move increment)
 *   - givesItemIds: items added to the carried set when taking the edge
 * Gauge is discretised into 50-point buckets for the visited set to keep combinatorics bounded.
 */
function markTruePaths(
  nodes: ExtractedNode[],
  edges: ExtractedEdge[],
  gaugePerMove: number,
  gaugeCap: number,
) {
  const start = nodes.find((n) => n.type === 'start')
  const tendings = new Set(nodes.filter((n) => n.type === 'tending').map((n) => n.id))
  if (!start || tendings.size === 0) return

  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const outgoing = new Map<string, ExtractedEdge[]>()
  for (const e of edges) {
    if (!outgoing.has(e.from)) outgoing.set(e.from, [])
    outgoing.get(e.from)!.push(e)
  }

  const truePathNodes = new Set<string>()
  const truePathEdges = new Set<string>() // `${from}:${to}`
  const edgeKey = (e: ExtractedEdge) => `${e.from}:${e.to}`

  // Merge auto-granted items on node entry so they satisfy downstream requirements.
  const mergeAuto = (nodeId: string, items: string[]): string[] => {
    const auto = nodeById.get(nodeId)?.autoGivesItemIds
    if (!auto || auto.length === 0) return items
    return Array.from(new Set([...items, ...auto])).sort()
  }

  interface State {
    nodeId: string
    items: string[] // sorted for deterministic hashing
    gauge: number
    path: string[]
    edgePath: string[]
  }
  const initial: State = {
    nodeId: start.id,
    items: mergeAuto(start.id, []),
    gauge: 0,
    path: [start.id],
    edgePath: [],
  }

  const visited = new Set<string>()
  const stateKey = (s: { nodeId: string; items: string[]; gauge: number }) =>
    `${s.nodeId}|${s.items.join(',')}|${Math.floor(s.gauge / 50)}`

  // Prefer edges that collect items / don't require them, to deterministically pick a single
  // canonical path when multiple alternatives are equally valid.
  const edgePreference = (e: ExtractedEdge): number => {
    let score = 0
    if (e.givesItemIds?.length) score -= 10 // prefer collecting items
    if (e.requireItemId) score += 5          // avoid gated edges unless needed
    if (e.requireGauge) score += 3
    return score
  }

  // ─── Pass 1: BFS for canonical (shortest) path ───
  const queue: State[] = [initial]
  visited.add(stateKey(initial))

  const MAX_ITER = 200_000
  let iter = 0
  let canonical: State | null = null

  while (queue.length > 0 && iter++ < MAX_ITER) {
    const cur = queue.shift()!
    if (tendings.has(cur.nodeId)) {
      canonical = cur
      break // BFS => first hit is the shortest path
    }
    const outs = outgoing.get(cur.nodeId) ?? []
    const sortedOuts = [...outs].sort((a, b) => edgePreference(a) - edgePreference(b))
    for (const edge of sortedOuts) {
      if (edge.requireItemId && !cur.items.includes(edge.requireItemId)) continue
      if (edge.requireGauge && cur.gauge < edge.requireGauge) continue

      const viaEdge = edge.givesItemIds
        ? Array.from(new Set([...cur.items, ...edge.givesItemIds])).sort()
        : cur.items
      const nextItems = mergeAuto(edge.to, viaEdge)
      const nextGauge = Math.max(0, Math.min(gaugeCap, cur.gauge + gaugePerMove + (edge.gaugeDelta ?? 0)))
      const nextState: State = {
        nodeId: edge.to,
        items: nextItems,
        gauge: nextGauge,
        path: [...cur.path, edge.to],
        edgePath: [...cur.edgePath, edgeKey(edge)],
      }
      const key = stateKey(nextState)
      if (visited.has(key)) continue
      visited.add(key)
      queue.push(nextState)
    }
  }

  if (!canonical) return // no valid path found, leave flags untouched

  for (const n of canonical.path) truePathNodes.add(n)
  for (const e of canonical.edgePath) truePathEdges.add(e)

  // ─── Pass 2: detect alternative branches from each canonical node ───
  //
  // For every step of the canonical path, look at every outgoing edge other than the one taken.
  // If, after taking that edge, the player can still reach a True Ending, that edge is a valid
  // alternative branch. This survives the pass-1 visited pruning because we now run a fresh
  // reachability BFS per candidate edge, with its own state.

  // BFS from (startId, items, gauge) that returns the list of edgeKeys taken to reach a
  // True Ending (shortest path), or null if unreachable. Used to trace the full alt detour so
  // the player can follow it back to the canonical path.
  const findPathToTending = (
    startId: string,
    startItems: string[],
    startGauge: number,
  ): string[] | null => {
    const seen = new Set<string>()
    interface LocalState {
      id: string
      items: string[]
      gauge: number
      edgePath: string[]
    }
    const queue: LocalState[] = [
      { id: startId, items: startItems, gauge: startGauge, edgePath: [] },
    ]
    seen.add(`${startId}|${startItems.join(',')}|${Math.floor(startGauge / 50)}`)
    const LOCAL_MAX = 20_000
    let li = 0
    while (queue.length && li++ < LOCAL_MAX) {
      const cur = queue.shift()!
      if (tendings.has(cur.id)) return cur.edgePath
      for (const edge of outgoing.get(cur.id) ?? []) {
        if (edge.requireItemId && !cur.items.includes(edge.requireItemId)) continue
        if (edge.requireGauge && cur.gauge < edge.requireGauge) continue
        const viaEdge = edge.givesItemIds
          ? Array.from(new Set([...cur.items, ...edge.givesItemIds])).sort()
          : cur.items
        const nextItems = mergeAuto(edge.to, viaEdge)
        const nextGauge = Math.max(0, Math.min(gaugeCap, cur.gauge + gaugePerMove + (edge.gaugeDelta ?? 0)))
        const k = `${edge.to}|${nextItems.join(',')}|${Math.floor(nextGauge / 50)}`
        if (seen.has(k)) continue
        seen.add(k)
        queue.push({
          id: edge.to,
          items: nextItems,
          gauge: nextGauge,
          edgePath: [...cur.edgePath, edgeKey(edge)],
        })
      }
    }
    return null
  }

  // Replay the canonical path to know the carried state at each step.
  const stateAt: State[] = [initial]
  for (let i = 0; i < canonical.edgePath.length; i++) {
    const prev = stateAt[i]
    const [fromId, toId] = canonical.edgePath[i].split(':')
    const edge = (outgoing.get(fromId) ?? []).find((e) => e.to === toId)
    if (!edge) break
    const viaEdge = edge.givesItemIds
      ? Array.from(new Set([...prev.items, ...edge.givesItemIds])).sort()
      : prev.items
    const nextItems = mergeAuto(edge.to, viaEdge)
    const nextGauge = Math.max(0, Math.min(gaugeCap, prev.gauge + gaugePerMove + (edge.gaugeDelta ?? 0)))
    stateAt.push({
      nodeId: edge.to,
      items: nextItems,
      gauge: nextGauge,
      path: [...prev.path, edge.to],
      edgePath: [...prev.edgePath, canonical.edgePath[i]],
    })
  }

  const altPathEdges = new Set<string>()
  for (let i = 0; i < canonical.path.length - 1; i++) {
    const state = stateAt[i]
    const canonicalEdgeK = canonical.edgePath[i]
    for (const edge of outgoing.get(canonical.path[i]) ?? []) {
      const k = edgeKey(edge)
      if (k === canonicalEdgeK) continue
      if (edge.requireItemId && !state.items.includes(edge.requireItemId)) continue
      if (edge.requireGauge && state.gauge < edge.requireGauge) continue
      const viaEdge = edge.givesItemIds
        ? Array.from(new Set([...state.items, ...edge.givesItemIds])).sort()
        : state.items
      const nextItems = mergeAuto(edge.to, viaEdge)
      const nextGauge = Math.max(0, Math.min(gaugeCap, state.gauge + gaugePerMove + (edge.gaugeDelta ?? 0)))
      const recovery = findPathToTending(edge.to, nextItems, nextGauge)
      if (recovery !== null) {
        altPathEdges.add(k)
        // Include the whole recovery path so the player has every edge they need to follow
        // to reconnect with the True Ending.
        for (const ek of recovery) altPathEdges.add(ek)
      }
    }
  }

  for (const e of truePathEdges) altPathEdges.delete(e)

  // Collect nodes touched by alt paths (both endpoints of each alt edge) so the UI can keep
  // them fully visible when the "True Ending Path" filter is on.
  const altPathNodes = new Set<string>()
  for (const ek of altPathEdges) {
    const [fromId, toId] = ek.split(':')
    if (!truePathNodes.has(fromId)) altPathNodes.add(fromId)
    if (!truePathNodes.has(toId)) altPathNodes.add(toId)
  }

  for (const n of nodes) {
    if (truePathNodes.has(n.id)) n.truePath = true
    else if (altPathNodes.has(n.id)) n.altPath = true
  }
  for (const e of edges) {
    if (truePathEdges.has(edgeKey(e))) e.truePath = true
    else if (altPathEdges.has(edgeKey(e))) e.altPath = true
  }
}

function listRoutes(routeRows: RouteRow[], textIndex: Map<string, TextRow>) {
  return routeRows.map((r) => ({
    id: r.ID,
    depth: parseInt(r.DepthID, 10),
    routeIndex: parseInt(r.StageRouteID, 10),
    nodeGroupIds: r.NodeGroupID.split(',').map((g) => g.trim()),
    name: resolveText(r.RouteName, textIndex),
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Reward resolution
// ─────────────────────────────────────────────────────────────────────────────

interface ResolvedRewardItem {
  type: string // RIT_ITEM, RIT_ASSET, ...
  typeId: string
  min: number
  max: number
}

interface ResolvedReward {
  gold?: { min: number; max: number }
  crystal?: { min: number; max: number }
  items: ResolvedRewardItem[]
}

function resolveReward(
  rewardId: string,
  rewardIndex: Map<string, Record<string, string>>,
  groupByGroupId: Map<string, Record<string, string>[]>,
): ResolvedReward | null {
  const reward = rewardIndex.get(rewardId)
  if (!reward) return null
  const out: ResolvedReward = { items: [] }
  if (reward.CreditMin) {
    out.gold = {
      min: parseInt(reward.CreditMin, 10),
      max: parseInt(reward.CreditMax ?? reward.CreditMin, 10),
    }
  }
  if (reward.Crystal) {
    const n = parseInt(reward.Crystal, 10)
    out.crystal = { min: n, max: n }
  }
  const addGroup = (raw: string | undefined) => {
    if (!raw) return
    for (const gid of raw.split(',').map((g) => g.trim()).filter(Boolean)) {
      const rows = groupByGroupId.get(gid) ?? []
      for (const r of rows) {
        out.items.push({
          type: r.Type ?? '',
          typeId: r.TypeID ?? '',
          min: parseInt(r.MinCount ?? '0', 10),
          max: parseInt(r.MaxCount ?? '0', 10),
        })
      }
    }
  }
  addGroup(reward.StaticGroupID)
  addGroup(reward.RandomGroupID)
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// Compact serialisation for data/monad/generated/
// ─────────────────────────────────────────────────────────────────────────────

interface CompactNode {
  id: string
  col: number
  row: number
  type: string
  typeNameKey?: string
  eventGroupId?: string
  rewardId?: string
  firstClearRewardId?: string
  autoItems?: string[]
  truePath?: boolean
  altPath?: boolean
}

interface CompactEdge {
  from: string
  to: string
  eventEndId?: string
  truePath?: boolean
  altPath?: boolean
}

interface CompactRoute {
  groupId: string
  depth: number
  routeIndex: number
  variant: number
  name: LangMap | null
  nodes: CompactNode[]
  edges: CompactEdge[]
}

interface CompactEventEnd {
  labelKey?: string
  requireItemId?: string
  requireGauge?: number
  givesItemIds?: string[]
  gaugeDelta?: number
}

interface CompactTheme {
  themeId: string
  themeName: LangMap | null
  gauge: { perMove: number; cap: number }
  items: Record<string, { name: LangMap }>
  events: Record<
    string,
    {
      titleKey?: string
      ends: Record<string, CompactEventEnd>
      /** "service" groups are recurring non-narrative events (character join/levelup,
       *  theme rule gauge manipulation) — they shouldn't appear in True Ending Choices. */
      kind?: 'service'
    }
  >
  rewards: Record<string, ResolvedReward>
  /** Shared label table. Keyed by the game text key (e.g. SYS_MG01_…). */
  labels: Record<string, LangMap>
  /** Stable per-stage labels (e.g. relic subtype, ending flavour). Keyed by the game text key. */
  stageLabels: Record<string, LangMap>
  routes: Array<{
    groupId: string
    depth: number
    routeIndex: number
    variant: number
    name: LangMap | null
  }>
}

function toCompactRoute(
  groupId: string,
  depth: number,
  routeIndex: number,
  variant: number,
  name: LangMap | null,
  nodes: ExtractedNode[],
  edges: ExtractedEdge[],
  stageByGroupId: Map<string, NodeStageRow>,
): CompactRoute {
  const compactNodes: CompactNode[] = nodes.map((n) => {
    const stage = stageByGroupId.get(n.stageGroupId)
    const out: CompactNode = {
      id: n.id,
      col: n.column,
      row: n.row,
      type: n.type,
    }
    if (n.stageNameKey) out.typeNameKey = n.stageNameKey
    if (n.eventGroupId) out.eventGroupId = n.eventGroupId
    if (stage?.RewardID) out.rewardId = stage.RewardID
    if (stage?.FirstClearRewardID) out.firstClearRewardId = stage.FirstClearRewardID
    if (n.autoGivesItemIds && n.autoGivesItemIds.length) out.autoItems = n.autoGivesItemIds
    if (n.truePath) out.truePath = true
    if (n.altPath) out.altPath = true
    return out
  })
  const compactEdges: CompactEdge[] = edges.map((e) => {
    const out: CompactEdge = { from: e.from, to: e.to }
    if (e.eventEndId) out.eventEndId = e.eventEndId
    if (e.truePath) out.truePath = true
    if (e.altPath) out.altPath = true
    return out
  })
  return {
    groupId,
    depth,
    routeIndex,
    variant,
    name,
    nodes: compactNodes,
    edges: compactEdges,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST: regenerate all JSON files under data/monad/generated/
// ─────────────────────────────────────────────────────────────────────────────

export async function POST() {
  const routeRows = loadTable<RouteRow>('MonadGateRouteTemplet')
  const textRows = loadTable<TextRow>('TextSystem')
  const nodeRows = loadTable<NodeTempletRow>('MonadGateNodeTemplet')
  const stageRows = loadTable<NodeStageRow>('MonadGateNodeStageTemplet')
  const eventRows = loadTable<EventRow>('MonadGateEventTemplet')
  const itemRows = loadTable<Record<string, string>>('ItemTemplet')
  const textItemRows = loadTable<TextRow>('TextItem')
  const themeRuleRows = loadTable<Record<string, string>>('MonadGateThemeRuleTemplet')
  const themeRows = loadTable<Record<string, string>>('MonadGateThemeTemplet')
  const rewardRows = loadTable<Record<string, string>>('RewardTemplet')
  const rewardGroupRows = loadTable<Record<string, string>>('RewardGroupTemplet')

  const textIndex = indexByCI(textRows)
  const stageIndex = indexBy(stageRows, 'GroupID')
  const eventByGroup = groupBy(eventRows, 'EventGroupID')
  const itemIndex = indexBy(itemRows, 'ID')
  const textItemIndex = indexByCI(textItemRows)
  const rewardIndex = indexBy(rewardRows, 'ID')
  const rewardGroupByGroupId = groupBy(rewardGroupRows, 'GroupID')

  const themeRule = themeRuleRows[0] ?? {}
  const gaugePerMove = parseInt(themeRule.NodeMoveGaugeIncrease ?? '20', 10)
  const gaugeCap = parseInt(themeRule.MonadGateThemeRuleGauge ?? '1000', 10)
  const theme = themeRows[0] ?? {}
  const themeId = theme.ID ?? '1'
  const themeName = resolveText(theme.MonadGateThemeName, textIndex)

  // Accumulate theme registries while walking all routes
  const themeOut: CompactTheme = {
    themeId,
    themeName,
    gauge: { perMove: gaugePerMove, cap: gaugeCap },
    items: {},
    events: {},
    rewards: {},
    labels: {},
    stageLabels: {},
    routes: [],
  }

  // Track referenced items / rewards / stage labels so we only ship what's actually used
  const referencedItemIds = new Set<string>()
  const referencedRewardIds = new Set<string>()
  const referencedEventGroups = new Set<string>()
  const referencedStageKeys = new Set<string>()

  const routes: CompactRoute[] = []

  for (const routeRow of routeRows) {
    const depth = parseInt(routeRow.DepthID, 10)
    const routeIndex = parseInt(routeRow.StageRouteID, 10)
    const groupIds = routeRow.NodeGroupID.split(',').map((g) => g.trim()).filter(Boolean)
    const name = resolveText(routeRow.RouteName, textIndex)

    groupIds.forEach((groupId, variantIdx) => {
      const { nodes, edges } = extractGroup(
        groupId,
        nodeRows,
        stageIndex,
        eventByGroup,
        textIndex,
        itemIndex,
        textItemIndex,
      )
      markTruePaths(nodes, edges, gaugePerMove, gaugeCap)

      // Collect theme-level references
      for (const n of nodes) {
        if (n.eventGroupId) referencedEventGroups.add(n.eventGroupId)
        if (n.stageNameKey) referencedStageKeys.add(n.stageNameKey)
        for (const id of n.autoGivesItemIds ?? []) referencedItemIds.add(id)
        const stage = stageIndex.get(n.stageGroupId)
        if (stage?.RewardID) referencedRewardIds.add(stage.RewardID)
        if (stage?.FirstClearRewardID) referencedRewardIds.add(stage.FirstClearRewardID)
      }
      for (const e of edges) {
        if (e.requireItemId) referencedItemIds.add(e.requireItemId)
        for (const id of e.givesItemIds ?? []) referencedItemIds.add(id)
      }

      routes.push(
        toCompactRoute(groupId, depth, routeIndex, variantIdx, name, nodes, edges, stageIndex),
      )
      themeOut.routes.push({ groupId, depth, routeIndex, variant: variantIdx, name })
    })
  }

  // Resolve referenced items into theme
  for (const id of referencedItemIds) {
    const item = itemIndex.get(id)
    if (!item) continue
    const n = resolveText(item.NameID, textItemIndex)
    if (!n) continue
    themeOut.items[id] = { name: n }
  }

  // Resolve referenced rewards into theme
  for (const id of referencedRewardIds) {
    const r = resolveReward(id, rewardIndex, rewardGroupByGroupId)
    if (r) themeOut.rewards[id] = r
  }

  // Resolve referenced stage labels into theme (dedup across all routes)
  for (const key of referencedStageKeys) {
    const label = resolveText(key, textIndex)
    if (label) themeOut.stageLabels[key] = label
  }

  // Resolve referenced event groups into theme (label references + constraints per end).
  // Labels are stored by text key into the shared `labels` registry so the same translated
  // string appears once no matter how many events reuse it.
  const addLabel = (key: string | undefined): string | undefined => {
    if (!key) return undefined
    if (!themeOut.labels[key]) {
      const resolved = resolveText(key, textIndex)
      if (resolved) themeOut.labels[key] = resolved
    }
    return themeOut.labels[key] ? key : undefined
  }

  for (const egid of referencedEventGroups) {
    const events = eventByGroup.get(egid) ?? []
    const startEv = events.find((e) => e.EventType === 'MGET_START')
    const titleKey = addLabel(startEv?.NameID)

    // Forward DFS from MGET_START to accumulate GetKeyItemID along each branch, so each
    // MGET_END knows the full chain of items the player collects by reaching it.
    const eventById = new Map(events.map((e) => [e.ID, e]))
    const endItemIds = new Map<string, string[]>()
    const visit = (evId: string, acquired: string[], seen: Set<string>) => {
      if (seen.has(evId)) return
      const ev = eventById.get(evId)
      if (!ev) return
      const next = ev.GetKeyItemID ? [...acquired, ev.GetKeyItemID] : acquired
      if (ev.EventType === 'MGET_END') {
        const existing = endItemIds.get(evId)
        if (!existing || existing.length < next.length) endItemIds.set(evId, next)
        return
      }
      const seenNext = new Set(seen).add(evId)
      for (const nid of (ev.MoveEventID || '').split(',').map((s) => s.trim()).filter(Boolean)) {
        visit(nid, next, seenNext)
      }
    }
    if (startEv) {
      for (const nid of (startEv.MoveEventID || '').split(',').map((s) => s.trim()).filter(Boolean)) {
        visit(nid, [], new Set([startEv.ID]))
      }
    }

    const ends: Record<string, CompactEventEnd> = {}
    for (const ev of events) {
      if (ev.EventType !== 'MGET_END') continue
      const labelKey = addLabel(ev.NameID)
      if (!labelKey) continue
      const entry: CompactEventEnd = { labelKey }
      if (ev.RequireItemID) entry.requireItemId = ev.RequireItemID
      if (ev.RequireThemeRuleGauge) entry.requireGauge = parseInt(ev.RequireThemeRuleGauge, 10)
      if (ev.ThemeRuleGaugeValue) entry.gaugeDelta = parseInt(ev.ThemeRuleGaugeValue, 10)
      const acquired = endItemIds.get(ev.ID) ?? []
      if (acquired.length > 0) entry.givesItemIds = acquired
      ends[ev.ID] = entry
    }

    // Flag recurring/mechanical event groups. Their labels are still useful in the map popup
    // but they shouldn't appear in the narrative True Ending Choices list.
    const isService = events.some(
      (e) =>
        e.EventType === 'MGET_CHARACTER_JOIN' ||
        e.EventType === 'MGET_CHARACTER_LEVELUP' ||
        e.EventType === 'MGET_THEMERULE_GAUGE',
    )

    themeOut.events[egid] = { titleKey, ends, ...(isService ? { kind: 'service' as const } : {}) }
  }

  // Write files
  const outDir = path.join(process.cwd(), 'data', 'monad', 'generated')
  const routesDir = path.join(outDir, 'routes')
  fs.mkdirSync(routesDir, { recursive: true })
  fs.writeFileSync(
    path.join(outDir, `theme-${themeId}.json`),
    JSON.stringify(themeOut, null, 2),
    'utf-8',
  )
  for (const r of routes) {
    fs.writeFileSync(
      path.join(routesDir, `${r.groupId}.json`),
      JSON.stringify(r, null, 2),
      'utf-8',
    )
  }

  return NextResponse.json({
    ok: true,
    themeId,
    routesWritten: routes.length,
    itemCount: Object.keys(themeOut.items).length,
    rewardCount: Object.keys(themeOut.rewards).length,
    eventGroupCount: Object.keys(themeOut.events).length,
    stageLabelCount: Object.keys(themeOut.stageLabels).length,
    labelCount: Object.keys(themeOut.labels).length,
  })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const groupId = searchParams.get('groupId')

  const routeRows = loadTable<RouteRow>('MonadGateRouteTemplet')
  const textRows = loadTable<TextRow>('TextSystem')
  const textIndex = indexByCI(textRows)

  if (!groupId) {
    return NextResponse.json({ routes: listRoutes(routeRows, textIndex) })
  }

  const nodeRows = loadTable<NodeTempletRow>('MonadGateNodeTemplet')
  const stageRows = loadTable<NodeStageRow>('MonadGateNodeStageTemplet')
  const eventRows = loadTable<EventRow>('MonadGateEventTemplet')
  const itemRows = loadTable<Record<string, string>>('ItemTemplet')
  const textItemRows = loadTable<TextRow>('TextItem')
  const themeRuleRows = loadTable<Record<string, string>>('MonadGateThemeRuleTemplet')

  const stageIndex = indexBy(stageRows, 'GroupID')
  const eventByGroup = groupBy(eventRows, 'EventGroupID')
  const itemIndex = indexBy(itemRows, 'ID')
  const textItemIndex = indexByCI(textItemRows)

  const themeRule = themeRuleRows[0] ?? {}
  const gaugePerMove = parseInt(themeRule.NodeMoveGaugeIncrease ?? '20', 10)
  const gaugeCap = parseInt(themeRule.MonadGateThemeRuleGauge ?? '1000', 10)

  const { nodes, edges } = extractGroup(
    groupId,
    nodeRows,
    stageIndex,
    eventByGroup,
    textIndex,
    itemIndex,
    textItemIndex,
  )

  markTruePaths(nodes, edges, gaugePerMove, gaugeCap)

  return NextResponse.json({
    groupId,
    nodes,
    edges,
    routes: listRoutes(routeRows, textIndex),
  })
}
