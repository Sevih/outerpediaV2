'use client';

import { useEffect, useState } from 'react';
import type { Messages } from '@/i18n';

type Props = {
  t: Messages;
};

type ResetTimers = {
  daily: number;
  weekly: number;
  monthly: number;
};

function computeTimers(): ResetTimers {
  const now = Date.now();

  // Daily: next 00:00 UTC
  const nextDaily = new Date();
  nextDaily.setUTCHours(24, 0, 0, 0);

  // Weekly: next Monday 00:00 UTC
  const nextWeekly = new Date();
  const dayOfWeek = nextWeekly.getUTCDay(); // 0=Sun, 1=Mon
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 7 : 8 - dayOfWeek;
  nextWeekly.setUTCDate(nextWeekly.getUTCDate() + daysUntilMonday);
  nextWeekly.setUTCHours(0, 0, 0, 0);
  // If it's Monday 00:00:00 exactly, show next week
  if (nextWeekly.getTime() <= now) {
    nextWeekly.setUTCDate(nextWeekly.getUTCDate() + 7);
  }

  // Monthly: next 1st 00:00 UTC
  const nextMonthly = new Date();
  nextMonthly.setUTCMonth(nextMonthly.getUTCMonth() + 1, 1);
  nextMonthly.setUTCHours(0, 0, 0, 0);
  // If it's the 1st at 00:00:00 exactly, show next month
  if (nextMonthly.getTime() <= now) {
    nextMonthly.setUTCMonth(nextMonthly.getUTCMonth() + 1);
  }

  return {
    daily: nextDaily.getTime() - now,
    weekly: nextWeekly.getTime() - now,
    monthly: nextMonthly.getTime() - now,
  };
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

export default function ServerResets({ t }: Props) {
  const [mounted, setMounted] = useState(false);
  const [timers, setTimers] = useState<ResetTimers>({ daily: 0, weekly: 0, monthly: 0 });

  useEffect(() => {
    setTimers(computeTimers());
    setMounted(true);
    const id = setInterval(() => setTimers(computeTimers()), 1000);
    return () => clearInterval(id);
  }, []);

  const resets = [
    { label: t['home.resets.daily'], ms: timers.daily, color: 'text-green-400' },
    { label: t['home.resets.weekly'], ms: timers.weekly, color: 'text-cyan-400' },
    { label: t['home.resets.monthly'], ms: timers.monthly, color: 'text-amber-400' },
  ];

  return (
    <div className="card-interactive flex flex-col justify-center gap-2 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {t['home.resets.title']}
      </p>
      {resets.map(({ label, ms, color }) => (
        <div key={label} className="flex items-center justify-between gap-4">
          <span className={`text-sm font-semibold ${color}`}>{label}</span>
          {mounted ? (
            <span className="font-mono text-sm tabular-nums text-zinc-200">
              {formatTime(ms)}
            </span>
          ) : (
            <span className="inline-block h-5 w-24 rounded bg-zinc-800/50" />
          )}
        </div>
      ))}
    </div>
  );
}