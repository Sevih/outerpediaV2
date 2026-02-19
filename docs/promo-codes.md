# Promo Codes — Data Format

## Overview

Promo codes are redeemable coupon codes for free in-game rewards (ether, recruitment tickets, etc.). Data lives in a single file: `data/promo-codes.json`.

It is consumed in two places:
- **Homepage** — `src/app/[lang]/page.tsx` (latest 5 active codes via `PromoCodes` component)
- **Dedicated page** — `src/app/[lang]/promo-codes/page.tsx` (full list with all statuses)

The page is also indexed in the search modal via `src/lib/nav.ts` (`EXTRA_PAGES`).

---

## File structure

`data/promo-codes.json` is a JSON array of promo code entries. No particular order is required — the component sorts them by `start` date (newest first) and groups them by status.

```json
[
  {
    "code": "OUTERNOTE9",
    "description": {
      "Free Ether": "1000"
    },
    "start": "2024-11-01",
    "end": "2024-11-29"
  },
  {
    "code": "NELLAGIFT1",
    "description": {
      "Limited Recruitment Ticket": "5",
      "Free Ether": "500"
    },
    "start": "2024-11-04",
    "end": "2024-12-02"
  }
]
```

---

## Fields

### `code` (required)

The promo code string exactly as it should be entered in-game. Displayed in monospace font with a copy-to-clipboard button.

```json
"code": "SWEETRANS10"
```

### `description` (required)

A `Record<string, string>` mapping **item name** to **quantity**. Each item name must match an entry in `data/items.json` so the `ItemInline` component can render its icon and tooltip.

```json
"description": {
  "Free Ether": "1000",
  "Limited Recruitment Ticket": "5"
}
```

Common reward item names:
- `Free Ether`
- `Limited Recruitment Ticket`
- `Special Recruitment Ticket (Event)`
- `Stamina`
- `Gold`
- `Transistone (Total)`
- `Transistone (Individual)`
- `Call of the Demiurge (Event)`

### `start` (required)

ISO date string (`YYYY-MM-DD`). The first day the code becomes active.

```json
"start": "2026-02-18"
```

### `end` (required)

ISO date string (`YYYY-MM-DD`). The last day the code is valid. After this date, the code is shown as expired.

```json
"end": "2026-04-30"
```

---

## Status logic

Status is computed client-side by comparing `start`/`end` against the current date:

| Status | Condition | Badge color |
|--------|-----------|-------------|
| **Active** | `start <= today <= end` | Green |
| **Upcoming** | `start > today` | Yellow |
| **Expired** | `end < today` | Grey |

---

## Component

### `PromoCodes` (`src/app/components/home/PromoCodes.tsx`)

Client component (`'use client'`) that renders promo codes with:
- Copy-to-clipboard button per code
- Status badge (active/upcoming/expired) in full-page mode
- Validity date range in full-page mode
- Reward items rendered via `ItemInline`
- "View all X active codes" link in homepage mode

### Props

| Prop | Type | Description |
|------|------|-------------|
| `codes` | `PromoCode[]` | All promo codes from JSON |
| `lang` | `Lang?` | Current language (for "view all" link) |
| `limit` | `number?` | Max codes to show (homepage: 5) |
| `showAll` | `boolean?` | Show all statuses + validity + redemption instructions |
| `t` | `object` | Translation strings (see below) |

### Translation keys

| Key | Usage |
|-----|-------|
| `home.section.codes` | Section title on homepage |
| `home.codes.copy` | Copy button label |
| `home.codes.copied` | Copy button label after click |
| `home.codes.empty` | Empty state message |
| `home.codes.view_all` | "View all {count} active codes" link |
| `promo_codes.active` | Active badge label |
| `promo_codes.expired` | Expired badge label |
| `promo_codes.upcoming` | Upcoming badge label |
| `promo_codes.validity` | Date range format: `{start} — {end}` |
| `promo_codes.redeem_android` | Android redemption instructions |
| `promo_codes.redeem_ios` | iOS redemption instructions (contains HTML link) |
| `page.promo_codes.title` | Page title + SEO |
| `page.promo_codes.description` | Page description + SEO |

---

## Adding a new promo code

1. Edit `data/promo-codes.json`
2. Add a new entry anywhere in the array:

```json
{
  "code": "NEWCODE123",
  "description": {
    "Free Ether": "500"
  },
  "start": "2026-03-01",
  "end": "2026-03-31"
}
```

3. Make sure item names in `description` exist in `data/items.json`
4. The page revalidates every 24 hours (`revalidate = 86400`), or redeploy for immediate update

---

## Redemption

Players can redeem codes in two ways:
- **Android**: Menu > Settings > Coupon (in-game)
- **iOS**: Via the [official coupon website](https://coupon.outerplane.vagames.co.kr:39009/coupon)
