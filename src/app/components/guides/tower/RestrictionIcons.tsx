import Image from 'next/image';

/* ── Restriction → visual mapping ── */

type IconInfo =
  | { type: 'element'; value: string; banned: boolean; atLeast?: number }
  | { type: 'class'; value: string; banned: boolean; atLeast?: number }
  | { type: 'star'; stars: number; atLeast?: number }
  | { type: 'text'; label: string };

const RESTRICTION_ICON_MAP: Record<string, IconInfo> = {
  // Element force/ban
  ForceFire:    { type: 'element', value: 'Fire',  banned: false },
  ForceWater:   { type: 'element', value: 'Water', banned: false },
  ForceEarth:   { type: 'element', value: 'Earth', banned: false },
  ForceLight:   { type: 'element', value: 'Light', banned: false },
  ForceDark:    { type: 'element', value: 'Dark',  banned: false },
  BanFire:      { type: 'element', value: 'Fire',  banned: true },
  BanWater:     { type: 'element', value: 'Water', banned: true },
  BanEarth:     { type: 'element', value: 'Earth', banned: true },
  BanLight:     { type: 'element', value: 'Light', banned: true },
  BanDark:      { type: 'element', value: 'Dark',  banned: true },

  // Class force/ban
  ForceStriker:  { type: 'class', value: 'Striker',  banned: false },
  ForceDefender: { type: 'class', value: 'Defender', banned: false },
  ForceRanger:   { type: 'class', value: 'Ranger',   banned: false },
  ForceHealer:   { type: 'class', value: 'Healer',   banned: false },
  ForceMage:     { type: 'class', value: 'Mage',     banned: false },
  BanStriker:    { type: 'class', value: 'Striker',   banned: true },
  BanDefender:   { type: 'class', value: 'Defender',  banned: true },
  BanRanger:     { type: 'class', value: 'Ranger',    banned: true },
  BanHealer:     { type: 'class', value: 'Healer',    banned: true },
  BanMage:       { type: 'class', value: 'Mage',      banned: true },

  // At least N element
  AtLeast1_Fire:    { type: 'element', value: 'Fire',  banned: false, atLeast: 1 },
  AtLeast2_Fire:    { type: 'element', value: 'Fire',  banned: false, atLeast: 2 },
  AtLeast1_Water:   { type: 'element', value: 'Water', banned: false, atLeast: 1 },
  AtLeast2_Water:   { type: 'element', value: 'Water', banned: false, atLeast: 2 },
  AtLeast1_Earth:   { type: 'element', value: 'Earth', banned: false, atLeast: 1 },
  AtLeast2_Earth:   { type: 'element', value: 'Earth', banned: false, atLeast: 2 },
  AtLeast1_Light:   { type: 'element', value: 'Light', banned: false, atLeast: 1 },
  AtLeast2_Light:   { type: 'element', value: 'Light', banned: false, atLeast: 2 },
  AtLeast1_Dark:    { type: 'element', value: 'Dark',  banned: false, atLeast: 1 },
  AtLeast2_Dark:    { type: 'element', value: 'Dark',  banned: false, atLeast: 2 },

  // At least N class
  AtLeast1_Striker:  { type: 'class', value: 'Striker',  banned: false, atLeast: 1 },
  AtLeast2_Striker:  { type: 'class', value: 'Striker',  banned: false, atLeast: 2 },
  AtLeast1_Defender: { type: 'class', value: 'Defender', banned: false, atLeast: 1 },
  AtLeast2_Defender: { type: 'class', value: 'Defender', banned: false, atLeast: 2 },
  AtLeast1_Ranger:   { type: 'class', value: 'Ranger',  banned: false, atLeast: 1 },
  AtLeast2_Ranger:   { type: 'class', value: 'Ranger',  banned: false, atLeast: 2 },
  AtLeast1_Healer:   { type: 'class', value: 'Healer',  banned: false, atLeast: 1 },
  AtLeast2_Healer:   { type: 'class', value: 'Healer',  banned: false, atLeast: 2 },
  AtLeast1_Mage:     { type: 'class', value: 'Mage',    banned: false, atLeast: 1 },
  AtLeast2_Mage:     { type: 'class', value: 'Mage',    banned: false, atLeast: 2 },

  // Star restrictions
  Only3Star:      { type: 'star', stars: 3 },
  AtLeast1_1Star: { type: 'star', stars: 1, atLeast: 1 },
  AtLeast2_1Star: { type: 'star', stars: 1, atLeast: 2 },
  AtLeast1_2Star: { type: 'star', stars: 2, atLeast: 1 },
  AtLeast2_2Star: { type: 'star', stars: 2, atLeast: 2 },
  AtLeast1_3Star: { type: 'star', stars: 3, atLeast: 1 },

  // Other
  Max3: { type: 'text', label: 'Max 3' },
};

/* ── Ban overlay (game ban icon) ── */

function BanOverlay() {
  return (
    <span className="absolute inset-0 z-10 flex items-center justify-center">
      <Image
        src="/images/ui/common/CT_Ban_Icon.webp"
        alt=""
        width={20}
        height={20}
      />
    </span>
  );
}

/* ── Single restriction icon ── */

export function RestrictionIcon({ id }: { id: string }) {
  const info = RESTRICTION_ICON_MAP[id];
  if (!info) return <span className="text-xs text-zinc-500">{id}</span>;

  switch (info.type) {
    case 'element':
      return (
        <span className="inline-flex items-center gap-0.5 shrink-0">
          {info.atLeast != null && (
            <span className="text-xs font-medium text-amber-300">{info.atLeast}×</span>
          )}
          <span className="relative inline-block h-7 w-7 shrink-0">
            <Image
              src={`/images/ui/elem/CM_Element_${info.value}.webp`}
              alt={info.value}
              fill
              sizes="28px"
              className="object-contain"
            />
            {info.banned && <BanOverlay />}
          </span>
        </span>
      );

    case 'class':
      return (
        <span className="inline-flex items-center gap-0.5 shrink-0">
          {info.atLeast != null && (
            <span className="text-xs font-medium text-amber-300">{info.atLeast}×</span>
          )}
          <span className="relative inline-block h-7 w-7 shrink-0">
            <Image
              src={`/images/ui/class/CM_Class_${info.value}.webp`}
              alt={info.value}
              fill
              sizes="28px"
              className="object-contain"
            />
            {info.banned && <BanOverlay />}
          </span>
        </span>
      );

    case 'star': {
      return (
        <span className="inline-flex items-center gap-0.5 shrink-0">
          {info.atLeast != null && (
            <span className="text-xs font-medium text-amber-300">{info.atLeast}×</span>
          )}
          <Image
            src={`/images/ui/star/CM_Work_Tab_Siar_0${info.stars}_Select.webp`}
            alt={`${info.stars}★`}
            width={info.stars === 1 ? 16 : info.stars === 2 ? 28 : 40}
            height={16}
          />
          {info.atLeast == null && (
            <span className="ml-0.5 text-xs font-medium text-amber-300">only</span>
          )}
        </span>
      );
    }

    case 'text':
      return (
        <span className="inline-block shrink-0 rounded bg-zinc-700/50 px-1.5 py-0.5 text-xs font-medium text-zinc-300">
          {info.label}
        </span>
      );
  }
}

/* ── Row of restriction icons (used as tab label) ── */

export default function RestrictionIcons({ restrictions }: { restrictions?: string[] }) {
  if (!restrictions || restrictions.length === 0) return null;

  return (
    <span className="inline-flex items-center gap-1.5">
      {restrictions.map((r, i) => (
        <RestrictionIcon key={i} id={r} />
      ))}
    </span>
  );
}
