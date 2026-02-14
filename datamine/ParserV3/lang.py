"""
Language Detection and Text Decoding Module

This module provides advanced text decoding with language-aware heuristics to handle
multi-language content from game data files (Korean, Japanese, English, Chinese).

Key Features:
- Automatic encoding detection (UTF-8, CP949, Shift-JIS, EUC-KR, GB18030, etc.)
- Language-specific priors to improve decoding accuracy
- Mojibake detection and correction
- Script scoring (Hangul, Kana, CJK, Latin)
- Unicode normalization (NFKC)

Usage:
    from lang import decode_with_lang_prior

    # Decode with language hint
    korean_text = decode_with_lang_prior("Korean", raw_bytes)
    english_text = decode_with_lang_prior("English", raw_bytes)
    japanese_text = decode_with_lang_prior("Japanese", raw_bytes)

Author: ParserV3
Date: 2025-10
"""
from typing import Optional, Union, Iterable, List, Tuple
import unicodedata


# =============================================================================
# TEXT NORMALIZATION
# =============================================================================

def _normalize_post(s: str) -> str:
    """
    Normalize text after decoding using NFKC and fix common issues

    - Applies NFKC normalization (compatibility decomposition + canonical composition)
    - Converts typographic apostrophe (U+2019) to ASCII apostrophe
    - Strips leading/trailing whitespace

    Args:
        s: String to normalize

    Returns:
        Normalized string
    """
    # NFKC normalization + replace typographic apostrophe with ASCII
    return unicodedata.normalize("NFKC", s).replace("\u2019", "'").strip()


# =============================================================================
# SCRIPT SCORING - Count characters from different writing systems
# =============================================================================

def _score_hangul(s: str) -> int:
    """
    Count Hangul (Korean) characters in string

    Unicode range: U+AC00 to U+D7A3 (Hangul Syllables block)

    Args:
        s: Input string

    Returns:
        Number of Hangul characters
    """
    return sum(1 for ch in s if '\uAC00' <= ch <= '\uD7A3')


def _score_kana(s: str) -> int:
    """
    Count Kana (Japanese) characters in string

    Includes both:
    - Hiragana: U+3040 to U+309F
    - Katakana: U+30A0 to U+30FF

    Args:
        s: Input string

    Returns:
        Number of Kana characters
    """
    return sum(1 for ch in s if ('\u3040' <= ch <= '\u309F') or ('\u30A0' <= ch <= '\u30FF'))


def _score_cjk(s: str) -> int:
    """
    Count CJK (Chinese/Japanese/Korean) Unified Ideographs

    Unicode range: U+4E00 to U+9FFF (CJK Unified Ideographs block)
    Common to Chinese, Japanese Kanji, and Korean Hanja

    Args:
        s: Input string

    Returns:
        Number of CJK characters
    """
    return sum(1 for ch in s if '\u4E00' <= ch <= '\u9FFF')


def _score_latin(s: str) -> int:
    """
    Count Latin alphabet characters (A-Z, a-z)

    Args:
        s: Input string

    Returns:
        Number of Latin characters
    """
    return sum(1 for ch in s if ('A' <= ch <= 'Z') or ('a' <= ch <= 'z'))


def _penalty_replacement(s: str) -> int:
    """
    Count replacement characters indicating decoding errors

    Checks for:
    - U+FFFD (Unicode replacement character)
    - '�' (visible replacement character)

    Args:
        s: Input string

    Returns:
        Number of replacement characters (indicates bad decoding)
    """
    return s.count('\uFFFD') + s.count('�')


def _score_overall(s: str) -> int:
    """
    Calculate overall quality score for decoded text

    Scoring weights (higher = more important):
    - Hangul (Korean): 4x weight
    - Kana (Japanese): 3x weight
    - CJK (Chinese/Kanji): 2x weight
    - Latin: 1x weight
    - Replacement chars: -10x penalty (heavily penalized)

    Args:
        s: Decoded string to score

    Returns:
        Overall quality score (higher = better decoding)
    """
    return (4 * _score_hangul(s) +
            3 * _score_kana(s) +
            2 * _score_cjk(s) +
            1 * _score_latin(s) -
            10 * _penalty_replacement(s))


# =============================================================================
# MOJIBAKE DETECTION - Detect common encoding errors
# =============================================================================

def _non_ascii_count(s: str) -> int:
    """
    Count non-ASCII characters (code points > 127)

    Used to detect potential encoding issues in English text

    Args:
        s: Input string

    Returns:
        Number of non-ASCII characters
    """
    return sum(1 for ch in s if ord(ch) > 0x7F)


def _mojibake_markers(s: str) -> int:
    """
    Detect common mojibake (garbled text) patterns

    These patterns often indicate UTF-8 text incorrectly decoded as Latin-1:
    - "â€™" should be "'"
    - "â€œ" should be opening quote (")
    - "ï¼" should be Japanese full-width characters
    - "窶" and similar indicate mangled Japanese text

    Args:
        s: Input string

    Returns:
        Count of mojibake markers (higher = more likely garbled)
    """
    bads = ("â€™", "â€œ", "â€\x9d", "ï¼", "Â", "ãƒ", "ã‚", "ã", "ã‚©", "窶")
    return sum(s.count(b) for b in bads)


# =============================================================================
# LANGUAGE PRIORS - Boost scores for expected languages
# =============================================================================

# Language-specific scoring bonuses to guide decoding
# Higher values = stronger preference for that script type
_LANG_PRIORS = {
    # Primary language names
    "korean":            {"hangul": 30, "kana": 0,  "cjk": 0,  "latin": 0},
    "english":           {"hangul": 0,  "kana": 0,  "cjk": 0,  "latin": 10},
    "japanese":          {"hangul": 0,  "kana": 25, "cjk": 10, "latin": 0},
    "china_simplified":  {"hangul": 0,  "kana": 0,  "cjk": 25, "latin": 0},
    "china_traditional": {"hangul": 0,  "kana": 0,  "cjk": 25, "latin": 0},

    # ISO language codes (aliases)
    "zh_cn":             {"hangul": 0,  "kana": 0,  "cjk": 25, "latin": 0},
    "zh_tw":             {"hangul": 0,  "kana": 0,  "cjk": 25, "latin": 0},
    "zh_hans":           {"hangul": 0,  "kana": 0,  "cjk": 25, "latin": 0},
    "zh_hant":           {"hangul": 0,  "kana": 0,  "cjk": 25, "latin": 0},
    "ko":                {"hangul": 30, "kana": 0,  "cjk": 0,  "latin": 0},
    "ja":                {"hangul": 0,  "kana": 25, "cjk": 10, "latin": 0},
    "en":                {"hangul": 0,  "kana": 0,  "cjk": 0,  "latin": 10},
}


def _canonical_lang_key(col_name: str) -> str:
    """
    Normalize language column names to canonical form

    Handles various naming conventions:
    - Full names: "Korean", "English", "Japanese"
    - ISO codes: "ko", "en", "ja", "zh_cn", "zh_tw"
    - Common abbreviations: "kr", "kor", "jp", "jpn"

    Args:
        col_name: Column/field name from data (e.g., "Korean", "ko", "kr")

    Returns:
        Canonical language key for _LANG_PRIORS lookup
    """
    k = col_name.strip().lower().replace(" ", "_")

    # Normalize Korean variants
    if k in {"korean","kr","kor"}:
        k = "korean"
    # Normalize English variants
    elif k in {"english","en","eng"}:
        k = "english"
    # Normalize Japanese variants
    elif k in {"japanese","jp","jpn"}:
        k = "japanese"
    # Normalize Simplified Chinese variants
    elif k in {"china_simplified","chinese_simplified","zh_cn","zh-hans","zh_hans"}:
        k = "china_simplified"
    # Normalize Traditional Chinese variants
    elif k in {"china_traditional","chinese_traditional","zh_tw","zh-hant","zh_hant"}:
        k = "china_traditional"

    return k


# =============================================================================
# ENCODING CANDIDATES - Generate possible decodings
# =============================================================================

def _candidates_with_origin(raw: Optional[Union[str, bytes]]) -> List[Tuple[str, str]]:
    """
    Generate all possible text decodings with origin tracking

    Tries multiple encodings commonly used in Korean/Japanese/Chinese games:
    - UTF-8: Modern standard
    - CP949: Korean Windows codepage
    - CP932: Japanese Windows codepage (Shift-JIS variant)
    - EUC-KR: Korean Extended Unix Code
    - Shift-JIS: Japanese encoding
    - EUC-JP: Japanese Extended Unix Code
    - GB18030: Chinese encoding
    - Latin-1: Fallback for unrecognized bytes

    Args:
        raw: Raw bytes or string to decode

    Returns:
        List of (decoded_text, origin_label) tuples
        Origin labels help track which encoding was used:
        - "bytes:utf-8": Direct UTF-8 decode (preferred)
        - "str-latin1->cp949": Re-encoded Latin-1 as CP949 (mojibake recovery)
        - "str:asis": Original string unchanged
    """
    cands: List[Tuple[str, str]] = []

    if raw is None:
        return cands

    if isinstance(raw, bytes):
        # Try multiple encodings on raw bytes
        for enc in ("utf-8","cp949","cp932","euc_kr","shift_jis","euc_jp","gb18030"):
            try:
                txt = raw.decode(enc)
                cands.append((txt, f"bytes:{enc}"))
            except UnicodeDecodeError:
                pass

        # Fallback: Latin-1 always succeeds (1-byte mapping)
        if not cands:
            cands.append((raw.decode("latin-1", errors="replace"), "bytes:latin-1"))
    else:
        # String input: Try mojibake recovery (double-encoding fixes)
        # If UTF-8 text was incorrectly decoded as Latin-1, re-encode and decode properly
        for enc in ("utf-8","cp949","cp932","euc_kr","shift_jis","euc_jp","gb18030"):
            try:
                txt = raw.encode("latin1").decode(enc)
                cands.append((txt, f"str-latin1->{enc}"))
            except Exception:
                pass

        # Also keep original string as-is
        cands.append((raw, "str:asis"))

    return cands


# =============================================================================
# SCORING WITH LANGUAGE PRIOR
# =============================================================================

def _score_with_prior_and_origin(s: str, prior: dict, origin: str) -> int:
    """
    Calculate quality score with language-specific priors and origin bonuses

    Scoring components:
    1. Base score from script counts (Hangul, Kana, CJK, Latin)
    2. Bonus from language priors (boosts expected scripts)
    3. Penalties for unexpected scripts in target language
    4. Mojibake detection penalties
    5. Encoding origin bonuses/penalties

    Args:
        s: Decoded string to score
        prior: Language-specific scoring weights (from _LANG_PRIORS)
        origin: Decoding method label (e.g., "bytes:utf-8")

    Returns:
        Quality score (higher = better match for target language)

    Example:
        For Korean text with Korean prior:
        - High Hangul count: Big bonus
        - Kana present: Penalty (unexpected in Korean)
        - UTF-8 origin: Bonus (preferred encoding)
    """
    # Count script types
    h = _score_hangul(s)
    ka = _score_kana(s)
    cj = _score_cjk(s)
    la = _score_latin(s)
    rep = _penalty_replacement(s)

    # Base score: weighted script counts minus replacement penalty
    base = 4*h + 3*ka + 2*cj + 1*la - 10*rep

    # Add language-specific bonuses (only for scripts present in text)
    bonus = (prior.get("hangul",0) if h else 0) + \
            (prior.get("kana",0)   if ka else 0) + \
            (prior.get("cjk",0)    if cj else 0) + \
            (prior.get("latin",0)  if la else 0)

    score = base + bonus

    def penalize(val, weight):
        """Helper to apply weighted penalty"""
        return val * weight

    # Detect target language from priors
    is_en = prior.get("latin",0) >= 10 and prior.get("kana",0)==0 and prior.get("hangul",0)==0 and prior.get("cjk",0)==0
    is_ko = prior.get("hangul",0) >= 30
    is_ja = prior.get("kana",0) >= 25
    is_zh = prior.get("cjk",0)  >= 25 and prior.get("kana",0)==0

    # Apply language-specific penalties for unexpected scripts
    if is_en:
        # English: Penalize ANY Asian scripts heavily
        score -= penalize(cj, 100)   # CJK characters very wrong
        score -= penalize(ka, 120)   # Kana even worse
        score -= penalize(h, 140)    # Hangul worst of all
        score -= 2 * _non_ascii_count(s)  # Non-ASCII rare in English
        score -= 25 * _mojibake_markers(s)  # Heavily penalize garbled text
    elif is_ko:
        # Korean: Kana shouldn't appear, CJK is somewhat okay (Hanja)
        score -= penalize(ka, 40)    # Kana wrong in Korean
        score -= penalize(cj, 20)    # CJK less wrong (Hanja used sometimes)
    elif is_zh:
        # Chinese: No Kana or Hangul expected
        score -= penalize(ka, 40)    # Kana wrong
        score -= penalize(h, 40)     # Hangul wrong
    elif is_ja:
        # Japanese: No Hangul expected (CJK and Kana both fine)
        score -= penalize(h, 60)     # Hangul wrong in Japanese

    # Encoding origin bonuses/penalties
    if origin.startswith("bytes:utf-8"):
        score += 40  # UTF-8 is preferred (modern, universal)
    if origin.startswith("str-latin1->"):
        score -= 25  # Mojibake recovery path (less reliable)

    return score


# =============================================================================
# MAIN API
# =============================================================================

def decode_with_lang_prior(field_name: Optional[str], raw: Optional[Union[str, bytes]]) -> str:
    """
    Decode text with language-aware heuristics

    Main entry point for smart text decoding. Tries multiple encodings and
    selects the best one based on:
    1. Language hints from field name
    2. Script content analysis
    3. Encoding detection
    4. Mojibake detection

    Process:
    1. Detect expected language from field_name ("Korean", "English", etc.)
    2. Generate candidate decodings (UTF-8, CP949, Shift-JIS, etc.)
    3. Score each candidate using language priors
    4. Return highest-scoring result
    5. Apply NFKC normalization

    Args:
        field_name: Column name hinting at language (e.g., "Korean", "English_JP", "ko")
                   Used to apply language-specific scoring bonuses
        raw: Raw bytes or string to decode

    Returns:
        Decoded and normalized string
        Returns empty string if raw is None

    Examples:
        >>> decode_with_lang_prior("Korean", b'\\\\xed\\\\x85\\\\x8c\\\\xec\\\\x8a\\\\xa4\\\\xed\\\\x8a\\\\xb8')
        '테스트'  # Korean "test"

        >>> decode_with_lang_prior("English", b'Hello World')
        'Hello World'

        >>> decode_with_lang_prior("Japanese", b'\\\\xe3\\\\x83\\\\x86\\\\xe3\\\\x82\\\\xb9\\\\xe3\\\\x83\\\\x88')
        'テスト'  # Japanese "test"

        >>> decode_with_lang_prior(None, "some text")
        'some text'  # No language hint, best-effort decoding
    """
    if raw is None:
        return ""

    # Get language-specific priors (empty dict if no hint)
    prior = _LANG_PRIORS.get(_canonical_lang_key(field_name or ""), {})

    # Generate all possible decodings
    cands = _candidates_with_origin(raw)

    # Fallback if no candidates generated
    if not cands:
        if isinstance(raw, bytes):
            return _normalize_post(raw.decode("latin-1", errors="replace"))
        return _normalize_post(str(raw))

    # Find best candidate by score
    best, best_score = "", -10**9
    for txt, origin in cands:
        # Score with language prior if available, else use general scoring
        if prior:
            sc = _score_with_prior_and_origin(txt, prior, origin)
        else:
            # No language hint: use general scoring + UTF-8 bonus
            sc = _score_overall(txt) + (20 if origin.startswith("bytes:utf-8") else 0)

        if sc > best_score:
            best, best_score = txt, sc

    # Normalize and return best result
    return _normalize_post(best)
