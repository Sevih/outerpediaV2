'use client';

import { useEffect, useState } from 'react';

type Props = {
  /** Template containing "{time}" — e.g. "Next reset in {time}". */
  template: string;
  className?: string;
};

/** ms remaining until the next 00:00 UTC tick (when the daily boss swap happens). */
function untilNextDailyReset(): number {
  const next = new Date();
  next.setUTCHours(24, 0, 0, 0);
  return next.getTime() - Date.now();
}

function formatTime(ms: number): string {
  if (ms <= 0) return '0s';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export default function SingularityCountdown({ template, className }: Props) {
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    setMs(untilNextDailyReset());
    const id = setInterval(() => setMs(untilNextDailyReset()), 1000);
    return () => clearInterval(id);
  }, []);

  if (ms === null) {
    return <span className={className} aria-hidden />;
  }

  return (
    <span className={className}>
      {template.replace('{time}', formatTime(ms))}
    </span>
  );
}
