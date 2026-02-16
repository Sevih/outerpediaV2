'use client';

import InlineIcon from './InlineIcon';

type Props = {
  name: string;
  subclass?: string;
};

export default function ClassInline({ name, subclass }: Props) {
  const displayName = subclass || name;

  return (
    <InlineIcon
      icon={`/images/ui/class/${name.toLowerCase()}.webp`}
      label={displayName}
      color="text-class"
      underline={false}
    />
  );
}
