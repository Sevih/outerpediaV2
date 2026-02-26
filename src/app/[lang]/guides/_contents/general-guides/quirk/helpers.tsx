'use client';

import React, { type ReactNode } from 'react';
import InlineIcon from '@/app/components/inline/InlineIcon';
import ContentCard from '@/app/components/guides/ContentCard';
import type { Lang } from '@/lib/i18n/config';
import { lRec } from '@/lib/i18n/localize';
import parseText from '@/lib/parse-text';

/* ===================== Icon Placeholder Parser ===================== */
type IconKey = 'ICON_CSE' | 'ICON_CE' | 'ICON_EE' | 'ICON_U' | 'ICON_AL';
type TermKey = 'counteractStrongEnemies' | 'classEnhancement' | 'elementEnhancement' | 'utility' | 'adventureLicense';

const ICON_MAP: Record<IconKey, { name: string; termKey: TermKey }> = {
  ICON_CSE: { name: 'CM_Gift_Menu_05', termKey: 'counteractStrongEnemies' },
  ICON_CE: { name: 'CM_Gift_Menu_03', termKey: 'classEnhancement' },
  ICON_EE: { name: 'CM_Gift_Menu_01', termKey: 'elementEnhancement' },
  ICON_U: { name: 'CM_Gift_Menu_04', termKey: 'utility' },
  ICON_AL: { name: 'CM_Gift_Menu_06', termKey: 'adventureLicense' },
};

function parseWithIcons(text: string, lang: Lang, size: number = 25): ReactNode[] {
  const regex = /\{(ICON_[A-Z_]+)\}/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let segmentIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    const [full, iconKey] = match;
    const index = match.index;

    if (index > lastIndex) {
      const before = text.slice(lastIndex, index);
      parts.push(
        <React.Fragment key={`seg-${segmentIndex++}`}>
          {parseText(before)}
        </React.Fragment>
      );
    }

    const icon = ICON_MAP[iconKey as IconKey];
    if (icon) {
      const localizedText = lRec(TERMS[icon.termKey], lang);
      parts.push(
        <InlineIcon key={`icon-${index}`} icon={`/images/guides/general-guides/${icon.name}.webp`} label={localizedText} size={size} />
      );
    } else {
      parts.push(full);
    }

    lastIndex = index + full.length;
  }

  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);
    parts.push(
      <React.Fragment key={`seg-${segmentIndex}`}>
        {parseText(remaining)}
      </React.Fragment>
    );
  }

  return parts;
}

/* ===================== Official Terms ===================== */
export const TERMS = {
  quirk: { en: 'Quirk', jp: 'ギフト', kr: '기프트', zh: '天赋' },
  classEnhancement: { en: 'Class Enhancement', jp: '戦闘タイプ強化', kr: '직업 강화', zh: '职业强化' },
  utility: { en: 'Utility', jp: '実用関連', kr: '유틸리티', zh: '效益' },
  elementEnhancement: { en: 'Element Enhancement', jp: '属性強化', kr: '속성 강화', zh: '属性强化' },
  counteractStrongEnemies: { en: 'Counteract Strong Enemies', jp: '強敵対応', kr: '강적 대응', zh: '应对强敌' },
  adventureLicense: { en: 'Adventure License', jp: '冒険者ライセンス', kr: '모험 라이선스', zh: '冒险许可证' },
} as const;

/* ===================== Localized Labels ===================== */
export const LABELS = {
  title: {
    en: 'Quirk System',
    jp: 'ギフトシステム',
    kr: '기프트 시스템',
    zh: '天赋系统',
  },
  categoryOverview: {
    en: 'Category Overview',
    jp: 'カテゴリー概要',
    kr: '카테고리 개요',
    zh: '类别概览',
  },
  howItWorks: {
    en: 'How It Works',
    jp: '仕組み',
    kr: '작동 방식',
    zh: '运作方式',
  },
  upgradingPriority: {
    en: 'Upgrading Priority',
    jp: '優先順位',
    kr: '업그레이드 우선순위',
    zh: '升级优先级',
  },
  earlyGameExample: {
    en: 'Early Game Example',
    jp: '序盤の例',
    kr: '초반 예시',
    zh: '前期示例',
  },
  faq: {
    en: 'FAQ',
    jp: 'よくある質問',
    kr: '자주 묻는 질문',
    zh: '常见问题',
  },
  introP1: {
    en: 'After clearing Season 1 stage 9-5 : The Responsibility of the Guilty, you will unlock the Quirk system.',
    jp: 'シーズン1ステージ9-5「奪った者の責任感」をクリアすると、ギフトシステムが解放されます。',
    kr: '시즌 1 스테이지 9-5: 빼앗은 자의 책임감을 클리어하면 기프트 시스템이 해금됩니다.',
    zh: '通关第一季9-5关卡「掠夺者的责任感」后，将解锁天赋系统。',
  },
  introP2: {
    en: 'Quirks are a permanent, account-wide enhancement system available in the Base → Quirk menu. They provide additional stats for your heroes or utility effects for your account, and are unlocked using materials such as {I-I/Proof of Destiny}, {I-I/Token of Connection}, and {I-I/Proof of Worth}.',
    jp: 'ギフトは、アジト→ギフトメニューで利用できる永続的なアカウント全体の強化システムです。ヒーローに追加ステータスやアカウントに実用的な効果を提供し、{I-I/Proof of Destiny}、{I-I/Token of Connection}、{I-I/Proof of Worth}などの素材で解放されます。',
    kr: '기프트는 아지트 → 기프트 메뉴에서 사용할 수 있는 영구적인 계정 전체 강화 시스템입니다. 영웅에게 추가 스탯이나 계정에 유틸리티 효과를 제공하며, {I-I/Proof of Destiny}, {I-I/Token of Connection}, {I-I/Proof of Worth} 등의 재료로 해금됩니다.',
    zh: '天赋是一个永久的全账户强化系统，可在基地→天赋菜单中使用。它为英雄提供额外属性或账户效益效果，使用{I-I/Proof of Destiny}、{I-I/Token of Connection}和{I-I/Proof of Worth}等材料解锁。',
  },
  catCounteract: {
    en: 'bonuses that enhance your team or weaken the enemy when facing bosses',
    jp: 'ボス戦でチームを強化したり敵を弱体化させるボーナス',
    kr: '보스전에서 팀을 강화하거나 적을 약화시키는 보너스',
    zh: '面对Boss时强化队伍或削弱敌人的加成',
  },
  catClass: {
    en: 'stat boosts for heroes based on their class and subclass',
    jp: 'クラスとサブクラスに基づくヒーローのステータスブースト',
    kr: '직업과 하위 직업에 따른 영웅 스탯 부스트',
    zh: '基于职业和子职业的英雄属性提升',
  },
  catElement: {
    en: 'stat boosts based on hero elements',
    jp: 'ヒーローの属性に基づくステータスブースト',
    kr: '영웅 속성에 따른 스탯 부스트',
    zh: '基于英雄属性的属性提升',
  },
  catUtility: {
    en: 'account-wide bonuses (EXP gain, drop rate, crafting cost, etc.)',
    jp: 'アカウント全体のボーナス（経験値獲得、ドロップ率、製作コストなど）',
    kr: '계정 전체 보너스 (경험치 획득, 드롭률, 제작 비용 등)',
    zh: '全账户加成（经验获取、掉落率、制作成本等）',
  },
  catAdventure: {
    en: 'bonuses that only apply in Adventure License mode',
    jp: '冒険者ライセンスモードでのみ適用されるボーナス',
    kr: '모험 라이선스 모드에서만 적용되는 보너스',
    zh: '仅在冒险许可证模式中生效的加成',
  },
  howP1: {
    en: 'Each category has Main Nodes and Sub-Nodes. You must upgrade the main node to unlock its sub-nodes.',
    jp: '各カテゴリーにはメインノードとサブノードがあります。サブノードを解放するにはメインノードをアップグレードする必要があります。',
    kr: '각 카테고리에는 메인 노드와 서브 노드가 있습니다. 서브 노드를 해금하려면 메인 노드를 업그레이드해야 합니다.',
    zh: '每个类别都有主节点和子节点。必须升级主节点才能解锁子节点。',
  },
  howP2: {
    en: 'You need 5 points in a main node to unlock all sub-nodes (except {ICON_AL}, which requires level 9).',
    jp: '全てのサブノードを解放するにはメインノードに5ポイント必要です（{ICON_AL}を除く、レベル9が必要）。',
    kr: '모든 서브 노드를 해금하려면 메인 노드에 5포인트가 필요합니다 ({ICON_AL} 제외, 레벨 9 필요).',
    zh: '需要主节点5点才能解锁所有子节点（{ICON_AL}除外，需要9级）。',
  },
  howP3: {
    en: 'Some nodes are more valuable than others. You can skip early nodes like {C/Healer}, {C/Defender}, {C/Ranger} ({C/Ranger|Tactician}), {S/DMG RED%} and {S/RES} quirks.',
    jp: '一部のノードは他より価値があります。{C/Healer}、{C/Defender}、{C/Ranger}（{C/Ranger|Tactician}）、{S/DMG RED%}、{S/RES}のギフトは序盤ではスキップできます。',
    kr: '일부 노드는 다른 것보다 가치가 높습니다. {C/Healer}, {C/Defender}, {C/Ranger} ({C/Ranger|Tactician}), {S/DMG RED%}, {S/RES} 기프트는 초반에 스킵할 수 있습니다.',
    zh: '某些节点比其他节点更有价值。可以跳过{C/Healer}、{C/Defender}、{C/Ranger}（{C/Ranger|Tactician}）、{S/DMG RED%}和{S/RES}等早期天赋。',
  },
  howP4: {
    en: 'You can reset quirk investments using {I-I/Free Ether}, refunding all materials spent.',
    jp: '{I-I/Free Ether}を使用してギフトの投資をリセットし、使用した素材を全て返還できます。',
    kr: '{I-I/Free Ether}를 사용하여 기프트 투자를 리셋하고 사용한 모든 재료를 환불받을 수 있습니다.',
    zh: '可以使用{I-I/Free Ether}重置天赋投资，退还所有使用的材料。',
  },
  priorityP1: {
    en: 'In the early game, your first priority should be {ICON_CSE} quirks, as their bonuses apply universally — regardless of enemy, game mode, hero class, or element.',
    jp: '序盤では、{ICON_CSE}ギフトを最優先にしましょう。敵、ゲームモード、ヒーロークラス、属性に関係なく、ボーナスが普遍的に適用されます。',
    kr: '초반에는 {ICON_CSE} 기프트를 최우선으로 하세요. 적, 게임 모드, 영웅 직업, 속성에 관계없이 보너스가 보편적으로 적용됩니다.',
    zh: '前期应优先{ICON_CSE}天赋，因为其加成普遍适用——无论敌人、游戏模式、英雄职业或属性。',
  },
  priorityP2: {
    en: 'Next, focus on {ICON_CE}, starting with the class of your main DPS. Then move on to {ICON_EE}, prioritizing the element your team relies on the most.',
    jp: '次に、{ICON_CE}に集中しましょう。メインDPSのクラスから始めて、その後{ICON_EE}に移り、チームが最も依存する属性を優先しましょう。',
    kr: '다음으로 {ICON_CE}에 집중하세요. 메인 딜러의 직업부터 시작하여 {ICON_EE}로 넘어가고, 팀이 가장 의존하는 속성을 우선하세요.',
    zh: '接下来专注于{ICON_CE}，从主力输出的职业开始。然后转向{ICON_EE}，优先队伍最依赖的属性。',
  },
  priorityP3: {
    en: 'Finally, consider {ICON_U} quirks, which offer account-wide bonuses such as EXP gain, drop rate, crafting discounts — and most notably, an increase to your stamina cap. While the stamina cap boost is the most impactful perk in this category, Utility quirks as a whole still remain a lower priority early on.',
    jp: '最後に、{ICON_U}ギフトを検討しましょう。経験値獲得、ドロップ率、製作割引などのアカウント全体のボーナスを提供し、特にスタミナ上限の増加が注目されます。スタミナ上限ブーストはこのカテゴリーで最も影響力のある特典ですが、実用関連ギフト全体としては序盤では優先度が低いままです。',
    kr: '마지막으로 {ICON_U} 기프트를 고려하세요. 경험치 획득, 드롭률, 제작 할인 등 계정 전체 보너스를 제공하며, 특히 스태미나 상한 증가가 주목됩니다. 스태미나 상한 부스트가 이 카테고리에서 가장 영향력 있는 혜택이지만, 유틸리티 기프트 전체적으로는 초반에 우선순위가 낮습니다.',
    zh: '最后考虑{ICON_U}天赋，提供全账户加成如经验获取、掉落率、制作折扣——最值得注意的是体力上限增加。虽然体力上限提升是该类别中最有价值的特权，但效益天赋整体在前期优先级仍然较低。',
  },
  priorityP4: {
    en: 'As for the {ICON_AL} tree: this is an endgame system and shouldn\'t be your early focus. It\'s also the only tree that requires {I-I/Proof of Worth}, which is exclusively obtained from Adventure License mode.',
    jp: '{ICON_AL}ツリーについて：これはエンドゲームシステムであり、序盤の焦点にすべきではありません。また、{I-I/Proof of Worth}を必要とする唯一のツリーであり、冒険者ライセンスモードでのみ入手できます。',
    kr: '{ICON_AL} 트리에 대해: 이것은 엔드게임 시스템이므로 초반에 집중해서는 안 됩니다. 또한 {I-I/Proof of Worth}가 필요한 유일한 트리이며, 모험 라이선스 모드에서만 획득할 수 있습니다.',
    zh: '关于{ICON_AL}树：这是终局系统，不应作为前期重点。它也是唯一需要{I-I/Proof of Worth}的树，该材料仅从冒险许可证模式获取。',
  },
  exampleIntro: {
    en: 'Let\'s take a common early team: {P/Valentine}, {P/Aer}, {P/Monad Eva}, {P/Drakhan}.',
    jp: '序盤の一般的なチームを例にしましょう：{P/Valentine}、{P/Aer}、{P/Monad Eva}、{P/Drakhan}。',
    kr: '초반의 일반적인 팀을 예로 들어봅시다: {P/Valentine}, {P/Aer}, {P/Monad Eva}, {P/Drakhan}.',
    zh: '以常见的前期队伍为例：{P/Valentine}、{P/Aer}、{P/Monad Eva}、{P/Drakhan}。',
  },
  exampleP1: {
    en: 'After unlocking boss quirks, prioritize the {C/Striker} tree — especially the left path, which benefits Attackers like {P/Aer} and {P/Drakhan}.',
    jp: 'ボスギフトを解放したら、{C/Striker}ツリーを優先しましょう。特に左側のパスは{P/Aer}や{P/Drakhan}のようなアタッカーに有利です。',
    kr: '보스 기프트를 해금한 후 {C/Striker} 트리를 우선하세요. 특히 왼쪽 경로는 {P/Aer}와 {P/Drakhan} 같은 어태커에게 유리합니다.',
    zh: '解锁Boss天赋后，优先{C/Striker}树——特别是左侧路径，对{P/Aer}和{P/Drakhan}等攻击者有利。',
  },
  exampleP2: {
    en: 'Then, upgrade the {E/Fire} tree ({P/Valentine} and {P/Aer}) — one of your early goals will be farming Chimera for Speed gear.',
    jp: '次に、{E/Fire}ツリーをアップグレードしましょう（{P/Valentine}と{P/Aer}）。序盤の目標の一つはキメラでスピード装備を集めることです。',
    kr: '그 다음, {E/Fire} 트리를 업그레이드하세요 ({P/Valentine}와 {P/Aer}). 초반 목표 중 하나는 키메라에서 스피드 장비를 파밍하는 것입니다.',
    zh: '然后升级{E/Fire}树（{P/Valentine}和{P/Aer}）——前期目标之一是刷奇美拉获取速度装备。',
  },
  exampleP3: {
    en: 'Then, invest in {E/Light} quirks for {P/Drakhan} and {P/Monad Eva}.',
    jp: 'その後、{P/Drakhan}と{P/Monad Eva}のために{E/Light}ギフトに投資しましょう。',
    kr: '그 다음, {P/Drakhan}와 {P/Monad Eva}를 위해 {E/Light} 기프트에 투자하세요.',
    zh: '然后为{P/Drakhan}和{P/Monad Eva}投资{E/Light}天赋。',
  },
  exampleOutro: {
    en: 'This is just one example — always adapt your quirk investments based on your team composition and progression goals.',
    jp: 'これは一例に過ぎません。チーム構成と進行目標に合わせてギフト投資を調整してください。',
    kr: '이것은 하나의 예시일 뿐입니다. 항상 팀 구성과 진행 목표에 맞게 기프트 투자를 조정하세요.',
    zh: '这只是一个示例——请根据队伍配置和进度目标调整天赋投资。',
  },
  faqRespecTitle: {
    en: 'Can I reset Quirks if I make a mistake?',
    jp: '間違えたらギフトをリセットできますか？',
    kr: '실수했을 때 기프트를 리셋할 수 있나요?',
    zh: '如果犯错可以重置天赋吗？',
  },
  faqRespecContent: {
    en: 'Yes. You can respec all your quirks by spending {I-I/Free Ether}. This will fully refund all materials used, letting you reallocate them freely.',
    jp: 'はい。{I-I/Free Ether}を使用して全てのギフトをリスペックできます。使用した素材は全額返還され、自由に再配分できます。',
    kr: '네. {I-I/Free Ether}를 사용하여 모든 기프트를 리스펙할 수 있습니다. 사용한 모든 재료가 환불되어 자유롭게 재배분할 수 있습니다.',
    zh: '可以。使用{I-I/Free Ether}可以重置所有天赋。这将全额退还所有使用的材料，让您自由重新分配。',
  },
  faqSubnodesTitle: {
    en: 'Should I max out a main node before unlocking sub-nodes?',
    jp: 'サブノードを解放する前にメインノードを最大にすべきですか？',
    kr: '서브 노드를 해금하기 전에 메인 노드를 최대로 올려야 하나요?',
    zh: '解锁子节点前需要将主节点升到满级吗？',
  },
  faqSubnodesP1: {
    en: 'No. Most main nodes should be upgraded to 5/10 — this unlocks all sub-nodes. Focus on sub-nodes early, as they usually offer better value per point.',
    jp: 'いいえ。ほとんどのメインノードは5/10までアップグレードすれば十分です。これで全てのサブノードが解放されます。サブノードは通常ポイント当たりの価値が高いため、序盤はサブノードに集中しましょう。',
    kr: '아니요. 대부분의 메인 노드는 5/10까지만 업그레이드하면 됩니다. 이렇게 하면 모든 서브 노드가 해금됩니다. 서브 노드는 보통 포인트당 가치가 높으므로 초반에는 서브 노드에 집중하세요.',
    zh: '不需要。大多数主节点升到5/10即可——这样就能解锁所有子节点。优先关注子节点，因为它们通常每点的价值更高。',
  },
  faqSubnodesP2: {
    en: 'The exception is the {ICON_AL} tree, which requires level 9 in the main node to unlock sub-nodes.',
    jp: '例外は{ICON_AL}ツリーで、サブノードを解放するにはメインノードをレベル9にする必要があります。',
    kr: '예외는 {ICON_AL} 트리로, 서브 노드를 해금하려면 메인 노드를 레벨 9까지 올려야 합니다.',
    zh: '{ICON_AL}树是例外，需要主节点达到9级才能解锁子节点。',
  },
  faqSkipTitle: {
    en: 'Are there any nodes I should skip?',
    jp: 'スキップすべきノードはありますか？',
    kr: '스킵해야 하는 노드가 있나요?',
    zh: '有需要跳过的节点吗？',
  },
  faqSkipIntro: {
    en: 'Yes. In early and mid-game, skip quirks related to:',
    jp: 'はい。序盤と中盤では、以下に関連するギフトをスキップしましょう：',
    kr: '네. 초반과 중반에는 다음과 관련된 기프트를 스킵하세요:',
    zh: '有的。在前中期，跳过以下相关天赋：',
  },
  faqSkipHealers: {
    en: '{C/Healer}',
  },
  faqSkipDefenders: {
    en: '{C/Defender}',
  },
  faqSkipTactician: {
    en: '{C/Ranger|Tactician} ({C/Ranger} subclass)',
    jp: '{C/Ranger|Tactician}（{C/Ranger}サブクラス）',
    kr: '{C/Ranger|Tactician} ({C/Ranger} 서브클래스)',
    zh: '{C/Ranger|Tactician}（{C/Ranger}子职业）',
  },
  faqSkipDmgRed: {
    en: '{S/DMG RED%} and {S/RES} effects',
    jp: '{S/DMG RED%}と{S/RES}効果',
    kr: '{S/DMG RED%}와 {S/RES} 효과',
    zh: '{S/DMG RED%}和{S/RES}效果',
  },
  faqMaterialsTitle: {
    en: 'What materials do I need to upgrade Quirks?',
    jp: 'ギフトのアップグレードにはどんな素材が必要ですか？',
    kr: '기프트 업그레이드에 어떤 재료가 필요한가요?',
    zh: '升级天赋需要什么材料？',
  },
  faqMaterialProofDestiny: {
    en: '{I-I/Proof of Destiny} — mainly obtained through Terminus Isle',
    jp: '{I-I/Proof of Destiny} — 主にテルミヌス島で入手',
    kr: '{I-I/Proof of Destiny} — 주로 종착지 섬에서 획득',
    zh: '{I-I/Proof of Destiny} — 主要通过终点岛获取',
  },
  faqMaterialTokenConnection: {
    en: '{I-I/Token of Connection} — mainly obtained through Terminus Isle',
    jp: '{I-I/Token of Connection} — 主にテルミヌス島で入手',
    kr: '{I-I/Token of Connection} — 주로 종착지 섬에서 획득',
    zh: '{I-I/Token of Connection} — 主要通过终点岛获取',
  },
  faqMaterialProofWorth: {
    en: '{I-I/Proof of Worth} — exclusively obtained from Adventure License shop',
    jp: '{I-I/Proof of Worth} — 冒険者ライセンスショップでのみ入手',
    kr: '{I-I/Proof of Worth} — 모험 라이선스 상점에서만 획득',
    zh: '{I-I/Proof of Worth} — 仅从冒险许可证商店获取',
  },
} as const;

/* ===================== Content Components ===================== */
interface QuirkGuideContentProps {
  lang: Lang;
}

export function CategoryOverviewSection({ lang }: QuirkGuideContentProps) {
  return (
    <ul className="list-inside ml-4 space-y-1">
      <li><InlineIcon icon={'/images/guides/general-guides/CM_Gift_Menu_05.webp'} label={lRec(TERMS.counteractStrongEnemies, lang)} size={40} />: {lRec(LABELS.catCounteract, lang)}</li>
      <li><InlineIcon icon={'/images/guides/general-guides/CM_Gift_Menu_03.webp'} label={lRec(TERMS.classEnhancement, lang)} size={40} />: {lRec(LABELS.catClass, lang)}</li>
      <li><InlineIcon icon={'/images/guides/general-guides/CM_Gift_Menu_01.webp'} label={lRec(TERMS.elementEnhancement, lang)} size={40} />: {lRec(LABELS.catElement, lang)}</li>
      <li><InlineIcon icon={'/images/guides/general-guides/CM_Gift_Menu_04.webp'} label={lRec(TERMS.utility, lang)} size={40} />: {lRec(LABELS.catUtility, lang)}</li>
      <li><InlineIcon icon={'/images/guides/general-guides/CM_Gift_Menu_06.webp'} label={lRec(TERMS.adventureLicense, lang)} size={40} />: {lRec(LABELS.catAdventure, lang)}</li>
    </ul>
  );
}

export function HowItWorksSection({ lang }: QuirkGuideContentProps) {
  return (
    <ul className="list-disc list-inside ml-4 space-y-1">
      <li>{lRec(LABELS.howP1, lang)}</li>
      <li>{parseWithIcons(lRec(LABELS.howP2, lang), lang)}</li>
      <li>{parseText(lRec(LABELS.howP3, lang))}</li>
      <li>{parseText(lRec(LABELS.howP4, lang))}</li>
    </ul>
  );
}

export function PrioritySection({ lang }: QuirkGuideContentProps) {
  return (
    <>
      <p>{parseWithIcons(lRec(LABELS.priorityP1, lang), lang)}</p>
      <p className="mt-2">{parseWithIcons(lRec(LABELS.priorityP2, lang), lang)}</p>
      <p className="mt-2">{parseWithIcons(lRec(LABELS.priorityP3, lang), lang)}</p>
      <p className="mt-2">{parseWithIcons(lRec(LABELS.priorityP4, lang), lang)}</p>
    </>
  );
}

export function EarlyGameExampleSection({ lang }: QuirkGuideContentProps) {
  return (
    <>
      <p>{parseText(lRec(LABELS.exampleIntro, lang))}</p>
      <ul className="list-disc list-inside ml-4 space-y-1">
        <li>{parseText(lRec(LABELS.exampleP1, lang))}</li>
        <li>{parseText(lRec(LABELS.exampleP2, lang))}</li>
        <li>{parseText(lRec(LABELS.exampleP3, lang))}</li>
      </ul>
      <p className="mt-2">{lRec(LABELS.exampleOutro, lang)}</p>
    </>
  );
}

export function FAQSection({ lang }: QuirkGuideContentProps) {
  return (
    <div className="space-y-4">
      <ContentCard>
        <h4>
          {lRec(LABELS.faqRespecTitle, lang)}
        </h4>
        <p>{parseText(lRec(LABELS.faqRespecContent, lang))}</p>
      </ContentCard>

      <ContentCard>
        <h4>
          {lRec(LABELS.faqSubnodesTitle, lang)}
        </h4>
        <p>{lRec(LABELS.faqSubnodesP1, lang)}</p>
        <p>{parseWithIcons(lRec(LABELS.faqSubnodesP2, lang), lang, 24)}</p>
      </ContentCard>

      <ContentCard>
        <h4>
          {lRec(LABELS.faqSkipTitle, lang)}
        </h4>
        <p>{lRec(LABELS.faqSkipIntro, lang)}</p>
        <ul className="list-disc list-inside ml-4">
          <li>{parseText(lRec(LABELS.faqSkipHealers, lang))}</li>
          <li>{parseText(lRec(LABELS.faqSkipDefenders, lang))}</li>
          <li>{parseText(lRec(LABELS.faqSkipTactician, lang))}</li>
          <li>{parseText(lRec(LABELS.faqSkipDmgRed, lang))}</li>
        </ul>
      </ContentCard>

      <ContentCard>
        <h4>
          {lRec(LABELS.faqMaterialsTitle, lang)}
        </h4>
        <ul className="list-disc list-inside ml-4">
          <li>{parseText(lRec(LABELS.faqMaterialProofDestiny, lang))}</li>
          <li>{parseText(lRec(LABELS.faqMaterialTokenConnection, lang))}</li>
          <li>{parseText(lRec(LABELS.faqMaterialProofWorth, lang))}</li>
        </ul>
      </ContentCard>
    </div>
  );
}
