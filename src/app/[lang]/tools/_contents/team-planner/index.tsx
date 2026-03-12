import { getCharactersForList } from '@/lib/data/characters';
import { getBuffs, getDebuffs } from '@/lib/data/effects';
import TeamPlannerClient from './TeamPlannerClient';

export default async function TeamPlannerTool() {
  const [characters, buffs, debuffs] = await Promise.all([
    getCharactersForList(),
    getBuffs(),
    getDebuffs(),
  ]);

  const buffMap = Object.fromEntries(buffs.map((b) => [b.name, b]));
  const debuffMap = Object.fromEntries(debuffs.map((d) => [d.name, d]));

  return (
    <TeamPlannerClient
      characters={characters}
      buffMap={buffMap}
      debuffMap={debuffMap}
    />
  );
}
