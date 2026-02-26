type Variant = 'tip' | 'note' | 'warning' | 'info';

const VARIANTS: Record<Variant, { bg: string; border: string }> = {
  tip:     { bg: 'bg-green-900/10',  border: 'border-green-500' },
  note:    { bg: 'bg-blue-900/10',   border: 'border-blue-500' },
  warning: { bg: 'bg-amber-900/10',  border: 'border-amber-500' },
  info:    { bg: 'bg-purple-900/10', border: 'border-purple-500' },
};

type Props = {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
};

export default function Callout({ variant = 'note', children, className = '' }: Props) {
  const v = VARIANTS[variant];
  return (
    <div className={`p-3 ${v.bg} border-l-4 ${v.border} rounded ${className}`}>
      {children}
    </div>
  );
}
