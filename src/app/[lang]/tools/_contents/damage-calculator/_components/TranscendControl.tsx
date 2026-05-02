'use client'

import Image from 'next/image'
import type { DamageCalcTranscendCharEntry } from '@/lib/data/damage-calc'
import { STAR_ICONS, starRowForLevel } from '@/lib/stars'
import { useI18n } from '@/lib/contexts/I18nContext'
import type { CalcAction } from '../_state/reducer'

/**
 * Transcend tier picker for the damage-calc attacker panel.
 *
 * Visual mirrors the character-page `TranscendenceSlider` (yellow track,
 * −/+ steppers, star row on the right). The data side is different —
 * we already have the structured templet (HP/ATK/DEF rate per tier +
 * Burst flags), so we don't parse text descriptions and render bonuses
 * directly from the typed fields.
 */

interface Props {
  entry: DamageCalcTranscendCharEntry
  transStar: number
  dispatch: (action: CalcAction) => void
}

/**
 * Map raw `TransStar` (3-9 for 3★ chars, 2-9 for 2★) to an in-game tier
 * label like `'3' / '4_1' / '4_2' / '5_1' / '5_2' / '5_3' / '6'`.
 *
 * The branching only kicks in once we've passed the BasicStar tier; the
 * first 1-2 tiers are linear (`'2' → '3'`). Past that, every two templet
 * rows correspond to one in-game tier branch (4, 4+, 5, 5+, 5++).
 */
function transStarToLevelId(transStar: number, basicStar: number): string {
  if (transStar === basicStar) return String(basicStar)
  if (basicStar === 2 && transStar === 3) return '3'
  switch (transStar) {
    case 4: return '4_1'
    case 5: return '4_2'
    case 6: return '5_1'
    case 7: return '5_2'
    case 8: return '5_3'
    case 9: return '6'
    default: return String(transStar)
  }
}

/** Friendly compact label for the slider readout (`4 / 4+ / 5 / 5+ / 5++ / 6`). */
const LEVEL_DISPLAY: Record<string, string> = {
  '1': '1', '2': '2', '3': '3',
  '4': '4', '4_1': '4', '4_2': '4+',
  '5': '5', '5_1': '5', '5_2': '5+', '5_3': '5++',
  '6': '6',
}

export default function TranscendControl({ entry, transStar, dispatch }: Props) {
  const { t } = useI18n()
  const tiers = entry.tiers
  if (tiers.length === 0) return null

  const minTier = entry.basicStar
  const maxTier = tiers[tiers.length - 1].transStar
  const currentTier = tiers.find(t => t.transStar === transStar)

  const levelId = transStarToLevelId(transStar, entry.basicStar)
  const stars = starRowForLevel(levelId)
  const label = LEVEL_DISPLAY[levelId] ?? String(transStar)

  const range = maxTier - minTier
  const progressPct = range > 0 ? ((transStar - minTier) / range) * 100 : 100

  const setTier = (next: number) => {
    const clamped = Math.max(minTier, Math.min(maxTier, next))
    dispatch({ type: 'attacker/setTransStar', tier: clamped })
  }

  return (
    <div className="space-y-2 rounded border border-zinc-800 bg-zinc-950 p-2">
      {/* Slider row — −/+ steppers + yellow progress bar + invisible range. */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">T</span>

        <button
          type="button"
          onClick={() => setTier(transStar - 1)}
          disabled={transStar <= minTier}
          aria-label={t('tools.damage-calculator.attacker.tier_lower')}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-zinc-700 text-sm text-white hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          &ndash;
        </button>

        <div className="relative h-2 grow overflow-hidden rounded-full bg-zinc-700">
          <div
            className="absolute left-0 top-0 h-full bg-yellow-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
          <input
            type="range"
            min={minTier}
            max={maxTier}
            step={1}
            value={transStar}
            onChange={e => setTier(parseInt(e.target.value, 10))}
            aria-label={t('tools.damage-calculator.attacker.tier_label')}
            className="absolute left-0 top-0 h-2 w-full cursor-pointer opacity-0"
          />
        </div>

        <button
          type="button"
          onClick={() => setTier(transStar + 1)}
          disabled={transStar >= maxTier}
          aria-label={t('tools.damage-calculator.attacker.tier_raise')}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-zinc-700 text-sm text-white hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          +
        </button>

        {/* Stars + label */}
        <div className="flex shrink-0 items-center gap-1">
          <div className="flex gap-px">
            {stars.map((color, i) => (
              <Image
                key={i}
                src={STAR_ICONS[color]}
                alt="Star"
                width={12}
                height={12}
                className="object-contain"
              />
            ))}
          </div>
          <span className="w-9 text-right text-[11px] font-semibold tabular-nums whitespace-nowrap text-yellow-300">{label}</span>
        </div>
      </div>

      {/* Bonuses — direct render from the structured templet (no text parse). */}
      {currentTier && (currentTier.atkRate > 0 || currentTier.burst2 || currentTier.burst3) && (
        <div className="space-y-1 text-[11px]">
          {currentTier.atkRate > 0 && (
            <div className="flex items-center gap-1 text-zinc-100">
              <Image src="/images/ui/effect/CM_Stat_Icon_ATK.webp" alt="ATK" width={14} height={14} className="object-contain" />
              <Image src="/images/ui/effect/CM_Stat_Icon_DEF.webp" alt="DEF" width={14} height={14} className="object-contain" />
              <Image src="/images/ui/effect/CM_Stat_Icon_HP.webp" alt="HP" width={14} height={14} className="object-contain" />
              <span className="ml-1 font-semibold">+{currentTier.atkRate / 10}%</span>
            </div>
          )}
          {currentTier.burst3 ? (
            <div className="inline-block rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
              {t('tools.damage-calculator.attacker.burst_unlocked', { n: 3 })}
            </div>
          ) : currentTier.burst2 ? (
            <div className="inline-block rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
              {t('tools.damage-calculator.attacker.burst_unlocked', { n: 2 })}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
