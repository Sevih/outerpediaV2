const COLOR_MAP: Record<string, { text: string; border: string }> = {
  sky:    { text: 'text-sky-400',    border: 'border-sky-500' },
  purple: { text: 'text-purple-400', border: 'border-purple-500' },
  green:  { text: 'text-green-400',  border: 'border-green-500' },
  amber:  { text: 'text-amber-400',  border: 'border-amber-500' },
  red:    { text: 'text-red-400',    border: 'border-red-500' },
  rose:   { text: 'text-rose-400',   border: 'border-rose-500' },
  pink:   { text: 'text-pink-400',   border: 'border-pink-500' },
};

type Props = {
  children: React.ReactNode;
  color?: keyof typeof COLOR_MAP;
};

export default function GuideSectionHeading({ children, color = 'sky' }: Props) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.sky;
  return (
    <h3 className={`text-2xl font-bold ${c.text} border-l-4 ${c.border} pl-4 after:hidden`}>
      {children}
    </h3>
  );
}
