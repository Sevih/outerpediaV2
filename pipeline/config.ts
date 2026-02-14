import { join } from 'path';

const ROOT = process.cwd();

export const PATHS = {
  // Game data (parser output)
  gameCharacters: join(ROOT, 'data/game/characters'),
  gameBosses: join(ROOT, 'data/game/bosses'),
  gameEquipment: join(ROOT, 'data/game/equipment'),
  gameEffects: join(ROOT, 'data/game/effects'),
  gameMeta: join(ROOT, 'data/game/meta'),

  // Generated (auto-built, gitignored)
  generated: join(ROOT, 'data/generated'),
  charactersIndex: join(ROOT, 'data/generated/characters-index.json'),
  slugMap: join(ROOT, 'data/generated/slug-map.json'),
  bossIndex: join(ROOT, 'data/generated/boss-index.json'),
  effectsIndex: join(ROOT, 'data/generated/effects-index.json'),
  characterPools: join(ROOT, 'data/generated/character-pools.json'),
  gearUsage: join(ROOT, 'data/generated/gear-usage.json'),
  substatsMap: join(ROOT, 'data/generated/substats-map.json'),

  // Content (editorial, human-written)
  contentGuides: join(ROOT, 'data/content/guides'),
  contentTeams: join(ROOT, 'data/content/teams'),
  contentReco: join(ROOT, 'data/content/recommendations'),
  contentRaids: join(ROOT, 'data/content/raids'),
  contentNews: join(ROOT, 'data/content/news'),
} as const;
