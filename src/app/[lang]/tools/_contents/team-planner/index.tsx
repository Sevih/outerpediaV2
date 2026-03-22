import { getCharactersForList } from '@/lib/data/characters';
import { getBuffs, getDebuffs, getSkillBuffs } from '@/lib/data/effects';
import TeamPlannerClient from './TeamPlannerClient';

export default async function TeamPlannerTool() {
  const [characters, buffs, debuffs, skillBuffs] = await Promise.all([
    getCharactersForList(),
    getBuffs(),
    getDebuffs(),
    getSkillBuffs(),
  ]);

  const buffMap = Object.fromEntries(buffs.map((b) => [b.name, b]));
  const debuffMap = Object.fromEntries(debuffs.map((d) => [d.name, d]));

  return (
    <TeamPlannerClient
      characters={characters}
      buffMap={buffMap}
      debuffMap={debuffMap}
      skillBuffs={skillBuffs}
    />
  );
}
