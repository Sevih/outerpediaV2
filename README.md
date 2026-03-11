![Next.js](https://img.shields.io/badge/Next.js-16.1-blue?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![React](https://img.shields.io/badge/React-19.2-61dafb?logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)

# Outerpedia v2

> A comprehensive, multilingual companion wiki and toolkit for Outerplane — built with Next.js 16 and TypeScript

**Outerpedia** is a fan-made, community-driven database for **Outerplane**, the turn-based mobile RPG developed by VA Games and published by Major9. It provides comprehensive information about characters, equipment, guides, tier lists, and various utility tools to help players optimize their gameplay experience.

### Live Sites

- **English**: [outerpedia.com](https://outerpedia.com)
- **Japanese**: [jp.outerpedia.com](https://jp.outerpedia.com)
- **Korean**: [kr.outerpedia.com](https://kr.outerpedia.com)
- **Chinese (Simplified)**: [zh.outerpedia.com](https://zh.outerpedia.com)

**Community:** [Join the EvaMains Discord](https://discord.com/invite/keGhVQWsHv)

---

## Features

### Character Database (115 Characters)
- Complete character information including stats, skills, and abilities
- Detailed skill descriptions with cooldowns and wave gain rates
- Exclusive Equipment (EE) data with effects and ranks
- Transcendence progression (levels 1–6 with multiplayer transcends at 4 & 5)
- Recommended gear sets for PvE and PvP
- Buffs/debuffs provided by each character
- Voice actor information (localized per language)
- Pro/Cons editorial analysis

### Equipment System
- Full catalog of weapons, armor, amulets, and accessories
- Advanced filtering by type, rarity, set bonuses
- Gear set recommendations per character
- Substat mapping and optimization data
- Set bonus information

### Tier Lists
- **PvE Tier List**: Character rankings for story/adventure content
- **PvP Tier List**: Character rankings for Arena/competitive modes
- Evaluation based on 6-star transcended characters with level 0 EE
- Filtering by element, class, and role

### Guides
- **Categories**: Adventure, Adventure License, General, Guild Raid, Irregular Extermination, Joint Boss, Monad Gate, Skyward Tower, Special Request, World Boss
- Comprehensive how-to-play guides
- Boss strategies and team compositions
- All guides support multi-language content

### Utility Tools (14 Tools)
1. **Pull Simulator** — Gacha/banner simulation
2. **EE Priority Calculator (Base)** — Exclusive Equipment upgrade planning
3. **EE Priority Calculator (+10)** — EE optimization at +10
4. **Gear Usage Finder** — Find who uses specific gear
5. **Gear Usage Statistics** — Character gear popularity analysis
6. **Most Used Units** — Meta analysis
7. **Interactive Tier Lists** — PvE & PvP rankings with filtering
8. **Coupon Codes** — Active coupon code manager with copy functionality
9. **Patch History** — Version changelog tracking
10. **Team Planner** — Team composition builder with chain logic and image export
11. **Progress Tracker** — Player progression tracking
12. **Event Calendar** — Upcoming and ongoing events
13. **OST Player** — In-game music player
14. **Wallpapers** — Character wallpaper gallery

### Technical Features
- **Lightning Fast** — Static generation, Cloudflare CDN with global edge network
- **Fully Multilingual** — Type-safe i18n support (EN, JP, KR, ZH) with subdomain-based routing
- **PWA Support** — Service worker with offline capabilities
- **Modern UI** — Tailwind CSS v4 with CSS-based configuration
- **SEO Optimized** — Dynamic meta tags, hreflang tags, OpenGraph, Twitter Cards
- **Secure** — Full CSP, HSTS, X-Frame-Options, Permissions-Policy headers
- **Accessible** — ARIA labels, semantic HTML, keyboard navigation

---

## Tech Stack

### Core Technologies
| Technology | Version | Purpose |
|------------|---------|---------|
| [Next.js](https://nextjs.org/) | 16.1 | App Router, React Server Components |
| [React](https://react.dev/) | 19.2 | UI Framework |
| [TypeScript](https://www.typescriptlang.org/) | 5 | Type Safety |
| [Tailwind CSS](https://tailwindcss.com/) | 4 | Utility-First Styling (CSS-based config) |

### Libraries
- **Radix UI** — Accessible hover card primitives
- **React Icons** — Icon library
- **Keen Slider** — Touch slider component
- **LZ-String** — Compression for shareable URLs (team planner)
- **Cheerio** — HTML parsing (datamine)

### Development Tools
- **ESLint** — Linting with Next.js config
- **tsx** — TypeScript execution for scripts and pipeline
- **Sharp** — Image processing and WebP conversion

---

## Multi-Language Architecture

Outerpedia features a **subdomain-based multi-language architecture** with type-safe translations.

### Supported Languages
| Key | Language | Subdomain | Default |
|-----|----------|-----------|---------|
| `en` | English | `outerpedia.com` | Yes |
| `jp` | 日本語 | `jp.outerpedia.com` | — |
| `kr` | 한국어 | `kr.outerpedia.com` | — |
| `zh` | 中文 | `zh.outerpedia.com` | — |

### How It Works

1. **Subdomain Detection**: Handled by `src/proxy.ts` (no middleware.ts) — rewrites subdomain requests to internal `[lang]/` routes
2. **Language Config**: Single source of truth in `src/lib/i18n/config.ts`
3. **Translation Files**: Locale files in `src/i18n/locales/` — line-aligned across all 4 languages
4. **Localized Data**: Data fields support `_jp`, `_kr`, `_zh` suffixes (e.g., `Fullname_jp`)

---

## Getting Started

### Prerequisites

- Node.js 18+ (recommended: 20+)
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/Sevih/outerpedia.git
cd outerpedia

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the site.

For local subdomain testing (e.g. `jp.outerpedia.local`), set up a reverse proxy (such as [Caddy](https://caddyserver.com/)) pointing the subdomains to `localhost:3000` and add them to your hosts file.

---

## Scripts

### Core

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server with automatic WebP image watcher |
| `npm run dev:next` | Development server only (no image watcher) |
| `npm run build` | Full production build (pipeline + Next.js build) |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

### Data Pipeline

| Command | Description |
|---------|-------------|
| `npm run pipeline` | Run the full data processing pipeline |
| `npm run pipeline:step <name>` | Run a single pipeline step |
| `npm run pipeline:validate` | Validate pipeline output |

### Assets

| Command | Description |
|---------|-------------|
| `npm run images` | Convert source images to WebP |
| `npm run images:watch` | Watch and auto-convert images |

### Versioning

```bash
node scripts/set-version.js X.Y.Z
```

Updates `package.json` version and the service worker cache name.

---

## Build Process

The production build runs a comprehensive pipeline:

```bash
npm run build
```

This executes:
1. Clean `.next` cache
2. Update app version
3. Run the data pipeline (generates `data/generated/`)
4. Convert images to WebP
5. Next.js production build

---

## Project Structure

```
outerpedia-v2/
├── data/                         # Game data (JSON) — NOT inside src/
│   ├── character/                # 115 character files
│   ├── boss/                     # Boss data
│   ├── equipment/                # Equipment data
│   ├── effects/                  # Buff/debuff effects
│   ├── reco/                     # Gear recommendations
│   ├── guides/                   # Guide metadata & categories
│   ├── guild-raid/               # Guild raid data
│   ├── monad/                    # Monad Gate data
│   ├── tower/                    # Skyward Tower data
│   ├── tools/                    # Tool-specific data
│   ├── patch-notes/              # Patch note data
│   └── generated/                # Auto-generated data (gitignored)
│
├── pipeline/                     # Data processing pipeline
│   ├── config.ts                 # Path definitions
│   ├── run.ts                    # Pipeline runner
│   └── steps/                    # Individual pipeline steps
│
├── scripts/                      # Dev utilities
│   ├── convert-images.ts         # Image → WebP conversion
│   ├── dev-with-images.ts        # Dev server + image watcher
│   ├── set-version.js            # Version bump (package.json + SW)
│   └── commit.mjs                # Git commit helper
│
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── [lang]/               # i18n-routed pages
│   │   │   ├── characters/       # Character pages
│   │   │   ├── equipments/       # Equipment pages
│   │   │   ├── tierlist/         # Tier list page
│   │   │   ├── guides/           # Guide system
│   │   │   ├── tools/            # Utility tools (14 total)
│   │   │   ├── coupons/          # Coupon codes
│   │   │   ├── contributors/     # Contributors page
│   │   │   ├── changelog/        # Update log
│   │   │   └── legal/            # Legal pages
│   │   ├── api/                  # API routes (search index)
│   │   └── components/           # React components
│   │       ├── character/        # Character display (20 components)
│   │       ├── equipment/        # Equipment display (14 components)
│   │       ├── guides/           # Guide components (26+ components)
│   │       ├── home/             # Homepage components
│   │       ├── inline/           # Inline tooltips & references
│   │       ├── layout/           # Header, Footer, LanguageSwitcher
│   │       ├── tools/            # Tool components
│   │       └── ui/               # Shared UI primitives
│   │
│   ├── lib/                      # Core utilities
│   │   ├── data/                 # Data access layer (use this, not raw JSON)
│   │   ├── i18n/                 # i18n config (single source of truth)
│   │   ├── contexts/             # React contexts
│   │   ├── monad/                # Monad Gate logic
│   │   ├── seo.ts                # SEO & metadata utilities
│   │   └── nav.ts                # Navigation definitions
│   │
│   ├── i18n/locales/             # Translation files (en, jp, kr, zh)
│   └── proxy.ts                  # Subdomain routing (replaces middleware)
│
├── public/
│   ├── images/                   # Game assets
│   ├── icons/                    # PWA icons
│   ├── audio/                    # OST audio files
│   └── sw.js                     # Service worker
│
├── next.config.ts                # Next.js config (security headers, env)
└── package.json
```

---

## SEO & Security

- **Dynamic Meta Tags** — Per-page metadata with i18n support
- **hreflang Tags** — Language/region alternates for all 4 languages
- **OpenGraph & Twitter Cards** — Social media preview optimization
- **Security Headers** — Full CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- **Typed Routes** — Next.js typed route checking enabled

---

## Performance

- **Cloudflare CDN** — Global content delivery
- **React Server Components** — Reduced client-side JavaScript
- **Image Optimization** — Automatic WebP conversion via Sharp
- **Code Splitting** — Route-based automatic splitting
- **Service Worker** — PWA support with versioned cache
- **HTTP/3 & Brotli** — Modern protocol optimizations via CDN

---

## Contributing

Contributions are welcome! This is a community-driven project.

Join the [EvaMains Discord](https://discord.com/invite/keGhVQWsHv) to discuss contributions, report issues, or suggest features.

### Adding New Characters

1. Create a new JSON file in `data/character/`
2. Follow the structure of existing character files
3. Include localized fields (`_jp`, `_kr`, `_zh`)
4. Run `npm run pipeline` to regenerate indexes

### Development Guidelines
- Follow TypeScript strict mode
- Use the data access layer (`src/lib/data/`) — never import JSON directly
- Ensure i18n keys are added for all 4 languages at the same line numbers
- Test on multiple screen sizes (responsive-first)

---

## License

This project is a fan-made companion site and is not affiliated with or endorsed by VA Games or Major9. All game assets, character names, and related intellectual property belong to their respective owners.

---

## Acknowledgments

- **VA Games** — For developing Outerplane
- **Major9** — For publishing and supporting the game
- **Community Contributors** — For translations, guides, and feedback
- **EvaMains Discord** — For being an awesome community

---

Made with ❤️ by the Outerpedia community
