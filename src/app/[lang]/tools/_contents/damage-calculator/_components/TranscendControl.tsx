'use client'

import Image from 'next/image'
import type { DamageCalcTranscendCharEntry } from '@/lib/data/damage-calc'
import { STAR_ICONS, starRowForLevel } from '@/lib/stars'
import { useI18n } from '@/lib/contexts/I18nContext'
import type { CalcAction } from '../_state/reducer'
import { TRANSCEND_LEVEL_DISPLAY, transStarToLevelId } from '../_lib/transcend'
import TranscendActiveInfo from './TranscendActiveInfo'

/**
 * Transcend tier picker for the damage-calc attacker panel.
 *
 * Visual mirrors the character-page `TranscendenceSlider` (yellow track,
 * −/+ steppers, star row on the right). The data side is different —
 * we already have the structured templet (HP/ATK/DEF rate per tier +
 * Burst flags), so we don't parse text descriptions and render bonuses
 * directly from the typed fields. Tier label resolution lives in
 * `_lib/transcend.ts` so the team panel's compact slider reuses the same
 * mapping (`5+ / 5++ / 6` etc.).
 */

interface Props {
  entry: DamageCalcTranscendCharEntry
  transStar: number
  dispatch: (action: CalcAction) => void
}

export default function TranscendControl({ entry, transStar, dispatch }: Props) {
  const { t } = useI18n()
  const tiers = entry.tiers
  if (tiers.length === 0) return null

  const minTier = entry.basicStar
  const maxTier = tiers[tiers.length - 1].transStar

  const levelId = transStarToLevelId(transStar, entry.basicStar)
  const stars = starRowForLevel(levelId)
  const label = TRANSCEND_LEVEL_DISPLAY[levelId] ?? String(transStar)

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

      {/* Active info — rate / Burst badge / unlocked team bonuses. Shared
          with the team panel's compact slider so both frames stay in sync. */}
      <TranscendActiveInfo entry={entry} transStar={transStar} variant="full" />
    </div>
  )
}
