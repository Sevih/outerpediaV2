'use client'

import { useCallback, useState } from 'react'
import GuideTemplate from '@/app/components/guides/GuideTemplate'
import Tabs from '@/app/components/ui/Tabs'
import { useI18n } from '@/lib/contexts/I18nContext'
import { lRec } from '@/lib/i18n/localize'

import { LABELS } from './labels'
import { StatsContent, CombatBasicsContent, FAQContent, type TabKey } from './helpers'

const TAB_KEYS: TabKey[] = ['stats', 'combat', 'faq']

export default function StatsGuide() {
    const { lang } = useI18n()
    const [selected, setSelected] = useState<TabKey>('stats')
    const onChange = useCallback((v: string) => setSelected(v as TabKey), [])

    const tabLabels = TAB_KEYS.map(k => lRec(LABELS.tabs[k], lang))

    const content: Record<TabKey, React.ReactNode> = {
        stats: <StatsContent />,
        combat: <CombatBasicsContent />,
        faq: <FAQContent />,
    }

    return (
        <GuideTemplate title={lRec(LABELS.title, lang)} introduction={lRec(LABELS.intro, lang)}>
            <Tabs
                items={TAB_KEYS}
                labels={tabLabels}
                value={selected}
                onChange={onChange}
                hashPrefix="tab"
                className="justify-center"
            />
            {content[selected]}
        </GuideTemplate>
    )
}
