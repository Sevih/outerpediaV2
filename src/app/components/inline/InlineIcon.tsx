'use client';

import Image from 'next/image';
import InlineTooltip from './InlineTooltip';

type Props = {
  icon: string;
  label: string;
  color?: string;
  underline?: boolean;
  imageClassName?: string;
  tooltip?: React.ReactNode;
  tooltipBg?: string;
  size?: number;
};

/**
 * Base inline component: icon + colored label.
 * Optionally wraps in InlineTooltip when tooltip content is provided.
 */
export default function InlineIcon({
  icon,
  label,
  color = 'text-white',
  underline = true,
  imageClassName,
  tooltip,
  tooltipBg,
  size = 18,
}: Props) {
  const inner = (
    <span className={`inline-flex items-center gap-0.5 align-middle ${color}`}>
      <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
        <Image
          src={icon}
          alt={label}
          fill
          sizes={`${size}px`}
          className={`object-contain ${imageClassName ?? ''}`}
        />
      </span>
      {label && <span className={underline ? 'underline' : ''}>{label}</span>}
    </span>
  );

  if (!tooltip) return inner;

  return (
    <InlineTooltip content={tooltip} bg={tooltipBg}>
      <button type="button" className="cursor-default">
        {inner}
      </button>
    </InlineTooltip>
  );
}
