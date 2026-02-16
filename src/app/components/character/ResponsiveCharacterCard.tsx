'use client';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import CharacterCard from './CharacterCard';
import type { Props as CharacterCardProps, CharacterCardSize } from './CharacterCard';

type ResponsiveSize = {
  base: CharacterCardSize;
  md?: CharacterCardSize;
  lg?: CharacterCardSize;
};

type Props = Omit<CharacterCardProps, 'size'> & {
  /** Responsive size map: base (mobile), md (768px+), lg (1024px+) */
  size?: ResponsiveSize;
};

const DEFAULT_SIZE: ResponsiveSize = { base: 'sm', md: 'md', lg: 'lg' };

export default function ResponsiveCharacterCard({
  size = DEFAULT_SIZE,
  ...props
}: Props) {
  const isMd = useMediaQuery('(min-width: 768px)');
  const isLg = useMediaQuery('(min-width: 1024px)');

  let resolved: CharacterCardSize = size.base;
  if (isMd && size.md) resolved = size.md;
  if (isLg && size.lg) resolved = size.lg;

  return <CharacterCard {...props} size={resolved} />;
}
