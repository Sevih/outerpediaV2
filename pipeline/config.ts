import { join } from 'path';

const ROOT = process.cwd();

export const PATHS = {
  // Static data (imported from v1)
  characters: join(ROOT, 'data/char'),
  bosses: join(ROOT, 'data/boss'),
  equipment: join(ROOT, 'data/equipment'),
  effects: join(ROOT, 'data/effects'),
  reco: join(ROOT, 'data/reco'),

  // Generated (auto-built, gitignored)
  generated: join(ROOT, 'data/generated'),

  // Datamine
  parserV3: join(ROOT, 'datamine/ParserV3'),
  datamineFiles: join(ROOT, 'datamine/files'),
  extractedAssets: join(ROOT, 'datamine/extracted_astudio'),
} as const;
