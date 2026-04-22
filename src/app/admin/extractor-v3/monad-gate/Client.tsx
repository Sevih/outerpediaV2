'use client'

import { useState, useEffect, useCallback } from 'react'
import type { MonadNode, MonadEdge, NodeType } from '@/types/monad'
import MonadGateMap from '@/app/components/guides/MonadGateMap'

const API = '/api/admin/extractor-v3/monad-gate'

interface RouteOption {
  id: string
  depth: number
  routeIndex: number
  nodeGroupIds: string[]
  name: { en: string; jp: string; kr: string; zh: string } | null
}

interface ApiNode {
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
  givesItem?: { en: string; jp: string; kr: string; zh: string }
  truePath?: boolean
  typeName?: { en: string; jp: string; kr: string; zh: string }
}

interface ApiEdge {
  from: string
  to: string
  label?: { en: string; jp: string; kr: string; zh: string }
  need?: { en: string; jp: string; kr: string; zh: string }
  gives?: { en: string; jp: string; kr: string; zh: string }
  truePath?: boolean
}

interface RoutesResponse {
  routes: RouteOption[]
}

interface GraphResponse {
  groupId: string
  nodes: ApiNode[]
  edges: ApiEdge[]
  routes: RouteOption[]
}

export default function MonadGateExtractorPage() {
  const [routes, setRoutes] = useState<RouteOption[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [nodes, setNodes] = useState<MonadNode[]>([])
  const [edges, setEdges] = useState<MonadEdge[]>([])
  const [rawNodes, setRawNodes] = useState<ApiNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateResult, setGenerateResult] = useState<string | null>(null)

  const regenerate = useCallback(async () => {
    setGenerating(true)
    setGenerateResult(null)
    setError(null)
    try {
      const res = await fetch(API, { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(JSON.stringify(data))
      setGenerateResult(
        `Wrote theme-${data.themeId}.json + ${data.routesWritten} routes · ${data.itemCount} items · ${data.rewardCount} rewards · ${data.eventGroupCount} event groups.`,
      )
    } catch (e) {
      setError(String(e))
    } finally {
      setGenerating(false)
    }
  }, [])

  useEffect(() => {
    fetch(API)
      .then((r) => r.json() as Promise<RoutesResponse>)
      .then((data) => setRoutes(data.routes))
      .catch((e) => setError(String(e)))
  }, [])

  const loadGraph = useCallback(async (groupId: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}?groupId=${encodeURIComponent(groupId)}`)
      const data = (await res.json()) as GraphResponse
      setRawNodes(data.nodes)
      setNodes(
        data.nodes.map((n) => {
          // Expose the specific game label on nodes where it adds information beyond the
          // generic type (relic subtype like Knight/Chaos, ending flavour like True/Bad…).
          const specifyType = new Set(['relic', 'tending', 'bending', 'nending'])
          const label = specifyType.has(n.type) ? n.typeName?.en : undefined
          return {
            id: n.id,
            x: n.x,
            y: n.y,
            type: n.type as NodeType,
            label,
            givesItem: n.givesItem,
            truePath: n.truePath,
          }
        }),
      )
      setEdges(
        data.edges.map((e) => ({
          from: e.from,
          to: e.to,
          label: e.label,
          need: e.need,
          gives: e.gives,
          truePath: e.truePath,
        })),
      )
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const onSelect = (groupId: string) => {
    setSelectedGroupId(groupId)
    if (groupId) void loadGraph(groupId)
    else {
      setNodes([])
      setEdges([])
      setRawNodes([])
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Monad Gate — Map Extractor</h1>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-zinc-400">Route:</label>
        <select
          className="bg-zinc-800 text-white border border-zinc-600 rounded px-3 py-1 min-w-[320px]"
          value={selectedGroupId}
          onChange={(e) => onSelect(e.target.value)}
        >
          <option value="">— Select a route —</option>
          {routes.flatMap((r) => {
            // For D10-style routes where the game randomises between N layouts (e.g. 111|112),
            // emit one option per variant so the user can inspect each map independently.
            if (r.nodeGroupIds.length <= 1) {
              return [
                <option key={r.id} value={r.nodeGroupIds[0]}>
                  Depth {r.depth} — Route #{r.routeIndex} — Group {r.nodeGroupIds[0]} —{' '}
                  {r.name?.en ?? ''}
                </option>,
              ]
            }
            return r.nodeGroupIds.map((gid, idx) => (
              <option key={`${r.id}-${gid}`} value={gid}>
                Depth {r.depth} — Route #{r.routeIndex} — Variant {String.fromCharCode(65 + idx)}{' '}
                (Group {gid}) — {r.name?.en ?? ''}
              </option>
            ))
          })}
        </select>
        {loading && <span className="text-sm text-zinc-400">Loading…</span>}
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={regenerate}
            disabled={generating}
            className="bg-emerald-700 hover:bg-emerald-600 disabled:bg-zinc-700 text-white border border-emerald-500 rounded px-3 py-1 text-sm"
          >
            {generating ? 'Regenerating…' : 'Regenerate all JSON'}
          </button>
        </div>
      </div>

      {generateResult && (
        <div className="p-3 bg-emerald-900/40 border border-emerald-600 rounded text-sm text-emerald-200">
          {generateResult}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-900/40 border border-red-600 rounded text-sm text-red-200">
          {error}
        </div>
      )}

      {nodes.length > 0 && (
        <>
          <div className="text-sm text-zinc-400">
            {nodes.length} nodes · {edges.length} edges · columns{' '}
            {Math.min(...rawNodes.map((n) => n.column))}–
            {Math.max(...rawNodes.map((n) => n.column))}
          </div>
          <MonadGateMap nodes={nodes} edges={edges} />
        </>
      )}
    </div>
  )
}
