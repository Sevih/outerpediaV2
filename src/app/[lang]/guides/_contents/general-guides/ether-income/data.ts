// ============= Types =============
export type Source = {
    id: string
    daily?: number
    weekly?: number
    monthly?: number
}

export type RewardOption = {
    id: string
    value: number
}

// === Defaults ===
export const DEFAULTS = {
    arena: 400,                 // Diamond III
    guildRaid: 850,             // Top 51–100
    worldBoss: {
        league: 'Extreme' as const,
        value: 200,             // Top 100% (Extreme)
    },
}

// ============= Data =============
export const DAILY_SOURCES: Source[] = [
    { id: 'daily.missions', daily: 50 },
    { id: 'daily.arena', daily: 20 },
    { id: 'daily.freePack', daily: 15 },
    { id: 'daily.missionEvent', daily: 30 },
    { id: 'daily.antiparticle', daily: 78 },
]

export const WEEKLY_SOURCES_BASE: Source[] = [
    { id: 'weekly.freePack', weekly: 75 },
    { id: 'weekly.arena', weekly: 400 },
    { id: 'weekly.missions', weekly: 150 },
    { id: 'weekly.guildCheckin', weekly: 150 },
    { id: 'weekly.monadGate', weekly: 250 },
]

export const MONTHLY_SOURCES_BASE: Source[] = [
    { id: 'monthly.freePack', monthly: 150 },
    { id: 'monthly.skywardTower', monthly: 500 },
    { id: 'monthly.checkin', monthly: 750 },
    { id: 'monthly.maintenance', monthly: 400 },
    { id: 'monthly.jointMission', monthly: 880 },
    { id: 'monthly.guildRaid', monthly: 200 },
    { id: 'monthly.worldBoss', monthly: 60 },
]

export const VARIABLE_SOURCE_IDS = [
    'variable.terminus',
    'variable.updateEvent',
    'variable.sideStories',
    'variable.coupons',
    'variable.seasonalEvents',
]

// === Rewards tables ===
export const ARENA_REWARDS: RewardOption[] = [
    { id: 'arena.bronze3', value: 35 },
    { id: 'arena.bronze2', value: 50 },
    { id: 'arena.bronze1', value: 75 },
    { id: 'arena.silver3', value: 100 },
    { id: 'arena.silver2', value: 125 },
    { id: 'arena.silver1', value: 150 },
    { id: 'arena.gold3', value: 175 },
    { id: 'arena.gold2', value: 200 },
    { id: 'arena.gold1', value: 225 },
    { id: 'arena.platinum3', value: 250 },
    { id: 'arena.platinum2', value: 300 },
    { id: 'arena.platinum1', value: 350 },
    { id: 'arena.diamond3', value: 400 },
    { id: 'arena.diamond2', value: 450 },
    { id: 'arena.diamond1', value: 500 },
    { id: 'arena.master3', value: 550 },
    { id: 'arena.master2', value: 600 },
    { id: 'arena.master1', value: 750 },
    { id: 'arena.top100', value: 800 },
    { id: 'arena.top50', value: 850 },
    { id: 'arena.top10', value: 1000 },
    { id: 'arena.top3', value: 1150 },
    { id: 'arena.top2', value: 1350 },
    { id: 'arena.top1', value: 1500 },
]

export const GUILD_RAID_REWARDS: RewardOption[] = [
    { id: 'guild.top1', value: 1500 },
    { id: 'guild.top2', value: 1400 },
    { id: 'guild.top3', value: 1300 },
    { id: 'guild.top5', value: 1200 },
    { id: 'guild.top10', value: 1100 },
    { id: 'guild.top20', value: 1000 },
    { id: 'guild.top50', value: 900 },
    { id: 'guild.top100', value: 850 },
    { id: 'guild.top150', value: 800 },
    { id: 'guild.top200', value: 750 },
    { id: 'guild.top300', value: 700 },
    { id: 'guild.top400', value: 650 },
    { id: 'guild.top500', value: 600 },
    { id: 'guild.top1000', value: 550 },
    { id: 'guild.top1500', value: 500 },
    { id: 'guild.top2000', value: 450 },
    { id: 'guild.top3000', value: 400 },
    { id: 'guild.below3001', value: 200 },
]

export const WORLD_BOSS_LEAGUES = ['Normal', 'Hard', 'Very Hard', 'Extreme'] as const
export type WorldBossLeague = typeof WORLD_BOSS_LEAGUES[number]

export const WORLD_BOSS_REWARDS: Record<WorldBossLeague, RewardOption[]> = {
    Normal: [
        { id: 'wb.rank1', value: 200 },
        { id: 'wb.rank2', value: 180 },
        { id: 'wb.rank3', value: 160 },
        { id: 'wb.top10', value: 140 },
        { id: 'wb.top50', value: 120 },
        { id: 'wb.top100', value: 100 },
        { id: 'wb.top1pct', value: 90 },
        { id: 'wb.top10pct', value: 80 },
        { id: 'wb.top50pct', value: 70 },
        { id: 'wb.top100pct', value: 60 },
    ],
    Hard: [
        { id: 'wb.rank1', value: 300 },
        { id: 'wb.rank2', value: 270 },
        { id: 'wb.rank3', value: 240 },
        { id: 'wb.top10', value: 210 },
        { id: 'wb.top50', value: 180 },
        { id: 'wb.top100', value: 160 },
        { id: 'wb.top1pct', value: 140 },
        { id: 'wb.top10pct', value: 120 },
        { id: 'wb.top50pct', value: 100 },
        { id: 'wb.top100pct', value: 80 },
    ],
    'Very Hard': [
        { id: 'wb.rank1', value: 500 },
        { id: 'wb.rank2', value: 450 },
        { id: 'wb.rank3', value: 400 },
        { id: 'wb.top10', value: 350 },
        { id: 'wb.top50', value: 300 },
        { id: 'wb.top100', value: 250 },
        { id: 'wb.top1pct', value: 200 },
        { id: 'wb.top10pct', value: 150 },
        { id: 'wb.top50pct', value: 120 },
        { id: 'wb.top100pct', value: 100 },
    ],
    Extreme: [
        { id: 'wb.rank1', value: 1500 },
        { id: 'wb.rank2', value: 1400 },
        { id: 'wb.rank3', value: 1300 },
        { id: 'wb.top10', value: 1100 },
        { id: 'wb.top50', value: 900 },
        { id: 'wb.top100', value: 700 },
        { id: 'wb.top1pct', value: 800 },
        { id: 'wb.top10pct', value: 600 },
        { id: 'wb.top50pct', value: 400 },
        { id: 'wb.top100pct', value: 200 },
    ],
}

// ============= Helpers =============
export function fmt(n?: number) {
    if (n === undefined) return '–'
    return n.toLocaleString()
}

export const sum = (arr: Source[], key: 'daily' | 'weekly' | 'monthly') =>
    arr.reduce((acc, s) => acc + (s[key] ?? 0), 0)

export function clampNonNeg(n: number) {
    return Number.isFinite(n) && n > 0 ? n : 0
}

export function withOverrides(list: Source[], overrides: Record<string, number>): Source[] {
    return list.map((s) => {
        const override = overrides[s.id]
        if (override === undefined) return s
        if (typeof s.weekly === 'number') return { ...s, weekly: override }
        if (typeof s.monthly === 'number') return { ...s, monthly: override }
        return s
    })
}
