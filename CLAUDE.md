# Claude Code Instructions — Outerpedia V2

Game: **Outerplane**

## Critical Rules

- **NEVER run `npm run build`** — it kills the dev server
- Always respond in **French**, code and comments in **English**
- Never create files unless strictly necessary — prefer editing existing ones
- Always ensure good **desktop + mobile** rendering — think responsive from the start

## Shell

- Uses **Git Bash** — never use `>nul` or `chcp` (Windows CMD syntax)
- Python is `python` (not `python3`)

## Data

- All game data lives in `data/` at the project root, **NOT** inside `src/`
- `data/generated/` is gitignored — never edit manually
- For game data (characters, bosses, equipment, effects), always use the **data access layer** in `src/lib/data/` — never import JSON directly
- For static site data (changelog, contributors), direct `@data/` import is fine

## i18n Rules

- Languages: `en`, `jp`, `kr`, `zh` — defined in `src/lib/i18n/config.ts` (single source of truth). **Never hardcode language arrays elsewhere.**
- Locale files (`src/i18n/locales/`): **line alignment** — keys and section comments must appear at the same line numbers across all 4 files
- **No duplicate i18n keys** — check existing keys before creating new ones
- Inline tags (`{B/...}`, `{D/...}`, etc.) must stay **identical across all languages**

## Routing

- **There is NO middleware.ts** — routing is handled by `src/proxy.ts`
- New root-level routes (outside `[lang]`) must be added to the **exclusion list** in `proxy.ts`
- When adding pages, update `NAV_ITEMS`/`ALL_PAGES` in `src/lib/nav.ts`

## Code Style

- **Tailwind: use canonical classes** — never `h-[72px]` when `h-18` exists. Check Tailwind v4 spacing scale before using `[Xpx]`.
- Images: `.webp` in components, `.jpg`/`.png` for metadata (OG/Twitter) — some crawlers don't support webp
- Slugs are kebab-case, used as primary identifiers — never filter/group on localized fields
- Version bump: `node scripts/set-version.js X.Y.Z` (updates `package.json` + SW cache name)
