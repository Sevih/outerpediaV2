'use client'

import { Card } from "./_primitives/Card"
import { ChevronDown } from "./_primitives/Icons"
import { Strip } from "./_primitives/Strip"

// ---------------------------------------------------------------------------
// Local placeholder types — Agent C will consolidate
// ---------------------------------------------------------------------------

/** Equipment loadout as carried in AttackerState. */
export interface EquipmentLoadout {
  /** Exclusive Equipment slug (e.g. "alice-ee") or null if none equipped. */
  eeSlug: string | null
  /** EE level 0..10 */
  eeLevel: number
  /** Whether the EE's conditional is active. */
  eeEnabled: boolean
}

interface EquipmentPanelProps {
  equipment: EquipmentLoadout
  expanded: boolean
  /** Opens the EE / equipment picker modal. Phase 3 wires to modal state. */
  onOpenEquipmentPicker: () => void
  /** Toggle collapse state. Phase 3 dispatches ui/toggleEquipment. */
  onToggleExpand: () => void
}

/** Visual scaffold for 4 gear slots — EE tile is active; others are locked placeholders. */
const GEAR_SLOTS: { slot: string; name: string; sub: string; locked?: boolean }[] = [
  { slot: "Weapon",    name: "Vellum Quill",      sub: "+672 ATK" },
  { slot: "Armor",     name: "Codex Mantle",       sub: "+18% HP" },
  { slot: "Accessory", name: "Inkwell Pendant",    sub: "+42 SPD" },
  { slot: "Talisman",  name: "Chapter VI Marker",  sub: "ATK% main" },
]

/**
 * Equipment block — 4-tile gear grid + substats row.
 *
 * V3 ships EE only. The non-EE tiles render as visual scaffold with dimmed
 * styling. Clicking any tile calls `onOpenEquipmentPicker`.
 *
 * Phase 3 wiring:
 *  - Pass real `equipment` from `AttackerState`.
 *  - `onOpenEquipmentPicker` dispatches `ui/openEquipPicker`.
 *  - `onToggleExpand` dispatches `ui/toggleEquipment`.
 *  - Substats row should reflect real roll counts from `equipment.substats`.
 */
export function EquipmentPanel({
  equipment: _equipment,
  expanded,
  onOpenEquipmentPicker,
  onToggleExpand,
}: EquipmentPanelProps) {
  if (!expanded) {
    return (
      <Card
        title="Equipment"
        right={
          <button
            type="button"
            onClick={onToggleExpand}
            className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200"
          >
            Expand <ChevronDown className="rotate-180" />
          </button>
        }
        padded={false}
      >
        <div className="px-4 py-2 text-[11px] text-zinc-600">Equipment hidden</div>
      </Card>
    )
  }

  return (
    <Card
      title="Equipment"
      right={
        <button
          type="button"
          onClick={onToggleExpand}
          className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200"
        >
          Collapse <ChevronDown />
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        {GEAR_SLOTS.map(({ slot, name, sub }) => (
          <button
            key={slot}
            type="button"
            onClick={onOpenEquipmentPicker}
            className="flex items-center gap-2 rounded-md border border-white/[0.05] bg-black/25 p-2 text-left transition-colors hover:border-violet-400/30 hover:bg-violet-500/[0.04]"
          >
            <Strip label="art" className="h-9 w-9 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {slot}
              </div>
              <div className="truncate text-[12px] font-medium text-zinc-200">{name}</div>
              <div className="font-calc-mono text-[10px] text-violet-300/80">{sub}</div>
            </div>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onOpenEquipmentPicker}
        className="mt-2 flex w-full items-center justify-between rounded-md border border-dashed border-white/[0.08] bg-black/20 px-2.5 py-1.5 text-[11px] text-zinc-400 hover:border-violet-400/30 hover:text-violet-200"
      >
        <span>Substats · 14 rolls</span>
        <span className="font-calc-mono text-[10px]">CHC 5 · CHD 3 · ATK% 4 · SPD 2</span>
      </button>
    </Card>
  )
}
