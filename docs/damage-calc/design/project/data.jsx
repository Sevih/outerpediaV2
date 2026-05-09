// Outerpedia · static fixture data for the calculator mockup.
// Fan-site reference data only — no official game art or UI is reproduced.

const ELEMENTS = {
  fire:  { label: "Fire",  short: "FIR", hue: 25,  fg: "oklch(0.78 0.18 25)",  bg: "oklch(0.32 0.10 25 / 0.45)",  bd: "oklch(0.55 0.16 25 / 0.7)" },
  water: { label: "Water", short: "WTR", hue: 240, fg: "oklch(0.78 0.14 240)", bg: "oklch(0.30 0.08 240 / 0.45)", bd: "oklch(0.55 0.14 240 / 0.7)" },
  earth: { label: "Earth", short: "ERT", hue: 145, fg: "oklch(0.80 0.14 145)", bg: "oklch(0.30 0.08 145 / 0.45)", bd: "oklch(0.55 0.13 145 / 0.7)" },
  light: { label: "Light", short: "LGT", hue: 95,  fg: "oklch(0.90 0.14 95)",  bg: "oklch(0.32 0.10 95 / 0.40)",  bd: "oklch(0.65 0.15 95 / 0.7)" },
  dark:  { label: "Dark",  short: "DRK", hue: 305, fg: "oklch(0.78 0.18 305)", bg: "oklch(0.30 0.10 305 / 0.45)", bd: "oklch(0.55 0.16 305 / 0.7)" },
};

const CLASSES = {
  striker:  { label: "Striker",  short: "STR", fg: "oklch(0.80 0.16 60)",  bg: "oklch(0.32 0.10 60 / 0.40)",  bd: "oklch(0.60 0.15 60 / 0.7)" },
  mage:     { label: "Mage",     short: "MAG", fg: "oklch(0.78 0.18 305)", bg: "oklch(0.30 0.10 305 / 0.40)", bd: "oklch(0.55 0.16 305 / 0.7)" },
  ranger:   { label: "Ranger",   short: "RNG", fg: "oklch(0.80 0.13 195)", bg: "oklch(0.30 0.08 195 / 0.40)", bd: "oklch(0.55 0.13 195 / 0.7)" },
  defender: { label: "Defender", short: "DEF", fg: "oklch(0.78 0.14 235)", bg: "oklch(0.30 0.08 235 / 0.40)", bd: "oklch(0.55 0.14 235 / 0.7)" },
  priest:   { label: "Priest",   short: "PRI", fg: "oklch(0.94 0.01 270)", bg: "oklch(0.32 0.005 270 / 0.55)", bd: "oklch(0.60 0.01 270 / 0.7)" },
};

// Roster — character names are common gacha-style fan-content placeholders.
// Only Alice + Yuelchen are needed for the sample state; rest populate the
// character picker modal so it feels alive.
const CHARACTERS = [
  { id: "alice",     name: "Alice",      element: "earth", cls: "mage",     rarity: 5, role: "DPS",     atk: 7842 },
  { id: "elise",     name: "Elise",      element: "fire",  cls: "mage",     rarity: 5, role: "DPS",     atk: 8120 },
  { id: "yuki",      name: "Yuki",       element: "water", cls: "mage",     rarity: 5, role: "DPS",     atk: 7610 },
  { id: "lumiere",   name: "Lumière",    element: "light", cls: "mage",     rarity: 5, role: "Support", atk: 6940 },
  { id: "noctis",    name: "Noctis",     element: "dark",  cls: "mage",     rarity: 5, role: "DPS",     atk: 7990 },
  { id: "tessera",   name: "Tessera",    element: "earth", cls: "mage",     rarity: 4, role: "DPS",     atk: 6240 },
  { id: "varin",     name: "Varin",      element: "fire",  cls: "mage",     rarity: 5, role: "DPS",     atk: 7805 },
  { id: "halia",     name: "Halia",      element: "water", cls: "mage",     rarity: 4, role: "Support", atk: 5960 },
  // non-Mage chars (filtered out in the picker preview, but available for team)
  { id: "yuelchen",  name: "Yuelchen",   element: "earth", cls: "defender", rarity: 5, role: "Tank",    atk: 4988 },
  { id: "noa",       name: "Noa",        element: "fire",  cls: "striker",  rarity: 5, role: "DPS",     atk: 8320 },
  { id: "rin",       name: "Rin",        element: "water", cls: "ranger",   rarity: 5, role: "DPS",     atk: 7104 },
  { id: "viella",    name: "Viella",     element: "light", cls: "priest",   rarity: 5, role: "Support", atk: 5980 },
];

const SELECTED = CHARACTERS[0]; // Alice — Earth Mage, the active attacker

const SKILLS = {
  s1: { name: "Lacuna Ping",    coef: 1.10, hits: 1, scaling: "ATK", desc: "Single-target. 110% ATK. +20% vs Mage targets." },
  s2: { name: "Cipher Bloom",   coef: 1.85, hits: 1, scaling: "ATK", desc: "Single-target. 185% ATK. CRIT chance +15% vs Boss." },
  s3: { name: "Null Cathedral", coef: 3.40, hits: 3, scaling: "ATK", desc: "AoE. 340% ATK. +30% damage to Bosses." },
};

// Sample target — Story Normal 4-1 / Sentry Archer (Earth Ranger boss)
const TARGET = {
  category: "Story",
  mode: "Normal",
  episode: "4 — Vellum Reach",
  stage: "4-1 · Watchpost",
  monster: "Sentry Archer",
  element: "earth",
  cls: "ranger",
  level: 30,
  isBoss: false,
  def: 382,
  hp: 28_400,
  drPct: 2.9,
  cdmgRedPct: 0,
  effPct: 0,
  resPct: 0,
};

// Cascade picker datasets
const CASCADE = {
  categories: [
    { id: "story",   label: "Story Normal" },
    { id: "hard",    label: "Story Hard" },
    { id: "joint",   label: "Joint Challenge" },
    { id: "raid",    label: "Guild Raid" },
    { id: "world",   label: "World Boss" },
    { id: "tower",   label: "Tower" },
    { id: "advlic",  label: "Adventure License" },
  ],
  episodes: [
    { id: "ep1", label: "Episode 1" },
    { id: "ep2", label: "Episode 2" },
    { id: "ep3", label: "Episode 3" },
    { id: "ep4", label: "Episode 4 — Vellum Reach" },
    { id: "ep5", label: "Episode 5" },
  ],
  stages: [
    { id: "4-1", label: "4-1 · Watchpost" },
    { id: "4-2", label: "4-2 · Outer Wall" },
    { id: "4-3", label: "4-3 · Inner Bailey" },
    { id: "4-4", label: "4-4 · Vellum Gate" },
  ],
  monsters: [
    { name: "Sentry Archer",   el: "earth", cls: "ranger",   boss: false, sel: true  },
    { name: "Wraith Sentinel", el: "dark",  cls: "defender", boss: false, sel: false },
    { name: "Thornbound Mage", el: "earth", cls: "mage",     boss: false, sel: false },
    { name: "Vellum Captain",  el: "earth", cls: "striker",  boss: true,  sel: false },
  ],
};

// Team — sample: Yuelchen (defender), empty, empty
const TEAM = [
  {
    id: "yuelchen",
    name: "Yuelchen",
    element: "earth",
    cls: "defender",
    star: 6,
    talisman: { main: "ATK%", value: "+18.0%" },
    sub: { type: "defender", absoluteToggle: true, tier: 3, flatDef: 4820 },
  },
  null,
  null,
];

// Buff/debuff matrix
const BUFFS = {
  attBuffs: [
    { key: "atk",  label: "Inc ATK",     pct: 30,  active: true  },
    { key: "pen",  label: "Inc PEN",     pct: 50,  active: false },
    { key: "chc",  label: "Inc CHC",     pct: 30,  active: false },
    { key: "chd",  label: "Inc CHD",     pct: 50,  active: false },
    { key: "eff",  label: "Inc EFF",     pct: 100, active: false },
    { key: "dmg",  label: "Inc DMG",     pct: 50,  active: false },
  ],
  attDebuffs: [
    { key: "atk",  label: "Dec ATK",     pct: 50,  active: false },
    { key: "chc",  label: "Dec CHC",     pct: 30,  active: false },
    { key: "chd",  label: "Dec CHD",     pct: 50,  active: false },
    { key: "spd",  label: "Dec SPD",     pct: 30,  active: false },
    { key: "acc",  label: "Dec ACC",     pct: 50,  active: false },
    { key: "dmg",  label: "Dec DMG",     pct: 25,  active: false },
  ],
  tgtBuffs: [
    { key: "def",  label: "Inc DEF",     pct: 50,  active: false },
    { key: "dr",   label: "Inc DR",      pct: 30,  active: false },
    { key: "res",  label: "Inc RES",     pct: 50,  active: false },
    { key: "shld", label: "Shield",      pct: 20,  active: false },
    { key: "imm",  label: "Immune",      pct: 0,   active: false, flat: true },
    { key: "cdr",  label: "Inc C.DmgRed",pct: 25,  active: false },
  ],
  tgtDebuffs: [
    { key: "def",  label: "Dec DEF",     pct: 50,  active: false },
    { key: "cdr",  label: "Dec C.DmgRed",pct: 25,  active: false },
    { key: "res",  label: "Dec RES",     pct: 50,  active: false },
    { key: "spd",  label: "Dec SPD",     pct: 30,  active: false },
    { key: "marked",label:"Marked",      pct: 0,   active: true,  flat: true },
    { key: "bleed",label: "Bleed",       pct: 0,   active: false, flat: true },
  ],
};

Object.assign(window, {
  ELEMENTS, CLASSES, CHARACTERS, SELECTED, SKILLS, TARGET, CASCADE, TEAM, BUFFS,
});
