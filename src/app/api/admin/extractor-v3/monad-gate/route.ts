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
  const row = textIndex.get(key)
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

// Game NodeType + icon → site node type (see src/lib/monad/nodeTypes.ts)
function mapNodeType(stage: NodeStageRow): string {
  const nodeType = stage.NodeType
  const icon = stage.GateNodeImage
  const ending = stage.EndingImage
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
  /** Localised specific label from the stage (e.g. relic type "Knight's Relic"). */
  typeName?: LangMap
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
  // Solver-internal constraints (item/gauge) captured from the game event, kept on the wire so
  // the admin UI can show them if needed.
  requireItemId?: string
  requireGauge?: number
  givesItemIds?: string[]
  gaugeDelta?: number
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

  const queue: State[] = [initial]
  visited.add(stateKey(initial))

  const MAX_ITER = 200_000
  let iter = 0

  while (queue.length > 0 && iter++ < MAX_ITER) {
    const cur = queue.shift()!
    if (tendings.has(cur.nodeId)) {
      for (const n of cur.path) truePathNodes.add(n)
      for (const e of cur.edgePath) truePathEdges.add(e)
      continue
    }
    const outs = outgoing.get(cur.nodeId) ?? []
    for (const edge of outs) {
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

  if (truePathNodes.size === 0) return // no valid path found, leave flags untouched

  for (const n of nodes) if (truePathNodes.has(n.id)) n.truePath = true
  for (const e of edges) if (truePathEdges.has(edgeKey(e))) e.truePath = true
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const groupId = searchParams.get('groupId')

  const routeRows = loadTable<RouteRow>('MonadGateRouteTemplet')
  const textRows = loadTable<TextRow>('TextSystem')
  const textIndex = indexBy(textRows)

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
  const textItemIndex = indexBy(textItemRows)

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
