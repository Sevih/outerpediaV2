type Props = {
  children: React.ReactNode;
  className?: string;
};

export default function ContentCard({ children, className = '' }: Props) {
  return (
    <div className={`bg-linear-to-br from-slate-800/50 to-slate-900/30 border border-slate-700 rounded-xl p-6 space-y-3 ${className}`}>
      {children}
    </div>
  );
}
