# Changelog — Data Format

## Overview

The changelog tracks all site updates, new features, fixes, and balance changes. Data lives in a single file: `data/changelog.json`.

It is consumed in three places:
- **Changelog page** — `src/app/[lang]/changelog/page.tsx` (full list, localized)
- **RSS feed** — `src/app/feed/route.ts` (last 20 entries, English only)
- **Homepage** — latest entries displayed as recent updates

---

## File structure

`data/changelog.json` is a JSON array of entries, ordered **newest first** (most recent entry at index 0):

```json
[
  {
    "date": "2026-02-11",
    "type": "update",
    "title": {
      "en": "English title",
      "jp": "Japanese title",
      "kr": "Korean title",
      "zh": "Chinese title"
    },
    "content": {
      "en": ["English description line 1", "Line 2"],
      "jp": ["Japanese description"],
      "kr": ["Korean description"],
      "zh": ["Chinese description"]
    },
    "url": "/characters/some-character"
  }
]
```

---

## Fields

### `date` (required)

ISO date string (`YYYY-MM-DD`). Used for display and RSS `<pubDate>`.

### `type` (required)

One of four values:

| Type | Color badge | Usage |
|------|------------|-------|
| `feature` | Green | New site feature or page |
| `update` | Blue | Update to existing content (new character, guide refresh) |
| `fix` | Red | Bug fix |
| `balance` | Amber | Game balance change documentation |

Defined in `src/types/changelog.ts` as `ChangelogType`.

### `title` (required)

`LangMap` — localized title object with keys `en`, `jp`, `kr`, `zh`. English is used as fallback if a language is missing.

### `content` (required)

`LangMapArray` — localized content, where each language maps to an **array of strings** (one string per bullet point). Each line is rendered as a list item prefixed with `- ` on the changelog page.

Markdown-like formatting is supported in content strings:
- `**bold**` for emphasis (e.g. coupon codes)

### `url` (optional)

Relative path to a related page. When present:
- The RSS feed uses it to build the `<link>` for the item
- Can be used for "Read more" links on the changelog page (currently commented out)

The path should NOT include the language prefix (e.g. `/characters/primine`, not `/en/characters/primine`).

---

## Examples

### New character

```json
{
  "date": "2026-02-10",
  "type": "update",
  "title": {
    "en": "New Hero: Primine",
    "jp": "新ヒーロー：プリミネ",
    "kr": "신규 영웅: 프리미네",
    "zh": "新同伴：普莉米妮"
  },
  "content": {
    "en": ["Primine joins the roster—dealing reliable damage through Dual Attacks while protecting allies with Shields and Immunity."],
    "jp": ["プリミネが参戦。デュアルアタックで安定したダメージを与えながら、シールドと免疫で味方を守ります。"],
    "kr": ["프리미네가 참전합니다. 이중 공격으로 안정적인 피해를 입히면서 보호막과 면역으로 아군을 보호합니다."],
    "zh": ["普莉米妮加入战场，通过夹攻造成稳定伤害，同时以护盾和免疫保护队友。"]
  },
  "url": "/characters/primine"
}
```

### New site feature

```json
{
  "date": "2026-02-04",
  "type": "feature",
  "title": {
    "en": "Soundtrack Player",
    "jp": "サウンドトラックプレイヤー",
    "kr": "사운드트랙 플레이어",
    "zh": "原声带播放器"
  },
  "content": {
    "en": ["Enjoy Outerplane's BGM directly on Outerpedia! Stream or download your favorite tracks."],
    "jp": ["OuterplaneのBGMをOuterpediaで楽しもう！お気に入りの曲をストリーミングまたはダウンロードできます。"],
    "kr": ["Outerplane의 BGM을 Outerpedia에서 즐기세요! 좋아하는 트랙을 스트리밍하거나 다운로드하세요."],
    "zh": ["在Outerpedia上欣赏《异域战记》的BGM！流媒体播放或下载您喜欢的曲目。"]
  },
  "url": "/ost"
}
```

### Entry without URL

```json
{
  "date": "2026-02-03",
  "type": "feature",
  "title": {
    "en": "Official Recognition from OUTERPLANE Developers",
    "jp": "OUTERPLANEの開発チームからの公式認定",
    "kr": "OUTERPLANE 개발팀의 공식 인정",
    "zh": "《异域战记》官方认可"
  },
  "content": {
    "en": ["Outerpedia has been officially recognized by the OUTERPLANE development team! A special coupon code **OUTERPEDIA** has been created to celebrate our community resource."],
    "jp": ["..."],
    "kr": ["..."],
    "zh": ["..."]
  }
}
```

---

## Architecture

```
data/changelog.json              Raw entries (LangMap format, newest first)
        │
        ├──▶ src/lib/changelog.ts     getChangelog(lang, { limit? }) → ResolvedChangelogEntry[]
        │         │                    Resolves LangMap/LangMapArray to plain strings for the given lang
        │         ▼
        │    src/app/[lang]/changelog/page.tsx    Full changelog page (server component)
        │
        └──▶ src/app/feed/route.ts    RSS 2.0 feed (English only, last 20 entries)
                                       Served at /feed, excluded from proxy
```

### Types (`src/types/changelog.ts`)

```typescript
type ChangelogType = 'feature' | 'fix' | 'update' | 'balance';

type LangMap = Partial<Record<Lang, string>>;
type LangMapArray = Partial<Record<Lang, string[]>>;

/** Raw entry as stored in changelog.json */
type ChangelogEntry = {
  date: string;
  type: ChangelogType;
  title: LangMap;
  content: LangMapArray;
  url?: string;
};

/** Resolved entry with plain strings for a specific language */
type ResolvedChangelogEntry = {
  date: string;
  type: ChangelogType;
  title: string;
  content: string[];
  url?: string;
};
```

### Resolution logic (`src/lib/changelog.ts`)

- `getChangelog(lang, options?)` reads all entries, resolves each `LangMap` / `LangMapArray` to the requested language (falling back to `en`), and optionally slices to `limit`
- The entries array is imported statically via `@data/changelog.json`

### RSS feed (`src/app/feed/route.ts`)

- Reads `data/changelog.json` directly (via `readFile`, not the data access layer)
- Outputs the last 20 entries as RSS 2.0 XML
- Uses English only (`title.en`, `content.en`)
- If `url` is present, builds a full link; otherwise links to `/en/changelog`
- Cached for 1 hour (`max-age=3600`)

---

## Rendering

The changelog page displays entries as cards with:

| Element | Source |
|---------|--------|
| Date | `entry.date` (displayed as-is) |
| Type badge | Colored pill based on `entry.type` |
| Title | `entry.title` (resolved to current language) |
| Content | `entry.content` lines as a bulleted list |

---

## Adding a new entry

1. Open `data/changelog.json`
2. Add a new object at the **beginning** of the array (newest first)
3. Fill in all 4 fields: `date`, `type`, `title`, `content`
4. Provide all 4 language translations for `title` and `content`
5. Optionally add `url` if the entry relates to a specific page
6. The changelog page and RSS feed will pick it up automatically
