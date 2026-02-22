# Guides — Components TODO

Components to build for the guide system, based on V1 analysis.
See `docs/guides.md` for architecture & data format.

## Already done

- [x] Types — `src/types/guide.ts` (GuideMeta, GuideCategory)
- [x] Data access layer — `src/lib/data/guides.ts`
- [x] Data files — `data/guides/_categories.json`, `_index.json`
- [x] Pages — listing (`/guides`), category (`/guides/[category]`), detail (`/guides/[category]/[slug]`)
- [x] GuideTemplate — `src/app/components/guides/GuideTemplate.tsx` (wrapper with version tabs)
- [x] GuideCard — `src/app/components/guides/GuideCard.tsx`
- [x] CategoryCard — `src/app/components/guides/CategoryCard.tsx`
- [x] Search integration — `src/app/api/search-index/extras/route.ts`
- [x] parse-text — `src/lib/parse-text.tsx` (inline tags B, D, E, C, S, P, EE, SK, I-W, I-A, I-T, AS)
- [x] i18n keys — `guides.category.*`, `page.guide.*`, `nav.guides.*`
- [x] Example content — `_contents/general-guides/beginner-faq.tsx`

---

## Priority 1 — Core boss guide components

Used by ~80% of guides (Adventure, Guild Raid, World Boss, Joint Boss, Special Request, Irregular Extermination).

- [ ] **GuideHeading** — Styled heading (h2/h3/h4) with gradient text and vertical glow bar. V1: `GuideHeading.tsx`
- [ ] **BossDisplay** — Full boss display: portrait, stats, skills, immunities. Mode selector (Normal/Hard/VeryHard), version switcher. Loads data from `data/boss/` via data layer. V1: `BossDisplay.tsx`
  - [ ] **BossPortrait** — Boss image (MT_* sprites), fallback to PNG, responsive sizes (sm/md/lg). V1: `boss/BossPortrait.tsx`
  - [ ] **BossHeader** — Boss name, title, class, element, level. Compact/expanded modes. V1: `boss/BossHeader.tsx`
  - [ ] **BossImmunities** — Buff/debuff immunity icons, deduplicated by effect group. V1: `boss/BossImmunities.tsx`
  - [ ] **BossSkillList** — Boss skill list with icons, names, parsed descriptions, associated buff/debuff badges. Compact/expanded. V1: `boss/BossSkillList.tsx`
- [ ] **TacticalTips** — "Strategy tips" section with lightbulb icon. Preset titles (tactical, strategy, mechanics, phase1, phase2...) mapped to i18n keys. Grouped sections with sub-headings. V1: `TacticalTips.tsx`
- [ ] **RecommendedCharacterList** — Character portraits (linked to `/characters/`) with reason text (supports inline tags). Preset or custom title. Responsive sizes (50px mobile, 80px desktop). V1: `RecommendedCharacterList.tsx`

---

## Priority 2 — Category-specific grids

Replace the generic 3-column grid on category listing pages when guides exist for that category.

- [ ] **AdventureGuideGrid** — Groups guides by season (S1, S2...). Anti-spoiler toggle hides boss names, shows only chapter numbers (e.g. "S1 Normal 8-5"). V1: `AdventureGuideGrid.tsx`
- [ ] **SkywardTowerGuideGrid** — Layout by difficulty (Normal/Hard/VeryHard). Background images per difficulty level, sorted by difficulty. V1: `SkywardTowerGuideGrid.tsx`
- [ ] **SpecialReqCardGrid** — Animated tabs (All / Identification / Ecology). Boss reward icons on right side. V1: `SpecialReqCardGrid.tsx`
- [ ] **MonadGateGuideGrid** — Staggered depth layout (D1-D2 side by side, D3 centered, D4-D5 side by side, D6 separate). Route buttons per depth, illustration backgrounds. V1: `MonadGateGuideGrid.tsx`

---

## Priority 3 — Specialized guide components

For thematic guides (stats, gacha, monad gate interactive map).

### Stats guide components

- [ ] **StatCard** — Expandable stat card: icon, label, abbreviation, description, buff/debuff effect badges, collapsible details. V1: `guides/StatCard.tsx`
- [ ] **StatGroup** — Wrapper grouping StatCards under a colored title (red/blue/green/purple/amber) with gradient left border. V1: part of `guides/StatCard.tsx`
- [ ] **StatBlock** — Accordion-based stat detail block: definition text, associated effects, custom content. V1: `guides/StatBlock.tsx`

### Banner/gacha guide components

- [ ] **BannerRates** — Drop rate display by rarity (1-3 stars), rate percentage, special feature badges. V1: `guides/BannerRates.tsx`
- [ ] **BannerRewards** — Pity/exchange rewards table (rarity, wildcard pieces, hero piece), notes per reward. V1: `guides/BannerRewards.tsx`
- [ ] **BannerResources** — Resource costs per pull, mileage grants, warning banner. V1: `guides/BannerResources.tsx`
- [ ] **MileageInfo** — Mileage system explanation (persistent vs temporary), exchange options card. V1: `guides/MileageInfo.tsx`

### Monad Gate interactive map

- [ ] **MonadGateMap** — Interactive node-based dungeon map: drag-to-pan, scroll/pinch zoom, compact/full mode toggle, true path filtering, fullscreen, node click popups, SVG edge rendering. V1: `guides/MonadGateMap.tsx` + `monad-ui/NodeContextPopup.tsx` + `monad-ui/PathOptionsContent.tsx`

---

## Priority 4 — Utilities

- [ ] **MiniBossDisplay** — Compact BossDisplay variant for 1-3 bosses side by side. Shared or independent mode selection. V1: `MiniBossDisplay.tsx`
- [ ] **GuideLoading** — Spinner with pulsing animation for guide loading state. V1: `GuideLoading.tsx`

---

## Notes

### V1 patterns to replicate

- **Composition**: Small focused sub-components (BossPortrait, BossHeader, BossImmunities, BossSkillList) assembled in BossDisplay
- **i18n presets**: TacticalTips uses preset title keys (tactical, strategy, phase1...) mapped to i18n, with LangMap fallback
- **parseText()**: All guide text passes through `parseText()` for inline tag rendering
- **Responsive**: Grids 1→2→3 cols, portraits resize, text→icon-only on mobile
- **Dynamic import**: Guide content loaded server-side (`await import(...)`) for SSR, component is `'use client'` for interactivity

### i18n keys to add

When building TacticalTips / RecommendedCharacterList, add these preset keys to all 4 locale files:
- `guide.tips.tactical`, `guide.tips.strategy`, `guide.tips.general`, `guide.tips.important`
- `guide.tips.mechanics`, `guide.tips.phase1`, `guide.tips.phase2`
- `guide.reco.title` (default "Recommended Characters")
