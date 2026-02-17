import Image from 'next/image';

type Props = {
  buffs: string[];
  debuffs: string[];
};

/** Render a row of buff/debuff effect icons */
export default function BuffDebuffDisplay({ buffs, debuffs }: Props) {
  if (!buffs.length && !debuffs.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {buffs.map((b) => (
        <EffectBadge key={b} code={b} type="buff" />
      ))}
      {debuffs.map((d) => (
        <EffectBadge key={d} code={d} type="debuff" />
      ))}
    </div>
  );
}

function EffectBadge({ code, type }: { code: string; type: 'buff' | 'debuff' }) {
  // Stat-based effects use BT_STAT|ST_XXX format — extract the stat name
  const displayName = code.startsWith('BT_STAT|')
    ? code.replace('BT_STAT|ST_', '')
    : code.replace('BT_', '').replace(/_/g, ' ');

  const borderColor = type === 'buff' ? 'border-blue-500/40' : 'border-red-500/40';
  const imagePath = `/images/ui/effect/${code.replace('|', '_')}.webp`;

  return (
    <div
      className={`relative h-7 w-7 rounded border ${borderColor} bg-zinc-800/60`}
      title={displayName}
    >
      <Image
        src={imagePath}
        alt={displayName}
        fill
        sizes="28px"
        className="object-contain p-0.5"
      />
    </div>
  );
}
