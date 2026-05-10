'use client'

import { useMemo, useState } from 'react'
import CharacterCard from '@/app/components/character/CharacterCard'
import CharacterFx from '@/lib/fx/CharacterFx'
import type { ElementType, ClassType } from '@/types/enums'
import type { FxDescriptor } from '@/lib/fx/types'

export interface CharRow {
  id: string
  name: string
  effect: string
  element?: ElementType
  classType?: ClassType
  rarity: number
}

interface Props {
  rows: CharRow[]
  descriptors: Record<string, FxDescriptor>
}

export default function BorderFxTestClient({ rows, descriptors }: Props) {
  const [speedScale, setSpeedScale] = useState(1.0)
  const [particleSizeByEffect, setParticleSizeByEffect] = useState<Record<string, number>>({})
  const sizeFor = (effect: string) => particleSizeByEffect[effect] ?? 0.25

  const groups = useMemo(() => {
    const m = new Map<string, CharRow[]>()
    for (const r of rows) {
      const arr = m.get(r.effect) ?? []
      arr.push(r)
      m.set(r.effect, arr)
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [rows])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Border FX prototype — Three.js</h1>
        <p className="text-sm text-zinc-500">
          {rows.length} characters across {groups.length} effects. Each card is wrapped in{' '}
          <code>CharacterFx</code> running a custom Three.js shader (1:1 port of Unity{' '}
          <code>MASTA/S_Assemble_Particle_UI</code>).
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded border border-zinc-800 bg-zinc-900/40 p-3 text-xs">
        <div className="flex items-center gap-3">
          <label htmlFor="speedScale" className="w-44 font-mono text-zinc-300">
            speedScale = {speedScale.toFixed(3)}
          </label>
          <input
            id="speedScale"
            type="range"
            min={0.05}
            max={2}
            step={0.01}
            value={speedScale}
            onChange={(e) => setSpeedScale(parseFloat(e.target.value))}
            className="w-64"
          />
          <span className="text-zinc-500">1.0 = Unity ground truth</span>
        </div>
        <div className="border-t border-zinc-800 pt-2 text-zinc-400">
          Particle size factor (per-prefab — 1.0 = Unity raw, 0.25 = previous global default)
        </div>
        {groups.map(([effect]) => (
          <div key={`size-${effect}`} className="flex items-center gap-3">
            <label htmlFor={`size-${effect}`} className="w-44 truncate font-mono text-zinc-300">
              {effect.replace('FX_UI_Character_List_', '')} = {sizeFor(effect).toFixed(3)}
            </label>
            <input
              id={`size-${effect}`}
              type="range"
              min={0.05}
              max={1.5}
              step={0.01}
              value={sizeFor(effect)}
              onChange={(e) =>
                setParticleSizeByEffect((prev) => ({
                  ...prev,
                  [effect]: parseFloat(e.target.value),
                }))
              }
              className="w-64"
            />
          </div>
        ))}
      </div>

      {groups.map(([effect, chars]) => {
        const descriptor = descriptors[effect]
        return (
          <section key={effect}>
            <h2 className="mb-3 text-sm font-semibold text-zinc-300">
              <code>{effect}</code>{' '}
              <span className="text-zinc-500">— {chars.length} char(s)</span>
              {!descriptor && (
                <span className="ml-2 rounded bg-amber-900/40 px-1.5 text-[10px] text-amber-300">
                  no descriptor
                </span>
              )}
            </h2>
            <div className="flex flex-wrap gap-6">
              {chars.map((c) => {
                const card = (
                  <CharacterCard
                    id={c.id}
                    name={c.name}
                    element={c.element}
                    classType={c.classType}
                    size="md"
                    showName={false}
                    showStars
                    showIcons
                    showBadge={false}
                  />
                )
                return (
                  <div key={c.id} className="flex flex-col items-center gap-1">
                    {descriptor ? (
                      <CharacterFx
                        descriptor={descriptor}
                        speedScale={speedScale}
                        particleSizeFactor={sizeFor(effect)}
                      >
                        {card}
                      </CharacterFx>
                    ) : (
                      card
                    )}
                    <span className="max-w-25 truncate text-[10px] text-zinc-500">{c.name}</span>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
