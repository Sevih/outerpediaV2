import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'character');

interface CharacterSummary {
  ID: string;
  Fullname: string;
  Rarity: number;
  Element: string;
  Class: string;
  rank: string;
}

async function getCharacters(): Promise<CharacterSummary[]> {
  const files = await fs.readdir(DATA_DIR);
  const characters = await Promise.all(
    files
      .filter(f => f.endsWith('.json'))
      .map(async f => {
        const raw = await fs.readFile(path.join(DATA_DIR, f), 'utf-8');
        const data = JSON.parse(raw);
        return {
          ID: data.ID,
          Fullname: data.Fullname,
          Rarity: data.Rarity,
          Element: data.Element,
          Class: data.Class,
          rank: data.rank,
        };
      })
  );
  return characters.sort((a, b) => a.Fullname.localeCompare(b.Fullname));
}

const ELEMENT_COLORS: Record<string, string> = {
  Fire: 'text-red-400',
  Water: 'text-blue-400',
  Earth: 'text-amber-400',
  Light: 'text-yellow-300',
  Dark: 'text-purple-400',
};

export default async function CharactersListPage() {
  const characters = await getCharacters();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Characters ({characters.length})</h1>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-800 text-zinc-400">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Rarity</th>
              <th className="px-3 py-2">Element</th>
              <th className="px-3 py-2">Class</th>
              <th className="px-3 py-2">Rank</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {characters.map(c => (
              <tr key={c.ID} className="border-b border-zinc-800/50 hover:bg-zinc-900">
                <td className="px-3 py-2 font-mono text-zinc-500">{c.ID}</td>
                <td className="px-3 py-2 font-medium">{c.Fullname}</td>
                <td className="px-3 py-2">{'★'.repeat(c.Rarity)}</td>
                <td className={`px-3 py-2 ${ELEMENT_COLORS[c.Element] ?? ''}`}>{c.Element}</td>
                <td className="px-3 py-2">{c.Class}</td>
                <td className="px-3 py-2 font-bold">{c.rank}</td>
                <td className="px-3 py-2">
                  <a href={`/admin/characters/${c.ID}`} className="text-blue-400 hover:underline">
                    Edit
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
