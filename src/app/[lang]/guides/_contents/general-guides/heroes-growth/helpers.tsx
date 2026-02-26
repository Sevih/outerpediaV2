import InlineIcon from '@/app/components/inline/InlineIcon';
import ItemInline from '@/app/components/inline/ItemInline';
import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import type { Lang } from '@/lib/i18n/config';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { LangMap } from '@/types/common';

import { StarBadge } from '@/app/components/ui/StarIcons';

const skillCosts: Record<string, Record<string, Record<string, number>>> = {
    '1': {
        'lv 2': { green: 3 },
        'lv 3': { green: 3, blue: 1 },
        'lv 4': { green: 5, blue: 2 },
        'lv 5': { green: 0, blue: 4, red: 1 },
    },
    '2': {
        'lv 2': { green: 3 },
        'lv 3': { green: 4, blue: 1 },
        'lv 4': { green: 5, blue: 3 },
        'lv 5': { green: 0, blue: 5, red: 1 },
    },
    '3': {
        'lv 2': { green: 5 },
        'lv 3': { green: 5, blue: 3 },
        'lv 4': { green: 0, blue: 4, red: 1 },
        'lv 5': { green: 0, blue: 5, red: 2 },
    },
};

const skillLevels = ['lv 2', 'lv 3', 'lv 4', 'lv 5'];

const upgradeStages = [
    { icon: 'CM_Evolution_00', stage: 'stage1', cost: '', item: '' },
    { icon: 'CM_Evolution_01', stage: 'stage2', cost: '30', item: 'Light Upgrade Stone Fragment' },
    { icon: 'CM_Evolution_02', stage: 'stage3', cost: '35', item: 'Light Upgrade Stone Piece' },
    { icon: 'CM_Evolution_03', stage: 'stage4', cost: '40', item: 'Light Upgrade Stone' },
    { icon: 'CM_Evolution_04', stage: 'stage5', cost: '50', item: 'Refined Light Upgrade Stone' },
    { icon: 'CM_Evolution_05', stage: 'stage6', cost: '200', item: 'Refined Light Upgrade Stone' },
];

const transcendenceSteps = ['1', '2', '3', '4', '4+', '5', '5+', '5++', '6'];

const affinityUpgradeStones = [
    { item: 'Light Upgrade Stone Fragment', points: 5 },
    { item: 'Light Upgrade Stone Piece', points: 10 },
    { item: 'Light Upgrade Stone', points: 25 },
    { item: 'Refined Light Upgrade Stone', points: 50 },
];

const affinityGifts = [
    { items: ['USB Drive', "Collector's Coin", 'Mana Potion', 'Paper Crane', 'Berry'], points: 100, bonus: 50 },
    { items: ['Portable Gaming Device', 'Elegant Teacup', 'Fay Dust', 'Crystal Orb', 'Wildflower'], points: 200, bonus: 100 },
    { items: ['Smartphone', 'Decorative Chest Armor', "Witch's Cauldron", 'Lion Statue', "Phantom Bird's Egg"], points: 500, bonus: 250 },
    { items: ['Dungeon Core Fragment', "Noble's Ceremonial Sword", 'Magic Textbook', 'Dreamcatcher', 'Leaf of World Tree'], points: 1000, bonus: 500 },
];

const xpItems = [
    { item: 'Sandwich', xp: 250 },
    { item: 'Cake Slice', xp: 600 },
    { item: 'Prosciutto', xp: 2500 },
    { item: 'Steak Dish', xp: 8000 },
];

const specialEquipmentMaterials = {
    ee: [
        { item: 'Blue Memory Stone', range: '0-5', needed: 150 },
        { item: 'Purple Memory Stone', range: '5-10', needed: 150 },
    ],
    talisman: [
        { item: 'Blue Stardust', range: '0-5', needed: 150 },
        { item: 'Purple Stardust', range: '5-10', needed: 150 },
    ],
};

// ---- Localized Labels
export const LABELS = {
    // Page intro
    intro: {
        en: "There are several ways to strengthen your heroes: leveling, upgrading, transcending, gear, etc. This guide covers each method in detail.",
        jp: "ヒーローを強化する方法はいくつかあります：レベルアップ、アップグレード、超越、装備など。このガイドでは各方法を詳しく説明します。",
        kr: "영웅을 강화하는 방법은 여러 가지가 있습니다: 레벨업, 승급, 초월, 장비 등. 이 가이드에서는 각 방법을 자세히 설명합니다.",
        zh: "强化英雄的方法有很多：升级、进阶、超越、装备等。本指南将详细介绍每种方法。"
    },

    // Section titles
    sectionLeveling: { en: "Leveling", jp: "レベルアップ", kr: "레벨업", zh: "升级" },
    sectionUpgrade: { en: "Upgrade", jp: "アップグレード", kr: "승급", zh: "进阶" },
    sectionTranscendence: { en: "Transcendence", jp: "超越", kr: "초월", zh: "超越" },
    sectionAffinity: { en: "Affinity (Friendship)", jp: "親密度（友情）", kr: "친밀도 (우정)", zh: "好感度（友情）" },
    sectionSkillUpgrade: { en: "Skill Upgrade", jp: "スキルアップグレード", kr: "스킬 강화", zh: "技能升级" },
    sectionSpecialEquipment: { en: "Special Equipment", jp: "特殊装備", kr: "특수 장비", zh: "特殊装备" },
    sectionGems: { en: "Gems", jp: "ジェム", kr: "보석", zh: "宝石" },
    sectionGear: { en: "Gear", jp: "装備", kr: "장비", zh: "装备" },

    // Leveling section
    levelingDesc1: {
        en: "Heroes gain experience by participating in battles or by consuming XP items. Most content grants XP, but not all (e.g., Bounty Hunter). The Bandit Chase challenge mode rewards you with consumable XP food:",
        jp: "ヒーローは戦闘に参加するか、経験値アイテムを消費することで経験値を得ます。ほとんどのコンテンツで経験値が得られますが、すべてではありません（例：賞金首狩り）。山賊討伐チャレンジモードでは消費可能な経験値フードが報酬として得られます：",
        kr: "영웅은 전투에 참여하거나 경험치 아이템을 소비하여 경험치를 얻습니다. 대부분의 콘텐츠에서 경험치를 얻을 수 있지만, 모든 콘텐츠가 그런 것은 아닙니다(예: 현상금 사냥꾼). 산적 토벌 챌린지 모드에서는 소비 가능한 경험치 음식을 보상으로 받습니다:",
        zh: "英雄可以通过参与战斗或消耗经验道具来获得经验值。大多数内容都会给予经验值，但不是全部（例如赏金猎人）。山贼追击挑战模式会奖励可消耗的经验食物："
    },
    levelingDesc2: {
        en: "You can use various items to give XP.",
        jp: "様々なアイテムを使用して経験値を付与できます。",
        kr: "다양한 아이템을 사용하여 경험치를 부여할 수 있습니다.",
        zh: "你可以使用各种道具来给予经验值。"
    },
    grantsXP: { en: "grants", jp: "付与", kr: "부여", zh: "给予" },
    xpUnit: { en: "XP", jp: "経験値", kr: "경험치", zh: "经验值" },
    instantLv100: {
        en: "instantly sets a hero to level 100 (event/cash shop only).",
        jp: "ヒーローを即座にレベル100にします（イベント/課金ショップ限定）。",
        kr: "영웅을 즉시 레벨 100으로 설정합니다(이벤트/유료 상점 전용).",
        zh: "立即将英雄设置为100级（仅限活动/付费商店）。"
    },

    // Upgrade section
    upgradeDesc: {
        en: "Once a hero reaches specific levels, you can upgrade their base stats permanently in Hero → Upgrade. The upgraded stats are fixed and depend on the hero's class and runes are mainly obtained via the Upgrade Stone Retrieval challenge. The requirements per stage (element vary depending of hero' one) is:",
        jp: "ヒーローが特定のレベルに達すると、ヒーロー → アップグレードで基本ステータスを永続的にアップグレードできます。アップグレードされるステータスは固定で、ヒーローのクラスに依存し、ルーンは主にアップグレードストーン回収チャレンジで入手できます。各ステージの必要条件（属性はヒーローのものに依存）は：",
        kr: "영웅이 특정 레벨에 도달하면 영웅 → 승급에서 기본 스탯을 영구적으로 승급할 수 있습니다. 승급되는 스탯은 고정되어 있으며 영웅의 클래스에 따라 다르고, 룬은 주로 승급석 회수 챌린지에서 얻을 수 있습니다. 각 단계의 요구 사항(속성은 영웅에 따라 다름)은:",
        zh: "当英雄达到特定等级后，你可以在英雄 → 进阶中永久提升其基础属性。升级的属性是固定的，取决于英雄的职业，符文主要通过进阶石回收挑战获得。每个阶段的要求（元素因英雄而异）是："
    },
    stage1: { en: "Stage 1 (Lv. 1)", jp: "ステージ1（Lv.1）", kr: "1단계 (Lv.1)", zh: "阶段1（Lv.1）" },
    stage2: { en: "Stage 2 (Lv. 20)", jp: "ステージ2（Lv.20）", kr: "2단계 (Lv.20)", zh: "阶段2（Lv.20）" },
    stage3: { en: "Stage 3 (Lv. 40)", jp: "ステージ3（Lv.40）", kr: "3단계 (Lv.40)", zh: "阶段3（Lv.40）" },
    stage4: { en: "Stage 4 (Lv. 60)", jp: "ステージ4（Lv.60）", kr: "4단계 (Lv.60)", zh: "阶段4（Lv.60）" },
    stage5: { en: "Stage 5 (Lv. 80)", jp: "ステージ5（Lv.80）", kr: "5단계 (Lv.80)", zh: "阶段5（Lv.80）" },
    stage6: { en: "Stage 6 (Lv. 100)", jp: "ステージ6（Lv.100）", kr: "6단계 (Lv.100)", zh: "阶段6（Lv.100）" },
    startingStage: { en: "Starting stage", jp: "開始ステージ", kr: "시작 단계", zh: "起始阶段" },
    instantStage6: {
        en: "instantly upgrades a hero to Stage 6 (event/cash shop only).",
        jp: "ヒーローを即座にステージ6にアップグレードします（イベント/課金ショップ限定）。",
        kr: "영웅을 즉시 6단계로 승급합니다(이벤트/유료 상점 전용).",
        zh: "立即将英雄升级到阶段6（仅限活动/付费商店）。"
    },

    // Transcendence section
    transcendenceDesc1: {
        en: "Transcending improves heroes using hero pieces instead of stones. You can earn these through pulling duplicates, the Doppelgänger challenge, hero shop, or events.",
        jp: "超越は石の代わりにヒーローピースを使用してヒーローを強化します。これらは重複の引き、ドッペルゲンガーチャレンジ、ヒーローショップ、またはイベントで入手できます。",
        kr: "초월은 돌 대신 영웅 조각을 사용하여 영웅을 강화합니다. 이것은 중복 뽑기, 도플갱어 챌린지, 영웅 상점 또는 이벤트를 통해 얻을 수 있습니다.",
        zh: "超越使用英雄碎片而非石头来强化英雄。你可以通过抽取重复、分身挑战、英雄商店或活动获得这些碎片。"
    },
    transcendenceDesc2: {
        en: "Note: Demiurge and Limited units cannot be farmed via Doppelgänger and their may have different bonuses, often including unique passives instead of stat buffs (e.g., DDrak reduces AoE damage) and don't follow the generic transcendence effects.",
        jp: "注意：デミウルゴスと限定ユニットはドッペルゲンガーでファームできず、異なるボーナスを持つ場合があります。多くの場合、ステータスバフの代わりにユニークなパッシブ（例：DDrakはAoEダメージを軽減）を含み、一般的な超越効果に従いません。",
        kr: "참고: 데미우르고스와 한정 유닛은 도플갱어에서 파밍할 수 없으며, 스탯 버프 대신 고유 패시브(예: DDrak은 광역 데미지 감소)를 포함하는 다른 보너스를 가질 수 있으며, 일반적인 초월 효과를 따르지 않습니다.",
        zh: "注意：造物主和限定角色无法通过分身挑战获取，它们可能有不同的加成，通常包括独特的被动技能而非属性加成（例如DDrak减少群体伤害），并且不遵循通用的超越效果。"
    },
    transcendenceDesc3: {
        en: "Generic transcendence effects (each step include a base Stat Atk, Def, HP bonus):",
        jp: "一般的な超越効果（各ステップには基本ステータスの攻撃、防御、HPボーナスが含まれます）：",
        kr: "일반적인 초월 효과(각 단계에는 기본 스탯 공격, 방어, HP 보너스가 포함됩니다):",
        zh: "通用超越效果（每个阶段包含基础攻击、防御、HP加成）："
    },
    transcendenceNothing: { en: "nothing", jp: "なし", kr: "없음", zh: "无" },
    transcendence3: { en: "Burst 2 Unlocked", jp: "バースト2解放", kr: "버스트 2 해금", zh: "爆发2解锁" },
    transcendence4part1: {
        en: "gain self-stat while",
        jp: "は自己ステータスを獲得、",
        kr: "자기 스탯 획득,",
        zh: "获得自身属性加成，而"
    },
    transcendence4part2: {
        en: "a team-stat",
        jp: "はチームステータスを獲得",
        kr: "팀 스탯 획득",
        zh: "获得团队属性加成"
    },
    transcendence4part3: {
        en: "All gain +1 Chain Passive Weakness Gauge Damage",
        jp: "全員が+1チェーンパッシブ弱点ゲージダメージを獲得",
        kr: "모두 +1 체인 패시브 약점 게이지 데미지 획득",
        zh: "全员获得+1连锁被动弱点槽伤害"
    },
    transcendence5: { en: "Burst 3 Unlocked", jp: "バースト3解放", kr: "버스트 3 해금", zh: "爆发3解锁" },
    transcendence6part1: {
        en: "gain self-stat improvement",
        jp: "は自己ステータス強化を獲得",
        kr: "자기 스탯 강화 획득",
        zh: "获得自身属性强化"
    },
    transcendence6part2: {
        en: "gains team-stat improvement",
        jp: "はチームステータス強化を獲得",
        kr: "팀 스탯 강화 획득",
        zh: "获得团队属性强化"
    },
    transcendence6part3: {
        en: "All gain +25 Action Points at battle start",
        jp: "全員がバトル開始時に+25アクションポイントを獲得",
        kr: "모두 전투 시작 시 +25 행동 포인트 획득",
        zh: "全员在战斗开始时获得+25行动点"
    },
    transcendenceNote: {
        en: "Note: you need 1 dupe to proceed each step. So with a",
        jp: "注意：各ステップを進めるには1体の重複が必要です。",
        kr: "참고: 각 단계를 진행하려면 1개의 중복이 필요합니다.",
        zh: "注意：每个阶段需要1个重复角色。所以"
    },
    transcendenceNoteEnd: {
        en: "base you need 1 + 6 copy to reach for",
        jp: "ベースの場合、",
        kr: "베이스의 경우",
        zh: "基础需要1+6个副本才能达到"
    },

    // Affinity section
    affinityDesc: {
        en: "Increasing a hero's affinity level unlocks their Exclusive Equipment at level 10. You can give them any gift, but each heroes gots his preferred ones (you can check gift preference in Hero → Affinity Level top-left box). You can also give them Upgrade Stones matching their element. 170 000 total affinity points are needed for level 10.",
        jp: "ヒーローの親密度レベルを上げると、レベル10で専用装備が解放されます。どのギフトでも渡せますが、各ヒーローには好みのギフトがあります（ヒーロー → 親密度レベルの左上ボックスでギフトの好みを確認できます）。また、属性に合ったアップグレードストーンを渡すこともできます。レベル10には合計170,000親密度ポイントが必要です。",
        kr: "영웅의 친밀도 레벨을 올리면 레벨 10에서 전용 장비가 해금됩니다. 어떤 선물이든 줄 수 있지만, 각 영웅에게는 선호하는 선물이 있습니다(영웅 → 친밀도 레벨 왼쪽 상단 박스에서 선물 선호도를 확인할 수 있습니다). 속성에 맞는 승급석을 줄 수도 있습니다. 레벨 10에는 총 170,000 친밀도 포인트가 필요합니다.",
        zh: "提升英雄的好感度等级可以在10级时解锁其专属装备。你可以送给他们任何礼物，但每个英雄都有自己偏好的礼物（你可以在英雄 → 好感度等级左上角框中查看礼物偏好）。你也可以送给他们与其属性匹配的进阶石。达到10级需要总共170,000好感度点数。"
    },
    bonus: { en: "Bonus", jp: "ボーナス", kr: "보너스", zh: "加成" },
    affinityMaxItem: {
        en: "maxes affinity to level 10 (event/cash shop only).",
        jp: "親密度をレベル10まで最大化します（イベント/課金ショップ限定）。",
        kr: "친밀도를 레벨 10까지 최대화합니다(이벤트/유료 상점 전용).",
        zh: "将好感度提升至10级（仅限活动/付费商店）。"
    },

    // Skill Upgrade section
    skillUpgradeDesc1: {
        en: "Each hero has 3 basic skills and 1 chain passive. Each can be upgraded 4 times for bonus effects. Upgrading is done in Hero → Skills using Skill Books found in events, shops, and rewards.",
        jp: "各ヒーローには3つの基本スキルと1つのチェーンパッシブがあります。それぞれ4回アップグレードでき、ボーナス効果が得られます。アップグレードはヒーロー → スキルで、イベント、ショップ、報酬で入手できるスキルブックを使用して行います。",
        kr: "각 영웅에게는 3개의 기본 스킬과 1개의 체인 패시브가 있습니다. 각각 4번 강화하여 보너스 효과를 얻을 수 있습니다. 강화는 영웅 → 스킬에서 이벤트, 상점, 보상에서 얻은 스킬북을 사용하여 수행합니다.",
        zh: "每个英雄有3个基础技能和1个连锁被动。每个都可以升级4次以获得加成效果。升级在英雄 → 技能中进行，使用从活动、商店和奖励中获得的技能书。"
    },
    skillUpgradeDesc2: {
        en: "The cost of skill upgrade depend of the hero base rarity",
        jp: "スキルアップグレードのコストはヒーローの基本レアリティに依存します",
        kr: "스킬 강화 비용은 영웅의 기본 레어리티에 따라 다릅니다",
        zh: "技能升级的费用取决于英雄的基础稀有度"
    },
    upgradeLevel: { en: "Upgrade Level", jp: "アップグレードレベル", kr: "강화 레벨", zh: "升级等级" },

    // Special Equipment section
    specialEquipmentDesc: {
        en: "Found under Hero → Special Gear. There are two types: Exclusive Equipment (EE) and Talismans.",
        jp: "ヒーロー → 特殊装備にあります。専用装備（EE）とタリスマンの2種類があります。",
        kr: "영웅 → 특수 장비에서 찾을 수 있습니다. 전용 장비(EE)와 탈리스만 두 가지 유형이 있습니다.",
        zh: "位于英雄 → 特殊装备。有两种类型：专属装备（EE）和护符。"
    },
    eeDesc: {
        en: "EE is unlocked via Affinity and grants a passive stat, a condition-based AP gain, a passive skill, and gem slots. It can be enhanced with:",
        jp: "EEは親密度で解放され、パッシブステータス、条件ベースのAP獲得、パッシブスキル、ジェムスロットを付与します。以下で強化できます：",
        kr: "EE는 친밀도로 해금되며 패시브 스탯, 조건 기반 AP 획득, 패시브 스킬, 보석 슬롯을 부여합니다. 다음으로 강화할 수 있습니다:",
        zh: "EE通过好感度解锁，提供被动属性、条件触发的AP获取、被动技能和宝石槽。可以用以下材料强化："
    },
    fromLvTo: { en: "from Lv.", jp: "Lv.", kr: "Lv.", zh: "从Lv." },
    toLv: { en: "to", jp: "から", kr: "에서", zh: "到" },
    needed: { en: "needed", jp: "必要", kr: "필요", zh: "需要" },
    eeLv5Unlock: {
        en: "Level 5 unlocks an extra gem slot, Level 10 unlocks (or upgrades) the passive.",
        jp: "レベル5で追加のジェムスロットが解放され、レベル10でパッシブが解放（またはアップグレード）されます。",
        kr: "레벨 5에서 추가 보석 슬롯이 해금되고, 레벨 10에서 패시브가 해금(또는 업그레이드)됩니다.",
        zh: "5级解锁额外宝石槽，10级解锁（或升级）被动。"
    },
    talismanDesc: {
        en: "Talismans grant a team-wide aura stat boost, CP/AP regen effects, and gem slots. They're upgraded with Stardust (blue/purple), and follow the same gem/passive thresholds as EE.",
        jp: "タリスマンはチーム全体のオーラステータスブースト、CP/APリジェネ効果、ジェムスロットを付与します。スターダスト（青/紫）でアップグレードし、EEと同じジェム/パッシブ閾値に従います。",
        kr: "탈리스만은 팀 전체 오라 스탯 부스트, CP/AP 재생 효과, 보석 슬롯을 부여합니다. 스타더스트(파랑/보라)로 강화하며, EE와 동일한 보석/패시브 임계값을 따릅니다.",
        zh: "护符提供全队光环属性加成、CP/AP回复效果和宝石槽。使用星尘（蓝色/紫色）升级，遵循与EE相同的宝石/被动阈值。"
    },
    auraNote: {
        en: "Only the highest aura effect applies if duplicates exist (e.g., two crit dmg boosts = only the higher one applies).",
        jp: "重複がある場合、最も高いオーラ効果のみが適用されます（例：2つのクリティカルダメージブースト = 高い方のみ適用）。",
        kr: "중복이 있는 경우 가장 높은 오라 효과만 적용됩니다(예: 두 개의 치명타 데미지 부스트 = 높은 것만 적용).",
        zh: "如果存在重复，只有最高的光环效果生效（例如：两个暴击伤害加成 = 只有较高的生效）。"
    },
    materialsSource: {
        en: "Those materials are mainly obtained via Irregular Extermination and events.",
        jp: "これらの素材は主にイレギュラー討伐とイベントで入手できます。",
        kr: "이러한 재료는 주로 이레귤러 토벌과 이벤트에서 얻을 수 있습니다.",
        zh: "这些材料主要通过异形讨伐和活动获得。"
    },

    // Gems section
    gemsDesc1: {
        en: "are special jewels that can be socketed into Exclusive Equipment or Talismans. Their primary purpose is to compensate for a hero's missing stats.",
        jp: "は専用装備やタリスマンにセットできる特別な宝石です。主な目的はヒーローの不足しているステータスを補うことです。",
        kr: "은 전용 장비나 탈리스만에 장착할 수 있는 특별한 보석입니다. 주요 목적은 영웅의 부족한 스탯을 보완하는 것입니다.",
        zh: "是可以镶嵌到专属装备或护符中的特殊珠宝。其主要目的是弥补英雄缺失的属性。"
    },
    gemsDesc2a: {
        en: "For example, if a DPS unit is lacking Crit Chance, equipping a",
        jp: "例えば、DPSユニットがクリティカル率が不足している場合、",
        kr: "예를 들어, DPS 유닛에 치명타 확률이 부족하다면",
        zh: "例如，如果DPS角色缺少暴击率，装备"
    },
    gemsDesc2b: {
        en: "can help reach key thresholds. Gem choices should always align with substat priorities and the character's role.",
        jp: "を装備することで重要な閾値に到達できます。ジェムの選択は常にサブステータスの優先順位とキャラクターの役割に合わせるべきです。",
        kr: "을 장착하여 핵심 임계값에 도달할 수 있습니다. 보석 선택은 항상 서브스탯 우선순위와 캐릭터의 역할에 맞아야 합니다.",
        zh: "可以帮助达到关键阈值。宝石选择应始终与副属性优先级和角色定位保持一致。"
    },

    // Gear section
    gearIntro: {
        en: "For detailed information, refer to the Equipment Guide. In short:",
        jp: "詳細については装備ガイドを参照してください。簡単に言うと：",
        kr: "자세한 정보는 장비 가이드를 참조하세요. 간단히 말하면:",
        zh: "详细信息请参阅装备指南。简而言之："
    },
    gearEquipmentGuide: { en: "Equipment Guide", jp: "装備ガイド", kr: "장비 가이드", zh: "装备指南" },
    gearPoint1: {
        en: "Gear comes in 4 rarities and can be upgraded up to +10",
        jp: "装備は4つのレアリティがあり、+10までアップグレードできます",
        kr: "장비는 4개의 레어리티가 있으며 +10까지 강화할 수 있습니다",
        zh: "装备有4种稀有度，可以升级到+10"
    },
    gearPoint2: {
        en: "Legendary Weapons and Amulets have class restrictions (e.g., only usable by Mages)",
        jp: "レジェンダリー武器とアミュレットにはクラス制限があります（例：メイジのみ使用可能）",
        kr: "전설 무기와 목걸이에는 클래스 제한이 있습니다(예: 마법사만 사용 가능)",
        zh: "传说武器和护身符有职业限制（例如仅法师可用）"
    },
    gearPoint3: {
        en: "Armors provide set bonuses when equipped together",
        jp: "アーマーは一緒に装備するとセットボーナスを提供します",
        kr: "방어구는 함께 장착하면 세트 보너스를 제공합니다",
        zh: "护甲套装一起装备时提供套装加成"
    },
    gearPoint4: {
        en: "Gear can be reforged to add substats (up to 4 total) or enhance existing ones if already at 4",
        jp: "装備はリフォージでサブステータスを追加（最大4つ）または既に4つある場合は既存のものを強化できます",
        kr: "장비는 재련하여 서브스탯을 추가(최대 4개)하거나 이미 4개인 경우 기존 것을 강화할 수 있습니다",
        zh: "装备可以重铸以添加副属性（最多4个）或在已有4个时强化现有属性"
    },
    gearPoint5: {
        en: "Breakthrough increases main stats and enhance passives",
        jp: "ブレイクスルーはメインステータスを増加させ、パッシブを強化します",
        kr: "돌파는 메인 스탯을 증가시키고 패시브를 강화합니다",
        zh: "突破增加主属性并强化被动"
    },
    gearPoint6: {
        en: "Main stats cannot be rerolled",
        jp: "メインステータスは変更できません",
        kr: "메인 스탯은 변경할 수 없습니다",
        zh: "主属性无法重置"
    },
    gearPoint7: {
        en: "Substats can be rerolled using Stat Change options",
        jp: "サブステータスはステータス変更オプションで変更できます",
        kr: "서브스탯은 스탯 변경 옵션으로 변경할 수 있습니다",
        zh: "副属性可以使用属性更改选项重置"
    },
} as const;

// ---- Components

export function UpgradeTable({ lang }: { lang: Lang }) {
    return (
        <table className="table-auto text-sm text-white">
            <tbody>
                {upgradeStages.map((stage, idx) => (
                    <tr key={idx} className="align-middle">
                        <td className="pr-2 whitespace-nowrap">
                            <InlineIcon icon={`/images/ui/evo/${stage.icon}.webp`} label={lRec(LABELS[stage.stage as keyof typeof LABELS] as LangMap, lang)} underline={false} />
                        </td>
                        <td className="px-2 text-neutral-400">→</td>
                        <td className="pr-1 text-right">{stage.cost}</td>
                        <td>
                            {stage.cost ? <ItemInline name={stage.item} /> : lRec(LABELS.startingStage, lang)}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export function TranscendenceTable({ lang }: { lang: Lang }) {
    const getUnlock = (icon: string): ReactNode => {
        switch (icon) {
            case '3':
                return lRec(LABELS.transcendence3, lang);
            case '4':
                return (
                    <>
                        <StarBadge level="1" /> {lRec(LABELS.transcendence4part1, lang).split('while')[0]} <StarBadge level="2" /> {lRec(LABELS.transcendence4part1, lang).includes('while') && 'gain self-stat while'} <StarBadge level="3" /> {lRec(LABELS.transcendence4part2, lang)}
                        <br /> {lRec(LABELS.transcendence4part3, lang)}
                    </>
                );
            case '5':
                return lRec(LABELS.transcendence5, lang);
            case '6':
                return (
                    <>
                        <StarBadge level="1" /> {lang === 'en' ? 'and' : ''} <StarBadge level="2" /> {lRec(LABELS.transcendence6part1, lang)}
                        <br /> <StarBadge level="3" /> {lRec(LABELS.transcendence6part2, lang)}
                        <br /> {lRec(LABELS.transcendence6part3, lang)}
                    </>
                );
            default:
                return null;
        }
    };

    return (
        <table className="table-auto text-sm text-white border-separate border-spacing-y-2">
            <tbody>
                {transcendenceSteps.map((icon, idx) => {
                    const unlock = getUnlock(icon);
                    return (
                        <tr key={idx} className="mb-2">
                            <td className="pr-2 whitespace-nowrap text-right">
                                <StarBadge level={icon} />
                            </td>
                            <td className="px-2 text-neutral-400">→</td>
                            <td className="text-left align-middle">
                                {unlock ? unlock : <p className="text-neutral-400 text-sm italic">{lRec(LABELS.transcendenceNothing, lang)}</p>}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

export function SkillCostTable({ lang }: { lang: Lang }) {
    return (
        <div className="overflow-x-auto">
            <table className="table-auto text-sm text-white">
                <thead>
                    <tr className="border-b border-white/10">
                        <th className="text-left pr-4 pb-2">{lRec(LABELS.upgradeLevel, lang)}</th>
                        <th className="text-center px-2 pb-2"><StarBadge level="1" /></th>
                        <th className="text-center px-2 pb-2"><StarBadge level="2" /></th>
                        <th className="text-center px-2 pb-2"><StarBadge level="3" /></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                    {skillLevels.map((lv) => (
                        <tr key={lv} className="align-middle">
                            <td className="py-2 pr-4 font-medium">Lv{lv.slice(2)}</td>
                            {(['1', '2', '3'] as const).map((rarity) => {
                                const rarityData = skillCosts[rarity] as Record<string, Record<string, number>>;
                                const data = rarityData[lv];
                                return (
                                    <td key={rarity} className="py-2 text-center px-2">
                                        {data &&
                                            Object.entries(data)
                                                .filter(([, amount]) => amount > 0)
                                                .map(([color, amount], i, arr) => {
                                                    const itemName =
                                                        color === "green"
                                                            ? "Basic Skill Manual"
                                                            : color === "blue"
                                                                ? "Intermediate Skill Manual"
                                                                : "Professional Skill Manual";
                                                    return (
                                                        <Fragment key={color}>
                                                            <span className="inline-block">
                                                                <ItemInline name={itemName} /> x{amount}
                                                            </span>
                                                            {i < arr.length - 1 && <br />}
                                                        </Fragment>
                                                    );
                                                })}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function XPItemsList({ lang }: { lang: Lang }) {
    return (
        <ul>
            {xpItems.map(({ item, xp }) => (
                <li key={item}>
                    <ItemInline name={item} /> {lRec(LABELS.grantsXP, lang)} {xp.toLocaleString()} {lRec(LABELS.xpUnit, lang)}
                </li>
            ))}
        </ul>
    );
}

export function AffinityList({ lang }: { lang: Lang }) {
    return (
        <div className="space-y-4">
            <table className="table-auto text-sm text-white">
                <tbody className="divide-y divide-white/10">
                    {affinityUpgradeStones.map(({ item, points }) => (
                        <tr key={item} className="align-middle">
                            <td className="py-1.5 pr-4 text-left"><ItemInline name={item} /></td>
                            <td className="py-1.5">+{points}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <table className="table-auto text-sm text-white">
                <tbody className="divide-y divide-white/10">
                    {affinityGifts.map(({ items: giftItems, points, bonus }, idx) => (
                        <tr key={idx}>
                            <td className="py-2 pr-4 text-left align-top">
                                {giftItems.map((item, i) => (
                                    <Fragment key={item}>
                                        <ItemInline name={item} />
                                        {i < giftItems.length - 1 && <br />}
                                    </Fragment>
                                ))}
                            </td>
                            <td className="py-2 whitespace-nowrap align-middle">+{points.toLocaleString()} ({lRec(LABELS.bonus, lang)}: +{bonus})</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function SpecialEquipmentList({ type, lang }: { type: 'ee' | 'talisman'; lang: Lang }) {
    const materials = specialEquipmentMaterials[type];
    return (
        <ul>
            {materials.map(({ item, range, needed }) => {
                const [from, to] = range.split('-');
                return (
                    <li key={item}>
                        <ItemInline name={item} /> {lRec(LABELS.fromLvTo, lang)} {from} {lRec(LABELS.toLv, lang)} {to} ({needed} {lRec(LABELS.needed, lang)})
                    </li>
                );
            })}
        </ul>
    );
}

export function GearSection({ lang }: { lang: Lang }) {
    const { href } = useI18n();
    const points = [
        LABELS.gearPoint1,
        LABELS.gearPoint2,
        LABELS.gearPoint3,
        LABELS.gearPoint4,
        LABELS.gearPoint5,
        LABELS.gearPoint6,
        LABELS.gearPoint7,
    ];

    return (
        <>
            <p>
                {lRec(LABELS.gearIntro, lang).split(lRec(LABELS.gearEquipmentGuide, lang))[0]}
                <Link href={href('/guides/general-guides/gear')} className="underline text-blue-400 hover:text-blue-300">
                    {lRec(LABELS.gearEquipmentGuide, lang)}
                </Link>
                {lRec(LABELS.gearIntro, lang).split(lRec(LABELS.gearEquipmentGuide, lang))[1]}
            </p>
            <ul>
                {points.map((point, idx) => (
                    <li key={idx}>{lRec(point, lang)}</li>
                ))}
            </ul>
        </>
    );
}
