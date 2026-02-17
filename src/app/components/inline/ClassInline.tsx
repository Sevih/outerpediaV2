'use client';

import InlineIcon from './InlineIcon';

type Props = {
  name: string;
  subclass?: string;
};

export default function ClassInline({ name, subclass }: Props) {
  const displayName = subclass || name;
  const icon = subclass
    ? `/images/ui/class/CM_Sub_Class_${subclass}.webp`
    : `/images/ui/class/CM_Class_${name}.webp`;

  return (
    <InlineIcon
      icon={icon}
      label={displayName}
      color="text-class"
      underline={false}
    />
  );
}
