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
};

/**
 * Base inline component: icon (18px) + colored label.
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
}: Props) {
  const inner = (
    <span className={`inline-flex items-center gap-0.5 align-middle ${color}`}>
      <span className="relative inline-block h-4.5 w-4.5 shrink-0">
        <Image
          src={icon}
          alt=""
          fill
          sizes="18px"
          className={`object-contain ${imageClassName ?? ''}`}
        />
      </span>
      <span className={underline ? 'underline' : ''}>{label}</span>
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
