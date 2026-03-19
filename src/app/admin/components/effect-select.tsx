'use client';

import { useState } from 'react';
import Image from 'next/image';

export type OptionItem = { id: string; label: string; icon?: string; image?: string };

export function EffectIcon({ icon, type, size = 20 }: { icon: string; type: 'buff' | 'debuff'; size?: number }) {
  const isIrremovable = icon.includes('Interruption');
  const filterClass = isIrremovable ? '' : `${type}-icon`;
  return (
    <span className="relative inline-block shrink-0 rounded bg-black" style={{ width: size, height: size }}>
      <Image
        src={`/images/ui/effect/${icon}.webp`}
        alt=""
        fill
        sizes={`${size}px`}
        className={`object-contain ${filterClass}`}
      />
    </span>
  );
}

export function EffectMultiSelect({ label, selected, options, onChange, type }: {
  label: string;
  selected: string[];
  options: OptionItem[];
  onChange: (v: string[]) => void;
  type: 'buff' | 'debuff';
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    o.id.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  }

  const pillBg = type === 'buff' ? 'bg-buff-bg' : 'bg-debuff-bg';

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
      <div className="flex flex-wrap gap-1 min-h-7">
        {selected.map((id, idx) => {
          const opt = options.find(o => o.id === id);
          return (
            <span key={`${id}-${idx}`} className={`flex items-center gap-1 rounded-md ${pillBg} py-0.5 pr-1.5 pl-0.5 text-[11px] font-semibold text-white`}>
              {opt?.icon && <EffectIcon icon={opt.icon} type={type} size={18} />}
              {opt?.label ?? id}
              <button onClick={() => toggle(id)} className="ml-0.5 text-white/50 hover:text-red-400">×</button>
            </span>
          );
        })}
      </div>
      <div className="relative">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          className="w-full rounded border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
        {open && filtered.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-white/10 bg-zinc-900 shadow-xl">
            {filtered.slice(0, 50).map((o, idx) => (
              <button
                key={`${o.id}-${idx}`}
                onMouseDown={e => { e.preventDefault(); toggle(o.id); }}
                className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-zinc-800 ${selected.includes(o.id) ? 'text-blue-400' : ''}`}
              >
                <span className={`inline-block h-3 w-3 shrink-0 rounded-sm border ${selected.includes(o.id) ? 'border-blue-500 bg-blue-500' : 'border-zinc-600'}`} />
                {o.icon && <EffectIcon icon={o.icon} type={type} size={18} />}
                <span>{o.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
