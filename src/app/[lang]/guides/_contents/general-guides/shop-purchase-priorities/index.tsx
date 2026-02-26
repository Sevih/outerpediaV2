'use client'

import { useCallback, useState } from 'react'
import GuideTemplate from '@/app/components/guides/GuideTemplate'
import Tabs from '@/app/components/ui/Tabs'
import { useI18n } from '@/lib/contexts/I18nContext'
import { lRec } from '@/lib/i18n/localize'

import {
    LABELS,
    SHOP_TABS,
    shopNotes,
    textOnlyShopsContent,
    ShopTable,
    TextOnlyShopSection,
    ShopTabLabel,
    type ShopKey
} from './helpers'
import { shopData } from './data'

const title = {
    en: 'Recommended Purchases by Shop',
    jp: 'ショップ別おすすめ購入品',
    kr: '상점별 추천 구매 목록',
    zh: '各商店推荐购买',
}

const TAB_KEYS = SHOP_TABS.map(t => t.key)

export default function ShopPurchasePrioritiesGuide() {
    const { lang } = useI18n()
    const [selected, setSelected] = useState<ShopKey>('guild')
    const onChange = useCallback((v: string) => setSelected(v as ShopKey), [])

    const tabLabels = SHOP_TABS.map(t => (
        <ShopTabLabel key={t.key} icon={t.icon} label={lRec(t.label, lang)} />
    ))

    const isTextOnlyShop = selected in textOnlyShopsContent

    return (
        <GuideTemplate title={lRec(title, lang)} introduction={lRec(LABELS.description, lang)}>
            <Tabs
                items={TAB_KEYS}
                labels={tabLabels}
                value={selected}
                onChange={onChange}
                hashPrefix="shop"
                className="justify-center"
            />

            {shopNotes[selected] && (
                <div className="text-sm text-neutral-400 px-2 text-center space-y-2">
                    <p>{lRec(shopNotes[selected]!, lang)}</p>
                </div>
            )}

            {isTextOnlyShop
                ? <TextOnlyShopSection shopKey={selected} lang={lang} />
                : <ShopTable items={shopData[selected] ?? []} lang={lang} />
            }
        </GuideTemplate>
    )
}
