'use client';

import stats from '@data/stats.json';
import InlineIcon from './InlineIcon';

type StatEntry = { label: string; icon: string };
const statsMap = stats as Record<string, StatEntry>;

type Props = { name: string };

export default function StatInline({ name }: Props) {
  const stat = statsMap[name];
  if (!stat) {
    return <span className="text-red-500">{name}</span>;
  }

  return (
    <InlineIcon
      icon={`/images/ui/effect/${stat.icon}`}
      label={stat.label}
      color="text-stat"
      underline={false}
    />
  );
}
