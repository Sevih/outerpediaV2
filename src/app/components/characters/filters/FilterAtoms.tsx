'use client';

import Image from 'next/image';
import type { ElementType, RoleType } from '@/types/enums';

export const ELEMENT_HEX: Record<ElementType, string> = {
  Fire: '#ff6b6b',
  Water: '#4dabf7',
  Earth: '#51cf66',
  Light: '#ffe066',
  Dark: '#cc5de8',
};

export const ROLE_HEX: Record<RoleType, string> = {
  dps: '#e11d48',
  support: '#0284c7',
  sustain: '#059660',
};

export const RARITY_HEX: Record<1 | 2 | 3, string> = {
  1: '#e5e7eb',
  2: '#93c5fd',
  3: '#f87171',
};

export const TONE = {
  cyan: '#22d3ee',
  amber: '#fbbf24',
  emerald: '#4ade80',
  rose: '#f87171',
  indigo: '#6366f1',
} as const;

// ── IconPill — square colored toggle (used for elements, classes) ──

type IconPillProps = {
  active: boolean;
  color: string;
  onClick: () => void;
  size?: 'sm' | 'md';
  title?: string;
  children: React.ReactNode;
  'aria-label'?: string;
};

export function IconPill({
  active, color, onClick, size = 'md', title, children, ...rest
}: IconPillProps) {
  const dim = size === 'sm' ? 32 : 36;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      aria-label={rest['aria-label']}
      style={{
        width: dim,
        height: dim,
        borderColor: active ? `${color}99` : '#27272a',
        background: active ? `${color}22` : undefined,
        boxShadow: active ? `inset 0 0 0 1px ${color}44, 0 0 14px ${color}26` : undefined,
      }}
      className={`flex shrink-0 items-center justify-center rounded-lg border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-filter-ring ${active ? '' : 'bg-slate-900/80'}`}
    >
      {children}
    </button>
  );
}

// ── ElementIconPill — element image with colored ring ──

export function ElementIconPill({
  element, active, onClick, size = 'md',
}: {
  element: ElementType;
  active: boolean;
  onClick: () => void;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 18 : 20;
  return (
    <IconPill
      active={active}
      color={ELEMENT_HEX[element]}
      onClick={onClick}
      size={size}
      title={element}
      aria-label={element}
    >
      <span className="relative block" style={{ width: dim, height: dim }}>
        <Image
          src={`/images/ui/elem/CM_Element_${element}.webp`}
          alt=""
          fill
          sizes="20px"
          className="object-contain"
          unoptimized
        />
      </span>
    </IconPill>
  );
}

// ── ClassIconPill — class image with cyan ring when active ──

export function ClassIconPill({
  classType, active, onClick, size = 'md',
}: {
  classType: string;
  active: boolean;
  onClick: () => void;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 18 : 20;
  return (
    <IconPill
      active={active}
      color={TONE.cyan}
      onClick={onClick}
      size={size}
      title={classType}
      aria-label={classType}
    >
      <span className="relative block" style={{ width: dim, height: dim }}>
        <Image
          src={`/images/ui/class/CM_Class_${classType}.webp`}
          alt=""
          fill
          sizes="20px"
          className="object-contain"
          unoptimized
        />
      </span>
    </IconPill>
  );
}

// ── StarPill — rarity toggle ──

export function StarPill({
  stars, active, onClick,
}: {
  stars: 1 | 2 | 3;
  active: boolean;
  onClick: () => void;
}) {
  const color = RARITY_HEX[stars];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${stars} star`}
      style={{
        borderColor: active ? `${color}99` : '#27272a',
        background: active ? `${color}1f` : undefined,
      }}
      className={`inline-flex h-8 shrink-0 items-center gap-0.5 rounded-lg border px-2.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-filter-ring ${active ? '' : 'bg-slate-900/80'}`}
    >
      {Array.from({ length: stars }, (_, i) => (
        <Image
          key={i}
          src="/images/ui/star/CM_icon_star_y.webp"
          alt=""
          width={14}
          height={14}
          style={{ width: 14, height: 14 }}
          unoptimized
        />
      ))}
    </button>
  );
}

// ── ActiveChip — pill with × remove ──

export function ActiveChip({
  label, color = TONE.cyan, prefix, onRemove,
}: {
  label: React.ReactNode;
  color?: string;
  prefix?: string;
  onRemove: () => void;
}) {
  return (
    <span
      style={{
        borderColor: `${color}55`,
        background: `${color}14`,
        color,
      }}
      className="inline-flex h-6.5 shrink-0 items-center gap-1.5 rounded-full border pl-2.5 pr-1 text-xs"
    >
      {prefix && (
        <span
          style={{ color, opacity: 0.7 }}
          className="font-mono text-[9px] uppercase tracking-wider"
        >
          {prefix}
        </span>
      )}
      <span style={{ color }} className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="remove"
        style={{ background: `${color}22` }}
        className="ml-0.5 inline-flex size-4 cursor-pointer items-center justify-center rounded-full transition hover:brightness-125"
      >
        <svg width="8" height="8" viewBox="0 0 8 8">
          <path d="M1 1l6 6M7 1l-6 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </span>
  );
}

// ── LogicToggle — AND / OR segmented control ──

export function LogicToggle({
  value, onChange, tone = TONE.cyan,
}: {
  value: 'AND' | 'OR';
  onChange: (v: 'AND' | 'OR') => void;
  tone?: string;
}) {
  return (
    <div
      role="radiogroup"
      className="inline-flex h-6.5 overflow-hidden rounded border border-zinc-800 bg-slate-900/80 font-mono text-[10px] tracking-wider"
    >
      {(['AND', 'OR'] as const).map((k, i) => {
        const on = k === value;
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(k)}
            style={{
              background: on ? `${tone}1f` : undefined,
              color: on ? tone : '#71717a',
              borderLeft: i > 0 ? '1px solid #27272a' : undefined,
            }}
            className="px-2 transition focus:outline-none"
          >
            {k}
          </button>
        );
      })}
    </div>
  );
}

// ── Eyebrow — small mono uppercase label ──

export function Eyebrow({
  children, className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 ${className ?? ''}`}>
      {children}
    </span>
  );
}
