import { execFileSync, execFile as execFileCb } from 'child_process';
import {
  existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync,
  statSync, renameSync, unlinkSync, rmSync,
} from 'fs';
import { join, parse as parsePath } from 'path';
import { cpus } from 'os';
import { promisify } from 'util';
import { PATHS } from '../config';
import { bundlesChanged, saveStamp } from '../lib/bundle-stamp';

const execFile = promisify(execFileCb);

const AUDIO_DIR = join(process.cwd(), 'public', 'audio', 'AudioClip');
const OUTPUT_DIR = join(process.cwd(), 'public', 'audio', 'bgm');
const MAPPING_OUTPUT = join(PATHS.generated, 'bgm_mapping.json');
const STAMP = join(PATHS.generated, '.bgm-extract-stamp');
const BITRATE = '192k';

const BGM_FILTER = '^(Agitpunkt|Battle_|Boss_|Event_|Guild_Agit|Intro|Lobby_|Remains_|Scene_|Gacha_BGM|Monadgate|Result_|RTPVP_|RuinIsland)';

// ─── Helpers ────────────────────────────────────────────────────────

function which(cmd: string): string | null {
  try {
    const result = execFileSync(process.platform === 'win32' ? 'where' : 'which', [cmd], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return result.trim().split('\n')[0] || null;
  } catch {
    return null;
  }
}

function formatFilenameAsName(filename: string): string {
  let name = filename.replace(/_[Ii]ntro$/, '');
  const isIntro = name !== filename;

  name = name.replace(/_/g, ' ');
  name = name.replace(/([a-zA-Z])(\d)/g, '$1 $2');
  name = name.replace(/([a-z])([A-Z])/g, '$1 $2');
  name = name.replace(/\s+/g, ' ').trim();

  name = name
    .split(' ')
    .map(w => (w === w.toUpperCase() && w.length >= 2 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');

  name = name.replace(/^(Boss|Battle|Scene|Event|Thema|Monadgate)\s+/, '$1 - ');

  if (isIntro) name += ' (Intro)';
  return name;
}

async function getDuration(filePath: string): Promise<number | null> {
  const ffprobe = which('ffprobe');
  if (!ffprobe) return null;
  try {
    const { stdout } = await execFile(ffprobe, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    return Math.round(parseFloat(stdout.trim()) * 10) / 10;
  } catch {
    return null;
  }
}

// ─── Step 1: Extract audio from bundles ─────────────────────────────

function extractAudioFromBundles(): number {
  if (!existsSync(PATHS.datamineCli) || !existsSync(PATHS.datamineBundles)) {
    return -1;
  }

  // Skip if bundles haven't changed since last extraction
  if (!bundlesChanged(STAMP, [OUTPUT_DIR])) return 0;

  const tempDir = join(process.cwd(), 'datamine', '_extracted_bgm_temp');
  mkdirSync(tempDir, { recursive: true });

  const cpuCount = cpus().length;
  const maxTasks = Math.min(Math.max(cpuCount - 4, 1), 16);

  execFileSync(PATHS.datamineCli, [
    PATHS.datamineBundles,
    '--asset-type', 'audio',
    '--output', tempDir,
    '--group-option', 'type',
    '--filter-by-name', BGM_FILTER,
    '--filter-with-regex',
    '--max-export-tasks', String(maxTasks),
    '--log-level', 'warning',
  ], { timeout: 600_000, stdio: 'ignore' });

  // Move WAV files to AudioClip
  mkdirSync(AUDIO_DIR, { recursive: true });
  let extracted = 0;

  const audioClipDir = join(tempDir, 'AudioClip');
  const searchDir = existsSync(audioClipDir) ? audioClipDir : tempDir;

  function moveWavs(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        moveWavs(join(dir, entry.name));
      } else if (entry.name.endsWith('.wav')) {
        try {
          renameSync(join(dir, entry.name), join(AUDIO_DIR, entry.name));
          extracted++;
        } catch {
          // skip
        }
      }
    }
  }
  moveWavs(searchDir);

  rmSync(tempDir, { recursive: true, force: true });
  saveStamp(STAMP);
  return extracted;
}

// ─── Step 2: Extract mapping from parsed JSON ──────────────────────

function extractMappingFromJson(): Record<string, string> {
  const lobbyPath = join(PATHS.adminJson, 'LobbyCustomResourceTemplet.json');
  const textPath = join(PATHS.adminJson, 'TextSystem.json');

  if (!existsSync(lobbyPath) || !existsSync(textPath)) return {};

  const lobbyData = JSON.parse(readFileSync(lobbyPath, 'utf-8'));
  const textData = JSON.parse(readFileSync(textPath, 'utf-8'));

  // Build translations lookup
  const translations: Record<string, string> = {};
  for (const row of textData.data ?? []) {
    if (row.IDSymbol) {
      translations[row.IDSymbol] = row.English ?? '';
    }
  }

  // Extract BGM entries
  const mapping: Record<string, string> = {};
  for (const row of lobbyData.data ?? []) {
    if (row.Type !== 'LRT_BGM') continue;
    const resource = row.ResourceFile ?? '';
    const nameKey = row.NAME ?? '';
    const enName = translations[nameKey] ?? '';
    for (const part of resource.split(',')) {
      const trimmed = part.trim();
      if (trimmed && enName) {
        mapping[trimmed] = enName;
      }
    }
  }

  return mapping;
}

// ─── Step 3: Find intro+main pairs ──────────────────────────────────

interface Pair { baseName: string; mainFile: string; introFile: string }

function findPairs(audioDir: string): { pairs: Pair[]; standalone: string[] } {
  const wavFiles = readdirSync(audioDir).filter(f => f.endsWith('.wav'));
  const byLower = new Map<string, string>();
  for (const f of wavFiles) byLower.set(parsePath(f).name.toLowerCase(), f);

  const pairs: Pair[] = [];
  const processed = new Set<string>();

  for (const [stemLower, filename] of byLower) {
    if (processed.has(stemLower) || stemLower.endsWith('_intro')) continue;
    const introLower = `${stemLower}_intro`;
    if (byLower.has(introLower)) {
      pairs.push({
        baseName: parsePath(filename).name,
        mainFile: filename,
        introFile: byLower.get(introLower)!,
      });
      processed.add(stemLower);
      processed.add(introLower);
    }
  }

  const pairedFiles = new Set<string>();
  for (const p of pairs) {
    pairedFiles.add(p.mainFile.toLowerCase());
    pairedFiles.add(p.introFile.toLowerCase());
  }

  const standalone = wavFiles
    .filter(f => !pairedFiles.has(f.toLowerCase()))
    .sort();

  return { pairs: pairs.sort((a, b) => a.baseName.localeCompare(b.baseName)), standalone };
}

// ─── Step 4: Merge & convert ────────────────────────────────────────

function mergeAndConvert(introPath: string, mainPath: string, outputPath: string): boolean {
  const ffmpeg = which('ffmpeg');
  if (!ffmpeg) return false;
  const listFile = join(parsePath(outputPath).dir, '_concat_list.txt');
  try {
    writeFileSync(listFile, `file '${introPath.replace(/\\/g, '/')}'\nfile '${mainPath.replace(/\\/g, '/')}'\n`);
    execFileSync(ffmpeg, [
      '-y', '-f', 'concat', '-safe', '0',
      '-i', listFile,
      '-b:a', BITRATE, '-map_metadata', '-1',
      outputPath,
    ], { stdio: 'ignore' });
    try { unlinkSync(listFile); } catch {}
    return true;
  } catch {
    try { unlinkSync(listFile); } catch {}
    return false;
  }
}

function convertSingle(inputPath: string, outputPath: string): boolean {
  const ffmpeg = which('ffmpeg');
  if (!ffmpeg) return false;
  try {
    execFileSync(ffmpeg, [
      '-y', '-i', inputPath,
      '-b:a', BITRATE, '-map_metadata', '-1',
      outputPath,
    ], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// ─── Main ───────────────────────────────────────────────────────────

interface MappingEntry {
  file: string;
  name: string;
  name_jp?: string;
  name_kr?: string;
  name_zh?: string;
  size?: number;
  duration?: number;
}

export async function run() {
  const parts: string[] = [];

  // Step 1: Extract audio
  const extracted = extractAudioFromBundles();
  if (extracted > 0) parts.push(`extracted ${extracted} WAVs`);
  else if (extracted === 0) parts.push('WAVs up to date');

  // Step 2: Get name mapping from pre-parsed JSON
  const jukeboxMapping = extractMappingFromJson();

  // Step 3: Check for WAV files
  const wavFiles = existsSync(AUDIO_DIR)
    ? readdirSync(AUDIO_DIR).filter(f => f.endsWith('.wav'))
    : [];

  // Load existing mapping
  const oldMapping = new Map<string, MappingEntry>();
  if (existsSync(MAPPING_OUTPUT)) {
    const entries: MappingEntry[] = JSON.parse(readFileSync(MAPPING_OUTPUT, 'utf-8'));
    for (const entry of entries) oldMapping.set(entry.file.toLowerCase(), entry);
  }

  if (wavFiles.length === 0) {
    // No WAVs — mapping-only mode
    if (Object.keys(jukeboxMapping).length === 0 && oldMapping.size === 0) {
      return 'skipped (no datamine, no WAVs)';
    }

    const allFiles = new Set([
      ...Object.keys(jukeboxMapping),
      ...[...oldMapping.values()].map(e => e.file),
    ]);

    // Remove intro entries if main exists
    const allLower = new Set([...allFiles].map(f => f.toLowerCase()));
    for (const f of [...allFiles]) {
      if (f.toLowerCase().endsWith('_intro') && allLower.has(f.replace(/_[Ii]ntro$/, '').toLowerCase())) {
        allFiles.delete(f);
      }
    }

    const result: MappingEntry[] = [];
    for (const filename of [...allFiles].sort()) {
      const old = oldMapping.get(filename.toLowerCase());
      const name = jukeboxMapping[filename] ?? old?.name ?? formatFilenameAsName(filename);
      const entry: MappingEntry = { file: filename, name };

      if (old?.name_jp) entry.name_jp = old.name_jp;
      if (old?.name_kr) entry.name_kr = old.name_kr;
      if (old?.name_zh) entry.name_zh = old.name_zh;
      if (old?.size != null) entry.size = old.size;
      if (old?.duration != null) entry.duration = old.duration;

      result.push(entry);
    }

    mkdirSync(parsePath(MAPPING_OUTPUT).dir, { recursive: true });
    writeFileSync(MAPPING_OUTPUT, JSON.stringify(result, null, 2), 'utf-8');
    return `mapping only — ${result.length} entries`;
  }

  // Step 4: We have WAVs — merge + convert
  if (!which('ffmpeg')) {
    return 'error: ffmpeg not found';
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const { pairs, standalone } = findPairs(AUDIO_DIR);

  // Clear old MP3s
  for (const f of readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.mp3'))) {
    try { unlinkSync(join(OUTPUT_DIR, f)); } catch {}
  }

  // Merge pairs
  let mergedCount = 0;
  for (const { baseName, mainFile, introFile } of pairs) {
    if (mergeAndConvert(join(AUDIO_DIR, introFile), join(AUDIO_DIR, mainFile), join(OUTPUT_DIR, `${baseName}.mp3`))) {
      mergedCount++;
    }
  }

  // Convert standalone
  let convertedCount = 0;
  for (const filename of standalone) {
    const stem = parsePath(filename).name;
    if (convertSingle(join(AUDIO_DIR, filename), join(OUTPUT_DIR, `${stem}.mp3`))) {
      convertedCount++;
    }
  }

  // Build final mapping
  const allMp3s = readdirSync(OUTPUT_DIR)
    .filter(f => f.endsWith('.mp3'))
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  const result: MappingEntry[] = [];
  for (const mp3 of allMp3s) {
    const stem = parsePath(mp3).name;
    const stemLower = stem.toLowerCase();

    let name = jukeboxMapping[stem] ?? oldMapping.get(stemLower)?.name ?? formatFilenameAsName(stem);
    if (name.endsWith(' (Intro)')) name = name.slice(0, -8);

    const entry: MappingEntry = { file: stem, name };

    const old = oldMapping.get(stemLower);
    if (old?.name_jp) entry.name_jp = old.name_jp;
    if (old?.name_kr) entry.name_kr = old.name_kr;
    if (old?.name_zh) entry.name_zh = old.name_zh;

    const mp3Path = join(OUTPUT_DIR, mp3);
    entry.size = Math.round(statSync(mp3Path).size / (1024 * 1024) * 100) / 100;
    const duration = await getDuration(mp3Path);
    if (duration) entry.duration = duration;

    result.push(entry);
  }

  mkdirSync(parsePath(MAPPING_OUTPUT).dir, { recursive: true });
  writeFileSync(MAPPING_OUTPUT, JSON.stringify(result, null, 2), 'utf-8');

  // Cleanup WAVs
  rmSync(AUDIO_DIR, { recursive: true, force: true });

  const total = mergedCount + convertedCount;
  parts.push(`${result.length} entries ${total} converted`);
  return `done ${parts.join(' | ')}`;
}
