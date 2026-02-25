# Guides System

## Overview

Guides use a three-level routing structure: `/guides` > `/guides/[category]` > `/guides/[category]/[slug]`.

- **Metadata** lives in JSON files under `data/guides/`
- **Content** lives in TSX component files under `src/app/[lang]/guides/_contents/`
- **Data access** goes through `src/lib/data/guides.ts` — never import JSON directly

```
data/guides/
├── _categories.json       # Category definitions (icon, order, keywords)
└── _index.json             # All guide metadata (title, description, author, etc.)

src/app/[lang]/guides/
├── page.tsx                          # Main listing (category grid)
├── [category]/
│   └── page.tsx                      # Category listing (guide grid)
├── [category]/[slug]/
│   └── page.tsx                      # Guide detail (server-side dynamic import)
└── _contents/                        # Guide content components (NOT routes)
    ├── general-guides/
    │   └── beginner-faq.tsx
    ├── adventure/
    ├── guild-raid/
    └── ...
```

---

## Categories

11 categories defined in `data/guides/_categories.json`:

| Slug | Description |
|------|-------------|
| `general-guides` | Beginner tips, game mechanics |
| `adventure` | Story stage boss guides |
| `adventure-license` | Promotion fight guides |
| `guild-raid` | Guild raid boss strategies |
| `world-boss` | World boss fight strategies |
| `joint-challenge` | Joint challenge guides |
| `special-request` | Special request boss guides |
| `irregular-extermination` | Irregular extermination guides |
| `monad-gate` | Monad gate route guides |
| `skyward-tower` | Skyward tower floor guides |
| `other` | Anything that doesn't fit above |

Each category has a translation key `guides.category.{slug}` and `guides.category.{slug}.desc` in all 4 locale files.

---

## How to add a new guide

### Step 1 — Register metadata in `data/guides/_index.json`

Add an entry keyed by the guide slug:

```jsonc
{
  "my-guide-slug": {
    "category": "guild-raid",                       // Must match a category slug
    "title": {
      "en": "My Guide Title",
      "jp": "ガイドタイトル",
      "kr": "가이드 제목",
      "zh": "攻略标题"
    },
    "description": {
      "en": "Short description of what this guide covers.",
      "jp": "このガイドの概要。",
      "kr": "이 가이드의 개요.",
      "zh": "本攻略简介。"
    },
    "icon": "my-guide-slug",                        // Used for OG image if needed
    "author": "Sevih",
    "last_updated": "2026-02-22"                    // ISO date
  }
}
```

### Step 2 — Create the content file

Create `src/app/[lang]/guides/_contents/{category}/{slug}.tsx`:

```tsx
'use client';

import GuideTemplate from '@/app/components/guides/GuideTemplate';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { LangMap } from '@/types/common';
import parseText from '@/lib/parse-text';

export default function MyGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec({ en: 'My Guide Title', jp: '...', kr: '...', zh: '...' }, lang)}
      introduction={lRec({ en: 'Introduction text.', jp: '...', kr: '...', zh: '...' }, lang)}
    >
      {/* Guide content here */}
    </GuideTemplate>
  );
}
```

That's it. The guide will automatically appear in:
- The category listing at `/guides/{category}`
- The category card count on `/guides`
- Breadcrumbs will resolve automatically
- `generateStaticParams` will pick it up for static generation

### Step 3 (optional) — Verify

Visit:
1. `/en/guides` — category card count should update
2. `/en/guides/{category}` — new guide card should appear
3. `/en/guides/{category}/{slug}` — guide content should render

---

## Content patterns

### Multilingual text with LangMap

All user-facing strings use `LangMap` objects with automatic English fallback:

```tsx
import { lRec } from '@/lib/i18n/localize';
import type { LangMap } from '@/types/common';

const text: LangMap = {
  en: 'English text',
  jp: '日本語テキスト',
  kr: '한국어 텍스트',
  zh: '中文文本',
};

// In component:
const { lang } = useI18n();
<p>{lRec(text, lang)}</p>
```

If a language is missing, `lRec()` automatically falls back to English.

### Inline tags

Use `parseText()` to render inline tags in text content:

```tsx
import parseText from '@/lib/parse-text';

<p>{parseText(lRec({ en: 'Use {B/BT_IMMUNE} to counter {D/BT_STUN}.' }, lang))}</p>
```

Supported tags:

| Tag | Renders | Example |
|-----|---------|---------|
| `{B/name}` | Buff icon + label | `{B/BT_IMMUNE}` |
| `{D/name}` | Debuff icon + label | `{D/BT_STUN}` |
| `{E/element}` | Element icon + label | `{E/Fire}` |
| `{C/class}` | Class icon + label | `{C/Striker}` |
| `{S/stat}` | Stat icon + label | `{S/ATK}` |
| `{P/name}` | Character link | `{P/Valentine}` |
| `{EE/name}` | Exclusive Equipment | `{EE/Valentine}` |
| `{SK/char\|skill}` | Skill reference | `{SK/Valentine\|S1}` |
| `{I-W/name}` | Weapon inline | `{I-W/Sword of Light}` |
| `{I-A/name}` | Amulet inline | `{I-A/Ring of Power}` |
| `{I-T/name}` | Talisman inline | `{I-T/Sage's Charm}` |
| `{I-I/name}` | Item inline (generic) | `{I-I/Free Ether}` |
| `{AS/name}` | Armor Set inline | `{AS/Attack Set}` |

### Direct component usage

When text needs to wrap around inline components (characters, effects, skills), split the LangMap around the component:

```tsx
{lRec({ en: 'You get ', jp: '', kr: '', zh: '' }, lang)}
<CharacterInline name="Mene" />
{lRec({ en: ' for free.', jp: 'は無料です。', kr: '는 무료입니다.', zh: '免费获得。' }, lang)}
```

Available inline components for direct use:
- `CharacterInline` — `@/app/components/inline/CharacterInline`
- `EffectInline` — `@/app/components/inline/EffectInline`
- `SkillInline` — `@/app/components/inline/SkillInline`

### Headings inside guides

Guide content lives inside `<GuideTemplate>` which already renders an `<h2>`. Use `h3`/`h4`/`h5` for sub-sections. Add `after:hidden` to suppress the default heading decoration from `globals.css`:

```tsx
<h3 className="text-2xl font-bold text-sky-400 border-l-4 border-sky-500 pl-4 after:hidden">
  {lRec({ en: 'Section Title', jp: '...', kr: '...', zh: '...' }, lang)}
</h3>
```

### Internal links

Next.js typed routes don't recognize dynamic guide paths. Use `as never` on `href`:

```tsx
<Link href={"/guides/general-guides/premium-limited" as never} className="text-blue-400 underline">
  {lRec({ en: 'link text', jp: '...', kr: '...', zh: '...' }, lang)}
</Link>
```

This is the same pattern used in `CharacterInline`, `CharacterCard`, `Breadcrumbs`, etc.

### GuideTemplate with versions

For guides that get updated over time (e.g., world boss rotations), use the `versions` prop:

```tsx
<GuideTemplate
  title={lRec(title, lang)}
  defaultVersion="february2026"
  versions={{
    february2026: {
      label: 'February 2026',
      content: (<>...</>),
    },
    january2026: {
      label: 'January 2026',
      content: (<>...</>),
    },
  }}
/>
```

Versions appear as tabs. The `defaultVersion` controls which tab is active initially.

---

## Data access layer

```typescript
import {
  getGuideCategories,       // All categories sorted by order
  getValidCategories,       // Category slug list
  getAllGuides,              // All guide metadata
  getGuidesByCategory,      // Guides filtered by category
  getGuideMeta,             // Single guide by slug
  getGuideSlugsWithCategories, // For generateStaticParams
  getGuideCounts,           // Count per category
} from '@/lib/data/guides';
```

---

## Types

Defined in `src/types/guide.ts`:

```typescript
type GuideMeta = {
  slug: string;
  category: string;
  title: LangMap;
  description: LangMap;
  icon: string;
  author: string;
  last_updated: string;
};

type GuideCategory = {
  slug: string;
  icon: string;
  order: number;
  keywords?: string[];
};
```

---

## SSR & SEO

Guide content is loaded via **server-side dynamic import** in the page server component:

```tsx
// page.tsx (server component)
const mod = await import(`../../_contents/${category}/${slug}`);
const GuideContent = mod.default;
return <GuideContent />;
```

This ensures full HTML is in the initial response — search engine crawlers see everything. The guide component itself uses `'use client'` for interactivity (language switching, version tabs) but is SSR'd on first render.

---

## i18n keys

Guide-related translation keys follow these patterns:

```
guides.category.{slug}           → Category name
guides.category.{slug}.desc      → Category description
page.guides.title                → Main page title
page.guides.meta_title           → SEO title with {monthYear}
page.guide.meta_title            → Individual guide SEO title with {title}
page.guide.by                    → "By {author}"
page.guide.updated               → "Updated {date}"
```

All keys must be present at the same line numbers across `en.ts`, `jp.ts`, `kr.ts`, `zh.ts`.

---

## Adding a new category

1. Add the category to `data/guides/_categories.json` with icon, order, and keywords
2. Add `guides.category.{slug}` and `guides.category.{slug}.desc` keys to all 4 locale files
3. Create the `_contents/{category}/` directory
4. Breadcrumbs resolve automatically via `guides.category.{slug}` keys
