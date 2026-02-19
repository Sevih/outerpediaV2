'use client';

import { StatInline } from '@/app/components/inline';

const TOTAL_SEGMENTS = 6;

type StatTier = { stats: string[]; filled: number };

function parsePrio(raw: string): StatTier[] {
  const tokens = raw.split('>');
  const tiers: StatTier[] = [];
  let level = 0;

  for (const token of tokens) {
    const trimmed = token.trim();
    if (trimmed === '') {
      // ">>" produces an empty token — skip an extra level
      level++;
      continue;
    }
    const stats = trimmed.split('=').map((s) => s.trim());
    tiers.push({ stats, filled: Math.max(1, TOTAL_SEGMENTS - level) });
    level++;
  }

  return tiers;
}

function PrioSegments({ filled }: { filled: number }) {
  return (
    <div className="mt-1 flex gap-0.5">
      {Array.from({ length: TOTAL_SEGMENTS }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-sm ${
            i < filled ? 'bg-yellow-400' : 'bg-zinc-700'
          }`}
        />
      ))}
    </div>
  );
}

type Props = { prio: string };

export default function SubstatPrioBar({ prio }: Props) {
  const tiers = parsePrio(prio);

  return (
    <div className="space-y-2">
      {tiers.map((tier) =>
        tier.stats.map((stat) => (
          <div key={stat}>
            <StatInline name={stat} />
            <PrioSegments filled={tier.filled} />
          </div>
        )),
      )}
    </div>
  );
}