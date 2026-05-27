/**
 * Round "vs" medallion that sits in the gutter between the PvE and PvP
 * flagship cards. Pure presentation, no JS.
 */
export default function VsBadge() {
  return (
    <div
      aria-hidden
      className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-radial from-zinc-800 to-zinc-950 shadow-[0_0_0_4px_#0a0a0a,0_0_0_5px_#27272a]"
    >
      <span
        className="bg-linear-to-br from-rose-400 to-indigo-400 bg-clip-text font-serif text-lg font-bold tracking-tighter italic text-transparent"
      >
        vs
      </span>
    </div>
  );
}
