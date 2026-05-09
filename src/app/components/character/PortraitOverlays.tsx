import Image from 'next/image';
import type { ElementType, ClassType } from '@/types/enums';

// Visual proportions for the FaceIcon overlays. Both CharacterPortrait and
// MonsterPortrait paint these on top of an FI_<id>.webp face icon.
//
// Sizes are CSS percentages of the frame side, so overlays auto-scale with
// any frame size — no per-breakpoint pixel arithmetic. The `intrinsicPx`
// prop on each component is only a sizes hint for next/image's optimiser.

const ELEMENT_SIZE = '39%';        // 50/128 from UICharacterThumbnail.prefab
const CLASS_SIZE = '27%';          // 34/128
const CLASS_OFFSET_TOP = '40%';    // 39/128
const STAR_SIZE = '17%';           // 22/128
const STAR_OFFSET_BOTTOM = '3%';   // 4/128

/** Below this frame size we suppress every overlay — they'd be unreadable. */
export const OVERLAY_MIN_PX = 40;

export function ElementIcon({ element, intrinsicPx }: { element: ElementType | string; intrinsicPx: number }) {
  return (
    <div className="absolute -top-1 -right-1 z-10" style={{ width: ELEMENT_SIZE, aspectRatio: '1' }}>
      <Image
        fill
        src={`/images/ui/elem/CM_Element_${element}.webp`}
        alt={element}
        sizes={`${intrinsicPx}px`}
        className="object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
      />
    </div>
  );
}

export function ClassIcon({ classType, intrinsicPx }: { classType: ClassType | string; intrinsicPx: number }) {
  return (
    <div
      className="absolute right-0 z-10"
      style={{ top: CLASS_OFFSET_TOP, width: CLASS_SIZE, aspectRatio: '1' }}
    >
      <Image
        fill
        src={`/images/ui/class/CM_Class_${classType}.webp`}
        alt={classType}
        sizes={`${intrinsicPx}px`}
        className="object-contain drop-shadow-md"
      />
    </div>
  );
}

export function StarsRow({ count, intrinsicPx }: { count: number; intrinsicPx: number }) {
  return (
    <div
      className="absolute left-0 right-0 z-10 flex items-center justify-center"
      style={{ bottom: STAR_OFFSET_BOTTOM }}
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="relative -mx-0.5" style={{ width: STAR_SIZE, aspectRatio: '1' }}>
          <Image
            fill
            src="/images/ui/star/CM_icon_star_y.webp"
            alt="Star"
            sizes={`${intrinsicPx}px`}
            className="object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
          />
        </div>
      ))}
    </div>
  );
}
