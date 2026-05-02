import Image from 'next/image'

/**
 * Tiny element / class icon badges — same convention as the admin Damage
 * Lab v2 (`CharPicker.tsx`). Used in the Attacker / Target panels next to
 * the textual element + class labels so users can scan visually without
 * reading.
 *
 * Files live under `/public/images/ui/elem/CM_Element_{element}.webp` and
 * `/public/images/ui/class/CM_Class_{token}.webp`.
 */

export function ElementIcon({ element, size = 14 }: { element: string; size?: number }) {
  if (!element) return null
  return (
    <Image
      src={`/images/ui/elem/CM_Element_${element}.webp`}
      alt={element}
      width={size}
      height={size}
      className="shrink-0"
      unoptimized
    />
  )
}

/**
 * In-game class label → icon-file token. Striker is the canonical token
 * (chars use "Striker", monsters use "Attacker" — both fold to the same
 * Striker icon). Healer / Priest fold to Healer (file convention).
 */
const CLASS_ICON: Record<string, string> = {
  Attacker: 'Striker',
  Striker:  'Striker',
  Mage:     'Mage',
  Ranger:   'Ranger',
  Defender: 'Defender',
  Priest:   'Healer',
  Healer:   'Healer',
}

export function ClassIcon({ classLabel, size = 14 }: { classLabel: string; size?: number }) {
  const token = CLASS_ICON[classLabel] ?? classLabel
  if (!token) return null
  return (
    <Image
      src={`/images/ui/class/CM_Class_${token}.webp`}
      alt={classLabel}
      width={size}
      height={size}
      className="shrink-0"
      unoptimized
    />
  )
}
