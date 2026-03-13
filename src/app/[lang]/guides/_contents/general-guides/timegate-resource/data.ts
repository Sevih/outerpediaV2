export type TabKey = 'books' | 'transistones' | 'special' | 'glunite'
export type SourceType = 'mission' | 'guild' | 'adventurer' | 'craft'

export type ResourceSource = {
    sourceKey: string
    weekly?: number
    monthly?: number
    costItem?: string
    costAmount?: number
}

export type ResourceItem = {
    name: string
    sources: ResourceSource[]
}

export type TimegateData = Record<TabKey, ResourceItem[]>

export const TAB_KEYS: TabKey[] = ['books', 'transistones', 'special', 'glunite']

export const TAB_ICONS: Record<TabKey, string> = {
    books: '/images/items/TI_Item_Growth_Book_01.webp',
    transistones: '/images/items/TI_Item_Option_Change_02.webp',
    special: '/images/items/TI_EX_Equip_Growth_Enhance_01.webp',
    glunite: '/images/items/TI_Equipment_Growth02.webp',
}

const SK = {
    RESOURCE_SHOP: 'progress.shop.general',
    ARENA_SHOP: 'progress.shop.arena-shop',
    GUILD_SHOP: 'progress.shop.guild-shop',
    WORLD_BOSS_SHOP: 'progress.shop.world-boss',
    KATES_WORKSHOP: 'progress.craft.kates-workshop',
    SURVEY_HUB: 'progress.shop.survey-hub',
    STARS_MEMORY_SHOP: 'progress.shop.star-memory',
    JOINT_CHALLENGE_SHOP: 'progress.shop.joint-challenge',
    IRREGULAR_INFILTRATION_FLOOR_3: 'timegate.source.irregular-infiltration-floor-3',
    ARENA_WEEKLY_REWARD: 'timegate.source.arena-weekly-reward',
    WEEKLY_MISSION: 'timegate.source.weekly-mission',
    IRREGULAR_EXTERMINATION_POINT: 'timegate.source.irregular-extermination-point',
} as const

export function getSourceType(sourceKey: string): SourceType {
    if (sourceKey === 'progress.shop.guild-shop') return 'guild'
    if (sourceKey.startsWith('progress.craft.')) return 'craft'
    if (sourceKey.startsWith('progress.shop.')) return 'adventurer'
    return 'mission'
}

export const SOURCE_TYPE_ORDER: Record<SourceType, number> = {
    mission: 0,
    guild: 1,
    adventurer: 2,
    craft: 3,
}

export const data: TimegateData = {
    'books': [
        {
            name: 'Basic Skill Manual',
            sources: [
                { sourceKey: SK.IRREGULAR_INFILTRATION_FLOOR_3, monthly: 28 },
                { sourceKey: SK.SURVEY_HUB, monthly: 40 },
                { sourceKey: SK.GUILD_SHOP, weekly: 3 },
                { sourceKey: SK.RESOURCE_SHOP, weekly: 5 },
                { sourceKey: SK.ARENA_SHOP, weekly: 5 },
                { sourceKey: SK.ARENA_WEEKLY_REWARD, weekly: 5 },
                { sourceKey: SK.WEEKLY_MISSION, weekly: 1 },
            ],
        },
        {
            name: 'Intermediate Skill Manual',
            sources: [
                { sourceKey: SK.IRREGULAR_INFILTRATION_FLOOR_3, monthly: 17 },
                { sourceKey: SK.SURVEY_HUB, monthly: 25 },
                { sourceKey: SK.GUILD_SHOP, weekly: 2 },
                { sourceKey: SK.RESOURCE_SHOP, weekly: 2 },
                { sourceKey: SK.ARENA_SHOP, weekly: 3 },
                { sourceKey: SK.STARS_MEMORY_SHOP, weekly: 2 },
                { sourceKey: SK.ARENA_WEEKLY_REWARD, weekly: 3 },
                { sourceKey: SK.WEEKLY_MISSION, weekly: 1 },
            ],
        },
        {
            name: 'Professional Skill Manual',
            sources: [
                { sourceKey: SK.IRREGULAR_INFILTRATION_FLOOR_3, monthly: 3 },
                { sourceKey: SK.SURVEY_HUB, monthly: 9 },
                { sourceKey: SK.GUILD_SHOP, weekly: 1 },
                { sourceKey: SK.ARENA_SHOP, weekly: 2 },
                { sourceKey: SK.STARS_MEMORY_SHOP, weekly: 1 },
                { sourceKey: SK.ARENA_WEEKLY_REWARD, weekly: 1 },
            ],
        },
    ],
    'transistones': [
        {
            name: 'Transistone (Total)',
            sources: [
                { sourceKey: SK.JOINT_CHALLENGE_SHOP, monthly: 1 },
                { sourceKey: SK.STARS_MEMORY_SHOP, weekly: 4 },
                { sourceKey: SK.WORLD_BOSS_SHOP, monthly: 2 },
                { sourceKey: SK.SURVEY_HUB, monthly: 2 },
                { sourceKey: SK.IRREGULAR_EXTERMINATION_POINT, monthly: 12 },
                { sourceKey: SK.IRREGULAR_INFILTRATION_FLOOR_3, monthly: 9 },
                { sourceKey: SK.KATES_WORKSHOP, monthly: 3 },
            ],
        },
        {
            name: 'Transistone (Individual)',
            sources: [
                { sourceKey: SK.JOINT_CHALLENGE_SHOP, monthly: 1 },
                { sourceKey: SK.STARS_MEMORY_SHOP, monthly: 4 },
                { sourceKey: SK.WORLD_BOSS_SHOP, monthly: 2 },
                { sourceKey: SK.SURVEY_HUB, monthly: 2 },
                { sourceKey: SK.IRREGULAR_EXTERMINATION_POINT, monthly: 12 },
                { sourceKey: SK.IRREGULAR_INFILTRATION_FLOOR_3, monthly: 9 },
                { sourceKey: SK.KATES_WORKSHOP, monthly: 3 },
            ],
        }
    ],
    'special': [
        {
            name: 'Blue Stardust',
            sources: [
                { sourceKey: SK.IRREGULAR_EXTERMINATION_POINT, monthly: 150 },
                { sourceKey: SK.KATES_WORKSHOP, weekly: 70 },
            ],
        },
        {
            name: 'Purple Stardust',
            sources: [
                { sourceKey: SK.IRREGULAR_EXTERMINATION_POINT, monthly: 300 },
                { sourceKey: SK.KATES_WORKSHOP, weekly: 10, costItem: 'Blue Stardust', costAmount: 30 },
            ],
        },
        {
            name: 'Blue Memory Stone',
            sources: [
                { sourceKey: SK.IRREGULAR_EXTERMINATION_POINT, monthly: 150 },
                { sourceKey: SK.KATES_WORKSHOP, weekly: 70 },
            ],
        },
        {
            name: 'Purple Memory Stone',
            sources: [
                { sourceKey: SK.IRREGULAR_EXTERMINATION_POINT, monthly: 300 },
                { sourceKey: SK.KATES_WORKSHOP, weekly: 10, costItem: 'Blue Memory Stone', costAmount: 30 },
            ],
        },
    ],
    'glunite': [
        {
            name: 'Refined Glunite',
            sources: [
                { sourceKey: SK.JOINT_CHALLENGE_SHOP, monthly: 1 },
                { sourceKey: SK.STARS_MEMORY_SHOP, monthly: 1 },
                { sourceKey: SK.SURVEY_HUB, monthly: 5 },
            ],
        },
        {
            name: 'Armor Glunite',
            sources: [
                { sourceKey: SK.JOINT_CHALLENGE_SHOP, weekly: 1 },
                { sourceKey: SK.IRREGULAR_EXTERMINATION_POINT, monthly: 9 },
                { sourceKey: SK.KATES_WORKSHOP, weekly: 4 },
            ],
        },
        {
            name: 'Glunite',
            sources: [
                { sourceKey: SK.STARS_MEMORY_SHOP, weekly: 1 },
                { sourceKey: SK.SURVEY_HUB, weekly: 6 },
            ],
        }
    ],
}
