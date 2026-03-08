import sharp from 'sharp';
import {
  existsSync,
  readdirSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  openSync,
  readSync,
  closeSync,
} from 'fs';
import { join, extname, basename } from 'path';
import { PATHS } from '../config';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MIN_WIDTH = 250;

type CategoryDef = {
  name: string;
  match: (name: string, w: number, h: number) => boolean;
};

const CATEGORIES: CategoryDef[] = [
  { name: 'Full', match: (_n, w, h) => w === 2048 && h === 1024 },
  { name: 'Banner', match: (n) => /_Banner_/.test(n) },
  { name: 'Cutin', match: (n) => /^T_CutIn_/i.test(n) },
  { name: 'Art', match: (n) => /^T_Demi_/.test(n) },
  { name: 'HeroFullArt', match: (n) => /^IMG_\d+/.test(n) },
];

const EXCLUDE_PATTERNS: RegExp[] = [
  /#/,
  /^T_FX_/,
  /(?:^T_.+_(d|body|cloud|a))/i,
  /^FX_/,
  /^T_DL/,
  /^LOADING_/,
  /^T_\d+/,
  /^sactx/i,
  /^\d+_/,
  /^GUIDE_/,
  /^T_Scenario_/,
  /^TT_ImageBox_/,
  /(noise|planet|ring|moon|lava|rock)/i,
  /^Tex_/,
  /(star|space|throne|sun|magic|lobby)/i,
  /_UI/,
  /(leaves|ruins|room|package)/i,
  /^T_PopUP/,
  /^Day_/,
  /^T_Recruit_Normal\.png$/,
  /^T_Dialog_Title\.png$/,
  /^T_Event_World_/,
  /^Lightmap-/,
  /^Patch_Download_/,
  /^T_RaidBG_/,
  /^T_MC/,
  /^T_Intelligence/,
  /^T_Intro/,
  /^CLG_/,
  /^CM_/,
  /^IG_/,
  /^T_GuildRaidBG_/,
  /^T_MonadGate_/,
  /^T_ScenarioBG_\d+/,
  /^T_ScenarioBG_Ending/,
  /^T_(Water|Wind|Snow|Hologram|Emblem|Burn|Blood|Agit)/,
  /^T_Event_(Coin|Box)/,
  /^colormap_/,
  /^mask_/,
  /^PVP_/,
  /^S02/,
  /^SDF_/,
  /^T_Chase/,
  /^T_Core/,
  /^T_Light/,
  /^T_Nebula/,
  /^T_Banner_/,
];

const EXCLUDE_PATH_PATTERNS: RegExp[] = [/model[\\\/]textures/];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type FileInfo = {
  path: string;
  name: string;
  width: number;
  height: number;
  category: string;
  hash?: string;
};

function getPriorityScore(filename: string): number {
  let score = 0;
  if (filename.includes('T_ScenarioCG_')) score += 100;
  else if (filename.includes('T_ScenarioBG_')) score += 80;
  else if (filename.includes('T_Event_BG_')) score += 20;
  else if (filename.includes('T_Event_CG')) score += 10;
  if (filename.includes('_E2')) score += 50;
  if (filename.startsWith('IMG_')) {
    const match = filename.match(/IMG_(\d+)/);
    if (match) score -= parseInt(match[1], 10) / 1000;
  }
  return score;
}

function getAllFiles(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) return files;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllFiles(fullPath, files);
    } else if (/\.(png|jpg|webp)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function shouldExclude(filePath: string, fileName: string): boolean {
  for (const pattern of EXCLUDE_PATTERNS) {
    if (pattern.test(fileName)) return true;
  }
  for (const pattern of EXCLUDE_PATH_PATTERNS) {
    if (pattern.test(filePath)) return true;
  }
  return false;
}

function getCategory(
  fileName: string,
  width: number,
  height: number,
): string | null {
  for (const cat of CATEGORIES) {
    if (cat.match(fileName, width, height)) return cat.name;
  }
  return null;
}

async function getImageDimensions(
  filePath: string,
): Promise<{ width: number; height: number } | null> {
  try {
    const metadata = await sharp(filePath).metadata();
    return { width: metadata.width!, height: metadata.height! };
  } catch {
    return null;
  }
}

async function computePerceptualHash(
  filePath: string,
): Promise<string | null> {
  try {
    const { data } = await sharp(filePath)
      .resize(16, 16, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i];
    const avg = sum / data.length;

    let hash = '';
    for (let i = 0; i < data.length; i++) {
      hash += data[i] > avg ? '1' : '0';
    }

    let hex = '';
    for (let i = 0; i < hash.length; i += 4) {
      hex += parseInt(hash.slice(i, i + 4), 2).toString(16);
    }
    return hex;
  } catch {
    return null;
  }
}

function getPngDimensions(
  filePath: string,
): { width: number; height: number } | null {
  try {
    const buffer = Buffer.alloc(24);
    const fd = openSync(filePath, 'r');
    readSync(fd, buffer, 0, 24, 0);
    closeSync(fd);
    if (buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') return null;
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Pipeline phases
// ---------------------------------------------------------------------------

async function scanAndFilter(): Promise<FileInfo[]> {
  const allFiles = getAllFiles(PATHS.extractedAssets);
  const validFiles: FileInfo[] = [];

  for (const filePath of allFiles) {
    const fileName = basename(filePath);
    if (shouldExclude(filePath, fileName)) continue;

    const dims = await getImageDimensions(filePath);
    if (!dims || dims.width < MIN_WIDTH) continue;

    const category = getCategory(fileName, dims.width, dims.height);
    if (!category) continue;

    validFiles.push({
      path: filePath,
      name: fileName,
      width: dims.width,
      height: dims.height,
      category,
    });
  }

  return validFiles;
}

async function detectDuplicates(
  files: FileInfo[],
): Promise<{ keep: FileInfo; remove: FileInfo[] }[]> {
  const hashMap = new Map<string, FileInfo[]>();

  for (const file of files) {
    const hash = await computePerceptualHash(file.path);
    if (hash) {
      file.hash = hash;
      if (!hashMap.has(hash)) hashMap.set(hash, []);
      hashMap.get(hash)!.push(file);
    }
  }

  const duplicates: { keep: FileInfo; remove: FileInfo[] }[] = [];
  for (const [, group] of hashMap) {
    if (group.length > 1) {
      group.sort(
        (a, b) => getPriorityScore(b.name) - getPriorityScore(a.name),
      );
      duplicates.push({ keep: group[0], remove: group.slice(1) });
    }
  }
  return duplicates;
}

async function buildExistingHashMap(): Promise<Map<string, string>> {
  const hashMap = new Map<string, string>();
  for (const cat of CATEGORIES) {
    const dir = join(PATHS.wallpaperOutput, cat.name);
    if (!existsSync(dir)) continue;
    const entries = readdirSync(dir).filter((f) => f.endsWith('.png'));
    for (const entry of entries) {
      const hash = await computePerceptualHash(join(dir, entry));
      if (hash) hashMap.set(hash, entry);
    }
  }
  return hashMap;
}

function copyFiles(
  files: FileInfo[],
  skipPaths: Set<string>,
  existingHashes: Map<string, string>,
): number {
  for (const cat of CATEGORIES) {
    const dir = join(PATHS.wallpaperOutput, cat.name);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  let copied = 0;
  const copiedNames = new Map<string, { width: number; height: number }>();

  for (const file of files) {
    if (skipPaths.has(file.path)) continue;
    if (file.hash && existingHashes.has(file.hash)) continue;

    const destDir = join(PATHS.wallpaperOutput, file.category);
    let destName = file.name;
    const key = `${file.category}/${file.name}`;

    if (copiedNames.has(key)) {
      const existing = copiedNames.get(key)!;
      if (existing.width === file.width && existing.height === file.height)
        continue;
      const ext = extname(file.name);
      const base = basename(file.name, ext);
      let counter = 1;
      do {
        destName = `${base}_${counter}${ext}`;
        counter++;
      } while (copiedNames.has(`${file.category}/${destName}`));
    }

    copyFileSync(file.path, join(destDir, destName));
    copiedNames.set(`${file.category}/${destName}`, {
      width: file.width,
      height: file.height,
    });
    copied++;
  }

  return copied;
}

type WallpaperEntry = { f: string; w: number; h: number };

function generateJson(): number {
  const result: Record<string, WallpaperEntry[]> = {};
  let totalCount = 0;

  const simpleCategories = CATEGORIES.map((c) => c.name).filter(
    (n) => n !== 'Full',
  );

  for (const cat of simpleCategories) {
    const dir = join(PATHS.wallpaperOutput, cat);
    if (!existsSync(dir)) {
      result[cat] = [];
      continue;
    }
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.png'))
      .map((f) => f.replace('.png', ''))
      .sort();

    result[cat] = files.map((filename) => {
      const dims = getPngDimensions(join(dir, `${filename}.png`));
      return { f: filename, w: dims?.width ?? 0, h: dims?.height ?? 0 };
    });
    totalCount += files.length;
  }

  // Split Full into subcategories
  const fullDir = join(PATHS.wallpaperOutput, 'Full');
  if (existsSync(fullDir)) {
    const allFiles = readdirSync(fullDir)
      .filter((f) => f.endsWith('.png'))
      .map((f) => f.replace('.png', ''))
      .sort();

    const events = allFiles.filter((f) => f.startsWith('T_Event'));
    const scenario = allFiles.filter((f) => f.startsWith('T_Scenario'));
    const others = allFiles.filter(
      (f) => !f.startsWith('T_Event') && !f.startsWith('T_Scenario'),
    );

    const processFiles = (dir: string, filenames: string[]) =>
      filenames.map((filename) => {
        const dims = getPngDimensions(join(dir, `${filename}.png`));
        return { f: filename, w: dims?.width ?? 0, h: dims?.height ?? 0 };
      });

    result['Full:Events'] = processFiles(fullDir, events);
    result['Full:Scenario'] = processFiles(fullDir, scenario);
    result['Full:Others'] = processFiles(fullDir, others);
    totalCount += allFiles.length;
  }

  // Outerpedia custom wallpapers (scanned from download/Outerpedia/)
  const outerpediaDir = join(PATHS.wallpaperOutput, 'Outerpedia');
  if (existsSync(outerpediaDir)) {
    const outerpediaFiles = readdirSync(outerpediaDir)
      .filter((f) => f.endsWith('.png'))
      .map((f) => f.replace('.png', ''))
      .sort();

    result['Outerpedia'] = outerpediaFiles.map((filename) => {
      const dims = getPngDimensions(join(outerpediaDir, `${filename}.png`));
      return { f: filename, w: dims?.width ?? 0, h: dims?.height ?? 0 };
    });
    totalCount += outerpediaFiles.length;
  } else {
    result['Outerpedia'] = [];
  }

  const outputPath = join(PATHS.generated, 'wallpapers.json');
  writeFileSync(outputPath, JSON.stringify(result, null, 2));

  return totalCount;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function run(): Promise<string> {
  if (!existsSync(PATHS.extractedAssets)) {
    // No datamine — just regenerate JSON from existing files
    const hasOutput = existsSync(PATHS.wallpaperOutput);
    if (!hasOutput) return 'skipped (no datamine, no existing files)';
    const count = generateJson();
    return `json only — ${count} entries`;
  }

  // 1. Hash existing destination files
  const existingHashes = await buildExistingHashMap();

  // 2. Scan and filter source
  const files = await scanAndFilter();

  // 3. Detect duplicates among source files
  const duplicates = await detectDuplicates(files);
  const skipPaths = new Set<string>();
  for (const { remove } of duplicates) {
    for (const f of remove) skipPaths.add(f.path);
  }

  // 4. Copy new files
  const copied = copyFiles(files, skipPaths, existingHashes);

  // 5. Generate JSON
  const total = generateJson();

  const parts = [`${total} entries`];
  if (copied > 0) parts.push(`${copied} new`);
  if (duplicates.length > 0)
    parts.push(`${duplicates.reduce((n, d) => n + d.remove.length, 0)} dupes skipped`);

  return parts.join(', ');
}
