# Damage Calculator V3 — 05. UI Contract

> **Audience.** UI engineers. Anyone touching
> `src/app/[lang]/tools/_contents/damage-calculator/`. The companion
> doc to `04-runtime-model.md` — together they cover everything from
> user click to formula output.
>
> **Scope.** Layout (desktop + mobile), state shape, action types,
> per-panel contracts, mode taxonomy, settings semantics, URL share,
> `localStorage`, i18n, hydration, memoization. The UI is React 19 +
> Tailwind v4 + Next.js 15 App Router.

---

## 0. Visual contract — the design package

**The visual layer of the V3 UI is contracted by the design package
shipped at [`docs/damage-calc/design/`](design/).** Read it before
implementing any panel.

```
docs/damage-calc/design/
  README.md                                # Claude-Design's instructions to the coding agent
  chats/                                   # 2 chat transcripts (intent — read these too)
    chat1.md                               # 2026-04-27 design system commitment
    chat2.md                               # 2026-05-08 final pass + sample state
  project/
    Damage Calculator.html                 # Entry — loads the .jsx via Babel standalone
    design-canvas.jsx                      # Canvas host (DesignCanvas + DCSection + DCArtboard)
    shells.jsx                             # WipBanner, TopBar, PageBackground, DesktopCalc, MobileCalc, Settings/CharPicker artboards
    primitives.jsx                         # Card, StatCell, StatRow, SegToggle, Pill, Slider, Checkbox, NumInput, Avatar, Strip, Element/Class badges, AutoBadge, TeamPlus, BuffStatIcon, icons
    data.jsx                               # ELEMENTS, CLASSES, CHARACTERS, SKILLS, TARGET, CASCADE, TEAM, BUFFS sample fixtures
    attacker.jsx                           # AttackerColumn (header card, stats grid, skill, burst+transcend, equipment, conditionals)
    target.jsx                             # TargetColumn (mode→stage→monster cascade + mob card)
    result.jsx                             # ResultColumn (hero number + breakdown trace + vs other skills)
    team.jsx                               # TeamPanel (3 ally slots: defender ED / ranger AM / talismans)
    buffs.jsx                              # BuffsPanel (4-section matrix + Marked toggle)
    modals.jsx                             # SettingsModal + CharPickerModal
    scraps/sketch-2026-05-08*.napkin       # design source (ignore)
```

### 0.1 Status

- **Format**: HTML/CSS/JS prototypes (React 18 + Tailwind v3 via CDN +
  Babel standalone). NOT production code.
- **Job of V3**: **recreate them pixel-perfectly** (per the README) in
  the project's stack — TypeScript, React 19, Tailwind v4, Next.js 15.
  Don't copy the prototype's internal structure unless it fits.
- **Sample state**: Alice (Earth Mage T6 Codex 11) vs Sentry Archer
  (4-1 Earth Ranger Lv 30), Yuelchen ally with Exquisite Death tier 3,
  Inc ATK +30% + Marked active. Used for illustrative numbers in the
  design (e.g., `14,837` crit damage). NOT a fixture for V3 to ship.
- **Original fan-tool design** — no in-game UI is reproduced. Avatars
  are initial-glyphs over element-hued gradients; missing art uses a
  diagonal-stripe placeholder (`Strip` component).

### 0.2 What to read in what order

1. `design/README.md` — Claude-Design's handoff brief.
2. `design/chats/chat1.md` and `chat2.md` — design intent + iteration.
3. `design/project/Damage Calculator.html` — the entry HTML; lists
   which `.jsx` files to load.
4. `design/project/primitives.jsx` — the design system (every panel
   composes from these).
5. `design/project/shells.jsx` — desktop / mobile shells.
6. `design/project/{attacker,target,result,team,buffs,modals}.jsx` —
   panel implementations (read in that order).
7. `design/project/data.jsx` — sample fixture state (DON'T port these
   values into V3; they're illustrative only).

### 0.3 Don't render the prototype

Per the README, **don't open the HTML in a browser or take screenshots
unless the user asks**. Everything you need (dimensions, colors,
layout rules) is in the source. Read the `.jsx` directly.

### 0.4 Non-trivial deviations from the brief

The design has a few elements not previously documented in this doc.
**Accept the design** — update this contract to match where they
disagree:

- **WIP / "Early access" banner** at the top — amber-tinted strip
  warning of ±5% accuracy. Dismissible via X button.
- **Top bar with site nav** — "Outerpedia" logo + nav links
  (`Characters / Tier list / Calculator / Builds / Banners` — only
  Calculator is active). The brief assumed the site shell handles
  this, but the design renders it inline. Align with the global
  Outerpedia layout — re-use the existing site `<Header>` rather than
  re-implementing.
- **"Single build / Compare 3 builds" tab strip** — Compare disabled
  with `soon` chip. V3 ships Single only; the Compare chip is
  reserved as visual scaffold.
- **Page-level header**: title `Damage Calculator` + subtitle
  `Predict damage in <10s — pick a character, a target, layer your
  buffs.` + Patch/Formula version pills on the right.
- **Burst & Transcendance card** — separate from the AttackerPanel's
  TranscendControl in the brief. Renders the active tier as an amber
  pill and lists the 4 tier upgrades with the active one highlighted.
- **vs other skills card** in `ResultColumn` — bar chart comparing
  S1/S2/S3 damage under the current setup. Currently active skill is
  highlighted in violet/amber; others in zinc.
- **Per-step trace** — 14-step numbered list (Base ATK → final crit)
  with alternate-row striping. Last row highlighted amber. The brief
  called this `breakdown.debugSteps[]`; design names it "Per-step
  trace" and inlines it under the breakdown intermediates.
- **Equipment block** — 4-tile grid (Weapon / Armor / Accessory /
  Talisman) + a substats row at the bottom showing roll counts. The
  brief reduced to "EE picker" only; the design surfaces full gear
  loadout. **For V3 we still ship EE only** (gear stats remain
  user-typed); render the other tiles as visual scaffold + tooltip
  saying "gear stats are typed manually for now".
- **Conditional modifiers card** — in the design, surfaced as
  checkboxes with `auto-on` badges (e.g., "EE active vs Earth target
  — auto-on"). Match the brief's `ConditionalModifiers` state
  one-to-one; the design's labels are illustrative.
- **Mode taxonomy in TargetColumn** — uses category labels like
  `"Story Normal"` and `"Adventure License"`. These map to the
  brief's `MODE_GROUPS` (see §6 below).
- **Mobile sticky bottom damage bar** — large gradient amber number
  + DF % + non-crit value + "View breakdown" button. The brief had
  a flatter mobile reflow; **adopt the design's sticky bar**.

### 0.5 The design's design system

Committed in `chats/chat1.md` (paraphrased):

> **Type**: Space Grotesk (UI) + JetBrains Mono (numbers/data) —
> slightly geometric, fits the anime-RPG-data tool vibe without
> leaning gamer-y.
>
> **Surface**: zinc-950 base with a hint of indigo
> (`oklch(0.13 0.012 270)`), three elevation tiers, hairline borders
> at `oklch(0.30 0.02 270)`.
>
> **Accent**: violet (`oklch(0.70 0.18 290)`) for interactive, **amber**
> (`oklch(0.78 0.18 75)`) reserved for the damage number — so it
> visually anchors as the output.
>
> **Element/class badges**: small caps pill, 1px border in the element
> hue, faint hue-tinted bg. Fire/Water/Earth/Light/Dark and
> Striker/Mage/Ranger/Defender/Priest each get a hue per spec.
>
> **Density**: auto-detected fields show a tiny `auto` chip; "override"
> reveals a manual editable shadow value beside.

See §0.7 below for the full token list.

### 0.6 Design tokens — palette

All colors are OKLCH (CSS-native; supported in all evergreen browsers
and Tailwind v4). Translate to Tailwind v4 utilities or inline
`style` props as needed. **Don't hardcode HEX**; the OKLCH values
are the source of truth.

**Page surface** (from `shells.jsx` `PageBackground`):

```css
background:
  radial-gradient(1200px 600px at 80% -10%, oklch(0.28 0.10 290 / 0.35), transparent 60%),
  radial-gradient(800px 500px at -10% 110%, oklch(0.26 0.10 25 / 0.18), transparent 60%),
  oklch(0.13 0.012 270);
```

**Card surface** (from `primitives.jsx` `Card`):

```css
background: oklch(0.21 0.018 270 / 0.7);
backdrop-filter: blur(4px);
border: 1px solid oklch(1 0 0 / 0.07);          /* zinc-50 @ 7% — hairline */
box-shadow:
  0 1px 0 oklch(1 0 0 / 0.04) inset,
  0 24px 60px -30px rgb(0 0 0 / 0.7);
```

**Surface tier hierarchy**:

| Tier | Use | Color |
|---|---|---|
| 0 (page) | Body bg | `oklch(0.13 0.012 270)` |
| 1 (card) | Section wrappers | `oklch(0.21 0.018 270 / 0.7)` |
| 2 (input) | Stat cells, inputs | `rgba(0, 0, 0, 0.25)` over card (`bg-black/25`) |
| 3 (selected) | Active state | `oklch(0.55 0.18 290 / 0.15)` (violet @ 15%) |

**Accent**:

| Use | Color |
|---|---|
| Interactive (default) | violet `oklch(0.65 0.18 290)` |
| Interactive hover | violet `oklch(0.78 0.18 290)` |
| Hero damage number | amber `oklch(0.92 0.16 78)` (text) + amber `oklch(0.78 0.18 70 / 0.55)` (glow) |
| Auto-detected field | violet `oklch(0.70 0.18 290 / 0.30)` (`AutoBadge`) |
| Team contribution | emerald `oklch(0.78 0.14 150)` (`TeamPlus`) |

**Element hues** (from `data.jsx` `ELEMENTS`):

| Element | hue | fg | bg | border |
|---|---|---|---|---|
| Fire | 25 | `oklch(0.78 0.18 25)` | `oklch(0.32 0.10 25 / 0.45)` | `oklch(0.55 0.16 25 / 0.7)` |
| Water | 240 | `oklch(0.78 0.14 240)` | `oklch(0.30 0.08 240 / 0.45)` | `oklch(0.55 0.14 240 / 0.7)` |
| Earth | 145 | `oklch(0.80 0.14 145)` | `oklch(0.30 0.08 145 / 0.45)` | `oklch(0.55 0.13 145 / 0.7)` |
| Light | 95 | `oklch(0.90 0.14 95)` | `oklch(0.32 0.10 95 / 0.40)` | `oklch(0.65 0.15 95 / 0.7)` |
| Dark | 305 | `oklch(0.78 0.18 305)` | `oklch(0.30 0.10 305 / 0.45)` | `oklch(0.55 0.16 305 / 0.7)` |

**Class hues** (from `data.jsx` `CLASSES`):

| Class | hue | fg |
|---|---|---|
| Striker | 60 (warm yellow) | `oklch(0.80 0.16 60)` |
| Mage | 305 (magenta — same as Dark) | `oklch(0.78 0.18 305)` |
| Ranger | 195 (cyan) | `oklch(0.80 0.13 195)` |
| Defender | 235 (cyan-blue) | `oklch(0.78 0.14 235)` |
| Priest / Healer | 270 (cool white) | `oklch(0.94 0.01 270)` |

**Status pills**:

| Tone | bg | border |
|---|---|---|
| neutral | `bg-white/[0.04]` | `border-white/[0.07]` |
| violet | `bg-violet-500/15` | `border-violet-400/30` |
| amber | `bg-amber-500/10` | `border-amber-400/25` |
| emerald | `bg-emerald-500/10` | `border-emerald-400/25` |
| rose | `bg-rose-500/10` | `border-rose-400/25` |

### 0.7 Design tokens — typography

**Loaded via `next/font/google`** in `src/app/layout.tsx` (already
done in Phase 1):

```ts
// src/app/layout.tsx
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  weight: ['400', '500', '600', '700'],
})
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  weight: ['400', '500', '700'],
})
```

The CSS variables (`--font-space-grotesk`, `--font-jetbrains-mono`)
are exposed on `<html>` via `className={spaceGrotesk.variable + ' ' + jetbrainsMono.variable}`.

**Tailwind v4 `@theme` (in `src/app/globals.css`)** registers
calc-scoped font-family tokens. **DO NOT use `font-display` or
`font-mono`** as token names — both collide with Tailwind built-ins
(`font-display: swap` is a Tailwind v4 utility; `font-mono` is the
project-global Geist Mono). Use:

```css
@theme {
  --font-calc-display: var(--font-space-grotesk), ui-sans-serif, system-ui, sans-serif;
  --font-calc-mono:    var(--font-jetbrains-mono), ui-monospace, monospace;
}
```

That gives Tailwind utilities `font-calc-display` and `font-calc-mono`
that the calc components consume. Geist / Geist Mono remain the
project-global defaults (`font-sans` / `font-mono`).

**Type roles**:

| Role | Class | Usage |
|---|---|---|
| Display heading | `font-calc-display text-[24px] font-semibold tracking-tight` | Page title "Damage Calculator" |
| Card section title | `text-[11px] font-semibold uppercase tracking-[0.14em]` | "Stats", "Skill", etc. (zinc-400) |
| Body / label | `text-[12px]` (zinc-300/400) | Most UI copy |
| Stat number | `font-calc-mono text-[14px] font-semibold tabular-nums` | StatCell values |
| Hero damage | `font-calc-display font-calc-mono text-[68px] font-bold tabular-nums tracking-[-0.03em]` | The big number — desktop |
| Hero damage (mobile) | `font-calc-display font-calc-mono text-[42px] font-bold tabular-nums tracking-[-0.03em]` | Sticky bottom bar |
| Mono caption | `font-calc-mono text-[10px] uppercase tracking-[0.18em]` | "Predicted damage" labels (zinc-500) |
| Hairline meta | `font-calc-mono text-[9px] uppercase tracking-wider` | Tiny captions inside cards (zinc-500) |

**Why both `font-calc-display` AND `font-calc-mono` on the hero
number.** Space Grotesk gives the heading-weight feel; JetBrains Mono
provides the `tabular-nums` digit shapes. The browser resolves the
last-declared family that supports the glyphs — JetBrains Mono wins
for digits, Space Grotesk for any non-digit chars (e.g., commas,
sign markers). Match the design exactly.

`tabular-nums` is critical for any column with numbers — keeps digits
the same width for visual stability when values change.

**Migration note for any code referencing the old tokens.** If you
see `font-display` or `font-mono` in a calc-internal component, treat
it as a bug from a stale design pass — replace with
`font-calc-display` / `font-calc-mono`.

### 0.8 Design tokens — spacing & shape

- **Card radius**: `rounded-xl` (Tailwind v4 default = 0.75rem).
- **Inner element radius**: `rounded-md` (cells, buttons) / `rounded-[3px]` (checkboxes, micro-pills) / `rounded-lg` (segmented toggles).
- **Card padding**: `px-4 py-3.5` (default), `px-4 py-2.5` (header strip).
- **Page padding**: `px-6 pb-6 pt-4` desktop, `px-3 pt-3` mobile.
- **Inter-card gap**: `gap-3` mobile / inside columns, `gap-4` for the desktop 3-column grid.
- **Stat cell**: `px-2 py-1.5` (compact, holds label + value + sub).
- **Hero card padding**: `px-5 pt-5 pb-4` (desktop) / `px-3 pt-3 pb-3` (mobile sticky bar).
- **Border**: `border-white/[0.05]` (hairline divider) / `border-white/[0.07]` (card border) / element-tinted for badges.

### 0.9 Design tokens — primitives reference

These primitives live in `design/project/primitives.jsx`. V3 should
port them to `src/app/[lang]/tools/_contents/damage-calculator/_components/_primitives/`
(or similar — co-locate with the panels) as TypeScript components.

| Primitive | Props | Notes |
|---|---|---|
| `<Card>` | `title?, right?, children, className?, padded=true, glow=false` | Section wrapper. `glow` adds a top hairline accent. |
| `<StatCell>` | `label, value, auto?, teamAdd?, accent?, sub?, dim?` | Stats grid cell. `auto` shows violet "auto" chip; `teamAdd="430"` shows emerald `(+430)`. |
| `<StatRow>` | `label, value, sub?, auto?, accent?` | StatCell in row form (used in TargetColumn). |
| `<SegToggle>` | `options, value, dense?, onChange` | Segmented control (S1/S2/S3, Single/Compare). |
| `<Pill>` | `tone='neutral'\|'violet'\|'amber'\|'emerald'\|'rose', children` | Small status chip. |
| `<Slider>` | `value, min=1, max=5, label?, marks=true, hue=290` | Gradient slider (skill level). |
| `<Checkbox>` | `label, sub?, checked, autoOn?, dense?, tone?` | Custom checkbox with sub-label. `autoOn` adds the violet auto chip. |
| `<NumInput>` | `value, suffix='%', width=60, disabled?, accent?` | Compact numeric input chip. Used in buff matrix. |
| `<Avatar>` | `name, element, size=36, ring=true` | Initial-letter on element-hued gradient. Element-colored corner dot when `ring`. |
| `<Strip>` | `label='art', className?, style?` | Diagonal-stripe placeholder for missing art. |
| `<ElementBadge>` | `el, size='xs'\|'sm'` | Small caps element pill. |
| `<ClassBadge>` | `cls, size='xs'\|'sm'` | Small caps class pill. |
| `<AutoBadge>` | `children='auto'` | Violet "auto" chip — always paired with auto-detected fields. |
| `<TeamPlus>` | `children` | Emerald `(+X)` annotation for team contributions. |
| `<BuffStatIcon>` | `stat, className?` | Tiny stat-shape icon (atk/def/chc/chd/pen/dmg/eff/res/dr/spd/acc/shld/imm/cdr/marked/bleed). |

Plus icon set: `<ChevronDown>`, `<ChevronRight>`, `<Search>`, `<Bolt>`,
`<Gear>`, `<ShareIcon>`, `<PlusIcon>`, `<XIcon>`, `<StarIcon>`,
`<WarnIcon>`. All stroke-based SVGs in 12-14 px viewboxes. Recolor
via `currentColor`.

### 0.10 What changes in CalcState because of the design

The design adds a few visual states that need persistence:

- **`ui.compareMode: 'single' | 'compare3'`** — for the Single/Compare
  toggle. V3 ships `'single'` only; the field exists for future use.
- **`ui.banner.dismissed: boolean`** — whether the WIP banner has been
  dismissed. Persist in `localStorage` (per-device).
- **`ui.activeMobileSection: 'attacker' | 'target' | 'team' | 'buffs'`**
  — which section the mobile tab strip has focused. Default `'attacker'`.
- **`ui.breakdownOpen: boolean`** — whether the result breakdown panel
  is expanded. Default `true` desktop, `false` mobile.
- **`ui.equipmentExpanded: boolean`** — for the AttackerPanel's
  Equipment block collapse/expand. Default `true`.

Add to `SettingsState` or a new `UIState` slice:

```ts
export interface UIState {
  compareMode: 'single' | 'compare3'
  bannerDismissed: boolean
  activeMobileSection: 'attacker' | 'target' | 'team' | 'buffs'
  breakdownOpen: boolean
  equipmentExpanded: boolean
}
```

Update `CalcState`:

```ts
export interface CalcState {
  attacker: AttackerState
  target: TargetState
  settings: SettingsState
  buffs: BuffsState
  team: TeamState
  bossMechanics: Record<string, BossMechanicState>
  bossOverride: BossOverride | null
  statsDirty: boolean
  ui: UIState                              // ← new
}
```

The action types in §3 below get corresponding `ui/setX` cases.

---

## 1. Page topology

### 1.1 URL

The calculator lives at `/[lang]/tools/damage-calculator` with one
language per top-level segment:

```
/en/tools/damage-calculator
/jp/tools/damage-calculator
/kr/tools/damage-calculator
/zh/tools/damage-calculator
```

`[lang]` resolves through `src/proxy.ts` (NOT a middleware — see
CLAUDE.md). The route is `tools/_contents/damage-calculator/index.tsx`
which is a server component that mounts the client root.

### 1.2 File layout

```
src/app/[lang]/tools/_contents/damage-calculator/
  index.tsx                          # Server entry; metadata; mounts client
  CalculatorClient.tsx               # 'use client' root; reducer; layout (renders DesktopCalc / MobileCalc)

  _components/
    _primitives/                     # Ported from design/project/primitives.jsx — TS versions
      Card.tsx                       # Section wrapper with optional title/right/glow
      StatCell.tsx                   # 6-grid stat cell (label + value + auto + teamAdd)
      StatRow.tsx                    # StatCell in row form (TargetPanel)
      SegToggle.tsx                  # Segmented control (S1/S2/S3, Single/Compare)
      Pill.tsx                       # Small status chip (5 tones)
      Slider.tsx                     # Gradient slider with marks (skill level)
      Checkbox.tsx                   # Custom checkbox with auto-on badge
      NumInput.tsx                   # Compact numeric chip (buff matrix)
      Avatar.tsx                     # Initial-glyph on element-hued gradient
      Strip.tsx                      # Diagonal-stripe placeholder (missing art)
      ElementBadge.tsx               # Small caps element pill
      ClassBadge.tsx                 # Small caps class pill
      AutoBadge.tsx                  # Violet "auto" chip
      TeamPlus.tsx                   # Emerald "(+X)" annotation
      BuffStatIcon.tsx               # Tiny stat-shape icons
      Icons.tsx                      # ChevronDown, ChevronRight, Search, Bolt, Gear,
                                     # ShareIcon, PlusIcon, XIcon, StarIcon, WarnIcon

    _shell/                          # Layout shells (from design/project/shells.jsx)
      WipBanner.tsx                  # Amber "Early access" banner (dismissible)
      TopBar.tsx                     # Logo + nav + Single/Compare tabs + Share + Gear
      PageBackground.tsx             # Radial gradients + grid mask
      DesktopCalc.tsx                # 3-col grid layout
      MobileCalc.tsx                 # Stacked sections + sticky bottom bar
      MobileStickyBar.tsx            # Sticky bottom damage bar (live result)

    AttackerPanel.tsx                # Char header + Stats grid + Skill + Burst+Transcend
                                     # + Equipment + Conditional modifiers
    TargetPanel.tsx                  # Mode → stage → monster cascade + monster card
                                     # (BossMechanicsPanel embedded under the card)
    ResultPanel.tsx                  # Hero damage + breakdown trace + vs other skills
    TeamPanel.tsx                    # 3 ally slots
    BuffsPanel.tsx                   # 4-section buff matrix + Marked toggle
    BossMechanicsPanel.tsx           # Conditional — embedded under TargetPanel's monster card

    TranscendControl.tsx             # Tier picker — lives inside AttackerPanel
    TranscendActiveInfo.tsx          # Tier upgrades list (Lv 3 / 4-1 / 4-2 / … / 6-3)
    EquipmentPanel.tsx               # 4-tile gear loadout (EE active; others scaffold)
    EquipmentPickerModal.tsx         # EE picker modal
    CharPickerModal.tsx              # Char picker modal (filterable + searchable)
    SettingsModal.tsx                # Codex + quirks toggles + display options (gear icon)
    SharePanel.tsx                   # Modal — URL display + copy + open

  _state/
    types.ts                         # CalcState (incl. UIState) + sub-states + action types
    reducer.ts                       # The reducer + buildRecomputeCtx helpers

  _lib/
    fetch-data.ts                    # Browser-side fetch helpers
    mode-taxonomy.ts                 # MODE_GROUPS, classifyMode, parseDungeonStage
    quirks.ts                        # PVE caster debuffs computation
    transcend.ts                     # Transcend tier helpers (cumulative ATK%, burst flags)
    no-gear-stats.ts                 # computeFinalStats (base + evo + class + skill8 + codex + quirks)
    compose-result.ts                # composeApplicableBuffs + composeRecomputeContext + runRecompute
    share.ts                         # serialize / deserialize URL state
    equipment-display.ts             # Display helpers for EE picker
    format.ts                        # Number formatting (`14,837`, `62.4%`, etc.)
```

**Ported primitives.** The design's `primitives.jsx` writes
components to `window.*`. V3 ports each to a strict TS component with
typed props (no global namespace pollution). Same visual output;
different DI strategy.

**No ObsTablePanel.** The admin-only obs table is gone in the public
calc. The reducer's state has no `obs` slice.

### 1.3 Top-level layout (desktop)

**See [`design/project/shells.jsx`](design/project/shells.jsx) →
`DesktopCalc()`**. Summary:

```
WipBanner (amber, dismissible)
└─ TopBar (logo + nav + Single/Compare tabs + Share + Gear)
   └─ Page header (title + subtitle + Patch/Formula pills)
      └─ Main grid (12 cols, gap-4, px-6 pb-6 pt-4)
         ├─ col-span-4: AttackerColumn
         ├─ col-span-4: TargetColumn
         ├─ col-span-4: ResultColumn
         ├─ col-span-12: TeamPanel              (full-width)
         ├─ col-span-12: BuffsPanel             (full-width, 4-section matrix)
         └─ col-span-12: footer (build hash + formula source link)
```

`BossMechanicsPanel` is **embedded inside `TargetColumn`** (under the
monster card) when the picked target has overrides — not a separate
full-width section. `SharePanel` is opened from the TopBar's "Share"
button (modal, not always-visible).

`SettingsPanel` is opened from the TopBar's gear icon (modal — see
[`design/project/modals.jsx`](design/project/modals.jsx) →
`SettingsModal`). It's NOT inline on the page.

### 1.4 Mobile (< `md`, stacked)

**See [`design/project/shells.jsx`](design/project/shells.jsx) →
`MobileCalc()`**. Summary:

```
WipBanner
└─ TopBar (compact — no nav, just logo + Share + Gear)
   └─ Page header (smaller — text-[18px])
      └─ Single/Compare tabs (2 buttons, full-width)
         └─ Section nav (4 buttons: Attacker / Target / Team / Buffs)
            └─ Stacked card list (currently-active section's content)
               └─ … (long scroll, padded bottom for sticky bar)
                  └─ STICKY BOTTOM BAR (always visible)
                     ├─ Avatar + char name → target name
                     ├─ Crit pill
                     ├─ Big damage number (amber, text-[42px])
                     ├─ DF % + non-crit value
                     └─ "View breakdown" → opens ResultPanel modal
```

The mobile section nav switches the visible content; the sticky
bottom bar shows the live damage prediction at all times.

The `ObsTablePanel` (admin only) is never shown.

### 1.5 Responsive breakpoints

Project uses Tailwind v4 with default breakpoints. Memo (CLAUDE.md):
**use canonical Tailwind classes, never `h-[72px]` when `h-18` exists**.

Recommended breakpoint usage:
- `< sm` (< 640px): single column.
- `sm` (≥ 640px): same — single column with denser typography.
- `md` (≥ 768px): single column still — most users are landscape
  tablet here, and the 3-col layout doesn't fit until ≥ 1024px.
- `lg` (≥ 1024px): 3-column layout for the main grid.
- `xl` (≥ 1280px): 3-column with wider gutters.

Tailwind classes to start with (applied on `CalculatorClient`'s root
grid):

```tsx
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4 py-6 max-w-7xl mx-auto">
  <AttackerPanel />
  <TargetPanel />
  <ResultPanel />
</div>
```

---

## 2. `CalcState` shape

The reducer's state — single source of truth for the entire calc UI.

```ts
export interface CalcState {
  attacker: AttackerState
  target: TargetState
  settings: SettingsState
  buffs: BuffsState
  team: TeamState
  bossMechanics: Record<string, BossMechanicState>
  bossOverride: BossOverride | null
  statsDirty: boolean
}
```

### 2.1 `AttackerState`

```ts
export interface AttackerState {
  charId: string | null
  detail: DamageCalcCharDetail | null     // lazy-loaded `chars/{id}.json`
  loading: boolean                         // inflight fetch indicator
  stats: StatValues                        // editable stat block
  skillSlot: SkillSlot                     // 'S1' | 'S2' | 'S3'
  skillLevel: 1 | 2 | 3 | 4 | 5
  burstLevel: 0 | 1 | 2 | 3                // 0 = no burst
  crit: boolean
  transStar: number                        // current transcend tier
  equipment: EquipmentLoadout              // weapon/accessory/sets/talisman/EE
  conditional: ConditionalModifiers        // pool-cond inputs
  atkScaling: StatScaling | null           // breakdown for additive ATK% stacking
}

export type StatKey = 'ATK' | 'DEF' | 'HP' | 'SPD' | 'CHC' | 'CHD' | 'PEN' | 'DMG_INC' | 'EFF' | 'RES'
export type StatValues = Record<StatKey, number>

export interface ConditionalModifiers {
  targetDebuffs:    number
  enemyTeamDeaths:  number
  targetBuffs:      number
  teamBuffs:        number
  casterLostHpPct:  number   // 0..100
  targetLostHpPct:  number
  killStacks:       number
}
```

### 2.2 `TargetState`

```ts
export type TargetMode = 'cascade' | 'manual'

export interface TargetState {
  mode: TargetMode
  stageId: string | null                   // DungeonTemplet.ID (or `${id}@al{N}`)
  monsterId: string | null                 // MonsterTemplet.ID
  manual: ManualTargetState                // independent of cascade selection
}

export interface ManualTargetState {
  isBoss: boolean
  element: string                          // 'Fire' / 'Water' / etc.
  stats: DamageCalcMonsterStats
}
```

### 2.3 `SettingsState`

```ts
export interface SettingsState {
  codexLevel: number                       // 0..11
  quirks: {
    element: boolean
    job: boolean
    pve: boolean
    adventureLicense: boolean
  }
}

export const INITIAL_SETTINGS: SettingsState = {
  codexLevel: 11,                          // max — assumes mature account
  quirks: {
    element: true,
    job: true,
    pve: true,
    adventureLicense: true,                // even though gated by mode
  },
}
```

**No `playerLevel` in settings.** Char Lv 100 is the prefill anchor;
Lv 105/110/120 give extra raw stats but no extra passives, and the
formula doesn't read attacker level. See `06-gotchas.md` §6.

**No `guildLevel` in settings.** Guild HP buff is a UI no-op — see
`04-runtime-model.md` §13.

**No `eeLevel` in `SettingsState`.** EE level lives PER-ATTACKER in
`AttackerState.equipment.ee.level` since each char can have a
different EE enchant.

### 2.4 `BuffsState`

```ts
export interface BuffsState {
  toggles: Record<string, ExternalBuffState>  // catalog-driven
  marked: boolean                              // separate flag — no editable value
}

export interface ExternalBuffState {
  active: boolean
  value: number                                // signed pct
}
```

The catalog (`EXTERNAL_BUFFS` from
`src/lib/damage/v2/external-buffs.ts`) defines:
- `id` — stable string ID (`a-buff-atk`, `t-debuff-def`, …).
- `side` — `attacker` | `target`.
- `direction` — `buff` | `debuff`.
- `stat` — `ATK` | `DEF` | `PEN` | `CHC` | `CHD` | `EFF` | `DR` | `CDMG_RED` | `DMG`.
- `label` — display string (in EN; UI translates via i18n).
- `defaultValue` — canonical in-game pct (signed).

### 2.5 `TeamState`

```ts
export const TEAM_SIZE = 3

export interface TeamState {
  members: TeamMember[]                    // length === TEAM_SIZE
}

export interface TeamMember {
  charId: string | null
  transStar: number
  talisman: TalismanLoadout
  exquisiteDeath: { enabled: boolean; tier: number }    // Defender-only
  defenderDef: number                                    // for ED scaling
  absoluteMusic: { enabled: boolean; tier: number }     // Ranger-only
}
```

The team panel is **optional** — most casual users won't fill it in.
When all slots are empty, the dealer's stats are unmodified.

### 2.6 Boss mechanics state

```ts
state.bossMechanics                        // Record<skillId | 'enrage', { active: boolean }>
state.bossOverride                         // BossOverride | null  (loaded from mechanics/{id}.json)
```

`bossOverride` is fetched on monster pick if the monster ID is in
`mechanics/_index.json`. Toggle states survive monster swaps when the
new monster shares a passive ID.

### 2.7 `statsDirty`

The user has manually edited the stats grid since the last char-pick
or reset. While `true`:
- Auto-prefill effect (settings or transcend change) is **skipped**
  to preserve manual edits.
- The reset button clears edits and returns to auto-prefill.

---

## 3. Action types

A discriminated union — every state transition has a typed action.

```ts
export type CalcAction =
  // Attacker
  | { type: 'attacker/setChar';       charId: string }
  | { type: 'attacker/setDetail';     detail: DamageCalcCharDetail }    // resolved fetch
  | { type: 'attacker/setLoading';    loading: boolean }
  | { type: 'attacker/setSkillSlot';  slot: SkillSlot }
  | { type: 'attacker/setSkillLevel'; level: 1|2|3|4|5 }
  | { type: 'attacker/setBurstLevel'; level: 0|1|2|3 }
  | { type: 'attacker/setCrit';       crit: boolean }
  | { type: 'attacker/setStat';       key: StatKey; value: number }      // marks dirty
  | { type: 'attacker/setStatsBatch'; stats: StatValues }                // for prefill
  | { type: 'attacker/clearDirty' }
  | { type: 'attacker/setTransStar';  transStar: number }
  | { type: 'attacker/setEquipment';  patch: Partial<EquipmentLoadout> }
  | { type: 'attacker/setEEEnabled';  enabled: boolean }
  | { type: 'attacker/setEELevel';    level: number }
  | { type: 'attacker/setEEVariant';  variant: 'self' | 'base' }
  | { type: 'attacker/setConditional'; patch: Partial<ConditionalModifiers> }
  | { type: 'attacker/setAtkScaling'; scaling: StatScaling | null }

  // Target
  | { type: 'target/setMode';      mode: TargetMode }
  | { type: 'target/setStage';     stageId: string }                     // resets monsterId
  | { type: 'target/setMonster';   monsterId: string }
  | { type: 'target/setManual';    patch: Partial<ManualTargetState> }
  | { type: 'target/setManualStat'; key: keyof DamageCalcMonsterStats; value: number }

  // Settings
  | { type: 'settings/setCodexLevel'; level: number }
  | { type: 'settings/setQuirk';      key: keyof SettingsState['quirks']; value: boolean }

  // External buffs
  | { type: 'buff/toggle';  id: string; active: boolean }
  | { type: 'buff/setValue'; id: string; value: number }
  | { type: 'buff/setMarked'; marked: boolean }

  // Boss mechanics
  | { type: 'bossMech/toggle';   skillId: string; active: boolean }
  | { type: 'bossMech/setOverride'; override: BossOverride | null }      // on monster swap

  // Team
  | { type: 'team/setMember';     index: number; patch: Partial<TeamMember> }
  | { type: 'team/setTalisman';   index: number; patch: Partial<TalismanLoadout> }
  | { type: 'team/setExquisite';  index: number; enabled: boolean; tier?: number }
  | { type: 'team/setAbsoluteMusic'; index: number; enabled: boolean; tier?: number }
  | { type: 'team/setDefenderDef'; index: number; def: number }

  // URL share
  | { type: 'state/loadFromUrl'; partial: Partial<CalcState> }

  // Reset
  | { type: 'state/reset' }
  | { type: 'state/resetAttacker' }
```

### 3.1 Reducer skeleton

```ts
import { INITIAL_STATE } from './types'

export function reducer(state: CalcState, action: CalcAction): CalcState {
  switch (action.type) {
    case 'attacker/setChar':
      // Switching char: reset detail, stats, slots, transStar, equipment, conditional
      return {
        ...state,
        attacker: {
          ...INITIAL_STATE.attacker,
          charId: action.charId,
          loading: true,
        },
        statsDirty: false,
      }

    case 'attacker/setDetail':
      // Detail loaded — prefill stats from noGearStats (NOT in reducer; effect)
      return {
        ...state,
        attacker: {
          ...state.attacker,
          detail: action.detail,
          loading: false,
        },
      }

    case 'attacker/setStat':
      // Manual edit — mark dirty
      return {
        ...state,
        attacker: {
          ...state.attacker,
          stats: { ...state.attacker.stats, [action.key]: action.value },
          atkScaling: action.key === 'ATK' ? null : state.attacker.atkScaling,
        },
        statsDirty: true,
      }

    // … other cases …
  }
}
```

### 3.2 Effect orchestration

Some actions trigger downstream effects (e.g., a char pick triggers a
fetch for the char detail + char buffs). These live in
`CalculatorClient.tsx` via `useEffect`:

```tsx
// On char pick: fetch detail + buffs
useEffect(() => {
  if (!state.attacker.charId) return
  fetchCharDetail(state.attacker.charId).then(detail =>
    dispatch({ type: 'attacker/setDetail', detail })
  )
  fetchCharBuffs(state.attacker.charId).then(setCharBuffs)
}, [state.attacker.charId])

// On detail loaded + settings change: auto-prefill stats
useEffect(() => {
  if (!state.attacker.detail || state.statsDirty) return
  const { stats, atkScaling } = computeFinalStats(
    state.attacker.detail.noGearStats,
    state.settings,
    state.attacker.transStar,
    state.settings.codexLevel,
  )
  dispatch({ type: 'attacker/setStatsBatch', stats })
  dispatch({ type: 'attacker/setAtkScaling', scaling: atkScaling })
}, [state.attacker.detail, state.settings, state.attacker.transStar])

// On monster pick: load mechanics override if any
useEffect(() => {
  if (!state.target.monsterId) return
  if (!mechanicsIndex.monsterIds.includes(state.target.monsterId)) {
    dispatch({ type: 'bossMech/setOverride', override: null })
    return
  }
  fetchMechanics(state.target.monsterId).then(file =>
    dispatch({ type: 'bossMech/setOverride', override: file.data })
  )
}, [state.target.monsterId, mechanicsIndex])
```

---

## 4. Per-panel contracts

### 4.1 `AttackerPanel`

**Props.**

```ts
interface AttackerPanelProps {
  state: AttackerState
  manifest: DamageCalcCharSummary[]
  detail: DamageCalcCharDetail | null
  transcend: DamageCalcTranscendCharEntry | null
  dispatch: Dispatch<CalcAction>
}
```

**Sections** (top to bottom):

1. **Char selector** — clickable card showing portrait + name + element
   badge + class. Opens `CharPickerModal` on click. Shows a placeholder
   when empty.
2. **Skill slot picker** — 3 buttons (S1 / S2 / S3). Active state
   highlighted. Dimmed if the char doesn't have that slot.
3. **Skill level slider** — 1..5. The picker shows the DamageFactor
   underneath ("DF: 1260").
4. **Burst level picker** — only visible when `slot === 'S3'` AND the
   char has any burst skill in detail. Buttons: "Base" (= 0), "B1",
   "B2", "B3". B2 disabled unless `transcend.tiers[N].burst2 === true`
   (where N matches state's `transStar`); B3 disabled unless `burst3`.
5. **Crit toggle** — single switch.
6. **Per-char flags** — only when `getCharOverride(charId,
   slot).conditionals` has entries. List of toggles (e.g., Ame: "Ume
   active" / "Sakura active").
7. **Stats grid** — 10 inputs (`ATK`, `DEF`, `HP`, `SPD`, `CHC`, `CHD`,
   `PEN`, `DMG_INC`, `EFF`, `RES`). Each input has:
   - A label.
   - The current value (parsed strict — NaN keeps previous value).
   - A `StatBadges` component on top showing "auto" (prefilled) /
     "manual" (edited) state.
   - A "reset" small icon that clears the manual override and
     re-runs the prefill effect.
8. **Conditional modifiers** — collapsible section with:
   - Caster lost HP %
   - Target lost HP %
   - Target debuffs count
   - Target buffs count
   - Team buffs count
   - Enemy team deaths (Maxwell type 94)
   - Kill count stack
   The picker hides fields whose matching pool-cond buff isn't on
   the picked char's active skill.
9. **`TranscendControl`** — picker for transcend tier (Lv 0 / Lv 3 /
   Lv 4-1 / Lv 4-2 / Lv 5-1 / Lv 5-2 / Lv 5-3 / Lv 6-1 / Lv 6-2 /
   Lv 6-3). Only tiers ≥ char's `BasicStar` are shown.
10. **`EquipmentPanel`** — EE selection. Toggle for enabled, slug
    picker (modal), level slider 0..10, base/CF variant toggle (CF
    chars only).

### 4.2 `TargetPanel`

**Props.**

```ts
interface TargetPanelProps {
  state: TargetState
  monsters: DamageCalcMonstersFile
  bossOverride: BossOverride | null
  bossMechanicsState: Record<string, BossMechanicState>
  dispatch: Dispatch<CalcAction>
}
```

**Sections.**

1. **Mode picker** — Category → Mode dropdown. Uses `MODE_GROUPS`
   from `mode-taxonomy.ts`. Locked when `state.mode === 'manual'`.
2. **Stage picker** — Stage list filtered by selected mode. Each row
   shows the dungeon name + stagePart (parsed via `parseDungeonStage`).
3. **Wave + slot picker** — clickable cards, one per `WaveEntry × Slot`.
   Each card shows: monster face icon, name, level, isBoss star.
4. **Resolved monster details** — read-only display:
   - Element badge (with auto-derived advantage to the dealer)
   - Stats summary (DEF / DR / CDR / HP) — these can be overridden in
     manual mode below.
5. **Manual mode toggle** — single switch. ON: hides sections 1-4,
   shows section 6.
6. **Manual target panel** — (when `mode === 'manual'`):
   - isBoss toggle
   - Element picker
   - Free-form stat inputs (DEF / DR / CDR / HP / etc.).
7. **`BossMechanicsPanel`** — embedded below the picker. Hidden when
   `bossOverride === null`.

### 4.3 `SettingsPanel`

**Props.**

```ts
interface SettingsPanelProps {
  state: SettingsState
  dispatch: Dispatch<CalcAction>
}
```

**Layout.** Compact horizontal strip near the top (or in a header
drawer on mobile). Sections:

1. **Codex level** — dropdown 0..11. Shows current `atkPct` /
   `defPct` / `hpPct` underneath.
2. **Quirks** — 4 checkboxes:
   - Element (always-on awakening element node — applies to char's
     element)
   - Job (class + subclass nodes)
   - PVE (Counteract Strong Enemies — affects PVE caster debuffs)
   - Adventure License (mode-gated — visible only as a toggle, applies
     only when target's mode is AL)
3. **EE level** — only visible when an EE is selected on the dealer.
   Slider 0..10. (Some teams prefer this on AttackerPanel; either
   placement works.)

### 4.4 `BuffsPanel`

**Props.**

```ts
interface BuffsPanelProps {
  state: BuffsState
  dispatch: Dispatch<CalcAction>
}
```

**Layout.** 4 columns on desktop, single column on mobile (each
section accordion):

| Attacker buffs | Attacker debuffs | Target buffs | Target debuffs |
|---|---|---|---|
| ATK +30 [✓] [30] | ATK −30 [☐] | DEF +50 [☐] | DEF −50 [✓] [50] |
| PEN +30 [☐] | PEN −30 [☐] | DR +30 [☐] | (none today) |
| CHC +50 [☐] | CHC −50 [☐] | CDR +30 [☐] | |
| CHD +50 [☐] | CHD −50 [☐] | | |
| EFF +100 [☐] | EFF −100 [☐] | | |
| DMG +30 [☐] | (none today) | | |

Each row: checkbox + label (translatable) + numeric input (strict
parse, signed). Disabled-grey input when checkbox is off (still
editable for preset before activating).

**Marked toggle** (separate, below the 4-section grid): "Marked
target — +15% damage taken (`BT_MARKING`)".

### 4.5 `BossMechanicsPanel`

**Props.**

```ts
interface BossMechanicsPanelProps {
  override: BossOverride | null
  state: Record<string, BossMechanicState>
  dispatch: Dispatch<CalcAction>
}
```

**Behavior.** Hidden when `override === null`. Otherwise:

- One row per `passive` in `override.passives[]`.
- Each row: checkbox (active state) + name (localized) + tooltip
  (description, localized).
- "Default active" passives default to ON; others default to OFF.

### 4.6 `ResultPanel`

**Props.**

```ts
interface ResultPanelProps {
  result: RecomputeResult | null
  ctx: RecomputeContext | null
  showDebug: boolean
  onToggleDebug: (on: boolean) => void
}
```

**Sections.**

1. **Headline value** — the integer damage. Format: thousands grouped
   per locale (`1 234 567` in fr, `1,234,567` in en).
2. **Components** — main / additional sub-amount breakdown.
3. **Breakdown** — collapsible:
   - Mitigation `0.521`
   - Rate (raw / capped) — show "Cap fired" badge when `rateRaw < 0.30`.
   - Element: ×1.20 / ×0.80 / ×1.00
   - Marking: ×1.15 (when active)
   - Missed: ×0.5 (when active)
   - Final reduce: ×0.85 (when active)
4. **Debug section** — collapsed by default; visible when
   `onToggleDebug(true)` (chevron):
   - `breakdown.debugSteps[]` — full f32 trace from formula.
   - `reduced.debugSteps[]` — reducer trace.
   - `reduced.active[]` — list of buffs that fired.
5. **Share button** — opens / focuses `SharePanel`.

### 4.7 `SharePanel`

**Props.**

```ts
interface SharePanelProps {
  state: CalcState
  url: string                              // pre-computed via serialize()
  onCopy: () => void
  onOpenInTab: () => void
}
```

**Behavior.**

- Computes `shareUrl = ${origin}/[lang]/tools/damage-calculator?${serialize(state)}`.
- Copy button uses `navigator.clipboard.writeText(shareUrl)`.
- Open-in-tab button: `window.open(shareUrl, '_blank')`.
- Shows a truncated preview of the URL.

### 4.8 `CharPickerModal`

**Props.**

```ts
interface CharPickerModalProps {
  manifest: DamageCalcCharSummary[]
  isOpen: boolean
  onSelect: (charId: string) => void
  onClose: () => void
}
```

**Behavior.**

- Filterable by element (5 chips: Earth/Water/Fire/Light/Dark).
- Filterable by class (5 chips).
- Searchable by name (lowercase substring match across all 4 langs).
- Grid of clickable char cards.
- Filter pills clearable.

### 4.9 `EquipmentPickerModal`

**Props.**

```ts
interface EquipmentPickerModalProps {
  catalog: DamageCalcEquipmentEE[]         // from equipment.json
  attackerCharId: string
  baseCharId?: string                       // for CF chars
  isOpen: boolean
  onSelect: (slug: string, variant: 'self' | 'base') => void
  onClose: () => void
}
```

Used to pick the EE for the attacker. CF chars get two cards (their
own EE + the base char's EE).

### 4.10 `TeamPanel`

**Props.**

```ts
interface TeamPanelProps {
  state: TeamState
  manifest: DamageCalcCharSummary[]
  transcend: DamageCalcTranscendFile
  equipment: DamageCalcEquipmentFile
  dispatch: Dispatch<CalcAction>
}
```

3 ally slots (or however many `TEAM_SIZE` is). Each slot:
- Char picker.
- Transcend tier picker.
- Talisman picker (rarity + main stat + level).
- Class-specific signature gear toggle (Defender: Exquisite Death;
  Ranger: Absolute Music).

The team contributions feed `computeTeamDeltas` (in
`compose-result.ts`) and apply to the dealer's BASE stats.

---

## 5. Mode taxonomy

The picker's category → mode tree is defined in `_lib/mode-taxonomy.ts`:

```ts
export const MODE_GROUPS: ModeCategory[] = [
  { categoryKey: 'guides.category.special-request', modes: [
    { rawMode: 'DM_RAID_1', displayKey: 'tools.damage-calculator.sub.ecology_study' },
    { rawMode: 'DM_RAID_2', displayKey: 'tools.damage-calculator.sub.identification' },
  ]},
  { categoryKey: 'guides.category.adventure-license', modes: [
    { rawMode: 'DM_ADVENTURE_MISSION',   displayKey: 'tools.damage-calculator.sub.weekly_conquest' },
    { rawMode: 'DM_ADVENTURE_CHALLENGE', displayKey: 'tools.damage-calculator.sub.promotion' },
  ]},
  // … (full table in 00-overview.md §3.5)
]

export function classifyMode(rawMode: string, labelEn?: string)
  : { categoryKey: TranslationKey; subKey: TranslationKey } | null
```

`labelMatch` regex disambiguates raw modes that map to multiple
display labels (e.g., `DM_NORMAL` → Normal/Hard, `DM_TOWER_ELEMENT`
→ Earth/Water/Fire/Light/Dark).

`parseDungeonStage(stage)` extracts the per-stage display split:

1. `season + episodeNum present` → `EP {n}: {chapter.en}` / `{episodeNum}-{stageNum}`.
2. `<base> (Stage N)` → `<base>` / `Stage N`.
3. `<base> NF` (tower) → `<base>` / `NF`.
4. `<base> (Difficulty)` → `<base>` / `Difficulty`.
5. fallback: stage name verbatim, no split.

Operates on the EN field; localization happens elsewhere via
`lRec(stage.name, lang)`.

---

## 6. Settings semantics

### 6.1 Codex level

Picker: `0`..`11`. Default `11`.

Effect: applied at prefill time via `noGearStats.codexPct` lookup
into `manifest.codexTable[level]`. Does NOT feed the formula
directly — the formula reads the post-prefill stats.

### 6.2 Quirks toggles

Each is a simple boolean. Default all `true`.

| Toggle | What it gates |
|---|---|
| `element` | `noGearStats.quirks.element` (always-on awakening element nodes for the char's element) |
| `job` | `noGearStats.quirks.job` (class + subclass nodes) |
| `pve` | `composeApplicableBuffs(opts.pveQuirk)` — filters `source.group === 'PVE'` awakening buffs (Counteract Strong Enemies). When OFF: no +30% pool vs boss + no PVE caster debuffs. |
| `adventureLicense` | `inAdventureLicense` flag in `RecomputeContext` (gates AL awakening sub-nodes; only applies when target's mode is also AL) |

The PVE toggle has a side-effect: when ON, the TargetPanel shows the
"effective EFF/RES under PVE quirks" display value (computed by
`computePveBossDebuffs`). This is informational — the formula itself
doesn't read EFF/RES.

### 6.3 EE level

Stored on the attacker (`AttackerState.equipment.ee.level`), not in
Settings, since each char can have a different EE enchant level.

UI: slider 0..10. Default 10 if EE selected, 0 otherwise.

---

## 7. URL share format

`_lib/share.ts` exposes `serialize(state) → URLSearchParams` and
`deserialize(query) → Partial<CalcState>`.

### 7.1 Compact encoding

Keys are single letters (or 2-3 letters for clarity). Numeric values
in base 10. Booleans encoded as `0`/`1`. Arrays / objects flattened.

```
?c=2000028&s=2&l=5&b=2&cr=1&t=6&a=12345&hd=50&p=80&di=0
&tg=70600101%40al8&tm=&et=Dark&te=...
&cx=11&q=1110&ee=1&el=10&ev=base
&xb=a-buff-atk:30,a-buff-def:50,t-debuff-def:-50
&mk=0&bm=132408:1
```

Symbol legend (one-letter unless ambiguous):
- `c` — char ID
- `s` — skill slot (`1`/`2`/`3`)
- `l` — skill level (`1`..`5`)
- `b` — burst level (`0`..`3`)
- `cr` — crit (`0`/`1`)
- `t` — transcend tier (`0`..`9`)
- `a` — ATK (raw flat)
- `hd` — CHD %
- `p` — PEN %
- `di` — DMG↑ %
- `def` — DEF flat
- `hp` — HP flat
- `spd` — SPD flat
- `chc` — CHC %
- `eff` — EFF flat
- `res` — RES flat
- `tg` — stage ID (URL-encoded; `@` → `%40`)
- `tm` — manual target flag (`0`/`1`)
- `et` — element (cascade auto, manual when `tm=1`)
- `te` — manual element (when `tm=1`)
- `cx` — codex level
- `q` — quirks bitmap (4 bits: element/job/pve/AL — `1110` = AL off)
- `ee` — EE enabled (`0`/`1`)
- `el` — EE level
- `ev` — EE variant (`self`/`base`)
- `xb` — external buffs CSV (`id:value` pairs)
- `mk` — marked
- `bm` — boss mechanic toggles CSV (`skillId:active`)
- `tx` — team CSV (per-slot encoded)

### 7.2 Decoding strategy

```ts
export function deserialize(query: URLSearchParams): Partial<CalcState> {
  const out: Partial<CalcState> = {}
  // Defensive parse — every field optional, returns INITIAL_STATE-fill on missing.
  const c = query.get('c'); if (c) out.attacker = { ...out.attacker, charId: c }
  // … etc.
  return out
}
```

Apply via `state/loadFromUrl` action which **deep-merges** with the
current state (preserving in-progress edits if the user is mid-edit
when a deep-link comes in — though typically the page mounts on the
deep-link before any editing).

### 7.3 Round-trip stability

Goal: `deserialize(serialize(state))` produces a state that `recompute`
evaluates to the same `calculated` value. Field-equality is NOT
required (defaults can fill in absent params), but the computation
result must be deterministic.

A round-trip test in CI samples ~50 random states, serializes,
deserializes, recomputes, and asserts equality on `result.calculated`.

### 7.4 Versioning

The share URL has a top-level version: `v=1`. On version mismatch,
the deserializer:
- Logs a warning.
- Falls back to defaults for fields it doesn't recognize.

A migration table is added when a breaking change ships (e.g., a
field rename). Old links remain shareable.

---

## 8. `localStorage` persistence

### 8.1 Key format

```
damage-calc-form-v{N}
```

Where `N` is bumped on breaking schema changes. Current value: see
the existing `CalculatorClient.tsx` (it tracks the version).

### 8.2 Stored shape

```ts
{
  version: 1,
  state: CalcState
}
```

### 8.3 Load + save

```ts
// On client mount (post-hydration):
useEffect(() => {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return
  try {
    const { version, state: stored } = JSON.parse(raw) as { version: number; state: CalcState }
    if (version !== STORAGE_VERSION) return
    dispatch({ type: 'state/loadFromUrl', partial: stored })
  } catch {
    // ignore parse errors
  }
}, [])

// On state change (debounced 200ms):
useEffect(() => {
  const handle = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, state }))
  }, 200)
  return () => clearTimeout(handle)
}, [state])
```

### 8.4 URL takes precedence

If a deep-link is shared:

```
?c=2000028&s=2&l=5&...
```

The mount effect:
1. Reads URL → `partial1`.
2. Reads localStorage → `partial2`.
3. Merges: `loadFromUrl({ ...partial2, ...partial1 })` (URL wins).
4. Dispatches one action.

This way, the user's localStorage is preserved as a baseline (their
char roster, their settings) but a shared link's specific
`charId`/`stageId`/`crit` etc. take effect.

### 8.5 Hydration mismatch avoidance

The reducer initializes with `INITIAL_STATE` on both server and
client. The localStorage / URL load happens **post-mount**, never in
the initial render. This avoids React's hydration mismatch warning
(server renders `INITIAL_STATE`-derived markup; client matches; then
the post-mount effect kicks in).

---

## 9. i18n integration

### 9.1 Translation keys

All UI strings must come through `t(key)` from `@/i18n`. Per CLAUDE.md:

> Languages: `en`, `jp`, `kr`, `zh` — defined in `src/lib/i18n/config.ts`
> (single source of truth). Never hardcode language arrays elsewhere.

> Locale files (`src/i18n/locales/`): line alignment — keys and section
> comments must appear at the same line numbers across all 4 files.

Key namespaces for the calc:

```
tools.damage-calculator.cat.*       — taxonomy categories
tools.damage-calculator.sub.*       — taxonomy sub-modes
tools.damage-calculator.attacker.*  — AttackerPanel labels
tools.damage-calculator.target.*    — TargetPanel labels
tools.damage-calculator.settings.*  — SettingsPanel labels
tools.damage-calculator.buffs.*     — BuffsPanel labels
tools.damage-calculator.result.*    — ResultPanel labels
tools.damage-calculator.share.*     — SharePanel labels
tools.damage-calculator.team.*      — TeamPanel labels
```

Reused keys (don't redefine):
- `guides.category.*` — for shared mode-category labels
  (`special-request`, `adventure-license`, `irregular-extermination`,
  `temporary-modes`, etc.).
- `sys.element.*` — for elemental labels (Earth/Water/Fire/Light/Dark).

### 9.2 Inline tags

Per CLAUDE.md:

> Inline tags (`{B/...}`, `{D/...}`, etc.) must stay identical across
> all languages.

Skill descriptions in `chars/{id}.json` use `{D/...}` tags for damage
references. The UI's `getSkillDescription()` helper resolves these.

### 9.3 Localized data fields

- Char names: `summary.name` + `summary.name_jp` / `name_kr` /
  `name_zh`. Read with `l(summary, lang)`.
- Stage names, monster names, mode labels: `LangDict` shape
  (`{ en, jp, kr, zh }`). Read with `lRec(field, lang)`.
- EE names, set names, passive names: `LangMap` shape (`{ en?, jp?,
  kr?, zh? }` — keys optional). Read with `lRec(field, lang)`.

EN is the canonical fallback. If a non-EN field is missing, render
the EN.

---

## 10. Page metadata (server entry)

```tsx
// src/app/[lang]/tools/_contents/damage-calculator/index.tsx
import type { Metadata } from 'next'

export async function generateMetadata({ params }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations(lang, 'tools.damage-calculator.meta')
  return {
    title: t('title'),
    description: t('description'),
    openGraph: {
      title: t('title'),
      description: t('description'),
      images: ['/images/og/damage-calculator.jpg'],   // .jpg, NOT .webp (CLAUDE.md)
    },
    twitter: {
      card: 'summary_large_image',
      images: ['/images/og/damage-calculator.jpg'],
    },
  }
}

export default async function Page({ params }) {
  const { lang } = await params
  const manifest = await getDamageCalcCharManifest()
  const monsters = await getDamageCalcMonsters()
  const awakening = await getDamageCalcAwakeningBuffs()
  const transcend = await getDamageCalcTranscend()
  const equipment = await getDamageCalcEquipment()
  const mechanicsIndex = await getDamageCalcMechanicsIndex()
  return (
    <CalculatorClient
      lang={lang}
      manifest={manifest}
      monsters={monsters}
      awakening={awakening}
      transcend={transcend}
      equipment={equipment}
      mechanicsIndex={mechanicsIndex}
    />
  )
}
```

Note: the OG / Twitter images are `.jpg`/`.png` — some crawlers don't
support `.webp` (CLAUDE.md).

---

## 11. Hydration strategy

### 11.1 Server-rendered shell

The server renders the page with `INITIAL_STATE`-derived markup. No
char picked, no target picked → `ResultPanel` shows a "Pick a char"
placeholder, `AttackerPanel` shows the empty state.

The bake data (manifest, monsters, awakening, etc.) IS loaded on the
server and passed to the client root as props. Lazy-loaded files (char
detail, char buffs, mechanics) are NOT pre-loaded.

### 11.2 Client mount

```tsx
'use client'

export function CalculatorClient({ manifest, monsters, awakening, ... }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)
  const [hydrated, setHydrated] = useState(false)

  // Post-mount: load from URL + localStorage, mark hydrated.
  useEffect(() => {
    const url = new URLSearchParams(window.location.search)
    const ls = localStorage.getItem(STORAGE_KEY)
    const partial: Partial<CalcState> = mergePartials(
      ls ? JSON.parse(ls).state : null,
      deserialize(url),
    )
    if (Object.keys(partial).length > 0) {
      dispatch({ type: 'state/loadFromUrl', partial })
    }
    setHydrated(true)
  }, [])

  // Render — children may show skeleton while !hydrated.
  return <Layout>...</Layout>
}
```

`hydrated === false` for the very first render (before the post-mount
effect). Components can render skeletons (or render their initial
state and accept the flash).

### 11.3 No SSR for char detail / char buffs

These files are 5-15 KB each and char-specific. Pre-loading every
char would balloon the page. They're fetched client-side on char pick:

```tsx
useEffect(() => {
  if (!state.attacker.charId) return
  Promise.all([
    fetchCharDetail(state.attacker.charId),
    fetchCharBuffs(state.attacker.charId),
  ]).then(([detail, buffs]) => {
    dispatch({ type: 'attacker/setDetail', detail })
    setCharBuffs(buffs)
  })
}, [state.attacker.charId])
```

While `loading: true`, `AttackerPanel` shows a spinner; `ResultPanel`
shows "computing…".

---

## 12. Accessibility

The calc handles a lot of numeric inputs and toggle states. Keep ARIA
clean:

- Every interactive element has a `role` and `aria-label` when not
  visually labeled.
- Keyboard navigation: Tab cycles inputs; Space toggles checkboxes;
  Enter submits modals (CharPickerModal closes with current selection).
- Focus management: opening a modal moves focus to its first focusable
  element; closing returns focus to the trigger.
- Error states: invalid input (e.g., empty ATK) should announce via
  `aria-invalid="true"` + `aria-describedby` linking to an error
  message.

---

## 13. Performance budget

### 13.1 Cold load

Target ≤ 3s on a mid-range Android (Moto G4-class) over 4G:
- HTML server-rendered (≤ 50 KB gzipped).
- Initial JS chunk for the route (≤ 200 KB gzipped).
- Bake data parallel-fetched, total ≤ 300 KB gzipped — see
  `03-bake-contract.md` §11.3.

### 13.2 Reducer re-render

Every dispatch produces a new top-level state object. Reactivity is
ref-based at the component level — `AttackerPanel` only re-renders
when `state.attacker` changes (deep-equality not required because
the reducer creates new sub-state objects only when the slice changes).

### 13.3 `recompute` memoization

```tsx
const result = useMemo(
  () => runRecompute(state, awakening, charBuffs, monsters, manifest, transcend, equipment),
  [state, awakening, charBuffs, monsters, manifest, transcend, equipment],
)
```

Median 1ms, p99 5ms. No further optimization needed.

### 13.4 Modal mounting

`CharPickerModal` and `EquipmentPickerModal` are heavy (filterable
grid). Render them only when `isOpen` to avoid permanent layout cost:

```tsx
{isCharPickerOpen && (
  <CharPickerModal
    manifest={manifest}
    isOpen={isCharPickerOpen}
    onSelect={handleCharSelect}
    onClose={() => setIsCharPickerOpen(false)}
  />
)}
```

---

## 14. Service worker

The site has a service worker (`/sw.js`). Per CLAUDE.md:

> Version bump: `node scripts/set-version.js X.Y.Z` (updates
> `package.json` + SW cache name)

The damage-calc bake files are precached on install:

- `/damage-calc/manifest.json`
- `/damage-calc/monsters.json`
- `/damage-calc/buffs/awakening.json`
- `/damage-calc/transcend.json`
- `/damage-calc/equipment.json`
- `/damage-calc/mechanics/_index.json`

Per-char files (chars/{id}.json, buffs/{id}.json, mechanics/{id}.json)
are runtime-cached (network-first with cache fallback).

When the SW cache name changes (deploy), users get the new bake on
their next page load.

---

## 15. Testing

### 15.1 Component-level

- Render each panel in isolation with synthetic state slices.
- Assert key labels appear (i18n smoke).
- Assert action dispatch happens on key interactions (click char
  card → `setChar` action).

### 15.2 Reducer-level

- Test each action type independently.
- Assert `setChar` resets the right slices.
- Assert `setStat` marks dirty.
- Assert `state/reset` returns to `INITIAL_STATE`.

### 15.3 Integration

- Mount full `<CalculatorClient />` with mock bake data.
- Assert end-to-end: pick char → assert detail loaded → assert
  prefill happened → pick stage → assert recompute fired.

### 15.4 URL round-trip

- Sample 50 random `CalcState`s, `serialize` → `deserialize` →
  `runRecompute` → assert `calculated` matches the original.

### 15.5 Bake fixture replay

Same as `04-runtime-model.md` §16.3 — the calc UI's `runRecompute`
must produce the same `calculated` as the admin lab's reference
implementation.

---

## 16. Common pitfalls

### 16.1 Prop drilling vs context

The calc's state is small (≤ 5 KB serialized) and reactive — prop
drilling is FINE. Don't introduce a context provider; it adds
reactivity boundaries the reducer doesn't need.

### 16.2 Forgetting to mark `statsDirty`

Manual stat edits MUST mark `statsDirty: true` to prevent the auto-
prefill effect from overwriting them. Easy to miss when adding new
stat fields.

### 16.3 Sharing wholesale `state` across props

Don't pass `state` to every panel. Pass the slice they need. Keeps
the panel's prop type tight and helps memo / dev tooling.

### 16.4 Mode raw token vs label confusion

The `mode` field carries the RAW `DungeonMode` token (`DM_NORMAL`,
`DM_TOWER_HARD`). Don't substitute the localized label — quirk
gating, taxonomy classification, environment heuristics all need the
raw token.

### 16.5 Floating-point comparison

When comparing damage values, use `toBeCloseTo` or
`toBeWithin(lo, hi)`. Direct `===` will fail on f32 drift.

### 16.6 `localStorage` on first render

Never read `localStorage` in the initial render — it's client-only.
Use `useEffect`. Server-rendered HTML must match the first client
render before the post-mount load.

---

## 17. Future-proofing

### 17.1 New stat axis

When the game adds a new stat (rare), update:
- `STAT_KEYS` array.
- `StatValues` type.
- `INITIAL_STATS` defaults.
- `AttackerPanel` grid (new input).
- `SharePanel` URL field.

### 17.2 New char with weird scaling

When a char ships with a never-seen scaling pattern:
- Most cases: covered by the existing `scaling_swap` /
  `scaling_add_*` / `scaling_target_stat` taxonomy.
- Edge cases: extend `getCharOverride()` with a new `dfMultiplier` /
  `conditionals` entry.

### 17.3 New external buff toggle

Add to the `EXTERNAL_BUFFS` catalog in `src/lib/damage/v2/external-buffs.ts`.
The UI auto-renders the new row.

### 17.4 New boss mechanic

Add the boss override to the `mechanics/{id}.json` bake. The UI
auto-renders the panel when the user picks the boss.

---

End of UI contract. Continue to `06-gotchas.md`.
