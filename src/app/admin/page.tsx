import fs from 'fs/promises';
import path from 'path';

const DATA_DIRS: Record<string, string> = {
  character: path.join(process.cwd(), 'data', 'character'),
  equipment: path.join(process.cwd(), 'data', 'equipment'),
  boss: path.join(process.cwd(), 'data', 'boss'),
};

async function countFiles(key: string, ext = '.json') {
  const dir = DATA_DIRS[key];
  if (!dir) return 0;
  try {
    const files = await fs.readdir(dir);
    return files.filter(f => f.endsWith(ext)).length;
  } catch {
    return 0;
  }
}

interface CategoryCard {
  name: string;
  description: string;
  href: string;
  dataKey?: string;
  disabled?: boolean;
}

interface CategoryGroup {
  label: string;
  cards: CategoryCard[];
}

const CATEGORIES: CategoryGroup[] = [
  {
    label: 'Extractor',
    cards: [
      { name: 'Characters', description: 'Extract character data from game files', href: '/admin/extractor/characters', dataKey: 'character' },
      { name: 'Equipment', description: 'Extract equipment data', href: '/admin/extractor/equipment' },
      { name: 'Bosses', description: 'Extract boss data', href: '/admin/extractor/bosses', disabled: true },
      { name: 'Buffs', description: 'Extract buff/debuff data', href: '/admin/extractor/buffs', disabled: true },
    ],
  },
  {
    label: 'Editor',
    cards: [
      { name: 'Characters', description: 'Edit character JSON files', href: '/admin/editor/characters', dataKey: 'character' },
      { name: 'Equipment', description: 'Edit equipment JSON files', href: '/admin/editor/equipment' },
      { name: 'Bosses', description: 'Edit boss JSON files', href: '/admin/editor/bosses', disabled: true },
      { name: 'Buffs', description: 'Edit buff/debuff JSON files', href: '/admin/editor/buffs', disabled: true },
    ],
  },
  {
    label: 'Utils',
    cards: [
      { name: 'Promo Codes', description: 'Manage promo codes', href: '/admin/utils/promo-codes', disabled: true },
      { name: 'Banners', description: 'Manage banners', href: '/admin/utils/banners', disabled: true },
      { name: 'Events', description: 'Manage events', href: '/admin/utils/events', disabled: true },
    ],
  },
  {
    label: 'Tools',
    cards: [
      { name: 'Bytes Parser', description: 'Explore binary game data files', href: '/admin/parser' },
    ],
  },
];

export default async function AdminDashboard() {
  const allDataKeys = [...new Set(
    CATEGORIES.flatMap(g => g.cards.map(c => c.dataKey).filter(Boolean))
  )] as string[];
  const countResults = await Promise.all(allDataKeys.map(k => countFiles(k)));
  const counts = Object.fromEntries(allDataKeys.map((k, i) => [k, countResults[i]]));

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {CATEGORIES.map(group => (
        <section key={group.label}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">{group.label}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {group.cards.map(card => {
              const count = card.dataKey ? counts[card.dataKey] : undefined;

              if (card.disabled) {
                return (
                  <div
                    key={card.href}
                    className="rounded-lg border border-zinc-800/50 p-4 opacity-40"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-zinc-500">{card.name}</h3>
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-600">soon</span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-600">{card.description}</p>
                  </div>
                );
              }

              return (
                <a
                  key={card.href}
                  href={card.href}
                  className="rounded-lg border border-zinc-800 p-4 transition-colors hover:border-zinc-600 hover:bg-zinc-900"
                >
                  <h3 className="font-semibold">{card.name}</h3>
                  <p className="mt-1 text-xs text-zinc-400">{card.description}</p>
                  {count !== undefined && (
                    <p className="mt-2 text-sm text-zinc-500">{count} files</p>
                  )}
                </a>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
