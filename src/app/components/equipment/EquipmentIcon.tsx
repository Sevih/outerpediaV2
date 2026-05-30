import Image from 'next/image';
import { getRarityBgPath } from '@/lib/format-text';
import type { ItemRarity } from '@/lib/theme';

type Props = {
  /** Image path relative to /images/ (e.g., 'equipment/TI_Equipment_Weapon_06') */
  src: string;
  rarity: ItemRarity;
  alt: string;
  /** Size in pixels (default 50) */
  size?: number;
  className?: string;
  /** Effect icon name (e.g., 'TI_Icon_UO_Weapon_11') — shown top-right */
  effectIcon?: string | null;
  /** Class name (e.g., 'Striker') — shown middle-right (resolved from /ui/class/) */
  classType?: string | null;
  /** Secondary effect-folder icon (e.g., 'TI_Icon_UO_Up' for EE) — rendered at the
   *  same slot as the class icon, resolved from /ui/effect/. `classType` takes precedence. */
  secondaryEffectIcon?: string | null;
  /** Size of the effect/class overlay icons in pixels (default 16) */
  overlaySize?: number;
  /** Equipment level — displayed as overlapping star icons at the bottom of the image */
  level?: number | string | null;
  /** When true, swap the rarity slot bg for the Singularity slot and the yellow stars for Singularity stars. */
  ascended?: boolean;
  /** Enhancement level — displays a "+N" badge (bottom-right). Hidden when null/undefined or 0. Ascended uses the Singularity gradient. */
  enhanceLevel?: number | null;
  /** Breakthrough tier (1..4) — displays a "T<n>" label (top-left). Hidden when null/undefined or 0. */
  tier?: number | null;
};

// APK-extracted overlay styling (CUIItemThumbnail prefab) — see memory equipment-icon-overlay-specs.
const ENH_TEXT_SHADOW = '1px -1px 0 rgba(30, 30, 30, .4), 1px 1px 0 rgba(0, 0, 0, .2)';
// Singularity gradient = vertical, cyan top → magenta bottom (matches the in-game name treatment).
const ENH_ASCENDED_GRADIENT = 'linear-gradient(180deg, #16EBF1 0%, #9D51FF 50%, #E02BCD 100%)';
const TIER_TEXT_SHADOW = '1px -1px 0 rgba(30, 30, 30, .78), 1px 1px 0 rgba(0, 0, 0, .5)';

export default function EquipmentIcon({
  src, rarity, alt, size = 50, className = '',
  effectIcon, classType, secondaryEffectIcon, overlaySize = 16, level, ascended = false,
  enhanceLevel, tier,
}: Props) {
  const starCount = level ? Number(level) : 0;
  const starSize = Math.round(size / 5);
  // Each star overlaps the previous by ~30% of its width
  const starOverlap = Math.round(starSize * 0.3);
  const starsWidth = starCount > 0 ? starSize + (starCount - 1) * (starSize - starOverlap) : 0;
  const bgSrc = ascended ? '/images/ui/bg/TI_Slot_Singularity.webp' : getRarityBgPath(rarity);
  const starSrc = ascended ? '/images/ui/star/CM_Star_Singularity.webp' : '/images/ui/star/CM_icon_star_y.webp';
  // Shared vertical position for the T<n> (left) and +N (right) badges — sits just above the
  // stars row when stars are present, otherwise hugs the bottom edge.
  const badgeBottom = starCount > 0 ? starSize + Math.round(size * 0.08) : Math.max(2, Math.round(size * 0.04));
  const badgeFontSize = Math.max(9, Math.round(size * 0.14));

  return (
    <div
      className={`relative shrink-0 overflow-visible rounded ${className}`}
      style={{ width: size, height: size }}
    >
      <div className="relative h-full w-full overflow-hidden rounded">
        <Image
          src={bgSrc}
          alt={ascended ? 'Singularity' : `${rarity} rarity`}
          fill
          sizes={`${size}px`}
          className="object-cover"
        />
        <Image
          src={`/images/${src}.webp`}
          alt={alt}
          fill
          sizes={`${size}px`}
          className="relative object-contain p-0.5"
        />
      </div>

      {/* Effect icon — top-right */}
      {effectIcon && (
        <div
          className="absolute right-0.5 top-0.5"
          style={{ width: overlaySize, height: overlaySize }}
        >
          <div className="relative h-full w-full">
            <Image
              src={`/images/ui/effect/${effectIcon}.webp`}
              alt="Effect"
              fill
              sizes={`${overlaySize}px`}
              className="object-contain"
            />
          </div>
        </div>
      )}

      {/* Class icon (or secondary effect-folder icon for EE) — top-right, just below the effect icon */}
      {(classType || secondaryEffectIcon) && (
        <div
          className="absolute right-0.5"
          style={{ width: overlaySize, height: overlaySize, top: overlaySize + 4 }}
        >
          <div className="relative h-full w-full">
            <Image
              src={classType
                ? `/images/ui/class/CM_Class_${classType}.webp`
                : `/images/ui/effect/${secondaryEffectIcon}.webp`}
              alt={classType ?? secondaryEffectIcon ?? ''}
              fill
              sizes={`${overlaySize}px`}
              className="object-contain"
            />
          </div>
        </div>
      )}

      {/* Breakthrough T1..T4 — left side, white italic with a same-color stroke to look properly bold. */}
      {tier != null && tier > 0 && (
        <span
          className="pointer-events-none absolute leading-none"
          style={{
            bottom: badgeBottom,
            left: Math.max(2, Math.round(size * 0.06)),
            fontSize: badgeFontSize,
            color: '#FFFFFF',
            fontWeight: 800,
            fontStyle: 'italic',
            WebkitTextStroke: '0.6px #FFFFFF',
            textShadow: TIER_TEXT_SHADOW,
          }}
        >
          T{tier}
        </span>
      )}

      {/* Enhancement +N — right edge, above the stars (APK EnchantLevelText, MiddleRight alignment).
          Sits on a semi-transparent black plate. Text is white (or Singularity gradient when ascended). */}
      {enhanceLevel != null && enhanceLevel > 0 && (
        <span
          className="pointer-events-none absolute inline-flex items-center leading-none"
          style={{
            bottom: badgeBottom,
            right: Math.max(2, Math.round(size * 0.04)),
            fontSize: badgeFontSize,
            fontWeight: 600,
            padding: '1px 4px',
            borderRadius: 3,
            background: 'rgba(0,0,0,0.78)',
          }}
        >
          <span
            style={ascended
              ? {
                  background: ENH_ASCENDED_GRADIENT,
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }
              : { color: '#FEFEFE', textShadow: ENH_TEXT_SHADOW }}
          >
            +{enhanceLevel}
          </span>
        </span>
      )}

      {/* Stars — overlapping, centered at the bottom of the image */}
      {starCount > 0 && (
        <div
          className="absolute bottom-1 left-1/2 flex"
          style={{
            width: starsWidth,
            marginLeft: -starsWidth / 2,
          }}
        >
          {Array.from({ length: starCount }, (_, i) => (
            <div
              key={i}
              className="relative shrink-0"
              style={{
                width: starSize,
                height: starSize,
                marginLeft: i === 0 ? 0 : -starOverlap,
              }}
            >
              <Image
                src={starSrc}
                alt="Star"
                fill
                sizes={`${starSize}px`}
                className="object-contain drop-shadow-sm"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
