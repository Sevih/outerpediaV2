/**
 * Language Detection and Text Decoding Module
 *
 * Port of ParserV3/lang.py - Handles multi-language content decoding
 * from OUTERPLANE game data files (Korean, Japanese, English, Chinese).
 *
 * Uses encoding detection heuristics + language priors to pick the best
 * decoding for each field based on its column name.
 */

// Node.js built-in for legacy encoding support
import * as iconv from 'iconv-lite';

// ─── Text normalization ─────────────────────────────────────────────

function normalizePost(s: string): string {
  // NFKC normalization + replace typographic apostrophe
  return s.normalize('NFKC').replace(/\u2019/g, "'").trim();
}

// ─── Script scoring ─────────────────────────────────────────────────

function scoreHangul(s: string): number {
  let count = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0xAC00 && cp <= 0xD7A3) count++;
  }
  return count;
}

function scoreKana(s: string): number {
  let count = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if ((cp >= 0x3040 && cp <= 0x309F) || (cp >= 0x30A0 && cp <= 0x30FF)) count++;
  }
  return count;
}

function scoreCjk(s: string): number {
  let count = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0x4E00 && cp <= 0x9FFF) count++;
  }
  return count;
}

function scoreLatin(s: string): number {
  let count = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if ((cp >= 0x41 && cp <= 0x5A) || (cp >= 0x61 && cp <= 0x7A)) count++;
  }
  return count;
}

function penaltyReplacement(s: string): number {
  let count = 0;
  for (const ch of s) {
    if (ch === '\uFFFD') count++;
  }
  return count;
}

function scoreOverall(s: string): number {
  return (
    4 * scoreHangul(s) +
    3 * scoreKana(s) +
    2 * scoreCjk(s) +
    1 * scoreLatin(s) -
    10 * penaltyReplacement(s)
  );
}

// ─── Mojibake detection ─────────────────────────────────────────────

function nonAsciiCount(s: string): number {
  let count = 0;
  for (const ch of s) {
    if (ch.codePointAt(0)! > 0x7F) count++;
  }
  return count;
}

const MOJIBAKE_MARKERS = ['â€™', 'â€œ', 'â€\x9d', 'ï¼', 'Â', 'ãƒ', 'ã‚', 'ã\u0083', 'ã‚©', '窶'];

function mojibakeMarkers(s: string): number {
  let count = 0;
  for (const marker of MOJIBAKE_MARKERS) {
    let idx = 0;
    while ((idx = s.indexOf(marker, idx)) !== -1) {
      count++;
      idx += marker.length;
    }
  }
  return count;
}

// ─── Language priors ────────────────────────────────────────────────

interface LangPrior {
  hangul: number;
  kana: number;
  cjk: number;
  latin: number;
}

const LANG_PRIORS: Record<string, LangPrior> = {
  korean:            { hangul: 30, kana: 0,  cjk: 0,  latin: 0  },
  english:           { hangul: 0,  kana: 0,  cjk: 0,  latin: 10 },
  japanese:          { hangul: 0,  kana: 25, cjk: 10, latin: 0  },
  china_simplified:  { hangul: 0,  kana: 0,  cjk: 25, latin: 0  },
  china_traditional: { hangul: 0,  kana: 0,  cjk: 25, latin: 0  },
};

const LANG_ALIASES: Record<string, string> = {
  kr: 'korean', kor: 'korean', ko: 'korean',
  en: 'english', eng: 'english',
  jp: 'japanese', jpn: 'japanese', ja: 'japanese',
  zh_cn: 'china_simplified', 'zh-hans': 'china_simplified', zh_hans: 'china_simplified',
  chinese_simplified: 'china_simplified',
  zh_tw: 'china_traditional', 'zh-hant': 'china_traditional', zh_hant: 'china_traditional',
  chinese_traditional: 'china_traditional',
};

function canonicalLangKey(colName: string): string {
  const k = colName.trim().toLowerCase().replace(/ /g, '_');
  return LANG_ALIASES[k] ?? LANG_PRIORS[k] ? k : k;
}

// ─── Encoding candidates ───────────────────────────────────────────

const ENCODINGS = ['utf-8', 'cp949', 'cp932', 'euc-kr', 'shiftjis', 'euc-jp', 'gb18030'] as const;

interface Candidate {
  text: string;
  origin: string;
}

function candidatesWithOrigin(raw: Buffer): Candidate[] {
  // UTF-8 first: if valid, it's authoritative — game data is UTF-8
  try {
    const txt = new TextDecoder('utf-8', { fatal: true }).decode(raw);
    return [{ text: txt, origin: 'bytes:utf-8' }];
  } catch {
    // Not valid UTF-8 — try legacy encodings
  }

  const cands: Candidate[] = [];

  for (const enc of ENCODINGS) {
    if (enc === 'utf-8') continue; // already tried
    if (iconv.encodingExists(enc)) {
      try {
        const txt = iconv.decode(raw, enc);
        cands.push({ text: txt, origin: `bytes:${enc}` });
      } catch {
        // Encoding failed
      }
    }
  }

  // Fallback: latin-1 always succeeds
  if (cands.length === 0) {
    cands.push({ text: iconv.decode(raw, 'latin1'), origin: 'bytes:latin-1' });
  }

  return cands;
}

// ─── Scoring with prior ────────────────────────────────────────────

function scoreWithPriorAndOrigin(s: string, prior: LangPrior, origin: string): number {
  const h = scoreHangul(s);
  const ka = scoreKana(s);
  const cj = scoreCjk(s);
  const la = scoreLatin(s);
  const rep = penaltyReplacement(s);

  // Base score
  let score = 4 * h + 3 * ka + 2 * cj + 1 * la - 10 * rep;

  // Language-specific bonuses
  score += (h ? prior.hangul : 0) + (ka ? prior.kana : 0) + (cj ? prior.cjk : 0) + (la ? prior.latin : 0);

  // Detect target language
  const isEn = prior.latin >= 10 && prior.kana === 0 && prior.hangul === 0 && prior.cjk === 0;
  const isKo = prior.hangul >= 30;
  const isJa = prior.kana >= 25;
  const isZh = prior.cjk >= 25 && prior.kana === 0;

  // Penalties for unexpected scripts
  if (isEn) {
    score -= cj * 100 + ka * 120 + h * 140;
    score -= 2 * nonAsciiCount(s);
    score -= 25 * mojibakeMarkers(s);
  } else if (isKo) {
    score -= ka * 40 + cj * 20;
  } else if (isZh) {
    score -= ka * 40 + h * 40;
  } else if (isJa) {
    score -= h * 60;
  }

  // Encoding origin bonuses
  if (origin.startsWith('bytes:utf-8')) score += 40;
  if (origin.startsWith('str-latin1->')) score -= 25;

  return score;
}

// ─── Main API ───────────────────────────────────────────────────────

/**
 * Decode raw bytes with language-aware heuristics.
 *
 * Tries multiple encodings and selects the best one based on
 * language hints from the field/column name.
 */
export function decodeWithLangPrior(fieldName: string | null, raw: Buffer | null): string {
  if (!raw || raw.length === 0) return '';

  const key = canonicalLangKey(fieldName ?? '');
  const prior = LANG_PRIORS[key] ?? null;

  const cands = candidatesWithOrigin(raw);
  if (cands.length === 0) {
    return normalizePost(iconv.decode(raw, 'latin1'));
  }

  let best = '';
  let bestScore = -Infinity;

  for (const { text, origin } of cands) {
    const sc = prior
      ? scoreWithPriorAndOrigin(text, prior, origin)
      : scoreOverall(text) + (origin.startsWith('bytes:utf-8') ? 20 : 0);

    if (sc > bestScore) {
      best = text;
      bestScore = sc;
    }
  }

  return normalizePost(best);
}
