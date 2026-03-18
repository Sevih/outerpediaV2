'use client';

import { useState } from 'react';

const TABS = [
  { key: 'weapons', label: 'Weapons' },
  { key: 'accessories', label: 'Accessories' },
  { key: 'armors', label: 'Armor Sets' },
  { key: 'talismans', label: 'Talismans' },
  { key: 'ee', label: 'Exclusive Equipment' },
] as const;

type Tab = (typeof TABS)[number]['key'];

export default function EquipmentEditorPage() {
  const [tab, setTab] = useState<Tab>('weapons');

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Equipment Editor</h1>

      <div className="flex gap-1 border-b border-zinc-800">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-zinc-800 p-8 text-center text-zinc-500">
        {TABS.find(t => t.key === tab)?.label} editor — coming soon
      </div>
    </div>
  );
}
