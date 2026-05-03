'use client'

import Image from 'next/image'
import type { DamageCalcTranscendCharEntry, DamageCalcTranscendTeamBonus } from '@/lib/data/damage-calc'
import { useI18n } from '@/lib/contexts/I18nContext'

/**
 * Renders the "active" transcend info for the current tier. Two variants:
 *
 *   - `'full'` (damage dealer's panel) — the dealer's OWN tier bonuses:
 *       • ATK/DEF/HP rate (single combined number, since the templet rates the
 *         three stats at the same percentage)
 *       • Burst level unlock badge (3 supersedes 2 visually)
 *     Excludes the dealer's team bonuses (those go to allies, not to self).
 *
 *   - `'compact'` (team slot's panel) — only the bonuses passed to the
 *     damage dealer (the slot's char is an ally, so its team bonuses ARE
 *     what matters here):
 *       • One badge per active stat with magnitude (e.g. `DEF +10%`).
 *     Excludes own-tier rate / burst (the ally's stats aren't displayed
 *     by the calc; they don't affect the dealer's damage).
 *
 * Returns `null` when there's nothing relevant to show for the variant.
 */

interface Props {
  entry: DamageCalcTranscendCharEntry
  transStar: number
  variant: 'full' | 'compact'
}

/** Stat-key → icon basename. Mirrors the convention in `AttackerPanel` /
 *  `TargetPanel` (`/images/ui/effect/CM_Stat_Icon_*.webp`). */
const TEAM_BONUS_ICONS: Record<string, string> = {
  ATK:        'CM_Stat_Icon_ATK',
  DEF:        'CM_Stat_Icon_DEF',
  HP:         'CM_Stat_Icon_HP',
  SPD:        'CM_Stat_Icon_SPEED',
  CHC:        'CM_Stat_Icon_CRITICAL',
  CHD:        'CM_Stat_Icon_CRITICAL_DMG',
  EFF:        'CM_Stat_Icon_CHANCE',
  RES:        'CM_Stat_Icon_RESIST',
  PEN:        'CM_Stat_Icon_PIERCE_POWER',
  'DMG UP%':  'CM_Stat_Icon_DMG_INCREASE',
  'DMG RED%': 'CM_Stat_Icon_ENEMY_DMG_REDUCE',
}

/**
 * Resolve the active value per stat at the given transStar — picks the
 * entry with the highest `fromTransStar` ≤ current per stat. Multiple
 * entries per stat exist when the buff UPGRADES (e.g. +5% → +10% → +20%
 * along the chain); only the latest unlocked version is "active".
 */
export function resolveActiveTeamBonuses(
  bonusesByTier: DamageCalcTranscendTeamBonus[] | undefined,
  transStar: number,
): DamageCalcTranscendTeamBonus[] {
  if (!bonusesByTier || bonusesByTier.length === 0) return []
  const latestByStat = new Map<string, DamageCalcTranscendTeamBonus>()
  for (const b of bonusesByTier) {
    if (b.fromTransStar > transStar) continue
    const cur = latestByStat.get(b.stat)
    if (!cur || b.fromTransStar > cur.fromTransStar) latestByStat.set(b.stat, b)
  }
  return Array.from(latestByStat.values())
}

/** Format a bonus value for display: `'rate'` → `+X%`, `'add'` on a
 *  percent stat → `+X%`, `'add'` on a flat stat → `+X`. The percent-stat
 *  set mirrors the runtime apply rules. */
function formatBonusValue(b: DamageCalcTranscendTeamBonus): string {
  const sign = b.value >= 0 ? '+' : ''
  if (b.apply === 'rate') return `${sign}${b.value}%`
  // OAT_ADD: percent stats display as %, flat stats as raw number.
  const isPctStat = b.stat === 'CHC' || b.stat === 'CHD' || b.stat === 'PEN' || b.stat === 'DMG UP%' || b.stat === 'DMG RED%'
  return isPctStat ? `${sign}${b.value}%` : `${sign}${b.value}`
}

export default function TranscendActiveInfo({ entry, transStar, variant }: Props) {
  const { t } = useI18n()
  const currentTier = entry.tiers.find(t => t.transStar === transStar)
  if (!currentTier) return null

  if (variant === 'compact') {
    const active = resolveActiveTeamBonuses(entry.teamBonusesByTier, transStar)
    if (active.length === 0) return null
    return (
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[9px] uppercase tracking-wider text-zinc-500">
          {t('tools.damage-calculator.attacker.team_bonuses')}
        </span>
        {active.map(b => {
          const icon = TEAM_BONUS_ICONS[b.stat]
          return (
            <span
              key={b.stat}
              className="inline-flex items-center gap-0.5 rounded bg-sky-500/15 px-1 py-px text-sky-300"
              title={`${b.stat} ${formatBonusValue(b)} (T${b.fromTransStar}+)`}
            >
              {icon && (
                <Image
                  src={`/images/ui/effect/${icon}.webp`}
                  alt={b.stat}
                  width={10}
                  height={10}
                  className="object-contain"
                />
              )}
              <span className="text-[10px] font-semibold tabular-nums">{formatBonusValue(b)}</span>
            </span>
          )
        })}
      </div>
    )
  }

  // 'full' variant — dealer's own tier rate + burst, no team bonuses (the
  // dealer's own teamBonuses go to the OTHER allies, not back to self).
  const hasRate = currentTier.atkRate > 0
  const hasBurst = currentTier.burst2 || currentTier.burst3
  if (!hasRate && !hasBurst) return null

  return (
    <div className="space-y-1 text-[11px]">
      {hasRate && (
        <div className="flex items-center gap-1 text-zinc-100">
          <Image src="/images/ui/effect/CM_Stat_Icon_ATK.webp" alt="ATK" width={14} height={14} className="object-contain" />
          <Image src="/images/ui/effect/CM_Stat_Icon_DEF.webp" alt="DEF" width={14} height={14} className="object-contain" />
          <Image src="/images/ui/effect/CM_Stat_Icon_HP.webp" alt="HP" width={14} height={14} className="object-contain" />
          <span className="ml-1 font-semibold">+{currentTier.atkRate / 10}%</span>
        </div>
      )}
      {hasBurst && (
        <div className="inline-block rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
          {t('tools.damage-calculator.attacker.burst_unlocked', { n: currentTier.burst3 ? 3 : 2 })}
        </div>
      )}
    </div>
  )
}
