'use client';

import { useEffect, useState, type ReactNode } from 'react';

import type { ElementType } from '@/types/enums';
import { ELEMENT_BG, ELEMENT_TEXT } from '@/lib/theme';

type Props = {
  endDate: string;
  element: ElementType;
  endsInLabel: string;
};

function formatTimeLeft(ms: number): string {
  if (ms <= 0) return '';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function BannerCountdown({ endDate, element, endsInLabel }: Props) {
  const [mounted, setMounted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const end = new Date(endDate + 'T00:00:00Z').getTime();
    const update = () => setTimeLeft(end - Date.now());
    update();
    setMounted(true);
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [endDate]);

  if (!mounted) return <span className="inline-block h-5 w-20 rounded bg-zinc-800/50" />;

  if (timeLeft <= 0) return null;

  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${ELEMENT_BG[element]}/20 ${ELEMENT_TEXT[element]}`}
    >
      {endsInLabel} {formatTimeLeft(timeLeft)}
    </span>
  );
}

/** Wrapper that hides its children once the banner has ended */
export function BannerWrapper({ endDate, children }: { endDate: string; children: ReactNode }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const end = new Date(endDate + 'T00:00:00Z').getTime();
    const check = () => {
      if (Date.now() >= end) setVisible(false);
    };
    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [endDate]);

  if (!visible) return null;
  return <>{children}</>;
}
