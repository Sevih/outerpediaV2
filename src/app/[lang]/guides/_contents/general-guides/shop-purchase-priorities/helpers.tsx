'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import ItemInline from '@/app/components/inline/ItemInline'
import WeaponInline from '@/app/components/inline/WeaponInline'
import AmuletInline from '@/app/components/inline/AmuletInline'
import TalismanInline from '@/app/components/inline/TalismanInline'
import CharacterInline from '@/app/components/inline/CharacterInline'
import parseText from '@/lib/parse-text'
import { useI18n } from '@/lib/contexts/I18nContext'
import { lRec } from '@/lib/i18n/localize'
import type { ReactNode } from 'react'
import type { Lang } from '@/lib/i18n/config'
import type { LangMap } from '@/types/common'

// ---- Types
export type Priority = 'S' | 'A' | 'B' | 'C'
export type Period = 'Daily' | 'Weekly' | 'Monthly' | 'One-time'

export type ShopKey =
    | 'guild'
    | 'supply'
    | 'rico'
    | 'event'
    | 'joint'
    | 'friend'
    | 'arena'
    | 'stars'
    | 'worldboss'
    | 'al'
    | 'survey'
    | 'resource'

export type Cost = {
    currency: string
    amount: number
    note?: string
}

export type Limit = {
    count: number
    period: Period
}

export type PerPurchase = {
    amount: number
    unit?: string
}

export type InlineType = 'item' | 'weapon' | 'amulet' | 'talisman'

export type ShopItem = {
    name: string
    priority: Priority
    gives?: PerPurchase
    costs?: Cost[]
    limit?: Limit
    notes?: string
    inlineType?: InlineType
    character?: string
    label?: LangMap
}

// ---- Tabs config
export const SHOP_TABS: { key: ShopKey; label: LangMap; icon: string }[] = [
    { key: 'guild', label: { en: 'Guild Shop', jp: 'ギルドショップ', kr: '길드 상점', zh: '公会商店' }, icon: '/images/ui/shop_guild.webp' },
    { key: 'supply', label: { en: 'Supply Module', jp: '補給モジュール', kr: '보급 모듈', zh: '补给模块' }, icon: '/images/ui/shop_supply.webp' },
    { key: 'rico', label: { en: 'Rico Secret', jp: 'リコの秘密', kr: '리코의 비밀', zh: '里科的秘密' }, icon: '/images/ui/shop_rico.webp' },
    { key: 'event', label: { en: 'Event Shop', jp: 'イベントショップ', kr: '이벤트 상점', zh: '活动商店' }, icon: '/images/ui/shop_event.webp' },
    { key: 'joint', label: { en: 'Joint Challenge', jp: 'ジョイントチャレンジ', kr: '조인트 챌린지', zh: '联合挑战' }, icon: '/images/ui/shop_joint.webp' },
    { key: 'friend', label: { en: 'Friendship Point', jp: '友情ポイント', kr: '우정 포인트', zh: '友情点' }, icon: '/images/ui/shop_friend.webp' },
    { key: 'arena', label: { en: 'Arena Shop', jp: 'アリーナショップ', kr: '아레나 상점', zh: '竞技场商店' }, icon: '/images/ui/shop_arena.webp' },
    { key: 'stars', label: { en: "Star's Memory", jp: 'スターの記憶', kr: '스타의 기억', zh: '星之记忆' }, icon: '/images/ui/shop_stars.webp' },
    { key: 'worldboss', label: { en: 'World Boss', jp: 'ワールドボス', kr: '월드 보스', zh: '世界首领' }, icon: '/images/ui/shop_worldboss.webp' },
    { key: 'al', label: { en: 'Adventure License', jp: '冒険ライセンス', kr: '모험 라이선스', zh: '冒险执照' }, icon: '/images/ui/shop_al.webp' },
    { key: 'survey', label: { en: 'Survey Hub', jp: 'サーベイハブ', kr: '서베이 허브', zh: '调查中心' }, icon: '/images/ui/shop_survey.webp' },
    { key: 'resource', label: { en: 'General', jp: '一般', kr: '일반', zh: '通用' }, icon: '/images/ui/shop_resource.webp' },
]

// ---- UI Constants
export const PRIORITY_ORDER: Record<Priority, number> = { S: 0, A: 1, B: 2, C: 3 }
export const PRIORITY_BADGE: Record<Priority, string> = {
    S: 'bg-emerald-600/30 text-emerald-300 ring-emerald-600/60',
    A: 'bg-sky-600/30 text-sky-300 ring-sky-600/60',
    B: 'bg-amber-600/30 text-amber-300 ring-amber-600/60',
    C: 'bg-zinc-700/40 text-zinc-300 ring-zinc-600/60',
}

// ---- Localized Labels
export const LABELS = {
    description: {
        en: "Specify exact costs and the amount given per purchase. Limits are structured as \"count / period\".",
        jp: "購入ごとの正確なコストと数量を明記。制限は「回数 / 期間」の形式です。",
        kr: "구매당 정확한 비용과 수량을 명시합니다. 제한은 \"횟수 / 기간\" 형식입니다.",
        zh: "标明每次购买的确切成本和数量。限制以\"次数/周期\"格式显示。"
    },
    legendTitle: {
        en: "Legend:",
        jp: "凡例:",
        kr: "범례:",
        zh: "图例:"
    },
    legendS: {
        en: "S = must-buy",
        jp: "S = 必須購入",
        kr: "S = 필수 구매",
        zh: "S = 必买"
    },
    legendA: {
        en: "A = high value",
        jp: "A = 高価値",
        kr: "A = 높은 가치",
        zh: "A = 高价值"
    },
    legendB: {
        en: "B = situational",
        jp: "B = 状況次第",
        kr: "B = 상황에 따라",
        zh: "B = 视情况而定"
    },
    legendC: {
        en: "C = low priority",
        jp: "C = 低優先度",
        kr: "C = 낮은 우선순위",
        zh: "C = 低优先级"
    },
    periodsTitle: {
        en: "Periods:",
        jp: "期間:",
        kr: "기간:",
        zh: "周期:"
    },
    periodD: { en: "D = Daily", jp: "D = 毎日", kr: "D = 매일", zh: "D = 每日" },
    periodW: { en: "W = Weekly", jp: "W = 毎週", kr: "W = 매주", zh: "W = 每周" },
    periodM: { en: "M = Monthly", jp: "M = 毎月", kr: "M = 매월", zh: "M = 每月" },
    periodO: { en: "O = One-time", jp: "O = 一回限り", kr: "O = 일회성", zh: "O = 一次性" },
    colPriority: { en: "Priority", jp: "優先度", kr: "우선순위", zh: "优先级" },
    colItem: { en: "Item", jp: "アイテム", kr: "아이템", zh: "物品" },
    colGives: { en: "Gives", jp: "獲得", kr: "획득", zh: "获得" },
    colCost: { en: "Cost", jp: "コスト", kr: "비용", zh: "花费" },
    colLimit: { en: "Limit", jp: "制限", kr: "제한", zh: "限制" },
    colNotes: { en: "Notes", jp: "備考", kr: "비고", zh: "备注" },
    seeGearUsageFinder: {
        en: "See Gear Usage Finder to check which characters your gear matches.",
        jp: "Gear Usage Finderで、装備がどのキャラクターに適しているか確認できます。",
        kr: "Gear Usage Finder에서 장비가 어떤 캐릭터에 맞는지 확인하세요.",
        zh: "请查看Gear Usage Finder，确认装备适合哪些角色。"
    },
} as const

// ---- Shop Notes (localized)
export const shopNotes: Record<ShopKey, LangMap | null> = {
    guild: null,
    supply: null,
    rico: null,
    event: {
        en: "Event shops vary a lot depending on the event. Adjust your priorities based on what's available, but generally focus on limited items first (cosmetics, 6★ event gear, rare manuals, transistones) before spending on more common resources.",
        jp: "イベントショップはイベントによって大きく異なります。入手可能なアイテムに基づいて優先順位を調整しますが、一般的には限定アイテム（コスメ、6★イベント装備、レアマニュアル、トランジストーン）を優先してから、より一般的なリソースに使いましょう。",
        kr: "이벤트 상점은 이벤트에 따라 크게 다릅니다. 가용 아이템에 따라 우선순위를 조정하되, 일반적으로 제한된 아이템(코스메틱, 6★ 이벤트 장비, 희귀 매뉴얼, 트랜지스톤)을 먼저 구매한 후 일반 자원에 사용하세요.",
        zh: "活动商店因活动而异。根据可用物品调整优先级，但通常先关注限定物品（外观、6★活动装备、稀有手册、晶石）再购买常见资源。"
    },
    joint: {
        en: "Save monthly purchases until the Joint Challenge event starts. The main concern is not having enough purchases to clear the quests. Once you can consistently max out the Joint Challenge, the currency becomes very abundant, so prioritize wisely at the start.",
        jp: "ジョイントチャレンジイベント開始まで月間購入を控えましょう。主な懸念はクエストをクリアするための購入回数が足りなくなることです。ジョイントチャレンジを安定してクリアできるようになれば通貨は非常に豊富になるので、最初は賢く優先順位をつけましょう。",
        kr: "조인트 챌린지 이벤트가 시작될 때까지 월간 구매를 아끼세요. 주요 우려사항은 퀘스트를 클리어하기 위한 구매 횟수가 부족해지는 것입니다. 조인트 챌린지를 꾸준히 클리어할 수 있게 되면 재화가 매우 풍부해지므로 처음에는 현명하게 우선순위를 정하세요.",
        zh: "在联合挑战活动开始前保留月度购买次数。主要担忧是没有足够的购买次数来完成任务。一旦能稳定满分通关联合挑战，货币会变得非常充裕，所以开始时要明智地分配优先级。"
    },
    friend: null,
    arena: null,
    stars: null,
    worldboss: null,
    al: null,
    survey: null,
    resource: null,
}

// ---- Text-only shops content (localized)
export interface TextOnlyShopContent {
    paragraphs: LangMap[]
    gearNote?: LangMap
}

export const textOnlyShopsContent: Partial<Record<ShopKey, TextOnlyShopContent>> = {
    supply: {
        paragraphs: [
            {
                en: "Only worth buying {I-I/Basic Skill Manual} and {I-I/Intermediate Skill Manual} for {I-I/Antimatter}.",
                jp: "{I-I/Basic Skill Manual}と{I-I/Intermediate Skill Manual}を{I-I/Antimatter}で購入する価値があります。",
                kr: "{I-I/Basic Skill Manual}과 {I-I/Intermediate Skill Manual}을 {I-I/Antimatter}로 구매할 가치가 있습니다.",
                zh: "只值得用{I-I/Antimatter}购买{I-I/Basic Skill Manual}和{I-I/Intermediate Skill Manual}。"
            },
            {
                en: "{I-I/Intermediate Skill Manual} for {I-I/Free Ether} is fine if discounted and you really need them.",
                jp: "割引があり本当に必要な場合、{I-I/Free Ether}で{I-I/Intermediate Skill Manual}を購入しても構いません。",
                kr: "할인이 있고 정말 필요하다면 {I-I/Free Ether}로 {I-I/Intermediate Skill Manual}을 구매해도 괜찮습니다.",
                zh: "如果有折扣且确实需要，用{I-I/Free Ether}购买{I-I/Intermediate Skill Manual}也可以。"
            }
        ],
        gearNote: {
            en: "6★ Legendary gear is only worth it if substats are strong: 3×3 matching the unit's stat priorities.",
            jp: "6★レジェンダリー装備はサブステータスが強力な場合のみ価値があります：ユニットのステータス優先度に一致する3×3。",
            kr: "6★ 레전더리 장비는 서브스탯이 강력한 경우에만 가치가 있습니다: 유닛의 스탯 우선순위와 일치하는 3×3.",
            zh: "6★传说装备只有在副属性强力时才值得：3×3匹配角色的属性优先级。"
        }
    },
    rico: {
        paragraphs: [
            {
                en: "Always buy {I-I/Special Recruitment Ticket (Event)} when it appears for {I-I/Gold}.",
                jp: "{I-I/Gold}で{I-I/Special Recruitment Ticket (Event)}が出たら必ず購入しましょう。",
                kr: "{I-I/Gold}로 {I-I/Special Recruitment Ticket (Event)}가 나오면 반드시 구매하세요.",
                zh: "当{I-I/Special Recruitment Ticket (Event)}以{I-I/Gold}出售时务必购买。"
            },
            {
                en: "Purchasing {I-I/Special Recruitment Ticket} with {I-I/Free Ether} is ill-advised due to expenses that come from Premium/Limited banners and Precise crafting.",
                jp: "{I-I/Free Ether}で{I-I/Special Recruitment Ticket}を購入するのは、プレミアム/限定ガチャや精密クラフトの出費があるためお勧めしません。",
                kr: "{I-I/Free Ether}로 {I-I/Special Recruitment Ticket}을 구매하는 것은 프리미엄/한정 배너와 정밀 제작에 필요한 비용 때문에 권장하지 않습니다.",
                zh: "用{I-I/Free Ether}购买{I-I/Special Recruitment Ticket}不明智，因为需要用于限定池和精准制作的开支。"
            },
            {
                en: "{I-I/Potentium (Armor)} / {I-I/Potentium (Weapon/Accessory)} are ok if the discount is 25–30%.",
                jp: "{I-I/Potentium (Armor)} / {I-I/Potentium (Weapon/Accessory)}は25〜30%の割引があれば購入しても良いでしょう。",
                kr: "{I-I/Potentium (Armor)} / {I-I/Potentium (Weapon/Accessory)}는 25~30% 할인이 있다면 구매해도 괜찮습니다.",
                zh: "如果{I-I/Potentium (Armor)} / {I-I/Potentium (Weapon/Accessory)}有25-30%的折扣可以购买。"
            }
        ],
        gearNote: {
            en: "6★ Legendary gear is only worth it if substats are strong: 3×3 or 2×3 + 1×4 matching the unit's stat priorities.",
            jp: "6★レジェンダリー装備はサブステータスが強力な場合のみ価値があります：ユニットのステータス優先度に一致する3×3または2×3 + 1×4。",
            kr: "6★ 레전더리 장비는 서브스탯이 강력한 경우에만 가치가 있습니다: 유닛의 스탯 우선순위와 일치하는 3×3 또는 2×3 + 1×4.",
            zh: "6★传说装备只有在副属性强力时才值得：3×3或2×3 + 1×4匹配角色的属性优先级。"
        }
    }
}

// ---- Helper functions
export function n(x: number) {
    return x.toLocaleString()
}

// ---- UI Components
export function PriorityBadge({ p }: { p: Priority }) {
    return (
        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ring-1 ${PRIORITY_BADGE[p]}`}>
            {p}
        </span>
    )
}

function ShopTextSection({ children }: { children: ReactNode }) {
    return (
        <div className="mx-auto max-w-3xl text-sm text-neutral-300 leading-relaxed space-y-3">
            {children}
        </div>
    )
}

function GearUsageLink({ children }: { children: ReactNode }) {
    const { href } = useI18n()
    return (
        <Link
            href={href('/gear-usage-finder')}
            className="underline hover:no-underline text-sky-300"
        >
            {children}
        </Link>
    )
}

export function renderCosts(costs?: Cost[]) {
    if (!costs || costs.length === 0) return '–'

    return (
        <div className="flex flex-col gap-0.5">
            {costs.map((c, i) => {
                const label = c.currency.trim().toLowerCase()
                if (c.amount === 0) {
                    if (label === 'free') return <div key={i}>Free{c.note ? ` (${c.note})` : ''}</div>
                    if (label === 'tbd') return <div key={i}>TBD{c.note ? ` (${c.note})` : ''}</div>
                }
                return (
                    <div key={i} className="whitespace-nowrap">
                        {n(c.amount)} <ItemInline name={c.currency} />{c.note ? ` (${c.note})` : ''}
                    </div>
                )
            })}
        </div>
    )
}

export function renderGives(g?: PerPurchase, name?: string) {
    if (!g || g.amount <= 0) return '–'
    const unit = g.unit ?? name ?? ''
    return `${n(g.amount)} ${unit}`.trim()
}

export function renderLimit(limit?: Limit) {
    if (!limit || limit.count <= 0) return '–'
    const ABBR: Record<Period, string> = { Daily: 'D', Weekly: 'W', Monthly: 'M', 'One-time': 'O' }
    return `${limit.count} / ${ABBR[limit.period]}`
}

function ShopItemName({ name, type, character, label, lang }: { name: string; type?: InlineType; character?: string; label?: LangMap; lang: Lang }) {
    if (label) return <>{lRec(label, lang)}</>
    const inline = (() => {
        switch (type) {
            case 'weapon': return <WeaponInline name={name} />
            case 'amulet': return <AmuletInline name={name} />
            case 'talisman': return <TalismanInline name={name} />
            default: return <ItemInline name={name} />
        }
    })()
    if (character) return <><CharacterInline name={character} /> {inline}</>
    return inline
}

// ---- Main Components
export function ShopTable({ items, lang }: { items: ShopItem[]; lang: Lang }) {
    const sorted = useMemo(
        () =>
            [...items].sort((a, b) => {
                const prioDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
                if (prioDiff !== 0) return prioDiff
                return a.name.localeCompare(b.name)
            }),
        [items]
    )

    const hasNotes = sorted.some(it => it.notes && it.notes.trim() !== "")

    return (
        <div className="flex justify-center my-6">
            <div className="w-full max-w-4xl overflow-x-auto">
                <table className="w-full border border-neutral-700 rounded-md text-sm">
                    <thead className="bg-neutral-800">
                        <tr>
                            <th className="border border-neutral-700 px-3 py-2 text-left">{lRec(LABELS.colPriority, lang)}</th>
                            <th className="border border-neutral-700 px-3 py-2 text-left">{lRec(LABELS.colItem, lang)}</th>
                            <th className="border border-neutral-700 px-3 py-2 text-left">{lRec(LABELS.colGives, lang)}</th>
                            <th className="border border-neutral-700 px-3 py-2">{lRec(LABELS.colCost, lang)}</th>
                            <th className="border border-neutral-700 px-3 py-2">{lRec(LABELS.colLimit, lang)}</th>
                            {hasNotes && <th className="border border-neutral-700 px-3 py-2 text-left">{lRec(LABELS.colNotes, lang)}</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((it, i) => (
                            <tr key={i} className="odd:bg-neutral-900/30">
                                <td className="border border-neutral-700 px-3 py-2"><PriorityBadge p={it.priority} /></td>
                                <td className="border border-neutral-700 px-3 py-2">
                                    <ShopItemName name={it.name} type={it.inlineType} character={it.character} label={it.label} lang={lang} />
                                </td>
                                <td className="border border-neutral-700 px-3 py-2">{renderGives(it.gives, it.name)}</td>
                                <td className="border border-neutral-700 px-3 py-2 text-center">{renderCosts(it.costs)}</td>
                                <td className="border border-neutral-700 px-3 py-2 text-center">{renderLimit(it.limit)}</td>
                                {hasNotes && (
                                    <td className="border border-neutral-700 px-3 py-2">{it.notes ?? ''}</td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>

                <p className="mt-3 text-xs text-zinc-400">
                    {lRec(LABELS.legendTitle, lang)}
                    <span className="font-semibold"> S</span> = {lRec(LABELS.legendS, lang).split('= ')[1]},
                    <span className="font-semibold"> A</span> = {lRec(LABELS.legendA, lang).split('= ')[1]},
                    <span className="font-semibold"> B</span> = {lRec(LABELS.legendB, lang).split('= ')[1]},
                    <span className="font-semibold"> C</span> = {lRec(LABELS.legendC, lang).split('= ')[1]}
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                    {lRec(LABELS.periodsTitle, lang)}
                    <span className="font-semibold"> D</span> = {lRec(LABELS.periodD, lang).split('= ')[1]},
                    <span className="font-semibold"> W</span> = {lRec(LABELS.periodW, lang).split('= ')[1]},
                    <span className="font-semibold"> M</span> = {lRec(LABELS.periodM, lang).split('= ')[1]},
                    <span className="font-semibold"> O</span> = {lRec(LABELS.periodO, lang).split('= ')[1]}
                </p>
            </div>
        </div>
    )
}

export function TextOnlyShopSection({ shopKey, lang }: { shopKey: ShopKey; lang: Lang }) {
    const content = textOnlyShopsContent[shopKey]
    if (!content) return null

    return (
        <ShopTextSection>
            {content.paragraphs.map((p, i) => (
                <p key={i}>{parseText(lRec(p, lang))}</p>
            ))}
            {content.gearNote && (
                <p>
                    {lRec(content.gearNote, lang)} {lRec(LABELS.seeGearUsageFinder, lang).split('Gear Usage Finder')[0]}
                    <GearUsageLink>Gear Usage Finder</GearUsageLink>
                    {lRec(LABELS.seeGearUsageFinder, lang).split('Gear Usage Finder')[1]}
                </p>
            )}
        </ShopTextSection>
    )
}

// Tab label with icon
export function ShopTabLabel({ icon, label }: { icon: string; label: string }) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <Image src={icon} alt="" width={20} height={20} className="shrink-0" />
            <span>{label}</span>
        </span>
    )
}
