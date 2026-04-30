'use client'

import Image from 'next/image'
import type {
  ExternalBuffDef, ExternalBuffDirection, ExternalBuffSide, ExternalBuffState, ExternalBuffStat,
} from '@/lib/damage/v2/external-buffs'

// In-game stat icons live under /images/ui/effect/CM_Stat_Icon_*.webp.
const STAT_ICON: Record<ExternalBuffStat, string> = {
  ATK: 'ATK',
  DEF: 'DEF',
  PEN: 'PIERCE_POWER',
  CHC: 'CRITICAL',
  CHD: 'CRITICAL_DMG',
  EFF: 'CHANCE',
}

interface BuffsTogglesPanelProps {
  catalog: ExternalBuffDef[]
  state: Record<string, ExternalBuffState>
  onToggle: (id: string, active: boolean) => void
  onValueChange: (id: string, value: number) => void
}

const COLUMNS: { side: ExternalBuffSide; direction: ExternalBuffDirection; label: string }[] = [
  { side: 'attacker', direction: 'buff',   label: 'Attacker buffs' },
  { side: 'attacker', direction: 'debuff', label: 'Attacker debuffs' },
  { side: 'target',   direction: 'buff',   label: 'Target buffs' },
  { side: 'target',   direction: 'debuff', label: 'Target debuffs' },
]

export function BuffsTogglesPanel({ catalog, state, onToggle, onValueChange }: BuffsTogglesPanelProps) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/40 p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Buffs & debuffs
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map(col => {
          const items = catalog.filter(b => b.side === col.side && b.direction === col.direction)
          if (items.length === 0) return null
          return (
            <Column key={`${col.side}-${col.direction}`} title={col.label}>
              {items.map(def => {
                const s = state[def.id] ?? { active: false, value: def.defaultValue }
                return (
                  <Row
                    key={def.id}
                    def={def}
                    active={s.active}
                    value={s.value}
                    onToggle={(active) => onToggle(def.id, active)}
                    onValueChange={(value) => onValueChange(def.id, value)}
                  />
                )
              })}
            </Column>
          )
        })}
      </div>
    </div>
  )
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950 p-2">
      <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Row({ def, active, value, onToggle, onValueChange }: {
  def: ExternalBuffDef
  active: boolean
  value: number
  onToggle: (v: boolean) => void
  onValueChange: (v: number) => void
}) {
  const iconToken = STAT_ICON[def.stat]
  // Match EffectInline styling — `buff-icon`/`debuff-icon` filters recolor the
  // white game icon (sky-blue/red), and the stat label takes the matching
  // tailwind color token. Direction (buff/debuff) is conveyed by color, no
  // need for `+`/`−` prefixes — the column header already names the direction.
  const iconClass = active
    ? (def.direction === 'buff' ? 'buff-icon' : 'debuff-icon')
    : 'opacity-30 saturate-0'
  const labelClass = active
    ? (def.direction === 'buff' ? 'text-buff' : 'text-debuff')
    : 'text-zinc-600'
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <input
        type="checkbox"
        checked={active}
        onChange={e => onToggle(e.target.checked)}
        className="h-3.5 w-3.5 shrink-0 rounded border-zinc-700 bg-zinc-800"
      />
      <Image
        src={`/images/ui/effect/CM_Stat_Icon_${iconToken}.webp`}
        alt={def.stat}
        width={16}
        height={16}
        className={`shrink-0 ${iconClass}`}
        unoptimized
      />
      <span className={`flex-1 truncate font-semibold ${labelClass}`}>{def.stat}</span>
      <input
        type="number"
        value={value}
        onChange={e => {
          const n = parseFloat(e.target.value)
          if (Number.isFinite(n)) onValueChange(n)
        }}
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        suppressHydrationWarning
        className={`w-14 shrink-0 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-right text-xs text-zinc-100 focus:border-blue-500 focus:outline-none ${
          active ? '' : 'opacity-50'
        }`}
      />
      <span className="w-3 shrink-0 text-[10px] text-zinc-600">%</span>
    </div>
  )
}
