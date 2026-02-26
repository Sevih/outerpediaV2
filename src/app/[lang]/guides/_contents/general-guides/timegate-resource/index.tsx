'use client'

import { useState, useCallback, Fragment, useMemo, type ReactNode } from 'react'
import Image from 'next/image'
import GuideTemplate from '@/app/components/guides/GuideTemplate'
import Tabs from '@/app/components/ui/Tabs'
import ItemInline from '@/app/components/inline/ItemInline'
import { useI18n } from '@/lib/contexts/I18nContext'
import { lRec } from '@/lib/i18n/localize'
import { LABELS } from './labels'
import type { CostFormat } from './labels'
import {
    data,
    TAB_KEYS,
    TAB_ICONS,
    getSourceType,
    SOURCE_TYPE_ORDER,
    type TabKey,
    type SourceType,
    type ResourceSource,
    type ResourceItem,
} from './data'

// Badge styling per source type
const BADGE_STYLES: Record<SourceType, {
    badge: string
    row: string
}> = {
    mission: {
        badge: 'bg-blue-900/50 text-blue-300 border-blue-700/50',
        row: 'bg-blue-950/20 text-blue-200',
    },
    guild: {
        badge: 'bg-purple-900/50 text-purple-300 border-purple-700/50',
        row: 'bg-purple-950/20 text-purple-200',
    },
    adventurer: {
        badge: 'bg-amber-900/50 text-amber-300 border-amber-700/50',
        row: 'text-neutral-200',
    },
    craft: {
        badge: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50',
        row: 'bg-emerald-950/20 text-emerald-200',
    },
}

function SourceTypeBadge({ type, label }: { type: SourceType; label: string }) {
    return (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border mr-2 ${BADGE_STYLES[type].badge}`}>
            {label}
        </span>
    )
}

function renderCostLabel(
    source: ResourceSource,
    sourceLabel: string,
    cost: CostFormat,
): ReactNode {
    if (!source.costItem || !source.costAmount) return sourceLabel

    const item = <ItemInline name={source.costItem} />
    const amountText = `${cost.prefix}${source.costAmount}${cost.suffix}`

    return (
        <span className="inline-flex items-center gap-1 flex-wrap">
            {sourceLabel} ({cost.amountFirst
                ? <>{amountText} {item}</>
                : <>{item} {amountText}</>
            })
        </span>
    )
}

function ResourceTable({ item, badgeLabels, sourceLabels, headers, cost }: {
    item: ResourceItem
    badgeLabels: Record<SourceType, string>
    sourceLabels: Record<string, string>
    headers: { source: string; weekly: string; monthly: string; total: string; grandTotal: string }
    cost: CostFormat
}) {
    const totalWeekly = item.sources.reduce((sum, s) => sum + (s.weekly || 0), 0)
    const totalMonthly = item.sources.reduce((sum, s) => sum + (s.monthly || 0), 0)
    const grandTotalMonthly = totalMonthly + (totalWeekly * 4)

    const sortedSources = [...item.sources].sort((a, b) =>
        SOURCE_TYPE_ORDER[getSourceType(a.sourceKey)] - SOURCE_TYPE_ORDER[getSourceType(b.sourceKey)]
    )

    const rows: { src: ResourceSource; type: SourceType; showSeparator: boolean }[] = []
    let prevType: SourceType | null = null
    for (const src of sortedSources) {
        const type = getSourceType(src.sourceKey)
        rows.push({ src, type, showSeparator: prevType !== null && prevType !== type })
        prevType = type
    }

    return (
        <div className="flex justify-center my-6">
            <div className="w-full max-w-2xl">
                <h3 className="font-semibold text-lg mb-3 text-center">
                    <ItemInline name={item.name} />
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-auto mx-auto border border-neutral-700 rounded-md text-sm text-center">
                        <thead className="bg-neutral-800">
                            <tr>
                                <th className="border border-neutral-700 px-3 py-2">{headers.source}</th>
                                <th className="border border-neutral-700 px-3 py-2">{headers.weekly}</th>
                                <th className="border border-neutral-700 px-3 py-2">{headers.monthly}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, i) => (
                                <Fragment key={i}>
                                    {row.showSeparator && (
                                        <tr className="h-1 bg-neutral-700/30">
                                            <td colSpan={3} className="p-0 border-0" />
                                        </tr>
                                    )}
                                    <tr className={BADGE_STYLES[row.type].row}>
                                        <td className="border border-neutral-700 px-3 py-2 text-left">
                                            <div className="flex items-center">
                                                <SourceTypeBadge type={row.type} label={badgeLabels[row.type]} />
                                                <span>
                                                    {renderCostLabel(
                                                        row.src,
                                                        sourceLabels[row.src.sourceKey] || row.src.sourceKey,
                                                        cost,
                                                    )}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="border border-neutral-700 px-3 py-2">{row.src.weekly ?? '–'}</td>
                                        <td className="border border-neutral-700 px-3 py-2">{row.src.monthly ?? '–'}</td>
                                    </tr>
                                </Fragment>
                            ))}
                            <tr className="bg-neutral-900 font-bold">
                                <td className="border border-neutral-700 px-3 py-2 text-left">{headers.total}</td>
                                <td className="border border-neutral-700 px-3 py-2">{totalWeekly || '–'}</td>
                                <td className="border border-neutral-700 px-3 py-2">{totalMonthly || '–'}</td>
                            </tr>
                            <tr className="bg-neutral-800 font-bold">
                                <td className="border border-neutral-700 px-3 py-2 text-left">{headers.grandTotal}</td>
                                <td className="border border-neutral-700 px-3 py-2">–</td>
                                <td className="border border-neutral-700 px-3 py-2">{grandTotalMonthly || '–'}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

export default function TimegatedResourcesGuide() {
    const { lang } = useI18n()
    const [selected, setSelected] = useState<TabKey>('books')
    const onChange = useCallback((v: string) => setSelected(v as TabKey), [])

    const tabLabels = TAB_KEYS.map((key) => (
        <span key={key} className="inline-flex items-center gap-1.5">
            <Image src={TAB_ICONS[key]} alt="" width={20} height={20} className="object-contain" />
            {lRec(LABELS.tabs[key], lang)}
        </span>
    ))

    const badgeLabels: Record<SourceType, string> = {
        mission: lRec(LABELS.badges.mission, lang),
        guild: lRec(LABELS.badges.guild, lang),
        adventurer: lRec(LABELS.badges.shop, lang),
        craft: lRec(LABELS.badges.craft, lang),
    }

    const sourceLabels = useMemo(() => {
        const result: Record<string, string> = {}
        for (const key of Object.keys(LABELS.sources)) {
            result[key] = lRec(LABELS.sources[key as keyof typeof LABELS.sources], lang)
        }
        return result
    }, [lang])

    const headers = useMemo(() => ({
        source: lRec(LABELS.headers.source, lang),
        weekly: lRec(LABELS.headers.weekly, lang),
        monthly: lRec(LABELS.headers.monthly, lang),
        total: lRec(LABELS.headers.total, lang),
        grandTotal: lRec(LABELS.headers.grandTotal, lang),
    }), [lang])

    const cost = LABELS.cost[lang]

    return (
        <GuideTemplate
            title={lRec(LABELS.title, lang)}
            introduction={lRec(LABELS.intro, lang)}
        >
            <Tabs
                items={[...TAB_KEYS]}
                labels={tabLabels}
                value={selected}
                onChange={onChange}
                hashPrefix="tab"
                className="justify-center"
            />

            <div className="space-y-6">
                {data[selected].map((item, idx) => (
                    <ResourceTable
                        key={idx}
                        item={item}
                        badgeLabels={badgeLabels}
                        sourceLabels={sourceLabels}
                        headers={headers}
                        cost={cost}
                    />
                ))}
            </div>
        </GuideTemplate>
    )
}
