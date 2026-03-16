import { join } from 'path';

const ROOT = process.cwd();

export const PATHS = {
  // Static data (imported from v1)
  characters: join(ROOT, 'data/character'),
  bosses: join(ROOT, 'data/boss'),
  equipment: join(ROOT, 'data/equipment'),
  effects: join(ROOT, 'data/effects'),
  reco: join(ROOT, 'data/reco'),
  guidesContent: join(ROOT, 'src', 'app', '[lang]', 'guides', '_contents'),

  // Generated (auto-built, gitignored)
  generated: join(ROOT, 'data/generated'),

  // Public images
  images: {
    characters: {
      portrait: join(ROOT, 'public/images/characters/portrait'),
      atb: join(ROOT, 'public/images/characters/atb'),
      full: join(ROOT, 'public/images/characters/full'),
      skills: join(ROOT, 'public/images/characters/skills'),
      chain: join(ROOT, 'public/images/characters/chain'),
      ee: join(ROOT, 'public/images/characters/ee'),
      cutin: join(ROOT, 'public/images/characters/cutin'),
    },
    bosses: {
      portrait: join(ROOT, 'public/images/bosses/portrait'),
      mini: join(ROOT, 'public/images/bosses/mini'),
      skill: join(ROOT, 'public/images/bosses/skill'),
    },
    equipment: join(ROOT, 'public/images/equipment'),
    ui: join(ROOT, 'public/images/ui'),
    bg: join(ROOT, 'public/images/bg'),
  },

  // Wallpapers
  wallpaperOutput: join(ROOT, 'public/images/download'),

  // Patch notes
  patchNotes: join(ROOT, 'data/patch-notes'),
  patchNotesImages: join(ROOT, 'public/images/patch-notes'),

  // Admin data
  adminBytes: join(ROOT, 'data/admin/bytes'),
  adminJson: join(ROOT, 'data/admin/json'),

  // Datamine
  datamineFiles: join(ROOT, 'datamine/files'),
  datamineBundles: join(ROOT, 'datamine/files/bundles'),
  datamineCli: join(ROOT, 'datamine/AssetStudioModCLI_net9_win64/AssetStudioModCLI.exe'),
  extractedAssets: join(ROOT, 'datamine/extracted_astudio'),
} as const;
