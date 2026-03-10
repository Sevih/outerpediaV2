'use client';

import GuideTemplate from '@/app/components/guides/GuideTemplate';
import GuideSectionHeading from '@/app/components/guides/GuideSectionHeading';
import ContentCard from '@/app/components/guides/ContentCard';
import Callout from '@/app/components/guides/Callout';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { LangMap } from '@/types/common';
import parseText from '@/lib/parse-text';
import Link from 'next/link';
import CharacterInline from '@/app/components/inline/CharacterInline';
import EffectInline from '@/app/components/inline/EffectInline';
import SkillInline from '@/app/components/inline/SkillInline';
import InlineIcon from '@/app/components/inline/InlineIcon';

/* ── Helpers ────────────────────────────────────────────── */

import { StarBadge } from '@/app/components/ui/StarIcons';

/* ── Top-level LangMap constants ────────────────────────── */

const title: LangMap = {
  en: 'Frequently Asked Questions',
  jp: 'よくある質問',
  kr: '자주 묻는 질문',
  zh: '常见问题解答',
};

const intro: LangMap = {
  en: 'Common questions asked by new players, compiled from community discussions and veteran player advice.',
  jp: 'コミュニティでの議論やベテランプレイヤーのアドバイスをまとめた、新規プレイヤーからよく寄せられる質問集です。',
  kr: '커뮤니티 토론과 베테랑 플레이어 조언을 정리한, 신규 플레이어가 자주 묻는 질문 모음입니다.',
  zh: '整理自社区讨论和资深玩家建议的新手常见问题汇总。',
};

/* ── Inline LABELS ──────────────────────────────────────── */

const LABELS = {
  /* ═══ Section headings ═══ */
  sectionGettingStarted: { en: 'Getting Started', jp: 'はじめに', kr: '시작하기', zh: '入门指南' } satisfies LangMap,
  sectionHeroesPulling: { en: 'Heroes & Pulling', jp: 'ヒーロー＆ガチャ', kr: '영웅 & 모집', zh: '英雄与抽卡' } satisfies LangMap,
  sectionGearEquipment: { en: 'Gear & Equipment', jp: '装備＆エクイップメント', kr: '장비 & 이큅먼트', zh: '装备与器材' } satisfies LangMap,
  sectionProgressionResources: { en: 'Progression & Resources', jp: '進行＆リソース', kr: '진행 & 리소스', zh: '进度与资源' } satisfies LangMap,
  sectionAdvancedTips: { en: 'Advanced Tips', jp: '上級者向けTips', kr: '고급 팁', zh: '进阶技巧' } satisfies LangMap,
  sectionRelatedGuides: { en: 'Related Guides', jp: '関連ガイド', kr: '관련 가이드', zh: '相关指南' } satisfies LangMap,

  /* ═══ Getting Started ═══ */
  rerollImportance: { en: 'How important is rerolling?', jp: 'リセマラはどれくらい重要ですか？', kr: '리세마라는 얼마나 중요한가요?', zh: '刷初始有多重要？' } satisfies LangMap,
  rerollGettingA: { en: 'Getting a ', jp: '早い段階で', kr: '초반에 ', zh: '早期获得' } satisfies LangMap,
  premiumLimitedHero: { en: 'Premium/Limited hero', jp: 'プレミアム/限定ヒーロー', kr: '프리미엄/한정 영웅', zh: '精选/限定英雄' } satisfies LangMap,
  rerollNotRequired: { en: ' early helps, but is not required.', jp: 'を入手すると有利ですが、必須ではありません。', kr: '을 얻으면 도움이 되지만, 필수는 아닙니다.', zh: '会有帮助，但不是必须的。' } satisfies LangMap,
  thePrefix: { en: 'The ', jp: '', kr: '', zh: '' } satisfies LangMap,
  freeHeroesLink: { en: 'heroes you get for free', jp: '無料で入手できるヒーロー', kr: '무료로 얻을 수 있는 영웅', zh: '免费获得的英雄' } satisfies LangMap,
  solidFoundation: { en: ' are a solid foundation to start off with.', jp: 'だけでも、序盤を進めるには十分な戦力になります。', kr: '만으로도 초반 진행에 충분한 전력이 됩니다.', zh: '足以作为良好的起步基础。' } satisfies LangMap,
  doppelgangerFarm: { en: 'Aside from Recruiting, you can farm regular heroes you don\'t have in the Doppelgänger Challenge too, given enough time (8 days each after completing their Side Story).', jp: 'ガチャ以外にも、ドッペルゲンガーチャレンジで一般ヒーローを獲得できます（サイドストーリークリア後、各キャラ8日かかります）。', kr: '모집 외에도 도플갱어 챌린지에서 일반 영웅을 획득할 수 있습니다 (사이드 스토리 클리어 후 각 캐릭터당 8일 소요).', zh: '除了招募之外，你还可以在分身挑战中获得普通英雄（完成支线故事后，每个角色需要8天）。' } satisfies LangMap,

  /* ═══ Heroes & Pulling ═══ */
  whoPullFor: { en: 'Who do I pull for?', jp: '誰を引くべきですか？', kr: '누구를 뽑아야 하나요?', zh: '应该抽谁？' } satisfies LangMap,
  wideRangeHeroes: { en: 'Outerplane aims to use a wide range of heroes, rather than focusing on a small core group, so the goal is to have most heroes available.', jp: 'Outerplaneは少数の主力キャラに集中するよりも、幅広いヒーローを使うゲームです。最終的にはほとんどのヒーローを揃えることが目標になります。', kr: 'Outerplane은 소수의 핵심 캐릭터에 집중하기보다 다양한 영웅을 사용하는 게임입니다. 최종 목표는 대부분의 영웅을 보유하는 것입니다.', zh: 'Outerplane的目标是使用多种英雄，而不是专注于少数核心角色，所以最终目标是拥有大部分英雄。' } satisfies LangMap,
  limited: { en: 'Limited', jp: '限定', kr: '한정', zh: '限定' } satisfies LangMap,
  limitedDesc: { en: '{I-I/Free Ether} goes to Limited heroes (Seasonal, Festival, Collab banners) as a priority. They don\'t necessarily stand above other heroes, but they are only available during their banner and can make certain fights easier. Collect at least at 3-star when their banner is up.', jp: '{I-I/Free Ether}は限定ヒーロー（シーズン、フェスティバル、コラボバナー）を優先的に使用します。他のヒーローより必ずしも強いわけではありませんが、バナー期間中のみ入手可能で、特定のコンテンツを楽にクリアできます。バナー開催中に最低でも3つ星で確保しましょう。', kr: '{I-I/Free Ether}는 한정 영웅(시즌, 페스티벌, 콜라보 배너)에 우선적으로 사용합니다. 다른 영웅보다 반드시 강하지는 않지만, 배너 기간에만 획득 가능하며 특정 컨텐츠를 더 쉽게 클리어할 수 있습니다. 배너 진행 중 최소 3성으로 확보하세요.', zh: '{I-I/Free Ether}优先用于限定英雄（季节、节日、联动卡池）。他们不一定比其他英雄强，但只能在卡池期间获得，可以让某些战斗更轻松。在卡池期间至少确保3星。' } satisfies LangMap,
  premium: { en: 'Premium', jp: 'プレミアム', kr: '프리미엄', zh: '精选' } satisfies LangMap,
  premiumBannerDesc: { en: 'The Premium banner lets you change your rate up target at any time. Our recommended order is listed in the ', jp: 'プレミアムバナーではいつでもピックアップ対象を変更できます。推奨順序は', kr: '프리미엄 배너에서는 언제든지 픽업 대상을 변경할 수 있습니다. 추천 순서는 ', zh: '精选卡池可以随时更换UP目标。推荐顺序请参阅' } satisfies LangMap,
  dedicatedGuide: { en: 'dedicated guide', jp: '専用ガイド', kr: '전용 가이드', zh: '专用指南' } satisfies LangMap,
  periodSeeGuide: { en: '.', jp: 'をご覧ください。', kr: '를 참고하세요.', zh: '。' } satisfies LangMap,
  regular: { en: 'Regular', jp: '一般', kr: '일반', zh: '常规' } satisfies LangMap,
  regularHeroesDesc: { en: 'For Regular heroes in Rate Up Recruit and Custom Recruit we recommend only using {I-I/Special Recruitment Ticket} {I-I/Special Recruitment Ticket (Event)}.', jp: 'ピックアップ募集とカスタム募集の一般ヒーローには、{I-I/Special Recruitment Ticket} {I-I/Special Recruitment Ticket (Event)}のみを使用することをおすすめします。', kr: '픽업 모집과 커스텀 모집의 일반 영웅에는 {I-I/Special Recruitment Ticket} {I-I/Special Recruitment Ticket (Event)}만 사용하는 것을 권장합니다.', zh: '对于UP招募和定向招募的常规英雄，建议只使用{I-I/Special Recruitment Ticket} {I-I/Special Recruitment Ticket (Event)}。' } satisfies LangMap,
  customRecruitGoal: { en: 'The first goal in Custom Recruit when starting out is a hero that gives ', jp: 'カスタム募集での最初の目標は、', kr: '커스텀 모집에서의 첫 번째 목표는 ', zh: '定向招募的首要目标是能提供' } satisfies LangMap,
  critBuff: { en: ' buff.', jp: 'バフを付与できるヒーローです。', kr: ' 버프를 부여하는 영웅입니다.', zh: '增益的英雄。' } satisfies LangMap,

  /* Should I pull for dupes? */
  pullForDupes: { en: 'Should I pull for dupes?', jp: '重ね引きするべきですか？', kr: '중복으로 뽑아야 하나요?', zh: '需要抽重复吗？' } satisfies LangMap,
  regularHeroesFarm: { en: 'Regular heroes can be farmed in the Doppelgänger Challenge, so pulling multiple copies is not required. Unlocking a 3-star hero without recruiting them takes 250 hero pieces, transcending takes 150 per step(*). So recruiting regular heroes while farming for their transcends in Doppelgänger is slightly more efficient. New heroes take 3 months to get added to Doppelgänger and Custom Recruit.', jp: '一般ヒーローはドッペルゲンガーチャレンジで獲得できるため、複数回引く必要はありません。3つ星ヒーローを募集せずに解放するには250ピース、超越には1段階ごとに150ピース(*)が必要です。そのため、一般ヒーローを募集しつつドッペルゲンガーで超越素材を集めるのが若干効率的です。新ヒーローがドッペルゲンガーとカスタム募集に追加されるまで3ヶ月かかります。', kr: '일반 영웅은 도플갱어 챌린지에서 획득할 수 있으므로 여러 번 뽑을 필요가 없습니다. 모집 없이 3성 영웅을 해금하려면 250피스, 초월에는 단계당 150피스(*)가 필요합니다. 따라서 일반 영웅을 모집하면서 도플갱어에서 초월 재료를 모으는 것이 약간 더 효율적입니다. 신규 영웅이 도플갱어와 커스텀 모집에 추가되기까지 3개월이 걸립니다.', zh: '常规英雄可以在分身挑战中获得，所以不需要抽多份。不招募解锁3星英雄需要250碎片，超越每阶段需要150碎片(*)。因此招募常规英雄同时在分身挑战中刷超越材料效率略高。新英雄需要3个月才会加入分身挑战和定向招募。' } satisfies LangMap,
  transcendSteps: { en: '(*) Transcend Steps being 4*, 4+, 5*, 5+, 5++, 6* for 900 total pieces required.', jp: '(*) 超越段階：4星、4+、5星、5+、5++、6星で合計900ピース必要。', kr: '(*) 초월 단계: 4성, 4+, 5성, 5+, 5++, 6성으로 총 900피스 필요.', zh: '(*) 超越阶段：4星、4+、5星、5+、5++、6星，共需900碎片。' } satisfies LangMap,
  star4WeaknessGauge: { en: ' — for the increased Weakness Gauge Damage is the main target.', jp: ' — 弱点ゲージダメージ増加が主な目標。', kr: ' — 약점 게이지 데미지 증가가 주요 목표.', zh: ' — 弱点槽伤害增加是主要目标。' } satisfies LangMap,
  star5Burst3: { en: ' — if they have an interesting burst 3 effect.', jp: ' — 興味深いバースト3効果がある場合。', kr: ' — 흥미로운 버스트 3 효과가 있는 경우.', zh: ' — 如果有有趣的爆发3效果。' } satisfies LangMap,
  star6NotPriority: { en: ' — is usually not a priority for regular heroes, since it only grants a stat bonus and 25 AP at battle start.', jp: ' — 一般ヒーローでは通常優先度が低いです。ステータスボーナスと戦闘開始時25APのみ。', kr: ' — 일반 영웅에서는 보통 우선순위가 낮습니다. 스탯 보너스와 전투 시작 시 25AP만 제공.', zh: ' — 常规英雄通常优先级不高，只提供属性加成和战斗开始时25AP。' } satisfies LangMap,
  andKwa: { en: ' and ', jp: 'と', kr: '과 ', zh: '和' } satisfies LangMap,
  premiumLimitedTranscend: { en: ' heroes transcend primarily via dupes, so these may need multiple copies. How many depends on their individual kits, they generally already work at 3-star. An evaluation of each hero and their transcends is found ', jp: 'ヒーローは主に重ね引きで超越するため、複数回引く必要があるかもしれません。必要な枚数は個々のキットによりますが、基本的に3つ星でも十分機能します。各ヒーローの評価と超越については', kr: ' 영웅은 주로 중복으로 초월하므로 여러 번 뽑아야 할 수 있습니다. 필요한 수량은 개별 키트에 따라 다르지만, 기본적으로 3성에서도 충분히 작동합니다. 각 영웅 평가와 초월에 대해서는 ', zh: '英雄主要通过重复抽取超越，所以可能需要多份。需要多少取决于各自的技能组，但基本上3星就能正常运作。各英雄评价和超越详情请参阅' } satisfies LangMap,
  here: { en: 'here', jp: 'こちら', kr: '여기', zh: '这里' } satisfies LangMap,

  /* What team do I start with? */
  whatTeam: { en: 'What team do I start with?', jp: '最初のチームは何がいいですか？', kr: '처음 팀은 어떻게 구성하나요?', zh: '初始队伍怎么搭配？' } satisfies LangMap,
  standardTeam: { en: 'A standard team for Story is a main damage dealer, a crit chance buffer, a Healer and a flexible spot for a debuffer, second damage dealer or buffer, or a Defender. Defenders are not required in most of the story, Healers or Bruisers can handle it.', jp: 'ストーリー用の基本チームは、メインアタッカー、クリティカル率バッファー、ヒーラー、そして自由枠（デバッファー、サブアタッカー、バッファー、またはディフェンダー）です。ストーリーのほとんどでディフェンダーは必須ではなく、ヒーラーやブルーザーで対応できます。', kr: '스토리용 기본 팀은 메인 딜러, 치명타 확률 버퍼, 힐러, 그리고 자유 슬롯(디버퍼, 서브 딜러, 버퍼 또는 디펜더)입니다. 스토리 대부분에서 디펜더는 필수가 아니며, 힐러나 브루저로 대응할 수 있습니다.', zh: '故事模式的标准队伍是主力输出、暴击率增益角色、奶妈，以及自由位（减益角色、副输出、增益角色或坦克）。大部分故事不需要坦克，奶妈或战士型角色就能应付。' } satisfies LangMap,
  dpsFromStartDash: { en: 'DPS (from Start Dash banner)', jp: 'DPS（スタートダッシュバナーから）', kr: 'DPS (스타트 대시 배너에서)', zh: 'DPS（来自新手冲刺卡池）' } satisfies LangMap,
  critBuffFromCustom: { en: 'Crit Buff (from Custom Recruit banner)', jp: 'クリティカルバフ（カスタム募集バナーから）', kr: '치명타 버프 (커스텀 모집 배너에서)', zh: '暴击增益（来自定向招募卡池）' } satisfies LangMap,
  healers: { en: 'Healers', jp: 'ヒーラー', kr: '힐러', zh: '奶妈' } satisfies LangMap,
  youGet: { en: 'You get ', jp: '', kr: '', zh: '' } satisfies LangMap,
  meneForFree: { en: ' for free and can choose between ', jp: 'は無料で入手でき、後から', kr: '는 무료로 획득할 수 있고, 나중에 ', zh: '免费获得，之后可以在' } satisfies LangMap,
  andWa: { en: ' and ', jp: 'と', kr: '와 ', zh: '和' } satisfies LangMap,
  laterWith: { en: ' later, with ', jp: 'のどちらかを選べます。', kr: ' 중 하나를 선택할 수 있습니다. ', zh: '中选择一个。' } satisfies LangMap,
  monadEvaRecommended: { en: ' also being highly recommended from Premium banner due to her unconditional ', jp: 'も無条件の', kr: '도 무조건적인 ', zh: '因为有无条件的' } satisfies LangMap,
  monadEvaPeriod: { en: '.', jp: 'があるため、プレミアムバナーからのおすすめです。', kr: '이 있어 프리미엄 배너에서 추천합니다.', zh: '，也推荐从精选卡池获取。' } satisfies LangMap,
  flexSupport: { en: 'Flex/Support', jp: 'フレックス/サポート', kr: '플렉스/서포트', zh: '自由位/辅助' } satisfies LangMap,
  orAnotherHero: { en: ' or another hero you picked up along the way.', jp: 'や、途中で入手した他のヒーロー。', kr: ' 또는 진행 중 획득한 다른 영웅.', zh: '或途中获得的其他英雄。' } satisfies LangMap,
  firstBossPriorities: { en: 'First boss priorities are:', jp: '最初のボス優先順位：', kr: '첫 보스 우선순위:', zh: '首要BOSS优先级：' } satisfies LangMap,
  unidentifiedChimera: { en: 'Unidentified Chimera', jp: '正体不明のキメラ', kr: '정체불명의 키메라', zh: '不明嵌合体' } satisfies LangMap,
  chimeraArmorSets: { en: 'for armor set like {S/SPD} and {S/CHD}.', jp: '：{S/SPD}や{S/CHD}などの防具セット。', kr: ': {S/SPD}와 {S/CHD} 등의 방어구 세트.', zh: '：{S/SPD}和{S/CHD}等防具套装。' } satisfies LangMap,
  glicys: { en: 'Glicys', jp: 'グリシス', kr: '글리시스', zh: '格利西斯' } satisfies LangMap,
  and: { en: 'and', jp: 'と', kr: '와', zh: '和' } satisfies LangMap,
  blazingKnightMeteos: { en: 'Blazing Knight Meteos', jp: '炎の騎士メテオス', kr: '화염의 기사 메테오스', zh: '炎之骑士梅特奥斯' } satisfies LangMap,
  forWeaponsAccessories: { en: 'for weapons/accessories.', jp: '：武器/アクセサリー。', kr: ': 무기/액세서리.', zh: '：武器/饰品。' } satisfies LangMap,
  earthFireTeam: { en: 'A party that focuses on {E/Earth} & {E/Fire} heroes would be beneficial as a first team to work on. The long term goal is having teams in each element, but focus on building one team at a time. Having one strong team ready speeds up upgrading your next one.', jp: '{E/Earth}と{E/Fire}ヒーローに集中したパーティが最初に育成するチームとしておすすめです。長期目標は各属性のチームを持つことですが、一度に1チームずつ育成に集中しましょう。1つの強いチームを完成させることで、次のチームの育成が加速します。', kr: '{E/Earth}와 {E/Fire} 영웅에 집중한 파티가 첫 번째로 육성할 팀으로 좋습니다. 장기 목표는 각 속성의 팀을 보유하는 것이지만, 한 번에 하나의 팀에 집중하세요. 하나의 강한 팀을 완성하면 다음 팀 육성이 빨라집니다.', zh: '专注于{E/Earth}和{E/Fire}英雄的队伍适合作为第一支培养的队伍。长期目标是拥有各属性的队伍，但一次专注培养一支队伍。完成一支强力队伍会加速下一支队伍的培养。' } satisfies LangMap,
  tip: { en: 'Tip:', jp: 'ヒント：', kr: '팁:', zh: '提示：' } satisfies LangMap,
  friendSupportTip: { en: 'You can use friends\' support heroes up to stage 10, so this is not a strict requirement.', jp: 'ステージ10までフレンドのサポートヒーローを使えるので、これは厳密な要件ではありません。', kr: '스테이지 10까지 친구의 서포트 영웅을 사용할 수 있으므로, 이것은 엄격한 요구 사항이 아닙니다.', zh: '第10关之前可以使用好友的支援英雄，所以这不是严格要求。' } satisfies LangMap,

  /* ═══ Where do I go first? ═══ */
  whereGoFirst: { en: 'Where do I go first?', jp: '最初にどこに行くべきですか？', kr: '처음에 어디로 가야 하나요?', zh: '首先应该去哪里？' } satisfies LangMap,
  evaGuideQuests: { en: 'Eva\'s Guide Quests in game will point you around the various gamemodes while clearing Story.', jp: 'ゲーム内のエヴァのガイドクエストがストーリーをクリアしながら様々なゲームモードを案内してくれます。', kr: '게임 내 에바의 가이드 퀘스트가 스토리를 클리어하면서 다양한 게임 모드를 안내해 줍니다.', zh: '游戏内的艾娃引导任务会在推进故事的同时引导你了解各种游戏模式。' } satisfies LangMap,
  underChallenges: { en: 'Under Challenges, the ', jp: 'チャレンジの', kr: '챌린지의 ', zh: '在挑战的' } satisfies LangMap,
  specialRequests: { en: 'Special Requests', jp: 'スペシャルリクエスト', kr: '스페셜 리퀘스트', zh: '特别委托' } satisfies LangMap,
  specialRequestsDesc: { en: ' will let you unlock a strong starter pack of 6 heroes, along with gear and upgrade materials for them.', jp: 'で、強力なスターターパックとして6体のヒーロー、装備、強化素材を解放できます。', kr: '에서 강력한 스타터 팩으로 6명의 영웅, 장비, 강화 재료를 해금할 수 있습니다.', zh: '中，可以解锁强力新手包：6名英雄、装备和升级材料。' } satisfies LangMap,
  experienceSlow: { en: 'Experience is slow at the start, progress through the Bandit Chase stages to get more food daily.', jp: '序盤は経験値獲得が遅いです。バンディットチェイスのステージを進めて、毎日より多くの食糧を獲得しましょう。', kr: '초반에는 경험치 획득이 느립니다. 밴디트 체이스 스테이지를 진행해서 매일 더 많은 식량을 획득하세요.', zh: '初期经验获取较慢。推进悬赏追击关卡来每天获得更多食物。' } satisfies LangMap,
  skywardTower: { en: 'Skyward Tower', jp: '昇天の塔', kr: '승천의 탑', zh: '升天之塔' } satisfies LangMap,
  skywardTowerResets: { en: ' resets monthly, try to get as high as you can.', jp: 'は毎月リセットされます。できるだけ高い階層を目指しましょう。', kr: '은 매월 리셋됩니다. 최대한 높은 층까지 올라가세요.', zh: '每月重置，尽可能爬到更高层。' } satisfies LangMap,

  /* ═══ Gear & Equipment ═══ */
  howGetGear: { en: 'How do I get gear?', jp: '装備はどうやって入手しますか？', kr: '장비는 어떻게 얻나요?', zh: '如何获得装备？' } satisfies LangMap,
  gearSourceDesc: { en: 'Eva\'s Guide Quests and Skyward Tower will sort this out while levelling, along with the Challenge! Special Request missions\' 6-star legendary gear. When enough Survey Hub or Arena currency is available, these can also offer solid 6-star gear. Farming for gear isn\'t a big focus until you have cleared Stage 10 on the Special Request bosses, so they can only drop 6-star gear.', jp: 'エヴァのガイドクエストと昇天の塔がレベリング中の装備を提供してくれます。また、チャレンジ！スペシャルリクエストミッションの6つ星レジェンダリー装備も入手できます。十分なサーベイハブやアリーナの通貨が貯まったら、これらも良い6つ星装備を提供してくれます。装備ファームは、スペシャルリクエストボスのステージ10をクリアして6つ星装備のみがドロップするようになるまでは、大きな焦点ではありません。', kr: '에바의 가이드 퀘스트와 승천의 탑이 레벨링 중 장비를 제공합니다. 또한 챌린지! 스페셜 리퀘스트 미션의 6성 레전더리 장비도 얻을 수 있습니다. 충분한 서베이 허브나 아레나 화폐가 모이면 이곳에서도 좋은 6성 장비를 얻을 수 있습니다. 장비 파밍은 스페셜 리퀘스트 보스의 스테이지 10을 클리어해서 6성 장비만 드롭되기 전까지는 큰 초점이 아닙니다.', zh: '艾娃引导任务和升天之塔会在升级过程中提供装备，还有挑战！特别委托任务的6星传说装备。当积累足够的调查站或竞技场货币时，也能获得不错的6星装备。在特别委托BOSS的第10关通关、只掉落6星装备之前，装备刷取不是主要重点。' } satisfies LangMap,
  armorPriority: { en: 'Armor Priority', jp: '防具優先', kr: '방어구 우선', zh: '防具优先' } satisfies LangMap,
  chimeraArmorDesc: { en: 'is the first focus for armor, as her sets, Speed, Counterattack, Critical Strike, Fortification offer something for any role. Penetration set from Sacreed Guardian would be stronger for damage dealers, but this boss doesn\'t offer sets that are generally useful for other roles.', jp: 'が防具の最初のターゲットです。速度、反撃、クリティカル、鉄壁セットはどの役割にも使えます。聖なる守護者の貫通セットはアタッカーにより強力ですが、このボスは他の役割に汎用的に使えるセットを提供しません。', kr: '가 방어구의 첫 타겟입니다. 속도, 반격, 치명타, 개전 방벽 세트는 어떤 역할에도 사용할 수 있습니다. 성스러운 수호자의 관통 세트가 딜러에게 더 강력하지만, 이 보스는 다른 역할에 범용적으로 사용할 수 있는 세트를 제공하지 않습니다.', zh: '是防具的首要目标。速度、反击、暴击、开战防壁套装适用于任何职业。神圣守护者的穿透套装对输出更强，但这个BOSS不提供对其他职业通用的套装。' } satisfies LangMap,
  weaponsAccessories: { en: 'Weapons/Accessories', jp: '武器/アクセサリー', kr: '무기/액세서리', zh: '武器/饰品' } satisfies LangMap,
  weaponAccessorySkills: { en: 'Weapon and accessory skills depend on the boss, and each boss can only drop accessories with certain main stats.', jp: '武器とアクセサリーのスキルはボスによって異なり、各ボスは特定のメインステータスのアクセサリーのみをドロップします。', kr: '무기와 액세서리 스킬은 보스에 따라 다르며, 각 보스는 특정 메인 스탯의 액세서리만 드롭합니다.', zh: '武器和饰品技能取决于BOSS，每个BOSS只掉落特定主属性的饰品。' } satisfies LangMap,
  glicysAccessoryDesc: { en: 'offers accessories with Speed and Crit Chance main stats (also Defense & Resilience), making her the prime target for Weapons and Accessories to start off with.', jp: 'は速度とクリティカル率メインステータス（また防御と抵抗も）のアクセサリーを提供するため、武器とアクセサリーの最初のターゲットとして最適です。', kr: '는 속도와 치명타 확률 메인 스탯 (또한 방어와 저항도) 액세서리를 제공하여, 무기와 액세서리의 첫 타겟으로 최적입니다.', zh: '提供速度和暴击率主属性（还有防御和抵抗）的饰品，是武器和饰品的首选目标。' } satisfies LangMap,
  meteos: { en: 'Meteos', jp: 'メテオス', kr: '메테오스', zh: '梅特奥斯' } satisfies LangMap,
  meteosAccessoryDesc: { en: 'is the easy next target, with Penetration, Crit Damage, Health and Effectiveness accessory main stat options. Veronica can solo him at stage 10.', jp: 'は次の簡単なターゲットで、貫通、クリティカルダメージ、体力、効果命中のアクセサリーメインステータスを提供します。Veronicaでステージ10をソロできます。', kr: '는 다음 쉬운 타겟으로, 관통, 치명타 피해, 체력, 효과 적중 액세서리 메인 스탯을 제공합니다. Veronica로 스테이지 10을 솔로할 수 있습니다.', zh: '是下一个简单目标，提供穿透、暴击伤害、生命、效果命中的饰品主属性。Veronica可以单刷第10关。' } satisfies LangMap,

  /* EE & Talismans */
  howGetEETalismans: { en: 'How do I get Exclusive Equipment & Talismans?', jp: '専用装備＆タリスマンはどうやって入手しますか？', kr: '전용 장비 & 탈리스만은 어떻게 얻나요?', zh: '如何获得专属装备和护符？' } satisfies LangMap,
  exclusiveEquipment: { en: 'Exclusive Equipment', jp: '専用装備', kr: '전용 장비', zh: '专属装备' } satisfies LangMap,
  exclusiveEquipmentDesc: { en: 'Heroes\' Exclusive Equipment is gained by reaching Affinity level 10. Gifts can be obtained via the Black Market Expedition in the base, and farmed in Story boss stages marked by a daily entry limit. Irregular Extermination Project: Pursuit Operations also give gifts when clearing bosses. You can get an Oath of Determination to instant max out Affinity via certain events.', jp: 'ヒーローの専用装備は信頼度レベル10で入手できます。ギフトは基地のブラックマーケット探検で入手でき、デイリー入場制限のあるストーリーボスステージでファームできます。イレギュラー殲滅作戦：追跡オペレーションでもボスクリア時にギフトが手に入ります。特定のイベントで誓いの決意を入手して、信頼度を即座に最大にすることもできます。', kr: '영웅의 전용 장비는 신뢰도 레벨 10에서 획득합니다. 선물은 기지의 블랙마켓 탐험에서 얻을 수 있고, 일일 입장 제한이 있는 스토리 보스 스테이지에서 파밍할 수 있습니다. 이레귤러 섬멸 작전: 추적 오퍼레이션에서도 보스 클리어 시 선물을 얻을 수 있습니다. 특정 이벤트에서 맹세의 결의를 얻어 신뢰도를 즉시 최대로 올릴 수도 있습니다.', zh: '英雄的专属装备在信赖度10级时获得。礼物可以从基地的黑市探险获得，也可以在有每日入场限制的故事BOSS关卡刷取。异常歼灭作战：追击行动中击败BOSS也能获得礼物。某些活动可以获得誓约决心，立即将信赖度提升到满级。' } satisfies LangMap,
  talismansAndCharms: { en: 'Talismans and Charms', jp: 'タリスマンとチャーム', kr: '탈리스만과 참', zh: '护符和符咒' } satisfies LangMap,
  talismansDesc: { en: 'The Archdemon\'s Ruins\' Infinite Corridor is the primary source for Talismans. The Archdemon\'s Ruins Shop offers one 6-star selector per month. You also get a few from the Challenge! Special Request missions.', jp: 'アークデーモンの遺跡の無限回廊がタリスマンの主な入手源です。アークデーモンの遺跡ショップでは毎月1つの6つ星セレクターを提供しています。チャレンジ！スペシャルリクエストミッションからもいくつか入手できます。', kr: '아크데몬의 유적의 무한 회랑이 탈리스만의 주요 획득처입니다. 아크데몬의 유적 상점에서는 매월 6성 셀렉터 1개를 제공합니다. 챌린지! 스페셜 리퀘스트 미션에서도 몇 개를 얻을 수 있습니다.', zh: '大恶魔遗迹的无限回廊是护符的主要来源。大恶魔遗迹商店每月提供一个6星选择器。挑战！特别委托任务也能获得一些。' } satisfies LangMap,

  /* Gear worth keeping */
  gearWorthKeeping: { en: 'What gear is worth keeping?', jp: 'どの装備を残すべきですか？', kr: '어떤 장비를 남겨야 하나요?', zh: '哪些装备值得保留？' } satisfies LangMap,
  dontThrowBlues: { en: 'Don\'t throw those blues!', jp: '注意：青装備を捨てないで！', kr: '주의: 파란 장비를 버리지 마세요!', zh: '注意：不要扔掉蓝色装备！' } satisfies LangMap,
  epicGearStaple: { en: 'Epic gear is the staple, not far behind Legendary and cheaper to upgrade. Once you get to 6-star gear (shouldn\'t take too long especially with friend supports), it\'ll be easy for reforged Epic gear to overtake 5-star Legendary gear, or even 6-star legendary with lower substat rolls. Green/Superior gear takes a bigger hit on its main stat, but for Helmet/Armor/Boots these can still turn out well when the substats are strong.', jp: 'エピック装備は基本であり、レジェンダリーとそれほど差がなく、強化コストも安いです。6つ星装備を入手したら（フレンドサポートを使えばすぐです）、錬成したエピック装備は5つ星レジェンダリーや、サブステータスの低い6つ星レジェンダリーを簡単に上回ります。緑/スーペリア装備はメインステータスが低くなりますが、ヘルメット/アーマー/ブーツではサブステータスが強ければ良い結果になることがあります。', kr: '에픽 장비가 기본이며, 레전더리와 큰 차이가 없고 강화 비용도 저렴합니다. 6성 장비를 얻으면 (친구 서포트를 사용하면 금방입니다), 재련한 에픽 장비가 5성 레전더리나 서브 스탯이 낮은 6성 레전더리를 쉽게 능가합니다. 그린/슈페리어 장비는 메인 스탯이 낮아지지만, 헬멧/아머/부츠에서는 서브 스탯이 강하면 좋은 결과가 나올 수 있습니다.', zh: '史诗装备是基础，与传说装备差距不大，升级成本也更低。获得6星装备后（使用好友支援很快），重铸的史诗装备可以轻松超越5星传说装备，甚至副属性较低的6星传说装备。绿色/优秀装备主属性会降低，但头盔/护甲/鞋子在副属性强的情况下也能有好结果。' } satisfies LangMap,
  gearReforge: { en: 'Gear can be reforged as many times as it has stars, which unlocks new substats until there are 4, then randomly increases one by one steps. The maximum total substats are:', jp: '装備は星の数だけ錬成でき、4つのサブステータスが揃うまで新しいサブステータスを解放し、その後はランダムに1つずつ上昇します。最大サブステータス合計は：', kr: '장비는 별 개수만큼 재련할 수 있으며, 4개의 서브 스탯이 채워질 때까지 새로운 서브 스탯을 해금하고, 그 후에는 랜덤으로 하나씩 증가합니다. 최대 서브 스탯 합계는:', zh: '装备可以重铸星数次，在4个副属性填满之前解锁新副属性，之后随机提升其中一个。最大副属性总计：' } satisfies LangMap,
  sixStarLegendary: { en: '6★ Legendary', jp: '6★ レジェンダリー', kr: '6★ 레전더리', zh: '6★ 传说' } satisfies LangMap,
  eighteenTicks: { en: '18 ticks', jp: '18ティック', kr: '18틱', zh: '18档' } satisfies LangMap,
  sixStarEpic: { en: '6★ Epic', jp: '6★ エピック', kr: '6★ 에픽', zh: '6★ 史诗' } satisfies LangMap,
  seventeenTicks: { en: '17 ticks', jp: '17ティック', kr: '17틱', zh: '17档' } satisfies LangMap,
  sixStarSuperior: { en: '6★ Superior', jp: '6★ スーペリア', kr: '6★ 슈페리어', zh: '6★ 优秀' } satisfies LangMap,
  sixteenTicks: { en: '16 ticks', jp: '16ティック', kr: '16틱', zh: '16档' } satisfies LangMap,
  gearRarityMeaning: { en: 'Meaning for armor, where the main stat is usually not going to make or break the fight, the rarity of the gear is not important. Weapons, Accessories and Gloves you would aim for the higher rarities, as the main stat here does matter. Legendary Weapons & Accessories also come with skills. When it drops, the substats can have up to 3 ticks worth before reforging, out of 6 maximum. This isn\'t common enough to make it the basic requirement, as long as most of the substats are right you can make use of them. Increase the standards for gear to keep or use as materials as your account grows.', jp: 'つまり防具では、メインステータスが戦闘を左右することは少ないため、レアリティはそれほど重要ではありません。武器、アクセサリー、グローブはメインステータスが重要なので、より高いレアリティを狙いましょう。レジェンダリーの武器とアクセサリーにはスキルも付きます。ドロップ時、サブステータスは錬成前に最大6のうち3ティック分を持つことができます。これは基本要件にするほど一般的ではないので、ほとんどのサブステータスが合っていれば活用できます。アカウントが成長するにつれて、残す装備や素材にする装備の基準を上げていきましょう。', kr: '즉, 방어구에서는 메인 스탯이 전투를 좌우하는 경우가 적으므로 레어리티가 그다지 중요하지 않습니다. 무기, 액세서리, 장갑은 메인 스탯이 중요하므로 더 높은 레어리티를 노리세요. 레전더리 무기와 액세서리에는 스킬도 붙습니다. 드롭 시 서브 스탯은 재련 전 최대 6 중 3틱을 가질 수 있습니다. 이것은 기본 요구 사항으로 삼을 만큼 흔하지 않으므로, 대부분의 서브 스탯이 맞으면 활용할 수 있습니다. 계정이 성장함에 따라 남길 장비와 재료로 쓸 장비의 기준을 높여가세요.', zh: '也就是说，防具的主属性通常不会决定战斗胜负，所以稀有度不那么重要。武器、饰品、手套的主属性很重要，应该追求更高稀有度。传说武器和饰品还带有技能。掉落时副属性最多可以有3档（满6档），在重铸前。这不够常见到成为基本要求，只要大部分副属性合适就可以使用。随着账号成长，逐步提高保留装备和用作材料的装备标准。' } satisfies LangMap,

  /* When should I start upgrading gear? */
  whenUpgradeGear: { en: 'When should I start upgrading gear?', jp: 'いつ装備を強化し始めるべきですか？', kr: '언제 장비 강화를 시작해야 하나요?', zh: '什么时候开始强化装备？' } satisfies LangMap,
  enhancingWeapons: { en: 'Enhancing Weapons', jp: '武器の強化', kr: '무기 강화', zh: '武器强化' } satisfies LangMap,
  enhancingWeaponsDesc: { en: 'will speed up the early game a lot, this is one you can start doing as soon as you notice progress slowing down.', jp: 'は序盤を大幅に加速します。進行が遅くなったと感じたらすぐに始められます。', kr: '는 초반을 크게 가속합니다. 진행이 느려졌다고 느끼면 바로 시작할 수 있습니다.', zh: '会大大加速前期进度。感觉进度变慢时就可以开始。' } satisfies LangMap,
  accessories: { en: 'Accessories', jp: 'アクセサリー', kr: '액세서리', zh: '饰品' } satisfies LangMap,
  accessoriesCritDesc: { en: 'with crit chance main stat for your damage dealer are the next target to enhance.', jp: 'のアタッカー用のクリティカル率メインステータスが次の強化対象です。', kr: '의 딜러용 치명타 확률 메인 스탯이 다음 강화 대상입니다.', zh: '中输出角色用的暴击率主属性是下一个强化目标。' } satisfies LangMap,
  armor: { en: 'Armor', jp: '防具', kr: '방어구', zh: '防具' } satisfies LangMap,
  armorLaterChapters: { en: 'won\'t need enhancements until you\'re in the later chapters of season 1 (and then +5 should be fine for a while).', jp: 'はシーズン1の後半チャプターまで強化の必要はありません（その後も+5でしばらく十分です）。', kr: '는 시즌 1 후반 챕터까지 강화할 필요가 없습니다 (이후에도 +5면 한동안 충분합니다).', zh: '在第一季后半章节之前不需要强化（之后+5也能用很久）。' } satisfies LangMap,
  reforgeBreakthrough: { en: 'Reforge/Breakthrough', jp: '錬成/限界突破', kr: '재련/한계돌파', zh: '重铸/突破' } satisfies LangMap,
  reforgeNotImportant: { en: 'systems don\'t become important until you have 6-star gear.', jp: 'システムは6つ星装備を入手するまで重要ではありません。', kr: ' 시스템은 6성 장비를 얻을 때까지 중요하지 않습니다.', zh: '系统在获得6星装备之前不重要。' } satisfies LangMap,
  substatsAtSixStar: { en: 'Substats are the focus at 6-star, so Reforging these will be a big part of your heroes\' power.', jp: '6つ星ではサブステータスが焦点になるので、錬成がヒーローの力の大きな部分を占めます。', kr: '6성에서는 서브 스탯이 초점이 되므로, 재련이 영웅 전력의 큰 부분을 차지합니다.', zh: '6星时副属性是重点，所以重铸是英雄战力的重要组成部分。' } satisfies LangMap,
  breakthroughDesc: { en: 'Breakthrough increases skill/set effects and upgrades main stats by 5% each (up to 4 times). This is one you can leave until you have gear with good substats which will be useful for a long time.', jp: '限界突破はスキル/セット効果を強化し、メインステータスを各5%ずつ（最大4回）上昇させます。これは長く使える良いサブステータスの装備を入手してから行いましょう。', kr: '한계돌파는 스킬/세트 효과를 강화하고, 메인 스탯을 각 5%씩 (최대 4회) 상승시킵니다. 이것은 오래 사용할 좋은 서브 스탯 장비를 얻은 후에 하세요.', zh: '突破强化技能/套装效果，主属性各提升5%（最多4次）。等获得副属性好、能长期使用的装备再做。' } satisfies LangMap,
  gemsForSpecialGear: { en: 'Gems for Special Gear are equivalent to one Reforge of the same level. They are a large gold sink to upgrade, so not something to focus on early while gold is still scarce and needed for gear enhancements.', jp: '特殊装備用のジェムは同レベルの錬成1回分に相当します。強化にゴールドが大量に必要なので、ゴールドが不足しがちで装備強化に必要な序盤は焦点にしないでください。', kr: '특수 장비용 젬은 같은 레벨의 재련 1회분에 해당합니다. 강화에 골드가 많이 들어가므로, 골드가 부족하고 장비 강화에 필요한 초반에는 초점으로 삼지 마세요.', zh: '特殊装备用的宝石相当于同等级的一次重铸。强化消耗大量金币，所以在金币紧缺、需要装备强化的前期不要专注于此。' } satisfies LangMap,

  /* ═══ Progression & Resources ═══ */
  skillManualsFirst: { en: 'Where do I use skill manuals first?', jp: 'スキルマニュアルはどこに使うべきですか？', kr: '스킬 매뉴얼은 어디에 먼저 사용하나요?', zh: '技能书优先用在哪里？' } satisfies LangMap,
  skillUpRule: { en: 'Skill up rule of thumb:', jp: 'スキルアップの目安：', kr: '스킬업 기준:', zh: '技能升级优先级：' } satisfies LangMap,
  skillLevel2Weakness: { en: 'Level 2 for Weakness Gauge damage', jp: '弱点ゲージダメージのためにレベル2', kr: '약점 게이지 데미지를 위해 레벨 2', zh: '为了弱点槽伤害升到2级' } satisfies LangMap,
  effectChanceDuration: { en: 'Effect chance, effect duration & cooldown reductions.', jp: '効果確率、効果持続時間、クールダウン減少', kr: '효과 확률, 효과 지속 시간, 쿨다운 감소', zh: '效果概率、效果持续时间、冷却时间减少' } satisfies LangMap,
  damageIncreasesDps: { en: 'Damage increases (DPS only)', jp: 'ダメージ増加（DPSのみ）', kr: '데미지 증가 (DPS만)', zh: '伤害增加（仅DPS）' } satisfies LangMap,
  chainPassive: { en: 'Chain passive can be left at level 2 until much later, the Weakness Gauge damage increase at level 5 is the only interesting part, so you can save skill manuals here until the more important skills are taken care of.', jp: 'チェインパッシブはもっと後までレベル2のままで大丈夫です。レベル5の弱点ゲージダメージ増加が唯一興味深い部分なので、より重要なスキルを優先してスキルマニュアルを節約できます。', kr: '체인 패시브는 나중까지 레벨 2로 둬도 됩니다. 레벨 5의 약점 게이지 데미지 증가가 유일한 관심 부분이므로, 더 중요한 스킬을 우선하여 스킬 매뉴얼을 절약할 수 있습니다.', zh: '连锁被动可以保持在2级直到很后期。5级的弱点槽伤害增加是唯一有趣的部分，所以可以优先更重要的技能来节省技能书。' } satisfies LangMap,

  /* Base upgrades */
  baseUpgrades: { en: 'What Base upgrades should I go for?', jp: '基地のアップグレード優先順位は？', kr: '기지 업그레이드 우선순위는?', zh: '基地升级优先级？' } satisfies LangMap,
  baseUpgradeOrder: { en: 'You can unlock and upgrade them in the order of Eva\'s Menu:', jp: 'エヴァのメニュー順に解放・アップグレードできます：', kr: '에바의 메뉴 순서대로 해금하고 업그레이드할 수 있습니다:', zh: '可以按艾娃菜单顺序解锁和升级：' } satisfies LangMap,
  antiparticleGenerator: { en: 'Antiparticle Generator', jp: '反粒子ジェネレーター', kr: '반입자 발생기', zh: '反粒子发生器' } satisfies LangMap,
  maxThisFirst: { en: 'Max this first!', jp: '最優先で最大に！', kr: '최우선으로 최대로!', zh: '优先升满！' } satisfies LangMap,
  expedition: { en: 'Expedition', jp: '探検', kr: '탐험', zh: '探险' } satisfies LangMap,
  synchroRoom: { en: 'Synchro Room', jp: 'シンクロルーム', kr: '싱크로 룸', zh: '同步室' } satisfies LangMap,
  katesWorkshop: { en: 'Kate\'s Workshop', jp: 'ケイトの工房', kr: '케이트의 공방', zh: '凯特工坊' } satisfies LangMap,
  supplyModule: { en: 'Supply Module', jp: '補給モジュール', kr: '보급 모듈', zh: '补给模块' } satisfies LangMap,
  unlockQuirks: { en: 'Unlock Quirks & Precise Crafting when they are opened (Clear Season 1 stage 9-5).', jp: 'クワーク＆精密クラフトは開放されたら解放しましょう（シーズン1ステージ9-5クリア）。', kr: '퀴크 & 정밀 제작은 열리면 해금하세요 (시즌 1 스테이지 9-5 클리어).', zh: '特质和精密制作开放后解锁（通关第一季9-5关）。' } satisfies LangMap,

  /* Quirks */
  quirksPriority: { en: 'Priority for Quirks?', jp: 'クワークの優先順位は？', kr: '퀴크 우선순위는?', zh: '特质优先级？' } satisfies LangMap,
  quirksUpgradeOrder: { en: 'The upgrade order for Quirks depends on what heroes you\'re using and what boss you\'re targeting next. From broad impact to more specific: Counteract Strong Enemies, Class, Element.', jp: 'クワークのアップグレード順は、使っているヒーローと次に狙うボスによります。広い影響から具体的な順：強敵対策、クラス、属性。', kr: '퀴크 업그레이드 순서는 사용하는 영웅과 다음에 노리는 보스에 따라 다릅니다. 넓은 영향에서 구체적인 순서: 강적 대응, 클래스, 속성.', zh: '特质升级顺序取决于使用的英雄和下一个目标BOSS。从广泛影响到具体：对抗强敌、职业、属性。' } satisfies LangMap,
  dpsSubclassFirst: { en: 'Your preferred damage dealer subclass (Attacker, Bruiser, Wizard, Vanguard) and their element can go before supporters unless you\'re having trouble keeping them alive.', jp: 'お気に入りのダメージディーラーサブクラス（アタッカー、ブルーザー、ウィザード、ヴァンガード）とその属性は、サポーターの生存に問題がなければ先に上げても良いでしょう。', kr: '선호하는 딜러 서브클래스 (어태커, 브루저, 위자드, 뱅가드)와 그 속성은 서포터 생존에 문제가 없다면 먼저 올려도 됩니다.', zh: '你喜欢的输出子职业（攻击者、战士、法师、先锋）和其属性，如果辅助生存没问题的话可以优先升级。' } satisfies LangMap,
  quirkLevel5: { en: 'Level 5 on the main node is enough to pick up all the side nodes, so you can leave level 6-10 for later.', jp: 'メインノードはレベル5でサイドノードを全て取得できるので、レベル6-10は後回しにできます。', kr: '메인 노드는 레벨 5에서 사이드 노드를 전부 획득할 수 있으므로, 레벨 6-10은 나중으로 미뤄도 됩니다.', zh: '主节点5级就能获取所有侧节点，所以6-10级可以之后再升。' } satisfies LangMap,
  utilityQoL: { en: 'Utility doesn\'t help in combat, so picking up these QoL perks is at your own discretion.', jp: 'ユーティリティは戦闘に役立たないので、これらのQoL特典を取るかはお好みで。', kr: '유틸리티는 전투에 도움이 되지 않으므로, 이러한 QoL 특전을 얻을지는 취향입니다.', zh: '实用性不帮助战斗，所以这些便利特权是否获取看个人喜好。' } satisfies LangMap,

  /* Guild */
  guildImportance: { en: 'How important is joining a guild?', jp: 'ギルドに入ることはどれくらい重要ですか？', kr: '길드 가입은 얼마나 중요한가요?', zh: '加入公会有多重要？' } satisfies LangMap,
  guildDesc: { en: 'It is a source of weekly skill manuals, and you can get hero pieces for Aer, Ame, Dahlia, Drakhan and Epsilon through it. Look for a guild with a level 5 guild shop. The monthly Guild Raid is also an important source of gems and ether.', jp: '週間スキルマニュアルの入手源であり、Aer、Ame、Dahlia、Drakhan、Epsilonのヒーローピースも入手できます。レベル5のギルドショップを持つギルドを探しましょう。月間ギルドレイドもジェムとエーテルの重要な入手源です。', kr: '주간 스킬 매뉴얼 획득처이며, Aer, Ame, Dahlia, Drakhan, Epsilon의 영웅 피스도 얻을 수 있습니다. 레벨 5 길드 상점을 가진 길드를 찾으세요. 월간 길드 레이드도 젬과 에테르의 중요한 획득처입니다.', zh: '是每周技能书的来源，还能获得Aer、Ame、Dahlia、Drakhan、Epsilon的英雄碎片。找一个有5级公会商店的公会。每月公会副本也是宝石和以太的重要来源。' } satisfies LangMap,

  /* ═══ Advanced Tips ═══ */
  heroScaleHealth: { en: 'My hero has skills that scale with health/defense/speed, should I focus on that then?', jp: 'HP/防御/速度でスケールするスキルを持つヒーローは、そのステータスに集中すべきですか？', kr: 'HP/방어/속도로 스케일하는 스킬을 가진 영웅은 그 스탯에 집중해야 하나요?', zh: '有技能按生命/防御/速度缩放的英雄，应该专注那个属性吗？' } satisfies LangMap,
  keyWordsLookFor: { en: 'The key words to look for here are ', jp: 'ここで注目すべきキーワードは', kr: '여기서 주목해야 할 키워드는 ', zh: '这里要注意的关键词是' } satisfies LangMap,
  insteadOfAttack: { en: '"instead of Attack"', jp: '「攻撃力の代わりに」', kr: '"공격력 대신"', zh: '"代替攻击力"' } satisfies LangMap,
  proportionalStat: { en: '. When a skill only says its damage increases proportional to a stat, it will still mainly use Attack for its damage calculation. The proportional stat will act as an extra multiplier, but this is generally too small to become the main focus.', jp: 'です。スキルがあるステータスに比例してダメージが増加するとだけ書いてある場合、ダメージ計算には依然として主に攻撃力を使用します。比例ステータスは追加の倍率として機能しますが、これは通常メインの焦点にするには小さすぎます。', kr: '입니다. 스킬이 특정 스탯에 비례해서 데미지가 증가한다고만 쓰여 있으면, 데미지 계산에는 여전히 주로 공격력을 사용합니다. 비례 스탯은 추가 배율로 작용하지만, 이는 보통 메인 초점으로 삼기에는 너무 작습니다.', zh: '。如果技能只说伤害随某属性等比增加，伤害计算仍然主要使用攻击力。比例属性作为额外倍率，但通常太小不值得作为主要关注点。' } satisfies LangMap,
  deltaHpInstead: { en: '(HP instead of ATK)', jp: '（攻撃力の代わりにHP）', kr: '(공격력 대신 HP)', zh: '（用生命代替攻击）' } satisfies LangMap,
  deltaScaleDesc: { en: '{P/Delta}\'s skills scale proportional to Max Health instead of {S/ATK}: Focus on {S/HP}', jp: '{P/Delta}のスキルは{S/ATK}の代わりに最大HPに比例：{S/HP}を重視', kr: '{P/Delta}의 스킬은 {S/ATK} 대신 최대 HP에 비례: {S/HP}에 집중', zh: '{P/Delta}的技能按最大生命代替{S/ATK}缩放：专注{S/HP}' } satisfies LangMap,
  stellaHpBonus: { en: '(HP bonus)', jp: '（HPボーナス）', kr: '(HP 보너스)', zh: '（生命加成）' } satisfies LangMap,
  stellaScaleDesc: { en: '{P/Demiurge Stella}\'s skills scale proportional to Max Health: Still goes for {S/ATK} to increase damage, {S/HP} is a bonus.', jp: '{P/Demiurge Stella}のスキルは最大HPに比例：ダメージを増やすには{S/ATK}を重視、{S/HP}はボーナス。', kr: '{P/Demiurge Stella}의 스킬은 최대 HP에 비례: 데미지를 늘리려면 {S/ATK}에 집중, {S/HP}는 보너스.', zh: '{P/Demiurge Stella}的技能按最大生命等比增加：仍然堆{S/ATK}来增加伤害，{S/HP}是加成。' } satisfies LangMap,
  atkZeroBossExample: { en: 'Against bosses that set your {S/ATK} to 0 (Like Shichifuja\'s Shadow in Skyward Tower Hard): {P/Delta} can deal damage normally. {P/Demiurge Stella}\'s damage will reduce to single digits.', jp: '{S/ATK}を0にするボス（昇天の塔ハードのシチフジャの影など）に対して：{P/Delta}は通常通りダメージを与えられます。{P/Demiurge Stella}のダメージは一桁まで減少します。', kr: '{S/ATK}를 0으로 만드는 보스(승천의 탑 하드의 시치후자의 그림자 등)에 대해: {P/Delta}는 정상적으로 데미지를 줄 수 있습니다. {P/Demiurge Stella}의 데미지는 한 자릿수까지 감소합니다.', zh: '对于将{S/ATK}设为0的BOSS（如升天之塔困难的七伏影）：{P/Delta}可以正常造成伤害。{P/Demiurge Stella}的伤害会降到个位数。' } satisfies LangMap,

  /* ═══ Related Guides ═══ */
  freeHeroesStartBanner: { en: 'Free Heroes & Start Banner', jp: '無料ヒーロー＆スタートバナー', kr: '무료 영웅 & 스타트 배너', zh: '免费英雄与新手卡池' } satisfies LangMap,
  freeHeroesStartBannerDesc: { en: 'Maximize your free roster', jp: '無料キャラを最大限活用', kr: '무료 캐릭터 최대한 활용', zh: '最大化利用免费角色' } satisfies LangMap,
  premiumLimitedGuide: { en: 'Premium & Limited Guide', jp: 'プレミアム＆限定ガイド', kr: '프리미엄 & 한정 가이드', zh: '精选与限定指南' } satisfies LangMap,
  premiumLimitedGuideDesc: { en: 'Pulling priorities & transcendence', jp: 'ガチャ優先度と超越', kr: '모집 우선순위와 초월', zh: '抽卡优先级与超越' } satisfies LangMap,
  gearGuide: { en: 'Gear Guide', jp: '装備ガイド', kr: '장비 가이드', zh: '装备指南' } satisfies LangMap,
  gearGuideDesc: { en: 'Deep dive into equipment', jp: '装備の詳細解説', kr: '장비 상세 해설', zh: '装备详细解说' } satisfies LangMap,
  heroesGrowth: { en: 'Heroes Growth', jp: 'ヒーロー育成', kr: '영웅 육성', zh: '英雄培养' } satisfies LangMap,
  heroesGrowthDesc: { en: 'Leveling & progression systems', jp: 'レベリングと進行システム', kr: '레벨링과 진행 시스템', zh: '升级与进度系统' } satisfies LangMap,
} as const;

/* ── Component ──────────────────────────────────────────── */

export default function BeginnerFAQGuide() {
  const { lang, href } = useI18n();

  return (
    <GuideTemplate
      title={lRec(title, lang)}
      introduction={lRec(intro, lang)}
    >
      <div className="space-y-12">

        {/* ═══ Getting Started ═══ */}
        <section className="space-y-6">
          <GuideSectionHeading color="sky">
            {lRec(LABELS.sectionGettingStarted, lang)}
          </GuideSectionHeading>

          <ContentCard>
            <h4 className="text-lg font-semibold text-sky-300 after:hidden">
              {lRec(LABELS.rerollImportance, lang)}
            </h4>
            <p className="leading-relaxed">
              {lRec(LABELS.rerollGettingA, lang)}
              <Link href={href('/guides/general-guides/premium-limited')} className="text-blue-400 hover:text-blue-300 underline">
                {lRec(LABELS.premiumLimitedHero, lang)}
              </Link>
              {lRec(LABELS.rerollNotRequired, lang)}
            </p>
            <p className="leading-relaxed">
              {lRec(LABELS.thePrefix, lang)}
              <Link href={href('/guides/general-guides/free-heroes-start-banner')} className="text-blue-400 hover:text-blue-300 underline">
                {lRec(LABELS.freeHeroesLink, lang)}
              </Link>
              {lRec(LABELS.solidFoundation, lang)}
            </p>
            <p className="leading-relaxed">
              {lRec(LABELS.doppelgangerFarm, lang)}
            </p>
          </ContentCard>
        </section>

        {/* ═══ Heroes & Pulling ═══ */}
        <section className="space-y-6">
          <GuideSectionHeading color="purple">
            {lRec(LABELS.sectionHeroesPulling, lang)}
          </GuideSectionHeading>

          {/* Who do I pull for? */}
          <ContentCard className="space-y-4!">
            <h4 className="text-lg font-semibold text-purple-300 after:hidden">
              {lRec(LABELS.whoPullFor, lang)}
            </h4>
            <p className="leading-relaxed">
              {lRec(LABELS.wideRangeHeroes, lang)}
            </p>

            <div className="grid md:grid-cols-3 gap-3 mt-4">
              <div className="p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg space-y-2">
                <div className="flex items-center gap-2 font-semibold text-purple-300">
                  <span>{lRec(LABELS.limited, lang)}</span>
                </div>
                <p className="text-sm">
                  {parseText(lRec(LABELS.limitedDesc, lang))}
                </p>
              </div>

              <div className="p-4 bg-amber-900/20 border border-amber-500/30 rounded-lg space-y-2">
                <h5 className="font-semibold text-amber-300 after:hidden">
                  {lRec(LABELS.premium, lang)}
                </h5>
                <p className="text-sm">
                  {lRec(LABELS.premiumBannerDesc, lang)}
                  <Link href={href('/guides/general-guides/premium-limited')} className="text-blue-400 underline">
                    {lRec(LABELS.dedicatedGuide, lang)}
                  </Link>
                  {lRec(LABELS.periodSeeGuide, lang)}
                </p>
              </div>

              <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-lg space-y-2">
                <h5 className="font-semibold text-green-300 after:hidden">
                  {lRec(LABELS.regular, lang)}
                </h5>
                <p className="text-sm mb-2">
                  {parseText(lRec(LABELS.regularHeroesDesc, lang))}
                  <br />
                  {lRec(LABELS.customRecruitGoal, lang)}
                  <EffectInline name="BT_STAT|ST_CRITICAL_RATE" type="buff" />
                  {lRec(LABELS.critBuff, lang)}
                </p>
                <div className="gap-1">
                  <CharacterInline name="Valentine" />{' '}
                  <CharacterInline name="Tamara" /><br />
                  <CharacterInline name="Skadi" />{' '}
                  <CharacterInline name="Charlotte" />
                </div>
              </div>
            </div>
          </ContentCard>

          {/* Should I pull for dupes? */}
          <ContentCard>
            <h4 className="text-lg font-semibold text-purple-300 after:hidden">
              {lRec(LABELS.pullForDupes, lang)}
            </h4>
            <div className="space-y-4">
              <div>
                <p className="leading-relaxed mb-2">
                  {lRec(LABELS.regularHeroesFarm, lang)}
                </p>
                <p className="text-xs text-gray-300 mb-4">
                  {lRec(LABELS.transcendSteps, lang)}
                </p>
                <div className="ml-4 space-y-1 text-sm text-gray-400">
                  <p>{'• '}<StarBadge level="4" />{lRec(LABELS.star4WeaknessGauge, lang)}</p>
                  <p>{'• '}<StarBadge level="5" />{lRec(LABELS.star5Burst3, lang)}</p>
                  <p>{'• '}<StarBadge level="6" />{lRec(LABELS.star6NotPriority, lang)}</p>
                </div>
              </div>
              <div>
                <p className="leading-relaxed">
                  <strong className="text-amber-300">{lRec(LABELS.premium, lang)}</strong>
                  {lRec(LABELS.andKwa, lang)}
                  <strong className="text-purple-400">{lRec(LABELS.limited, lang)}</strong>
                  {lRec(LABELS.premiumLimitedTranscend, lang)}
                  <Link href={href('/guides/general-guides/premium-limited')} className="text-blue-400 underline">
                    {lRec(LABELS.here, lang)}
                  </Link>
                  {lRec(LABELS.periodSeeGuide, lang)}
                </p>
              </div>
            </div>
          </ContentCard>

          {/* What team do I start with? */}
          <ContentCard>
            <h4 className="text-lg font-semibold text-purple-300 after:hidden">
              {lRec(LABELS.whatTeam, lang)}
            </h4>
            <p className="leading-relaxed">
              {lRec(LABELS.standardTeam, lang)}
            </p>

            <div className="grid md:grid-cols-2 gap-3 mt-3">
              <Callout variant="warning">
                <p className="text-sm font-semibold text-red-300 mb-2">
                  {lRec(LABELS.dpsFromStartDash, lang)}
                </p>
                <div className="gap-1">
                  <CharacterInline name="Ame" />{' '}<CharacterInline name="Rey" />{' '}<CharacterInline name="Rin" />{' '}<CharacterInline name="Vlada" />
                </div>
              </Callout>
              <Callout variant="note">
                <p className="text-sm font-semibold text-blue-300 mb-2">
                  {lRec(LABELS.critBuffFromCustom, lang)}
                </p>
                <div className="gap-1">
                  <CharacterInline name="Valentine" />{' '}<CharacterInline name="Tamara" />{' '}<CharacterInline name="Skadi" />{' '}<CharacterInline name="Charlotte" />
                </div>
              </Callout>
              <Callout variant="tip">
                <p className="text-sm font-semibold text-green-300 mb-2">
                  {lRec(LABELS.healers, lang)}
                </p>
                <div className="gap-1">
                  {lRec(LABELS.youGet, lang)}
                  <CharacterInline name="Mene" />
                  {lRec(LABELS.meneForFree, lang)}
                  <CharacterInline name="Dianne" />
                  {lRec(LABELS.andWa, lang)}
                  <CharacterInline name="Nella" />
                  {lRec(LABELS.laterWith, lang)}
                  <CharacterInline name="Monad Eva" />
                  {lRec(LABELS.monadEvaRecommended, lang)}
                  <EffectInline name="BT_CALL_BACKUP" type="buff" />
                  {lRec(LABELS.monadEvaPeriod, lang)}
                </div>
              </Callout>
              <Callout variant="warning">
                <p className="text-sm font-semibold text-amber-300 mb-2">
                  {lRec(LABELS.flexSupport, lang)}
                </p>
                <div className="gap-1">
                  <CharacterInline name="Veronica" />{' '}<CharacterInline name="Eternal" />{' '}<CharacterInline name="Akari" />
                  {lRec(LABELS.orAnotherHero, lang)}
                </div>
              </Callout>
            </div>

            <Callout variant="warning" className="mt-3">
              <div className="text-sm">
                <strong>{lRec(LABELS.firstBossPriorities, lang)}</strong>
                <ul className="mt-2 space-y-1">
                  <li>
                    <InlineIcon icon="/images/characters/boss/atb/IG_Turn_4034002.webp" label={lRec(LABELS.unidentifiedChimera, lang)} size={28} underline={false} />
                    {' '}{parseText(lRec(LABELS.chimeraArmorSets, lang))}
                  </li>
                  <li>
                    <InlineIcon icon="/images/characters/boss/atb/IG_Turn_4076001.webp" label={lRec(LABELS.glicys, lang)} size={28} underline={false} />
                    {' '}{lRec(LABELS.and, lang)}{' '}
                    <InlineIcon icon="/images/characters/boss/atb/IG_Turn_4076002.webp" label={lRec(LABELS.blazingKnightMeteos, lang)} size={28} underline={false} />
                    {' '}{lRec(LABELS.forWeaponsAccessories, lang)}
                  </li>
                </ul>
                <p className="mt-4">
                  {parseText(lRec(LABELS.earthFireTeam, lang))}
                </p>
                <Callout variant="note" className="mt-2">
                  <p className="text-sm">
                    <strong>{lRec(LABELS.tip, lang)}</strong>{' '}
                    {lRec(LABELS.friendSupportTip, lang)}
                  </p>
                </Callout>
              </div>
            </Callout>
          </ContentCard>
        </section>

        {/* ═══ Where do I go first? ═══ */}
        <section>
          <ContentCard>
            <h4 className="text-lg font-semibold text-sky-300 after:hidden">
              {lRec(LABELS.whereGoFirst, lang)}
            </h4>
            <p className="leading-relaxed">
              {lRec(LABELS.evaGuideQuests, lang)}
            </p>
            <div className="space-y-2 mt-3">
              <div className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <p className="leading-relaxed">
                  {lRec(LABELS.underChallenges, lang)}
                  <Link href={href('/guides/special-request')} className="text-blue-400 underline">{lRec(LABELS.specialRequests, lang)}</Link>
                  {lRec(LABELS.specialRequestsDesc, lang)}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <p className="leading-relaxed">
                  {lRec(LABELS.experienceSlow, lang)}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <p className="leading-relaxed">
                  <Link href={href('/guides/skyward-tower')} className="text-blue-400 underline">{lRec(LABELS.skywardTower, lang)}</Link>
                  {lRec(LABELS.skywardTowerResets, lang)}
                </p>
              </div>
            </div>
          </ContentCard>
        </section>

        {/* ═══ Gear & Equipment ═══ */}
        <section className="space-y-6">
          <GuideSectionHeading color="amber">
            {lRec(LABELS.sectionGearEquipment, lang)}
          </GuideSectionHeading>

          <ContentCard>
            <h4 className="text-lg font-semibold text-amber-300 after:hidden">
              {lRec(LABELS.howGetGear, lang)}
            </h4>
            <p className="leading-relaxed">
              {lRec(LABELS.gearSourceDesc, lang)}
            </p>
            <div className="grid md:grid-cols-2 gap-3 mt-3">
              <Callout variant="note">
                <p className="text-sm font-semibold text-cyan-300 mb-1">{lRec(LABELS.armorPriority, lang)}</p>
                <p className="text-sm">
                  <InlineIcon icon="/images/characters/boss/atb/IG_Turn_4034002.webp" label={lRec(LABELS.unidentifiedChimera, lang)} size={28} underline={false} />
                  {' '}{lRec(LABELS.chimeraArmorDesc, lang)}
                </p>
              </Callout>
              <Callout variant="warning">
                <p className="text-sm font-semibold text-rose-300 mb-1">{lRec(LABELS.weaponsAccessories, lang)}</p>
                <p className="text-sm">
                  {lRec(LABELS.weaponAccessorySkills, lang)}
                  <br />
                  <InlineIcon icon="/images/characters/boss/atb/IG_Turn_4076001.webp" label={lRec(LABELS.glicys, lang)} size={28} underline={false} />
                  {' '}{lRec(LABELS.glicysAccessoryDesc, lang)}
                  <br />
                  <InlineIcon icon="/images/characters/boss/atb/IG_Turn_4076002.webp" label={lRec(LABELS.meteos, lang)} size={28} underline={false} />
                  {' '}{lRec(LABELS.meteosAccessoryDesc, lang)}
                </p>
              </Callout>
            </div>
          </ContentCard>

          <ContentCard>
            <h4 className="text-lg font-semibold text-amber-300 after:hidden">
              {lRec(LABELS.howGetEETalismans, lang)}
            </h4>
            <div className="space-y-3">
              <Callout variant="info">
                <p className="text-sm font-semibold text-purple-300 mb-1">{lRec(LABELS.exclusiveEquipment, lang)}</p>
                <p className="text-sm">
                  {lRec(LABELS.exclusiveEquipmentDesc, lang)}
                </p>
              </Callout>
              <Callout variant="info">
                <p className="text-sm font-semibold text-indigo-300 mb-1">{lRec(LABELS.talismansAndCharms, lang)}</p>
                <p className="text-sm">
                  {lRec(LABELS.talismansDesc, lang)}
                </p>
              </Callout>
            </div>
          </ContentCard>

          <ContentCard>
            <h4 className="text-lg font-semibold text-amber-300 after:hidden">
              {lRec(LABELS.gearWorthKeeping, lang)}
            </h4>
            <Callout variant="note" className="mb-3">
              <p className="text-sm font-semibold text-red-300">
                {lRec(LABELS.dontThrowBlues, lang)}
              </p>
            </Callout>
            <p className="leading-relaxed">
              {lRec(LABELS.epicGearStaple, lang)}
            </p>
            <p>{lRec(LABELS.gearReforge, lang)}</p>
            <div className="grid grid-cols-3 gap-2 text-sm mt-2">
              <div className="p-2 bg-red-900/20 rounded text-center">
                <p className="text-red-300 font-semibold">{lRec(LABELS.sixStarLegendary, lang)}</p>
                <p>{lRec(LABELS.eighteenTicks, lang)}</p>
              </div>
              <div className="p-2 bg-blue-900/20 rounded text-center">
                <p className="text-blue-300 font-semibold">{lRec(LABELS.sixStarEpic, lang)}</p>
                <p>{lRec(LABELS.seventeenTicks, lang)}</p>
              </div>
              <div className="p-2 bg-green-900/20 rounded text-center">
                <p className="text-green-300 font-semibold">{lRec(LABELS.sixStarSuperior, lang)}</p>
                <p>{lRec(LABELS.sixteenTicks, lang)}</p>
              </div>
            </div>
            <p className="mt-2">
              {lRec(LABELS.gearRarityMeaning, lang)}
            </p>
          </ContentCard>

          <ContentCard>
            <h4 className="text-lg font-semibold text-amber-300 after:hidden">
              {lRec(LABELS.whenUpgradeGear, lang)}
            </h4>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-amber-400 mt-1">1.</span>
                <p><strong>{lRec(LABELS.enhancingWeapons, lang)}</strong> {lRec(LABELS.enhancingWeaponsDesc, lang)}</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-400 mt-1">2.</span>
                <p><strong>{lRec(LABELS.accessories, lang)}</strong> {lRec(LABELS.accessoriesCritDesc, lang)}</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-400 mt-1">3.</span>
                <p><strong>{lRec(LABELS.armor, lang)}</strong> {lRec(LABELS.armorLaterChapters, lang)}</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-400 mt-1">4.</span>
                <p><strong>{lRec(LABELS.reforgeBreakthrough, lang)}</strong> {lRec(LABELS.reforgeNotImportant, lang)}</p>
              </div>
              <ul className="ml-4 space-y-1 text-sm">
                <li>{lRec(LABELS.substatsAtSixStar, lang)}</li>
                <li>{lRec(LABELS.breakthroughDesc, lang)}</li>
                <li>{lRec(LABELS.gemsForSpecialGear, lang)}</li>
              </ul>
            </div>
          </ContentCard>
        </section>

        {/* ═══ Progression & Resources ═══ */}
        <section className="space-y-6">
          <GuideSectionHeading color="green">
            {lRec(LABELS.sectionProgressionResources, lang)}
          </GuideSectionHeading>

          <ContentCard>
            <h4 className="text-lg font-semibold text-green-300 after:hidden">
              {lRec(LABELS.skillManualsFirst, lang)}
            </h4>
            <Callout variant="warning">
              <p className="text-sm font-semibold text-yellow-300">{lRec(LABELS.skillUpRule, lang)}</p>
              <ol className="list-decimal list-inside text-sm space-y-1 mt-2 ml-2">
                <li>{lRec(LABELS.skillLevel2Weakness, lang)}</li>
                <li>{lRec(LABELS.effectChanceDuration, lang)}</li>
                <li>{lRec(LABELS.damageIncreasesDps, lang)}</li>
              </ol>
            </Callout>
            <p className="text-sm text-gray-300">
              {lRec(LABELS.chainPassive, lang)}
            </p>
          </ContentCard>

          <ContentCard>
            <h4 className="text-lg font-semibold text-green-300 after:hidden">
              {lRec(LABELS.baseUpgrades, lang)}
            </h4>
            <div className="space-y-2">
              <p>{lRec(LABELS.baseUpgradeOrder, lang)}</p>
              <Callout variant="warning">
                <p className="text-sm font-semibold text-red-300">1. {lRec(LABELS.antiparticleGenerator, lang)} <span className="text-sm text-gray-400">{lRec(LABELS.maxThisFirst, lang)}</span></p>
              </Callout>
              <Callout variant="warning">
                <p className="text-sm font-semibold text-orange-300">2. {lRec(LABELS.expedition, lang)}</p>
              </Callout>
              <Callout variant="warning">
                <p className="text-sm font-semibold text-yellow-300">3. {lRec(LABELS.synchroRoom, lang)}</p>
              </Callout>
              <Callout variant="tip">
                <p className="text-sm font-semibold text-lime-300">4. {lRec(LABELS.katesWorkshop, lang)}</p>
              </Callout>
              <Callout variant="tip">
                <p className="text-sm font-semibold text-green-300">5. {lRec(LABELS.supplyModule, lang)}</p>
              </Callout>
              <p className="text-sm">{lRec(LABELS.unlockQuirks, lang)}</p>
            </div>
          </ContentCard>

          <ContentCard>
            <h4 className="text-lg font-semibold text-green-300 after:hidden">
              {lRec(LABELS.quirksPriority, lang)}
            </h4>
            <p className="leading-relaxed">
              {lRec(LABELS.quirksUpgradeOrder, lang)}
            </p>
            <p>{lRec(LABELS.dpsSubclassFirst, lang)}</p>
            <p>{lRec(LABELS.quirkLevel5, lang)}</p>
            <p>{lRec(LABELS.utilityQoL, lang)}</p>
          </ContentCard>

          <ContentCard>
            <h4 className="text-lg font-semibold text-green-300 after:hidden">
              {lRec(LABELS.guildImportance, lang)}
            </h4>
            <p>{lRec(LABELS.guildDesc, lang)}</p>
          </ContentCard>
        </section>

        {/* ═══ Advanced Tips ═══ */}
        <section className="space-y-6">
          <GuideSectionHeading color="rose">
            {lRec(LABELS.sectionAdvancedTips, lang)}
          </GuideSectionHeading>

          <ContentCard>
            <h4 className="text-lg font-semibold text-rose-300 after:hidden">
              {lRec(LABELS.heroScaleHealth, lang)}
            </h4>
            <p className="leading-relaxed">
              {lRec(LABELS.keyWordsLookFor, lang)}
              <strong className="underline">{lRec(LABELS.insteadOfAttack, lang)}</strong>
              {lRec(LABELS.proportionalStat, lang)}
            </p>

            <div className="grid md:grid-cols-2 gap-3 mt-3">
              <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
                <p className="text-sm font-semibold text-green-300 mb-2 flex items-center gap-2">
                  <CharacterInline name="Delta" />
                  <span className="text-xs">{lRec(LABELS.deltaHpInstead, lang)}</span>
                </p>
                <p className="text-sm"><SkillInline character="Delta" skill="S1" /><SkillInline character="Delta" skill="S2" /><SkillInline character="Delta" skill="S3" /></p>
                <p>{parseText(lRec(LABELS.deltaScaleDesc, lang))}</p>
              </div>
              <div className="p-4 bg-amber-900/20 border border-amber-500/30 rounded-lg">
                <p className="text-sm font-semibold text-amber-300 mb-2 flex items-center gap-2">
                  <CharacterInline name="Demiurge Stella" />
                  <span className="text-xs">{lRec(LABELS.stellaHpBonus, lang)}</span>
                </p>
                <p className="text-sm"><SkillInline character="Demiurge Stella" skill="S1" /><SkillInline character="Demiurge Stella" skill="S2" /><SkillInline character="Demiurge Stella" skill="S3" /></p>
                <p className="text-sm">{parseText(lRec(LABELS.stellaScaleDesc, lang))}</p>
              </div>
            </div>

            <Callout variant="info">
              <p className="text-sm font-semibold text-purple-300 mb-1">
                {parseText(lRec(LABELS.atkZeroBossExample, lang))}
              </p>
            </Callout>
          </ContentCard>
        </section>

        {/* ═══ Related Guides ═══ */}
        <div className="mt-12 p-6 bg-linear-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-xl">
          <h2 className="text-lg font-semibold text-blue-300 mb-4 after:hidden">
            {lRec(LABELS.sectionRelatedGuides, lang)}
          </h2>
          <div className="grid md:grid-cols-2 gap-3">
            <Link href={href('/guides/general-guides/free-heroes-start-banner')} className="p-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg transition border border-slate-600">
              <p className="text-blue-400 font-medium">{lRec(LABELS.freeHeroesStartBanner, lang)}</p>
              <p className="text-xs text-gray-400 mt-1">{lRec(LABELS.freeHeroesStartBannerDesc, lang)}</p>
            </Link>
            <Link href={href('/guides/general-guides/premium-limited')} className="p-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg transition border border-slate-600">
              <p className="text-purple-400 font-medium">{lRec(LABELS.premiumLimitedGuide, lang)}</p>
              <p className="text-xs text-gray-400 mt-1">{lRec(LABELS.premiumLimitedGuideDesc, lang)}</p>
            </Link>
            <Link href={href('/guides/general-guides/gear')} className="p-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg transition border border-slate-600">
              <p className="text-amber-400 font-medium">{lRec(LABELS.gearGuide, lang)}</p>
              <p className="text-xs text-gray-400 mt-1">{lRec(LABELS.gearGuideDesc, lang)}</p>
            </Link>
            <Link href={href('/guides/general-guides/heroes-growth')} className="p-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg transition border border-slate-600">
              <p className="text-green-400 font-medium">{lRec(LABELS.heroesGrowth, lang)}</p>
              <p className="text-xs text-gray-400 mt-1">{lRec(LABELS.heroesGrowthDesc, lang)}</p>
            </Link>
          </div>
        </div>

      </div>
    </GuideTemplate>
  );
}
