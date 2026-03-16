import fs from 'fs/promises';
import path from 'path';

const SECTION_DIRS: Record<string, string> = {
  character: path.join(process.cwd(), 'data', 'character'),
};

async function countFiles(key: string, ext = '.json') {
  const dir = SECTION_DIRS[key];
  if (!dir) return 0;
  try {
    const files = await fs.readdir(dir);
    return files.filter(f => f.endsWith(ext)).length;
  } catch {
    return 0;
  }
}

const sections = [
  { name: 'Characters', href: '/admin/characters', dir: 'character' },
  { name: 'Extractor', href: '/admin/extractor', dir: '' },
  { name: 'Parser', href: '/admin/parser', dir: '' },
];

export default async function AdminDashboard() {
  const counts = await Promise.all(sections.map(s => countFiles(s.dir)));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section, i) => (
          <a
            key={section.name}
            href={section.href}
            className="rounded-lg border border-zinc-800 p-6 transition-colors hover:border-zinc-600 hover:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold">{section.name}</h2>
            <p className="mt-1 text-sm text-zinc-400">{counts[i]} files</p>
          </a>
        ))}
      </div>
    </div>
  );
}
