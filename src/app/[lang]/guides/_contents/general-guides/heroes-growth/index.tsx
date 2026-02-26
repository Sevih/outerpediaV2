'use client';

import { useCallback, useState } from 'react';
import GuideTemplate from '@/app/components/guides/GuideTemplate';
import Tabs from '@/app/components/ui/Tabs';
import ItemInline from '@/app/components/inline/ItemInline';
import parseText from '@/lib/parse-text';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { LangMap } from '@/types/common';
import { StarBadge } from '@/app/components/ui/StarIcons';
import {
    LABELS,
    UpgradeTable,
    TranscendenceTable,
    SkillCostTable,
    XPItemsList,
    AffinityList,
    SpecialEquipmentList,
    GearSection,
} from './helpers';

const heading: LangMap = { en: "Growth Systems", jp: "育成システム", kr: "육성 시스템", zh: "培养系统" };

const TAB_KEYS = ['leveling', 'upgrade', 'transcendence', 'affinity', 'skills', 'specialEquip', 'gems', 'gear'] as const;
type TabKey = typeof TAB_KEYS[number];

const TAB_LABELS: Record<TabKey, LangMap> = {
    leveling: LABELS.sectionLeveling,
    upgrade: LABELS.sectionUpgrade,
    transcendence: LABELS.sectionTranscendence,
    affinity: LABELS.sectionAffinity,
    skills: LABELS.sectionSkillUpgrade,
    specialEquip: LABELS.sectionSpecialEquipment,
    gems: LABELS.sectionGems,
    gear: LABELS.sectionGear,
};

export default function HeroGrowthGuide() {
    const { lang } = useI18n();
    const [tab, setTab] = useState<TabKey>('leveling');
    const onChange = useCallback((v: string) => setTab(v as TabKey), []);

    return (
        <GuideTemplate
            title={lRec(heading, lang)}
            introduction={lRec(LABELS.intro, lang)}
        >
            <Tabs
                items={[...TAB_KEYS]}
                labels={TAB_KEYS.map(k => lRec(TAB_LABELS[k], lang))}
                value={tab}
                onChange={onChange}
                hashPrefix="tab"
                className="justify-center"
            />

            <div className="mt-6 space-y-4">
                {tab === 'leveling' && <>
                    <p>{lRec(LABELS.levelingDesc1, lang)}</p>
                    <p>{lRec(LABELS.levelingDesc2, lang)}</p>
                    <XPItemsList lang={lang} />
                    <p>
                        <ItemInline name="Unlimited Restaurant Voucher" /> {lRec(LABELS.instantLv100, lang)}
                    </p>
                </>}

                {tab === 'upgrade' && <>
                    <p>{lRec(LABELS.upgradeDesc, lang)}</p>
                    <UpgradeTable lang={lang} />
                    <p>
                        <ItemInline name="Book of Evolution" /> {lRec(LABELS.instantStage6, lang)}
                    </p>
                </>}

                {tab === 'transcendence' && <>
                    <p>{lRec(LABELS.transcendenceDesc1, lang)}</p>
                    <p>{lRec(LABELS.transcendenceDesc2, lang)}</p>
                    <p>{lRec(LABELS.transcendenceDesc3, lang)}</p>
                    <TranscendenceTable lang={lang} />
                    <p className="text-neutral-400 text-sm italic">
                        {lRec(LABELS.transcendenceNote, lang)} <StarBadge level="3" /> {lRec(LABELS.transcendenceNoteEnd, lang)} <StarBadge level="6" />.
                    </p>
                </>}

                {tab === 'affinity' && <>
                    <p>{lRec(LABELS.affinityDesc, lang)}</p>
                    <AffinityList lang={lang} />
                    <p>
                        <ItemInline name="Oath of Determination" /> {lRec(LABELS.affinityMaxItem, lang)}
                    </p>
                </>}

                {tab === 'skills' && <>
                    <p>{lRec(LABELS.skillUpgradeDesc1, lang)}</p>
                    <p>{lRec(LABELS.skillUpgradeDesc2, lang)}</p>
                    <SkillCostTable lang={lang} />
                </>}

                {tab === 'specialEquip' && <>
                    <p>{lRec(LABELS.specialEquipmentDesc, lang)}</p>
                    <p><strong>EE</strong> {lRec(LABELS.eeDesc, lang)}</p>
                    <SpecialEquipmentList type="ee" lang={lang} />
                    <p>{lRec(LABELS.eeLv5Unlock, lang)}</p>
                    <p><strong>Talismans</strong> {lRec(LABELS.talismanDesc, lang)}</p>
                    <SpecialEquipmentList type="talisman" lang={lang} />
                    <p>{lRec(LABELS.auraNote, lang)}</p>
                    <p>{lRec(LABELS.materialsSource, lang)}</p>
                </>}

                {tab === 'gems' && <>
                    <p><ItemInline name="Gems" /> {lRec(LABELS.gemsDesc1, lang)}</p>
                    <p>{parseText(lRec(LABELS.gemsDesc2, lang))}</p>
                </>}

                {tab === 'gear' && <GearSection lang={lang} />}
            </div>
        </GuideTemplate>
    );
}
