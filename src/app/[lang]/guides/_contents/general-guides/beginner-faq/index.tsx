'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Route } from 'next';
import GuideTemplate from '@/app/components/guides/GuideTemplate';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { LangMap } from '@/types/common';
import parseText from '@/lib/parse-text';
import Link from 'next/link';
import Image from 'next/image';
import guidesIndex from '@data/guides/_index.json';
import InlineIcon from '@/app/components/inline/InlineIcon';
import { StarBadge } from '@/app/components/ui/StarIcons';

/* ── Top-level LangMap constants ────────────────────────── */

const title: LangMap = {
  en: 'Frequently Asked Questions',
  jp: 'よくある質問',
  kr: '자주 묻는 질문',
  zh: '常见问题解答',
  fr: 'Foire Aux Questions',
};

const intro: LangMap = {
  en: 'Common questions asked by new players, compiled from community discussions and veteran player advice.',
  jp: 'コミュニティでの議論やベテランプレイヤーのアドバイスをまとめた、新規プレイヤーからよく寄せられる質問集です。',
  kr: '커뮤니티 토론과 베테랑 플레이어 조언을 정리한, 신규 플레이어가 자주 묻는 질문 모음입니다.',
  zh: '整理自社区讨论和资深玩家建议的新手常见问题汇总。',
  fr: 'Questions courantes posées par les nouveaux joueurs, compilées à partir des discussions de la communauté et des conseils de joueurs expérimentés.',
};

/* ── Inline LABELS ──────────────────────────────────────── */

const LABELS = {
  /* ═══ Section headings ═══ */
  sectionGettingStarted: { en: 'Getting Started', jp: 'はじめに', kr: '시작하기', zh: '入门指南', fr: 'Pour Commencer' } satisfies LangMap,
  sectionHeroesPulling: { en: 'Heroes & Pulling', jp: 'ヒーロー＆ガチャ', kr: '영웅 & 모집', zh: '英雄与抽卡', fr: 'Héros & Pulls' } satisfies LangMap,
  sectionGearEquipment: { en: 'Gear & Equipment', jp: '装備＆エクイップメント', kr: '장비 & 이큅먼트', zh: '装备与器材', fr: 'Équipement' } satisfies LangMap,
  sectionProgressionResources: { en: 'Progression & Resources', jp: '進行＆リソース', kr: '진행 & 리소스', zh: '进度与资源', fr: 'Progression & Ressources' } satisfies LangMap,
  sectionAdvancedTips: { en: 'Advanced Tips', jp: '上級者向けTips', kr: '고급 팁', zh: '进阶技巧', fr: 'Conseils Avancés' } satisfies LangMap,
  sectionRelatedGuides: { en: 'Related Guides', jp: '関連ガイド', kr: '관련 가이드', zh: '相关指南', fr: 'Guides Connexes' } satisfies LangMap,

  /* ═══ Getting Started ═══ */
  rerollImportance: { en: 'How important is rerolling?', jp: 'リセマラはどれくらい重要ですか？', kr: '리세마라는 얼마나 중요한가요?', zh: '刷初始有多重要？', fr: 'À quel point le reroll est-il important ?' } satisfies LangMap,
  rerollAnswer: { en: 'Getting a {L/Premium/Limited hero|/guides/general-guides/premium-limited} early helps, but is not required.', jp: '早い段階で{L/プレミアム/限定ヒーロー|/guides/general-guides/premium-limited}を入手すると有利ですが、必須ではありません。', kr: '초반에 {L/프리미엄/한정 영웅|/guides/general-guides/premium-limited}을 얻으면 도움이 되지만, 필수는 아닙니다.', zh: '早期获得{L/精选/限定英雄|/guides/general-guides/premium-limited}会有帮助，但不是必须的。', fr: 'Obtenir un {L/Héros Premium/Limited|/guides/general-guides/premium-limited} tôt aide, mais n\'est pas obligatoire.' } satisfies LangMap,
  freeHeroesFoundation: { en: 'The {L/heroes you get for free|/guides/general-guides/free-heroes-start-banner} are a solid foundation to start off with.', jp: '{L/無料で入手できるヒーロー|/guides/general-guides/free-heroes-start-banner}だけでも、序盤を進めるには十分な戦力になります。', kr: '{L/무료로 얻을 수 있는 영웅|/guides/general-guides/free-heroes-start-banner}만으로도 초반 진행에 충분한 전력이 됩니다.', zh: '{L/免费获得的英雄|/guides/general-guides/free-heroes-start-banner}足以作为良好的起步基础。', fr: 'Les {L/Héros obtenus gratuitement|/guides/general-guides/free-heroes-start-banner} constituent une base solide pour bien débuter.' } satisfies LangMap,
  doppelgangerFarm: { en: 'Aside from Recruiting, you can farm regular heroes you don\'t have in the Doppelgänger Challenge. It takes about 5 days to transcend a hero, or about 8 days to recruit one you don\'t own, and with gold you can work on two heroes at once.', jp: 'ガチャ以外にも、ドッペルゲンガーチャレンジで所持していない一般ヒーローを獲得できます。超越には約5日、未所持ヒーローの獲得には約8日かかり、ゴールドを使えば2体同時に進められます。', kr: '모집 외에도 도플갱어 챌린지에서 보유하지 않은 일반 영웅을 획득할 수 있습니다. 초월에는 약 5일, 미보유 영웅 획득에는 약 8일이 걸리며, 골드를 사용하면 두 명을 동시에 진행할 수 있습니다.', zh: '除了招募之外，你还可以在分身挑战中获得未拥有的普通英雄。超越约需5天，招募一名未拥有的英雄约需8天，使用金币可以同时培养两名英雄。', fr: 'En plus du Recruiting, vous pouvez farmer les Héros Réguliers que vous n\'avez pas via le Doppelganger Challenge. Il faut environ 5 jours pour transcender un Héros, ou environ 8 jours pour en recruter un que vous ne possédez pas, et avec du gold vous pouvez travailler deux Héros à la fois.' } satisfies LangMap,

  newAccountStarters: { en: 'New accounts also get a {L/Demiurge Contract and a Seasonal Limited Hero Selection Recruit|/guides/general-guides/premium-limited}. The Contract guarantees a 5★+ Premium hero ({P/Demiurge Luna} or {P/Monad Eva} are the recommended picks), and the Seasonal selection gives quick access to {P/Mystic Sage Ame}, one of the best supports in the game. On top of that you receive 1000 {I-I/Special Recruitment Ticket} to collect the regular roster, giving you a well-rounded lineup to work with right away.', jp: '新規アカウントには{L/デミウルゴス契約とシーズナル限定仲間選択スカウト|/guides/general-guides/premium-limited}も付与されます。契約では★5+のプレミアムヒーローが確定し（おすすめは{P/Demiurge Luna}または{P/Monad Eva}）、シーズナル選択ではゲーム屈指のサポーター{P/Mystic Sage Ame}を早期に入手できます。さらに一般ヒーローを集めるための{I-I/Special Recruitment Ticket}が1000枚もらえるので、序盤から充実したロスターを揃えられます。', kr: '신규 계정에는 {L/데미우르고스 계약과 시즌 한정 동료 선택 영입|/guides/general-guides/premium-limited}도 제공됩니다. 계약으로 ★5+ 프리미엄 영웅이 확정되며(추천은 {P/Demiurge Luna} 또는 {P/Monad Eva}), 시즈널 선택으로 게임 최고의 서포터 중 하나인 {P/Mystic Sage Ame}를 빠르게 얻을 수 있습니다. 여기에 일반 영웅을 모으기 위한 {I-I/Special Recruitment Ticket} 1000장도 받으므로, 초반부터 다양한 로스터를 갖출 수 있습니다.', zh: '新账号还会获得{L/迪米乌哥斯合约和季节限定同伴选择招募|/guides/general-guides/premium-limited}。合约保证一名★5+精选英雄（推荐{P/Demiurge Luna}或{P/Monad Eva}），季节选择则能快速获得游戏中最强辅助之一的{P/Mystic Sage Ame}。此外你还会获得1000张{I-I/Special Recruitment Ticket}用于收集常规英雄阵容，因此一开始就能组建丰富的阵容。', fr: 'Les nouveaux comptes reçoivent aussi un {L/Demiurge Contract et une Seasonal Limited Hero Selection Recruit|/guides/general-guides/premium-limited}. Le Contract garantit un Héros Premium ★5+ ({P/Demiurge Luna} ou {P/Monad Eva} sont les choix recommandés), et la sélection Seasonal donne un accès rapide à {P/Mystic Sage Ame}, l\'un des meilleurs supports du jeu. En plus, vous recevez 1000 {I-I/Special Recruitment Ticket} pour collecter le roster régulier, de quoi disposer d\'un roster varié dès le départ.' } satisfies LangMap,

  /* ═══ Heroes & Pulling ═══ */
  whoPullFor: { en: 'Who do I pull for?', jp: '誰を引くべきですか？', kr: '누구를 뽑아야 하나요?', zh: '应该抽谁？', fr: 'Pour qui faut-il pull ?' } satisfies LangMap,
  wideRangeHeroes: { en: 'Outerplane aims to use a wide range of heroes, rather than focusing on a small core group, so the goal is to have most heroes available.', jp: 'Outerplaneは少数の主力キャラに集中するよりも、幅広いヒーローを使うゲームです。最終的にはほとんどのヒーローを揃えることが目標になります。', kr: 'Outerplane은 소수의 핵심 캐릭터에 집중하기보다 다양한 영웅을 사용하는 게임입니다. 최종 목표는 대부분의 영웅을 보유하는 것입니다.', zh: 'Outerplane的目标是使用多种英雄，而不是专注于少数核心角色，所以最终目标是拥有大部分英雄。', fr: 'Outerplane vise à utiliser une large gamme de Héros, plutôt qu\'à se concentrer sur un petit groupe central ; l\'objectif est donc d\'avoir la plupart des Héros disponibles.' } satisfies LangMap,
  limited: { en: 'Limited', jp: '限定', kr: '한정', zh: '限定', fr: 'Limited' } satisfies LangMap,
  limitedDesc: { en: '{I-I/Free Ether} goes to Limited heroes (Seasonal, Festival, Collab banners) as a priority. They don\'t necessarily stand above other heroes, but they are only available during their banner and can make certain fights easier. Collect at least at 3-star when their banner is up.', jp: '{I-I/Free Ether}は限定ヒーロー（シーズン、フェスティバル、コラボバナー）を優先的に使用します。他のヒーローより必ずしも強いわけではありませんが、バナー期間中のみ入手可能で、特定のコンテンツを楽にクリアできます。バナー開催中に最低でも3つ星で確保しましょう。', kr: '{I-I/Free Ether}는 한정 영웅(시즌, 페스티벌, 콜라보 배너)에 우선적으로 사용합니다. 다른 영웅보다 반드시 강하지는 않지만, 배너 기간에만 획득 가능하며 특정 컨텐츠를 더 쉽게 클리어할 수 있습니다. 배너 진행 중 최소 3성으로 확보하세요.', zh: '{I-I/Free Ether}优先用于限定英雄（季节、节日、联动卡池）。他们不一定比其他英雄强，但只能在卡池期间获得，可以让某些战斗更轻松。在卡池期间至少确保3星。', fr: 'Les {I-I/Free Ether} vont en priorité aux Limited Heroes (Banners Seasonal, Festival, Collab). Ils ne sont pas forcément supérieurs aux autres Héros, mais ne sont disponibles que pendant leur Banner et peuvent faciliter certains combats. Récupérez-les au moins en 3 étoiles pendant leur Banner.' } satisfies LangMap,
  premium: { en: 'Premium', jp: 'プレミアム', kr: '프리미엄', zh: '精选', fr: 'Premium' } satisfies LangMap,
  premiumBannerDesc: { en: 'The Premium banner lets you change your rate up target at any time. Our recommended order is listed in the ', jp: 'プレミアムバナーではいつでもピックアップ対象を変更できます。推奨順序は', kr: '프리미엄 배너에서는 언제든지 픽업 대상을 변경할 수 있습니다. 추천 순서는 ', zh: '精选卡池可以随时更换UP目标。推荐顺序请参阅', fr: 'La Premium Banner vous permet de changer votre cible de rate up à tout moment. Notre ordre recommandé est détaillé dans le ' } satisfies LangMap,
  dedicatedGuide: { en: 'dedicated guide', jp: '専用ガイド', kr: '전용 가이드', zh: '专用指南', fr: 'guide dédié' } satisfies LangMap,
  periodSeeGuide: { en: '.', jp: 'をご覧ください。', kr: '를 참고하세요.', zh: '。', fr: '.' } satisfies LangMap,
  regular: { en: 'Regular', jp: '一般', kr: '일반', zh: '常规', fr: 'Réguliers' } satisfies LangMap,
  regularHeroesDesc: { en: 'For Regular heroes in Rate Up Recruit and Custom Recruit we recommend only using {I-I/Special Recruitment Ticket} {I-I/Special Recruitment Ticket (Event)}.', jp: 'ピックアップ募集とカスタム募集の一般ヒーローには、{I-I/Special Recruitment Ticket} {I-I/Special Recruitment Ticket (Event)}のみを使用することをおすすめします。', kr: '픽업 모집과 커스텀 모집의 일반 영웅에는 {I-I/Special Recruitment Ticket} {I-I/Special Recruitment Ticket (Event)}만 사용하는 것을 권장합니다.', zh: '对于UP招募和定向招募的常规英雄，建议只使用{I-I/Special Recruitment Ticket} {I-I/Special Recruitment Ticket (Event)}。', fr: 'Pour les Héros Réguliers sur Rate Up Recruit et Custom Recruit, nous recommandons d\'utiliser uniquement {I-I/Special Recruitment Ticket} {I-I/Special Recruitment Ticket (Event)}.' } satisfies LangMap,
  customRecruitGoal: { en: 'The first goal in Custom Recruit when starting out is a hero that gives the {B/BT_STAT|ST_CRITICAL_RATE} buff.', jp: 'カスタム募集での最初の目標は、{B/BT_STAT|ST_CRITICAL_RATE}バフを付与できるヒーローです。', kr: '커스텀 모집에서의 첫 번째 목표는 {B/BT_STAT|ST_CRITICAL_RATE} 버프를 부여하는 영웅입니다.', zh: '定向招募的首要目标是能提供{B/BT_STAT|ST_CRITICAL_RATE}增益的英雄。', fr: 'Le premier objectif sur le Custom Recruit en débutant est un Héros qui donné le buff {B/BT_STAT|ST_CRITICAL_RATE}.' } satisfies LangMap,

  /* Should I pull for dupes? */
  pullForDupes: { en: 'Should I pull for dupes?', jp: '重ね引きするべきですか？', kr: '중복으로 뽑아야 하나요?', zh: '需要抽重复吗？', fr: 'Faut-il pull pour les dupes ?' } satisfies LangMap,
  regularHeroesFarm: { en: 'Regular heroes can be farmed in the Doppelgänger Challenge, so pulling multiple copies is not required. Unlocking a 3-star hero without recruiting them takes 250 hero pieces, transcending takes 150 per step(*). So recruiting regular heroes while farming for their transcends in Doppelgänger is slightly more efficient. New heroes take 3 months to get added to Doppelgänger and Custom Recruit.', jp: '一般ヒーローはドッペルゲンガーチャレンジで獲得できるため、複数回引く必要はありません。3つ星ヒーローを募集せずに解放するには250ピース、超越には1段階ごとに150ピース(*)が必要です。そのため、一般ヒーローを募集しつつドッペルゲンガーで超越素材を集めるのが若干効率的です。新ヒーローがドッペルゲンガーとカスタム募集に追加されるまで3ヶ月かかります。', kr: '일반 영웅은 도플갱어 챌린지에서 획득할 수 있으므로 여러 번 뽑을 필요가 없습니다. 모집 없이 3성 영웅을 해금하려면 250피스, 초월에는 단계당 150피스(*)가 필요합니다. 따라서 일반 영웅을 모집하면서 도플갱어에서 초월 재료를 모으는 것이 약간 더 효율적입니다. 신규 영웅이 도플갱어와 커스텀 모집에 추가되기까지 3개월이 걸립니다.', zh: '常规英雄可以在分身挑战中获得，所以不需要抽多份。不招募解锁3星英雄需要250碎片，超越每阶段需要150碎片(*)。因此招募常规英雄同时在分身挑战中刷超越材料效率略高。新英雄需要3个月才会加入分身挑战和定向招募。', fr: 'Les Héros Réguliers peuvent être farmés dans le Doppelganger Challenge, donc pull plusieurs copies n\'est pas obligatoire. Débloquer un Héros 3 étoiles sans le recruit coûte 250 pièces, le transcender en coûte 150 par étape(*). Recruit des Héros Réguliers tout en farmant leurs transcends dans le Doppelganger est donc légèrement plus efficace. Les nouveaux Héros mettent 3 mois à être ajoutés au Doppelganger et au Custom Recruit.' } satisfies LangMap,
  transcendSteps: { en: '(*) Transcend Steps being 4*, 4+, 5*, 5+, 5++, 6* for 900 total pieces required.', jp: '(*) 超越段階：4星、4+、5星、5+、5++、6星で合計900ピース必要。', kr: '(*) 초월 단계: 4성, 4+, 5성, 5+, 5++, 6성으로 총 900피스 필요.', zh: '(*) 超越阶段：4星、4+、5星、5+、5++、6星，共需900碎片。', fr: '(*) Les étapes de Transcend sont 4*, 4+, 5*, 5+, 5++, 6* pour un total de 900 pièces requises.' } satisfies LangMap,
  star4WeaknessGauge: { en: ' — for the increased Weakness Gauge Damage is the main target.', jp: ' — 弱点ゲージダメージ増加が主な目標。', kr: ' — 약점 게이지 데미지 증가가 주요 목표.', zh: ' — 弱点槽伤害增加是主要目标。', fr: ' — pour l\'augmentation des dégâts de Weakness Gauge, c\'est la cible principale.' } satisfies LangMap,
  star5Burst3: { en: ' — if they have an interesting burst 3 effect.', jp: ' — 興味深いバースト3効果がある場合。', kr: ' — 흥미로운 버스트 3 효과가 있는 경우.', zh: ' — 如果有有趣的爆发3效果。', fr: ' — s\'ils possèdent un effet Burst 3 intéressant.' } satisfies LangMap,
  star6NotPriority: { en: ' — is usually not a priority for regular heroes, since it only grants a stat bonus and 25 AP at battle start.', jp: ' — 一般ヒーローでは通常優先度が低いです。ステータスボーナスと戦闘開始時25APのみ。', kr: ' — 일반 영웅에서는 보통 우선순위가 낮습니다. 스탯 보너스와 전투 시작 시 25AP만 제공.', zh: ' — 常规英雄通常优先级不高，只提供属性加成和战斗开始时25AP。', fr: ' — n\'est généralement pas une priorité pour les Héros Réguliers, car cela ne donné qu\'un bonus de stat et 25 Action Points en début de combat.' } satisfies LangMap,
  andKwa: { en: ' and ', jp: 'と', kr: '과 ', zh: '和', fr: ' et ' } satisfies LangMap,
  premiumLimitedLead: { en: '', jp: '', kr: '', zh: '', fr: 'Les Héros ' } satisfies LangMap,
  premiumLimitedTranscend: { en: ' heroes transcend primarily via dupes, so these may need multiple copies. How many depends on their individual kits, they generally already work at 3-star. An evaluation of each hero and their transcends is found ', jp: 'ヒーローは主に重ね引きで超越するため、複数回引く必要があるかもしれません。必要な枚数は個々のキットによりますが、基本的に3つ星でも十分機能します。各ヒーローの評価と超越については', kr: ' 영웅은 주로 중복으로 초월하므로 여러 번 뽑아야 할 수 있습니다. 필요한 수량은 개별 키트에 따라 다르지만, 기본적으로 3성에서도 충분히 작동합니다. 각 영웅 평가와 초월에 대해서는 ', zh: '英雄主要通过重复抽取超越，所以可能需要多份。需要多少取决于各自的技能组，但基本上3星就能正常运作。各英雄评价和超越详情请参阅', fr: ' se transcendent principalement via les dupes, ils peuvent donc nécessiter plusieurs copies. Le nombre dépend de leurs kits individuels, mais ils fonctionnent généralement déjà en 3 étoiles. Une évaluation de chaque Héros et de ses transcends se trouve ' } satisfies LangMap,
  here: { en: 'here', jp: 'こちら', kr: '여기', zh: '这里', fr: 'ici' } satisfies LangMap,

  /* What team do I start with? */
  whatTeam: { en: 'What team do I start with?', jp: '最初のチームは何がいいですか？', kr: '처음 팀은 어떻게 구성하나요?', zh: '初始队伍怎么搭配？', fr: 'Avec quelle équipe débuter ?' } satisfies LangMap,
  standardTeam: { en: 'A standard team for Story is a main damage dealer, a crit chance buffer, a Healer and a flexible spot for a debuffer, second damage dealer or buffer, or a Defender. Defenders are not required in most of the story, Healers or Bruisers can handle it.', jp: 'ストーリー用の基本チームは、メインアタッカー、クリティカル率バッファー、ヒーラー、そして自由枠（デバッファー、サブアタッカー、バッファー、またはディフェンダー）です。ストーリーのほとんどでディフェンダーは必須ではなく、ヒーラーやブルーザーで対応できます。', kr: '스토리용 기본 팀은 메인 딜러, 치명타 확률 버퍼, 힐러, 그리고 자유 슬롯(디버퍼, 서브 딜러, 버퍼 또는 디펜더)입니다. 스토리 대부분에서 디펜더는 필수가 아니며, 힐러나 브루저로 대응할 수 있습니다.', zh: '故事模式的标准队伍是主力输出、暴击率增益角色、奶妈，以及自由位（减益角色、副输出、增益角色或坦克）。大部分故事不需要坦克，奶妈或战士型角色就能应付。', fr: 'Une équipe standard pour la Story est composée d\'un main damage dealer, d\'un buffer de Crit Chance, d\'un Healer et d\'un slot flexible pour un debuffer, un second damage dealer ou buffer, ou un Defender. Les Defenders ne sont pas requis dans la majeure partie de la Story ; les Healers ou les Bruisers peuvent suffire.' } satisfies LangMap,
  dpsFromStartDash: { en: 'DPS (from Start Dash banner)', jp: 'DPS（スタートダッシュバナーから）', kr: 'DPS (스타트 대시 배너에서)', zh: 'DPS（来自新手冲刺卡池）', fr: 'DPS (depuis la Start Dash Banner)' } satisfies LangMap,
  critBuffFromCustom: { en: 'Crit Buff (from Custom Recruit banner)', jp: 'クリティカルバフ（カスタム募集バナーから）', kr: '치명타 버프 (커스텀 모집 배너에서)', zh: '暴击增益（来自定向招募卡池）', fr: 'Crit Buff (depuis la Custom Recruit Banner)' } satisfies LangMap,
  healers: { en: 'Healers', jp: 'ヒーラー', kr: '힐러', zh: '奶妈', fr: 'Healers' } satisfies LangMap,
  healersLine: { en: 'You get {P/Mene} for free and can choose between {P/Dianne} and {P/Nella} later, with {P/Monad Eva} also being highly recommended from Premium banner due to her unconditional {B/BT_CALL_BACKUP}.', jp: '{P/Mene}は無料で入手でき、後から{P/Dianne}と{P/Nella}のどちらかを選べます。{P/Monad Eva}も無条件の{B/BT_CALL_BACKUP}があるため、プレミアムバナーからのおすすめです。', kr: '{P/Mene}는 무료로 획득할 수 있고, 나중에 {P/Dianne}와 {P/Nella} 중 하나를 선택할 수 있습니다. {P/Monad Eva}도 무조건적인 {B/BT_CALL_BACKUP}이 있어 프리미엄 배너에서 추천합니다.', zh: '{P/Mene}免费获得，之后可以在{P/Dianne}和{P/Nella}中选择一个。{P/Monad Eva}因为有无条件的{B/BT_CALL_BACKUP}，也推荐从精选卡池获取。', fr: 'Vous obtenez {P/Mene} gratuitement et pouvez choisir entre {P/Dianne} et {P/Nella} plus tard, avec {P/Monad Eva} également fortement recommandée depuis la Premium Banner grâce à son {B/BT_CALL_BACKUP} inconditionnel.' } satisfies LangMap,
  flexSupport: { en: 'Flex/Support', jp: 'フレックス/サポート', kr: '플렉스/서포트', zh: '自由位/辅助', fr: 'Flex/Support' } satisfies LangMap,
  flexLine: { en: '{P/Veronica} {P/Eternal} {P/Akari} or another hero you picked up along the way.', jp: '{P/Veronica} {P/Eternal} {P/Akari}や、途中で入手した他のヒーロー。', kr: '{P/Veronica} {P/Eternal} {P/Akari} 또는 진행 중 획득한 다른 영웅.', zh: '{P/Veronica} {P/Eternal} {P/Akari}或途中获得的其他英雄。', fr: '{P/Veronica} {P/Eternal} {P/Akari} ou un autre Héros récupéré en chemin.' } satisfies LangMap,
  firstBossPriorities: { en: 'First boss priorities are:', jp: '最初のボス優先順位：', kr: '첫 보스 우선순위:', zh: '首要BOSS优先级：', fr: 'Les premières priorités Boss sont :' } satisfies LangMap,
  unidentifiedChimera: { en: 'Unidentified Chimera', jp: '正体不明のキメラ', kr: '정체불명의 키메라', zh: '不明嵌合体', fr: 'Unidentified Chimera' } satisfies LangMap,
  chimeraArmorSets: { en: 'for armor set like {S/SPD} and {S/CHD}.', jp: '：{S/SPD}や{S/CHD}などの防具セット。', kr: ': {S/SPD}와 {S/CHD} 등의 방어구 세트.', zh: '：{S/SPD}和{S/CHD}等防具套装。', fr: 'pour les armor sets comme {S/SPD} et {S/CHD}.' } satisfies LangMap,
  glicys: { en: 'Glicys', jp: 'グリシス', kr: '글리시스', zh: '格利西斯', fr: 'Glicys' } satisfies LangMap,
  and: { en: 'and', jp: 'と', kr: '와', zh: '和', fr: 'et' } satisfies LangMap,
  blazingKnightMeteos: { en: 'Blazing Knight Meteos', jp: '炎の騎士メテオス', kr: '화염의 기사 메테오스', zh: '炎之骑士梅特奥斯', fr: 'Blazing Knight Meteos' } satisfies LangMap,
  forWeaponsAccessories: { en: 'for weapons/accessories.', jp: '：武器/アクセサリー。', kr: ': 무기/액세서리.', zh: '：武器/饰品。', fr: 'pour les armes/accessoires.' } satisfies LangMap,
  earthFireTeam: { en: 'A party that focuses on {E/Earth} & {E/Fire} heroes would be beneficial as a first team to work on. The long term goal is having teams in each element, but focus on building one team at a time. Having one strong team ready speeds up upgrading your next one.', jp: '{E/Earth}と{E/Fire}ヒーローに集中したパーティが最初に育成するチームとしておすすめです。長期目標は各属性のチームを持つことですが、一度に1チームずつ育成に集中しましょう。1つの強いチームを完成させることで、次のチームの育成が加速します。', kr: '{E/Earth}와 {E/Fire} 영웅에 집중한 파티가 첫 번째로 육성할 팀으로 좋습니다. 장기 목표는 각 속성의 팀을 보유하는 것이지만, 한 번에 하나의 팀에 집중하세요. 하나의 강한 팀을 완성하면 다음 팀 육성이 빨라집니다.', zh: '专注于{E/Earth}和{E/Fire}英雄的队伍适合作为第一支培养的队伍。长期目标是拥有各属性的队伍，但一次专注培养一支队伍。完成一支强力队伍会加速下一支队伍的培养。', fr: 'Une party axée sur les Héros {E/Earth} et {E/Fire} constitue une bonne première équipe à travailler. L\'objectif à long terme est d\'avoir une équipe par Élément, mais concentrez-vous sur une seule à la fois. Avoir une équipe forte prête accélère le build de la suivante.' } satisfies LangMap,
  tip: { en: 'Tip:', jp: 'ヒント：', kr: '팁:', zh: '提示：', fr: 'Astuce :' } satisfies LangMap,
  friendSupportTip: { en: 'You can use friends\' support heroes up to stage 10, so this is not a strict requirement.', jp: 'ステージ10までフレンドのサポートヒーローを使えるので、これは厳密な要件ではありません。', kr: '스테이지 10까지 친구의 서포트 영웅을 사용할 수 있으므로, 이것은 엄격한 요구 사항이 아닙니다.', zh: '第10关之前可以使用好友的支援英雄，所以这不是严格要求。', fr: 'Vous pouvez utiliser les Héros support de vos amis jusqu\'au Stage 10, donc ce n\'est pas une exigence stricte.' } satisfies LangMap,

  /* ═══ Where do I go first? ═══ */
  whereGoFirst: { en: 'Where do I go first?', jp: '最初にどこに行くべきですか？', kr: '처음에 어디로 가야 하나요?', zh: '首先应该去哪里？', fr: 'Où aller en premier ?' } satisfies LangMap,
  evaGuideQuests: { en: 'Eva\'s Guide Quests in game will point you around the various gamemodes while clearing Story.', jp: 'ゲーム内のエヴァのガイドクエストがストーリーをクリアしながら様々なゲームモードを案内してくれます。', kr: '게임 내 에바의 가이드 퀘스트가 스토리를 클리어하면서 다양한 게임 모드를 안내해 줍니다.', zh: '游戏内的艾娃引导任务会在推进故事的同时引导你了解各种游戏模式。', fr: 'Les Eva\'s Guide Quests in-game vous orienteront vers les différents modes de jeu pendant que vous avancez dans la Story.' } satisfies LangMap,
  underChallengesLine: { en: 'Under Challenges, the {L/Special Requests|/guides/special-request} will let you unlock a strong starter pack of 6 heroes, along with gear and upgrade materials for them.', jp: 'チャレンジの{L/スペシャルリクエスト|/guides/special-request}で、強力なスターターパックとして6体のヒーロー、装備、強化素材を解放できます。', kr: '챌린지의 {L/스페셜 리퀘스트|/guides/special-request}에서 강력한 스타터 팩으로 6명의 영웅, 장비, 강화 재료를 해금할 수 있습니다.', zh: '在挑战的{L/特别委托|/guides/special-request}中，可以解锁强力新手包：6名英雄、装备和升级材料。', fr: 'Dans Challenges, les {L/Special Requests|/guides/special-request} vous permettent de débloquer un pack starter solide de 6 Héros, avec leur équipement et leurs matériaux d\'upgrade.' } satisfies LangMap,
  experienceSlow: { en: 'Experience is slow at the start, progress through the Bandit Chase stages to get more food daily.', jp: '序盤は経験値獲得が遅いです。バンディットチェイスのステージを進めて、毎日より多くの食糧を獲得しましょう。', kr: '초반에는 경험치 획득이 느립니다. 밴디트 체이스 스테이지를 진행해서 매일 더 많은 식량을 획득하세요.', zh: '初期经验获取较慢。推进悬赏追击关卡来每天获得更多食物。', fr: 'L\'expérience est lente au début ; progressez dans les stages Bandit Chase pour obtenir plus de food quotidiennement.' } satisfies LangMap,
  skywardTowerLine: { en: '{L/Skyward Tower|/guides/skyward-tower} resets monthly, try to get as high as you can.', jp: '{L/昇天の塔|/guides/skyward-tower}は毎月リセットされます。できるだけ高い階層を目指しましょう。', kr: '{L/승천의 탑|/guides/skyward-tower}은 매월 리셋됩니다. 최대한 높은 층까지 올라가세요.', zh: '{L/升天之塔|/guides/skyward-tower}每月重置，尽可能爬到更高层。', fr: 'La {L/Skyward Tower|/guides/skyward-tower} se réinitialise tous les mois ; essayez de monter le plus haut possible.' } satisfies LangMap,

  /* ═══ Gear & Equipment ═══ */
  howGetGear: { en: 'How do I get gear?', jp: '装備はどうやって入手しますか？', kr: '장비는 어떻게 얻나요?', zh: '如何获得装备？', fr: 'Comment obtenir de l\'équipement ?' } satisfies LangMap,
  gearSourceDesc: { en: 'Eva\'s Guide Quests and Skyward Tower will sort this out while levelling, along with the Challenge! Special Request missions\' 6-star legendary gear. When enough Survey Hub or Arena currency is available, these can also offer solid 6-star gear. Farming for gear isn\'t a big focus until you have cleared Stage 10 on the Special Request bosses, so they can only drop 6-star gear.', jp: 'エヴァのガイドクエストと昇天の塔がレベリング中の装備を提供してくれます。また、チャレンジ！スペシャルリクエストミッションの6つ星レジェンダリー装備も入手できます。十分なサーベイハブやアリーナの通貨が貯まったら、これらも良い6つ星装備を提供してくれます。装備ファームは、スペシャルリクエストボスのステージ10をクリアして6つ星装備のみがドロップするようになるまでは、大きな焦点ではありません。', kr: '에바의 가이드 퀘스트와 승천의 탑이 레벨링 중 장비를 제공합니다. 또한 챌린지! 스페셜 리퀘스트 미션의 6성 레전더리 장비도 얻을 수 있습니다. 충분한 서베이 허브나 아레나 화폐가 모이면 이곳에서도 좋은 6성 장비를 얻을 수 있습니다. 장비 파밍은 스페셜 리퀘스트 보스의 스테이지 10을 클리어해서 6성 장비만 드롭되기 전까지는 큰 초점이 아닙니다.', zh: '艾娃引导任务和升天之塔会在升级过程中提供装备，还有挑战！特别委托任务的6星传说装备。当积累足够的调查站或竞技场货币时，也能获得不错的6星装备。在特别委托BOSS的第10关通关、只掉落6星装备之前，装备刷取不是主要重点。', fr: 'Les Eva\'s Guide Quests et la Skyward Tower vous fourniront de l\'équipement pendant le leveling, tout comme les récompenses 6 étoiles légendaires des missions Challenge! Special Request. Avec assez de monnaie du Survey Hub ou de l\'Arène, vous obtiendrez aussi du bon équipement 6 étoiles. Le farm d\'équipement n\'est pas une priorité tant que vous n\'avez pas clear le Stage 10 des bosses Special Request, afin qu\'ils ne droppent que de l\'équipement 6 étoiles.' } satisfies LangMap,
  armorPriority: { en: 'Armor Priority', jp: '防具優先', kr: '방어구 우선', zh: '防具优先', fr: 'Priorité Armor' } satisfies LangMap,
  chimeraArmorDesc: { en: 'is the first focus for armor, as her sets, Speed, Counterattack, Critical Strike, Fortification offer something for any role. Penetration set from Sacreed Guardian would be stronger for damage dealers, but this boss doesn\'t offer sets that are generally useful for other roles.', jp: 'が防具の最初のターゲットです。速度、反撃、クリティカル、鉄壁セットはどの役割にも使えます。聖なる守護者の貫通セットはアタッカーにより強力ですが、このボスは他の役割に汎用的に使えるセットを提供しません。', kr: '가 방어구의 첫 타겟입니다. 속도, 반격, 치명타, 개전 방벽 세트는 어떤 역할에도 사용할 수 있습니다. 성스러운 수호자의 관통 세트가 딜러에게 더 강력하지만, 이 보스는 다른 역할에 범용적으로 사용할 수 있는 세트를 제공하지 않습니다.', zh: '是防具的首要目标。速度、反击、暴击、开战防壁套装适用于任何职业。神圣守护者的穿透套装对输出更强，但这个BOSS不提供对其他职业通用的套装。', fr: 'est la première cible pour l\'armor, car ses sets Speed, Counterattack, Critical Strike et Fortification offrent quelque chose pour chaque rôle. Le set Penetration de Sacreed Guardian serait plus fort pour les damage dealers, mais ce Boss n\'offre pas de sets généralement utiles pour les autres rôles.' } satisfies LangMap,
  weaponsAccessories: { en: 'Weapons/Accessories', jp: '武器/アクセサリー', kr: '무기/액세서리', zh: '武器/饰品', fr: 'Armes/Accessoires' } satisfies LangMap,
  weaponAccessorySkills: { en: 'Weapon and accessory skills depend on the boss, and each boss can only drop accessories with certain main stats.', jp: '武器とアクセサリーのスキルはボスによって異なり、各ボスは特定のメインステータスのアクセサリーのみをドロップします。', kr: '무기와 액세서리 스킬은 보스에 따라 다르며, 각 보스는 특정 메인 스탯의 액세서리만 드롭합니다.', zh: '武器和饰品技能取决于BOSS，每个BOSS只掉落特定主属性的饰品。', fr: 'Les Skills d\'arme et d\'accessoire dépendent du Boss, et chaque Boss ne peut dropper que des accessoires avec certaines main stats.' } satisfies LangMap,
  glicysAccessoryDesc: { en: 'offers accessories with Speed and Crit Chance main stats (also Defense & Resilience), making her the prime target for Weapons and Accessories to start off with.', jp: 'は速度とクリティカル率メインステータス（また防御と抵抗も）のアクセサリーを提供するため、武器とアクセサリーの最初のターゲットとして最適です。', kr: '는 속도와 치명타 확률 메인 스탯 (또한 방어와 저항도) 액세서리를 제공하여, 무기와 액세서리의 첫 타겟으로 최적입니다.', zh: '提供速度和暴击率主属性（还有防御和抵抗）的饰品，是武器和饰品的首选目标。', fr: 'offre des accessoires avec SPD et CHC en main stat (également DEF et Resilience), ce qui en fait la cible principale pour les armes et accessoires en début de jeu.' } satisfies LangMap,
  meteos: { en: 'Meteos', jp: 'メテオス', kr: '메테오스', zh: '梅特奥斯', fr: 'Meteos' } satisfies LangMap,
  meteosAccessoryDesc: { en: 'is the easy next target, with Penetration, Crit Damage, Health and Effectiveness accessory main stat options. Veronica can solo him at stage 10.', jp: 'は次の簡単なターゲットで、貫通、クリティカルダメージ、体力、効果命中のアクセサリーメインステータスを提供します。Veronicaでステージ10をソロできます。', kr: '는 다음 쉬운 타겟으로, 관통, 치명타 피해, 체력, 효과 적중 액세서리 메인 스탯을 제공합니다. Veronica로 스테이지 10을 솔로할 수 있습니다.', zh: '是下一个简单目标，提供穿透、暴击伤害、生命、效果命中的饰品主属性。Veronica可以单刷第10关。', fr: 'est la prochaine cible facile, avec PEN, CHD, HP et EFF comme options de main stat d\'accessoire. Veronica peut le solo jusqu\'au stage 10.' } satisfies LangMap,

  /* EE & Talismans */
  howGetEETalismans: { en: 'How do I get Exclusive Equipment & Talismans?', jp: '専用装備＆タリスマンはどうやって入手しますか？', kr: '전용 장비 & 탈리스만은 어떻게 얻나요?', zh: '如何获得专属装备和护符？', fr: 'Comment obtenir l\'Exclusive Equipment et les Talismans ?' } satisfies LangMap,
  exclusiveEquipment: { en: 'Exclusive Equipment', jp: '専用装備', kr: '전용 장비', zh: '专属装备', fr: 'Exclusive Equipment' } satisfies LangMap,
  exclusiveEquipmentDesc: { en: 'Heroes\' Exclusive Equipment is gained by reaching Affinity level 10. Gifts can be obtained via the Black Market Expedition in the base, and farmed in Story boss stages marked by a daily entry limit. Irregular Extermination Project: Pursuit Operations also give gifts when clearing bosses. You can get an Oath of Determination to instant max out Affinity via certain events.', jp: 'ヒーローの専用装備は信頼度レベル10で入手できます。ギフトは基地のブラックマーケット探検で入手でき、デイリー入場制限のあるストーリーボスステージでファームできます。イレギュラー殲滅作戦：追跡オペレーションでもボスクリア時にギフトが手に入ります。特定のイベントで誓いの決意を入手して、信頼度を即座に最大にすることもできます。', kr: '영웅의 전용 장비는 신뢰도 레벨 10에서 획득합니다. 선물은 기지의 블랙마켓 탐험에서 얻을 수 있고, 일일 입장 제한이 있는 스토리 보스 스테이지에서 파밍할 수 있습니다. 이레귤러 섬멸 작전: 추적 오퍼레이션에서도 보스 클리어 시 선물을 얻을 수 있습니다. 특정 이벤트에서 맹세의 결의를 얻어 신뢰도를 즉시 최대로 올릴 수도 있습니다.', zh: '英雄的专属装备在信赖度10级时获得。礼物可以从基地的黑市探险获得，也可以在有每日入场限制的故事BOSS关卡刷取。异常歼灭作战：追击行动中击败BOSS也能获得礼物。某些活动可以获得誓约决心，立即将信赖度提升到满级。', fr: 'L\'Exclusive Equipment des Héros s\'obtient en atteignant le niveau d\'Affinity 10. Les cadeaux peuvent être obtenus via la Black Market Expedition dans la base, et farmés dans les stages Story Boss avec une limité d\'entrée quotidienne. Irregular Extermination: Pursuit Operations donné aussi des cadeaux lors du clear des bosses. Vous pouvez obtenir un Oath of Determination via certains événements pour maxer l\'Affinity instantanément.' } satisfies LangMap,
  talismansAndCharms: { en: 'Talismans and Charms', jp: 'タリスマンとチャーム', kr: '탈리스만과 참', zh: '护符和符咒', fr: 'Talismans et Charms' } satisfies LangMap,
  talismansDesc: { en: 'The Archdemon\'s Ruins\' Infinite Corridor is the primary source for Talismans. The Archdemon\'s Ruins Shop offers one 6-star selector per month. You also get a few from the Challenge! Special Request missions.', jp: 'アークデーモンの遺跡の無限回廊がタリスマンの主な入手源です。アークデーモンの遺跡ショップでは毎月1つの6つ星セレクターを提供しています。チャレンジ！スペシャルリクエストミッションからもいくつか入手できます。', kr: '아크데몬의 유적의 무한 회랑이 탈리스만의 주요 획득처입니다. 아크데몬의 유적 상점에서는 매월 6성 셀렉터 1개를 제공합니다. 챌린지! 스페셜 리퀘스트 미션에서도 몇 개를 얻을 수 있습니다.', zh: '大恶魔遗迹的无限回廊是护符的主要来源。大恶魔遗迹商店每月提供一个6星选择器。挑战！特别委托任务也能获得一些。', fr: 'L\'Infinite Corridor de l\'Archdemon\'s Ruins est la source principale de Talismans. L\'Archdemon\'s Ruins Shop offre un sélecteur 6 étoiles par mois. Vous en obtenez aussi quelques-uns via les missions Challenge! Special Request.' } satisfies LangMap,

  /* Gear worth keeping */
  gearWorthKeeping: { en: 'What gear is worth keeping?', jp: 'どの装備を残すべきですか？', kr: '어떤 장비를 남겨야 하나요?', zh: '哪些装备值得保留？', fr: 'Quel équipement vaut le coup d\'être gardé ?' } satisfies LangMap,
  dontThrowBlues: { en: 'Don\'t throw those blues!', jp: '注意：青装備を捨てないで！', kr: '주의: 파란 장비를 버리지 마세요!', zh: '注意：不要扔掉蓝色装备！', fr: 'Ne jetez pas les bleus !' } satisfies LangMap,
  epicGearStaple: { en: 'Epic gear is the staple, not far behind Legendary and cheaper to upgrade. Once you get to 6-star gear (shouldn\'t take too long especially with friend supports), it\'ll be easy for reforged Epic gear to overtake 5-star Legendary gear, or even 6-star legendary with lower substat rolls. Green/Superior gear takes a bigger hit on its main stat, but for Helmet/Armor/Boots these can still turn out well when the substats are strong.', jp: 'エピック装備は基本であり、レジェンダリーとそれほど差がなく、強化コストも安いです。6つ星装備を入手したら（フレンドサポートを使えばすぐです）、錬成したエピック装備は5つ星レジェンダリーや、サブステータスの低い6つ星レジェンダリーを簡単に上回ります。緑/スーペリア装備はメインステータスが低くなりますが、ヘルメット/アーマー/ブーツではサブステータスが強ければ良い結果になることがあります。', kr: '에픽 장비가 기본이며, 레전더리와 큰 차이가 없고 강화 비용도 저렴합니다. 6성 장비를 얻으면 (친구 서포트를 사용하면 금방입니다), 재련한 에픽 장비가 5성 레전더리나 서브 스탯이 낮은 6성 레전더리를 쉽게 능가합니다. 그린/슈페리어 장비는 메인 스탯이 낮아지지만, 헬멧/아머/부츠에서는 서브 스탯이 강하면 좋은 결과가 나올 수 있습니다.', zh: '史诗装备是基础，与传说装备差距不大，升级成本也更低。获得6星装备后（使用好友支援很快），重铸的史诗装备可以轻松超越5星传说装备，甚至副属性较低的6星传说装备。绿色/优秀装备主属性会降低，但头盔/护甲/鞋子在副属性强的情况下也能有好结果。', fr: 'L\'équipement Epic est la norme, pas très loin du Legendary et moins cher à upgrade. Une fois que vous arrivez au 6 étoiles (ce qui ne devrait pas prendre trop longtemps, surtout avec les friend supports), l\'équipement Epic reforgé peut facilement surpasser le Legendary 5 étoiles, voire le Legendary 6 étoiles avec de faibles substat rolls. Le gear Green/Superior perd davantage sur sa main stat, mais pour Helmet/Armor/Boots cela peut très bien marcher si les substats sont fortes.' } satisfies LangMap,
  gearReforge: { en: 'Gear can be reforged as many times as it has stars, which unlocks new substats until there are 4, then randomly increases one by one steps. The maximum total substats are:', jp: '装備は星の数だけ錬成でき、4つのサブステータスが揃うまで新しいサブステータスを解放し、その後はランダムに1つずつ上昇します。最大サブステータス合計は：', kr: '장비는 별 개수만큼 재련할 수 있으며, 4개의 서브 스탯이 채워질 때까지 새로운 서브 스탯을 해금하고, 그 후에는 랜덤으로 하나씩 증가합니다. 최대 서브 스탯 합계는:', zh: '装备可以重铸星数次，在4个副属性填满之前解锁新副属性，之后随机提升其中一个。最大副属性总计：', fr: 'L\'équipement peut être reforgé autant de fois qu\'il à d\'étoiles, ce qui débloque de nouvelles substats jusqu\'à 4, puis en augmente une aléatoirement à chaque reforge. Le total maximum des substats est :' } satisfies LangMap,
  sixStarLegendary: { en: '6★ Legendary', jp: '6★ レジェンダリー', kr: '6★ 레전더리', zh: '6★ 传说', fr: '6★ Legendary' } satisfies LangMap,
  eighteenTicks: { en: '18 ticks', jp: '18ティック', kr: '18틱', zh: '18档', fr: '18 ticks' } satisfies LangMap,
  sixStarEpic: { en: '6★ Epic', jp: '6★ エピック', kr: '6★ 에픽', zh: '6★ 史诗', fr: '6★ Epic' } satisfies LangMap,
  seventeenTicks: { en: '17 ticks', jp: '17ティック', kr: '17틱', zh: '17档', fr: '17 ticks' } satisfies LangMap,
  sixStarSuperior: { en: '6★ Superior', jp: '6★ スーペリア', kr: '6★ 슈페리어', zh: '6★ 优秀', fr: '6★ Superior' } satisfies LangMap,
  sixteenTicks: { en: '16 ticks', jp: '16ティック', kr: '16틱', zh: '16档', fr: '16 ticks' } satisfies LangMap,
  gearRarityMeaning: { en: 'Meaning for armor, where the main stat is usually not going to make or break the fight, the rarity of the gear is not important. Weapons, Accessories and Gloves you would aim for the higher rarities, as the main stat here does matter. Legendary Weapons & Accessories also come with skills. When it drops, the substats can have up to 3 ticks worth before reforging, out of 6 maximum. This isn\'t common enough to make it the basic requirement, as long as most of the substats are right you can make use of them. Increase the standards for gear to keep or use as materials as your account grows.', jp: 'つまり防具では、メインステータスが戦闘を左右することは少ないため、レアリティはそれほど重要ではありません。武器、アクセサリー、グローブはメインステータスが重要なので、より高いレアリティを狙いましょう。レジェンダリーの武器とアクセサリーにはスキルも付きます。ドロップ時、サブステータスは錬成前に最大6のうち3ティック分を持つことができます。これは基本要件にするほど一般的ではないので、ほとんどのサブステータスが合っていれば活用できます。アカウントが成長するにつれて、残す装備や素材にする装備の基準を上げていきましょう。', kr: '즉, 방어구에서는 메인 스탯이 전투를 좌우하는 경우가 적으므로 레어리티가 그다지 중요하지 않습니다. 무기, 액세서리, 장갑은 메인 스탯이 중요하므로 더 높은 레어리티를 노리세요. 레전더리 무기와 액세서리에는 스킬도 붙습니다. 드롭 시 서브 스탯은 재련 전 최대 6 중 3틱을 가질 수 있습니다. 이것은 기본 요구 사항으로 삼을 만큼 흔하지 않으므로, 대부분의 서브 스탯이 맞으면 활용할 수 있습니다. 계정이 성장함에 따라 남길 장비와 재료로 쓸 장비의 기준을 높여가세요.', zh: '也就是说，防具的主属性通常不会决定战斗胜负，所以稀有度不那么重要。武器、饰品、手套的主属性很重要，应该追求更高稀有度。传说武器和饰品还带有技能。掉落时副属性最多可以有3档（满6档），在重铸前。这不够常见到成为基本要求，只要大部分副属性合适就可以使用。随着账号成长，逐步提高保留装备和用作材料的装备标准。', fr: 'Concrètement, pour l\'armor, où la main stat ne fait généralement pas la différence dans un combat, la rareté n\'est pas importante. Sur les armes, accessoires et gloves, visez les raretés plus élevées car la main stat compte ici. Les armes et accessoires Legendary viennent aussi avec des skills. Au drop, les substats peuvent avoir jusqu\'à 3 ticks avant reforge, pour un maximum de 6. Ce n\'est pas assez fréquent pour en faire une exigence de base ; tant que la plupart des substats sont bonnes, vous pouvez les utiliser. Relevez vos standards de gear à garder ou à utiliser comme matériaux au fur et à mesure que votre compte progresse.' } satisfies LangMap,

  /* When should I start upgrading gear? */
  whenUpgradeGear: { en: 'When should I start upgrading gear?', jp: 'いつ装備を強化し始めるべきですか？', kr: '언제 장비 강화를 시작해야 하나요?', zh: '什么时候开始强化装备？', fr: 'Quand commencer à upgrade le gear ?' } satisfies LangMap,
  enhancingWeapons: { en: 'Enhancing Weapons', jp: '武器の強化', kr: '무기 강화', zh: '武器强化', fr: 'Enhance des armes' } satisfies LangMap,
  enhancingWeaponsDesc: { en: 'will speed up the early game a lot, this is one you can start doing as soon as you notice progress slowing down.', jp: 'は序盤を大幅に加速します。進行が遅くなったと感じたらすぐに始められます。', kr: '는 초반을 크게 가속합니다. 진행이 느려졌다고 느끼면 바로 시작할 수 있습니다.', zh: '会大大加速前期进度。感觉进度变慢时就可以开始。', fr: ' accélère beaucoup l\'early game ; vous pouvez commencer dès que vous sentez la progression ralentir.' } satisfies LangMap,
  accessories: { en: 'Accessories', jp: 'アクセサリー', kr: '액세서리', zh: '饰品', fr: 'Accessoires' } satisfies LangMap,
  accessoriesCritDesc: { en: 'with crit chance main stat for your damage dealer are the next target to enhance.', jp: 'のアタッカー用のクリティカル率メインステータスが次の強化対象です。', kr: '의 딜러용 치명타 확률 메인 스탯이 다음 강화 대상입니다.', zh: '中输出角色用的暴击率主属性是下一个强化目标。', fr: ' avec CHC en main stat pour votre damage dealer sont la prochaine cible à enhance.' } satisfies LangMap,
  armor: { en: 'Armor', jp: '防具', kr: '방어구', zh: '防具', fr: 'Armor' } satisfies LangMap,
  armorLaterChapters: { en: 'won\'t need enhancements until you\'re in the later chapters of season 1 (and then +5 should be fine for a while).', jp: 'はシーズン1の後半チャプターまで強化の必要はありません（その後も+5でしばらく十分です）。', kr: '는 시즌 1 후반 챕터까지 강화할 필요가 없습니다 (이후에도 +5면 한동안 충분합니다).', zh: '在第一季后半章节之前不需要强化（之后+5也能用很久）。', fr: ' n\'aura pas besoin d\'enhancement avant les derniers chapitres de la saison 1 (et +5 suffira ensuite pendant un moment).' } satisfies LangMap,
  reforgeBreakthrough: { en: 'Reforge/Breakthrough', jp: '錬成/限界突破', kr: '재련/한계돌파', zh: '重铸/突破', fr: 'Reforge/Breakthrough' } satisfies LangMap,
  reforgeNotImportant: { en: 'systems don\'t become important until you have 6-star gear.', jp: 'システムは6つ星装備を入手するまで重要ではありません。', kr: ' 시스템은 6성 장비를 얻을 때까지 중요하지 않습니다.', zh: '系统在获得6星装备之前不重要。', fr: ' : ces systèmes ne deviennent importants qu\'une fois que vous avez de l\'équipement 6 étoiles.' } satisfies LangMap,
  substatsAtSixStar: { en: 'Substats are the focus at 6-star, so Reforging these will be a big part of your heroes\' power.', jp: '6つ星ではサブステータスが焦点になるので、錬成がヒーローの力の大きな部分を占めます。', kr: '6성에서는 서브 스탯이 초점이 되므로, 재련이 영웅 전력의 큰 부분을 차지합니다.', zh: '6星时副属性是重点，所以重铸是英雄战力的重要组成部分。', fr: 'Les substats sont la priorité en 6 étoiles, donc les Reforge prendront une grande place dans la puissance de vos Héros.' } satisfies LangMap,
  breakthroughDesc: { en: 'Breakthrough increases skill/set effects and upgrades main stats by 5% each (up to 4 times). This is one you can leave until you have gear with good substats which will be useful for a long time.', jp: '限界突破はスキル/セット効果を強化し、メインステータスを各5%ずつ（最大4回）上昇させます。これは長く使える良いサブステータスの装備を入手してから行いましょう。', kr: '한계돌파는 스킬/세트 효과를 강화하고, 메인 스탯을 각 5%씩 (최대 4회) 상승시킵니다. 이것은 오래 사용할 좋은 서브 스탯 장비를 얻은 후에 하세요.', zh: '突破强化技能/套装效果，主属性各提升5%（最多4次）。等获得副属性好、能长期使用的装备再做。', fr: 'Breakthrough augmente les effets de skill/set et upgrade les main stats de 5% chacune (jusqu\'à 4 fois). Vous pouvez attendre d\'avoir du gear avec de bonnes substats, utile pour longtemps.' } satisfies LangMap,
  gemsForSpecialGear: { en: 'Gems for Special Gear are equivalent to one Reforge of the same level. They are a large gold sink to upgrade, so not something to focus on early while gold is still scarce and needed for gear enhancements.', jp: '特殊装備用のジェムは同レベルの錬成1回分に相当します。強化にゴールドが大量に必要なので、ゴールドが不足しがちで装備強化に必要な序盤は焦点にしないでください。', kr: '특수 장비용 젬은 같은 레벨의 재련 1회분에 해당합니다. 강화에 골드가 많이 들어가므로, 골드가 부족하고 장비 강화에 필요한 초반에는 초점으로 삼지 마세요.', zh: '特殊装备用的宝石相当于同等级的一次重铸。强化消耗大量金币，所以在金币紧缺、需要装备强化的前期不要专注于此。', fr: 'Les Gems pour le Special Gear équivalent à un Reforge du même niveau. Ils coûtent beaucoup de gold à upgrade, donc ce n\'est pas une priorité en début de jeu, quand le gold est encore rare et nécessaire aux enhancements d\'équipement.' } satisfies LangMap,

  /* ═══ Progression & Resources ═══ */
  skillManualsFirst: { en: 'Where do I use skill manuals first?', jp: 'スキルマニュアルはどこに使うべきですか？', kr: '스킬 매뉴얼은 어디에 먼저 사용하나요?', zh: '技能书优先用在哪里？', fr: 'Où utiliser les Skill Manuals en premier ?' } satisfies LangMap,
  skillUpRule: { en: 'Skill up rule of thumb:', jp: 'スキルアップの目安：', kr: '스킬업 기준:', zh: '技能升级优先级：', fr: 'Règle générale pour le skill up :' } satisfies LangMap,
  skillLevel2Weakness: { en: 'Level 2 for Weakness Gauge damage', jp: '弱点ゲージダメージのためにレベル2', kr: '약점 게이지 데미지를 위해 레벨 2', zh: '为了弱点槽伤害升到2级', fr: 'Niveau 2 pour les dégâts de Weakness Gauge' } satisfies LangMap,
  effectChanceDuration: { en: 'Effect chance, effect duration & cooldown reductions.', jp: '効果確率、効果持続時間、クールダウン減少', kr: '효과 확률, 효과 지속 시간, 쿨다운 감소', zh: '效果概率、效果持续时间、冷却时间减少', fr: 'Effect chance, effect duration et réductions de cooldown.' } satisfies LangMap,
  damageIncreasesDps: { en: 'Damage increases (DPS only)', jp: 'ダメージ増加（DPSのみ）', kr: '데미지 증가 (DPS만)', zh: '伤害增加（仅DPS）', fr: 'Augmentations de dégâts (DPS uniquement)' } satisfies LangMap,
  chainPassive: { en: 'Chain passive can be left at level 2 until much later, the Weakness Gauge damage increase at level 5 is the only interesting part, so you can save skill manuals here until the more important skills are taken care of.', jp: 'チェインパッシブはもっと後までレベル2のままで大丈夫です。レベル5の弱点ゲージダメージ増加が唯一興味深い部分なので、より重要なスキルを優先してスキルマニュアルを節約できます。', kr: '체인 패시브는 나중까지 레벨 2로 둬도 됩니다. 레벨 5의 약점 게이지 데미지 증가가 유일한 관심 부분이므로, 더 중요한 스킬을 우선하여 스킬 매뉴얼을 절약할 수 있습니다.', zh: '连锁被动可以保持在2级直到很后期。5级的弱点槽伤害增加是唯一有趣的部分，所以可以优先更重要的技能来节省技能书。', fr: 'Le Chain Passive peut rester au niveau 2 longtemps : l\'augmentation des dégâts de Weakness Gauge au niveau 5 est la seule partie intéressante, vous pouvez donc économiser les Skill Manuals ici tant que les skills plus importants ne sont pas couverts.' } satisfies LangMap,

  /* Base upgrades */
  baseUpgrades: { en: 'What Base upgrades should I go for?', jp: '基地のアップグレード優先順位は？', kr: '기지 업그레이드 우선순위는?', zh: '基地升级优先级？', fr: 'Quels upgrades de Base viser ?' } satisfies LangMap,
  baseUpgradeOrder: { en: 'You can unlock and upgrade them in the order of Eva\'s Menu:', jp: 'エヴァのメニュー順に解放・アップグレードできます：', kr: '에바의 메뉴 순서대로 해금하고 업그레이드할 수 있습니다:', zh: '可以按艾娃菜单顺序解锁和升级：', fr: 'Vous pouvez les débloquer et les upgrade dans l\'ordre du menu d\'Eva :' } satisfies LangMap,
  antiparticleGenerator: { en: 'Antiparticle Generator', jp: '反粒子ジェネレーター', kr: '반입자 발생기', zh: '反粒子发生器', fr: 'Antiparticle Generator' } satisfies LangMap,
  maxThisFirst: { en: 'Max this first!', jp: '最優先で最大に！', kr: '최우선으로 최대로!', zh: '优先升满！', fr: 'À maxer en premier !' } satisfies LangMap,
  synchroRoom: { en: 'Synchro Room', jp: 'シンクロルーム', kr: '싱크로 룸', zh: '同步室', fr: 'Synchro Room' } satisfies LangMap,
  katesWorkshop: { en: 'Kate\'s Workshop', jp: 'ケイトの工房', kr: '케이트의 공방', zh: '凯特工坊', fr: 'Kate\'s Workshop' } satisfies LangMap,
  supplyModule: { en: 'Supply Module', jp: '補給モジュール', kr: '보급 모듈', zh: '补给模块', fr: 'Supply Module' } satisfies LangMap,
  unlockQuirks: { en: 'Unlock Quirks & Precise Crafting when they are opened (Clear Season 1 stage 9-5).', jp: 'クワーク＆精密クラフトは開放されたら解放しましょう（シーズン1ステージ9-5クリア）。', kr: '퀴크 & 정밀 제작은 열리면 해금하세요 (시즌 1 스테이지 9-5 클리어).', zh: '特质和精密制作开放后解锁（通关第一季9-5关）。', fr: 'Débloquez les Quirks et le Precise Crafting dès qu\'ils s\'ouvrent (clear du stage 9-5 en Season 1).' } satisfies LangMap,

  /* Quirks */
  quirksPriority: { en: 'Priority for Quirks?', jp: 'クワークの優先順位は？', kr: '퀴크 우선순위는?', zh: '特质优先级？', fr: 'Priorité pour les Quirks ?' } satisfies LangMap,
  quirksUpgradeOrder: { en: 'The upgrade order for Quirks depends on what heroes you\'re using and what boss you\'re targeting next. From broad impact to more specific: Counteract Strong Enemies, Class, Element.', jp: 'クワークのアップグレード順は、使っているヒーローと次に狙うボスによります。広い影響から具体的な順：強敵対策、クラス、属性。', kr: '퀴크 업그레이드 순서는 사용하는 영웅과 다음에 노리는 보스에 따라 다릅니다. 넓은 영향에서 구체적인 순서: 강적 대응, 클래스, 속성.', zh: '特质升级顺序取决于使用的英雄和下一个目标BOSS。从广泛影响到具体：对抗强敌、职业、属性。', fr: 'L\'ordre d\'upgrade des Quirks dépend des Héros que vous utilisez et du Boss que vous visez ensuite. Du plus large au plus spécifique : Counteract Strong Enemies, Class, Élément.' } satisfies LangMap,
  dpsSubclassFirst: { en: 'Your preferred damage dealer subclass (Attacker, Bruiser, Wizard, Vanguard) and their element can go before supporters unless you\'re having trouble keeping them alive.', jp: 'お気に入りのダメージディーラーサブクラス（アタッカー、ブルーザー、ウィザード、ヴァンガード）とその属性は、サポーターの生存に問題がなければ先に上げても良いでしょう。', kr: '선호하는 딜러 서브클래스 (어태커, 브루저, 위자드, 뱅가드)와 그 속성은 서포터 생존에 문제가 없다면 먼저 올려도 됩니다.', zh: '你喜欢的输出子职业（攻击者、战士、法师、先锋）和其属性，如果辅助生存没问题的话可以优先升级。', fr: 'Votre subclass de damage dealer préférée (Attacker, Bruiser, Wizard, Vanguard) et son Élément peuvent passer avant les supports, sauf si vous avez du mal à les maintenir en vie.' } satisfies LangMap,
  quirkLevel5: { en: 'Level 5 on the main node is enough to pick up all the side nodes, so you can leave level 6-10 for later.', jp: 'メインノードはレベル5でサイドノードを全て取得できるので、レベル6-10は後回しにできます。', kr: '메인 노드는 레벨 5에서 사이드 노드를 전부 획득할 수 있으므로, 레벨 6-10은 나중으로 미뤄도 됩니다.', zh: '主节点5级就能获取所有侧节点，所以6-10级可以之后再升。', fr: 'Le niveau 5 sur le main node suffit pour récupérer tous les side nodes ; vous pouvez laisser les niveaux 6 à 10 pour plus tard.' } satisfies LangMap,
  utilityQoL: { en: 'Utility doesn\'t help in combat, so picking up these QoL perks is at your own discretion.', jp: 'ユーティリティは戦闘に役立たないので、これらのQoL特典を取るかはお好みで。', kr: '유틸리티는 전투에 도움이 되지 않으므로, 이러한 QoL 특전을 얻을지는 취향입니다.', zh: '实用性不帮助战斗，所以这些便利特权是否获取看个人喜好。', fr: 'Les Quirks Utility n\'aident pas en combat ; libre à vous de les prendre pour leurs avantages QoL.' } satisfies LangMap,

  /* Guild */
  guildImportance: { en: 'How important is joining a guild?', jp: 'ギルドに入ることはどれくらい重要ですか？', kr: '길드 가입은 얼마나 중요한가요?', zh: '加入公会有多重要？', fr: 'À quel point est-ce important de rejoindre une guilde ?' } satisfies LangMap,
  guildDesc: { en: 'It is a source of weekly skill manuals, and you can get hero pieces for Aer, Ame, Dahlia, Drakhan and Epsilon through it. Look for a guild with a level 5 guild shop. The monthly Guild Raid is also an important source of gems and ether.', jp: '週間スキルマニュアルの入手源であり、Aer、Ame、Dahlia、Drakhan、Epsilonのヒーローピースも入手できます。レベル5のギルドショップを持つギルドを探しましょう。月間ギルドレイドもジェムとエーテルの重要な入手源です。', kr: '주간 스킬 매뉴얼 획득처이며, Aer, Ame, Dahlia, Drakhan, Epsilon의 영웅 피스도 얻을 수 있습니다. 레벨 5 길드 상점을 가진 길드를 찾으세요. 월간 길드 레이드도 젬과 에테르의 중요한 획득처입니다.', zh: '是每周技能书的来源，还能获得Aer、Ame、Dahlia、Drakhan、Epsilon的英雄碎片。找一个有5级公会商店的公会。每月公会副本也是宝石和以太的重要来源。', fr: 'C\'est une source de Skill Manuals hebdomadaires, et vous pouvez y obtenir des hero pièces pour Aer, Ame, Dahlia, Drakhan et Epsilon. Cherchez une guilde avec un Guild Shop niveau 5. Le Guild Raid mensuel est aussi une source importante de gems et d\'Ether.' } satisfies LangMap,

  /* ═══ Advanced Tips ═══ */
  heroScaleHealth: { en: 'My hero has skills that scale with health/defense/speed, should I focus on that then?', jp: 'HP/防御/速度でスケールするスキルを持つヒーローは、そのステータスに集中すべきですか？', kr: 'HP/방어/속도로 스케일하는 스킬을 가진 영웅은 그 스탯에 집중해야 하나요?', zh: '有技能按生命/防御/速度缩放的英雄，应该专注那个属性吗？', fr: 'Mon Héros à des skills qui scale avec HP/DEF/SPD, faut-il se concentrer dessus ?' } satisfies LangMap,
  keyWordsLookFor: { en: 'The key words to look for here are ', jp: 'ここで注目すべきキーワードは', kr: '여기서 주목해야 할 키워드는 ', zh: '这里要注意的关键词是', fr: 'Les mots-clés à rechercher ici sont ' } satisfies LangMap,
  insteadOfAttack: { en: '"instead of Attack"', jp: '「攻撃力の代わりに」', kr: '"공격력 대신"', zh: '"代替攻击力"', fr: '"instead of Attack"' } satisfies LangMap,
  proportionalStat: { en: '. When a skill only says its damage increases proportional to a stat, it will still mainly use Attack for its damage calculation. The proportional stat will act as an extra multiplier, but this is generally too small to become the main focus.', jp: 'です。スキルがあるステータスに比例してダメージが増加するとだけ書いてある場合、ダメージ計算には依然として主に攻撃力を使用します。比例ステータスは追加の倍率として機能しますが、これは通常メインの焦点にするには小さすぎます。', kr: '입니다. 스킬이 특정 스탯에 비례해서 데미지가 증가한다고만 쓰여 있으면, 데미지 계산에는 여전히 주로 공격력을 사용합니다. 비례 스탯은 추가 배율로 작용하지만, 이는 보통 메인 초점으로 삼기에는 너무 작습니다.', zh: '。如果技能只说伤害随某属性等比增加，伤害计算仍然主要使用攻击力。比例属性作为额外倍率，但通常太小不值得作为主要关注点。', fr: '. Un skill avec cette mention utilisé autre chose qu\'ATK. En revanche, si le skill ne la comporte pas mais parle d\'une autre stat, cela signifie qu\'elle est utilisée en plus d\'ATK ; elle est cependant généralement trop faible pour en faire la priorité.' } satisfies LangMap,
  deltaHpInstead: { en: '(HP instead of ATK)', jp: '（攻撃力の代わりにHP）', kr: '(공격력 대신 HP)', zh: '（用生命代替攻击）', fr: '(HP au lieu d\'ATK)' } satisfies LangMap,
  deltaScaleDesc: { en: '{P/Delta}\'s skills scale proportional to Max Health instead of {S/ATK}: Focus on {S/HP}', jp: '{P/Delta}のスキルは{S/ATK}の代わりに最大HPに比例：{S/HP}を重視', kr: '{P/Delta}의 스킬은 {S/ATK} 대신 최대 HP에 비례: {S/HP}에 집중', zh: '{P/Delta}的技能按最大生命代替{S/ATK}缩放：专注{S/HP}', fr: 'Les skills de {P/Delta} scalent proportionnellement au Max HP au lieu de {S/ATK} : concentrez-vous sur {S/HP}' } satisfies LangMap,
  stellaHpBonus: { en: '(HP bonus)', jp: '（HPボーナス）', kr: '(HP 보너스)', zh: '（生命加成）', fr: '(bonus HP)' } satisfies LangMap,
  stellaScaleDesc: { en: '{P/Demiurge Stella}\'s skills scale proportional to Max Health: Still goes for {S/ATK} to increase damage, {S/HP} is a bonus.', jp: '{P/Demiurge Stella}のスキルは最大HPに比例：ダメージを増やすには{S/ATK}を重視、{S/HP}はボーナス。', kr: '{P/Demiurge Stella}의 스킬은 최대 HP에 비례: 데미지를 늘리려면 {S/ATK}에 집중, {S/HP}는 보너스.', zh: '{P/Demiurge Stella}的技能按最大生命等比增加：仍然堆{S/ATK}来增加伤害，{S/HP}是加成。', fr: 'Les skills de {P/Demiurge Stella} scalent proportionnellement au Max HP : on vise quand même {S/ATK} pour augmenter les dégâts, {S/HP} reste un bonus.' } satisfies LangMap,
  atkZeroBossExample: { en: 'Against bosses that set your {S/ATK} to 0 (Like Shichifuja\'s Shadow in Skyward Tower Hard): {P/Delta} can deal damage normally. {P/Demiurge Stella}\'s damage will reduce to single digits.', jp: '{S/ATK}を0にするボス（昇天の塔ハードのシチフジャの影など）に対して：{P/Delta}は通常通りダメージを与えられます。{P/Demiurge Stella}のダメージは一桁まで減少します。', kr: '{S/ATK}를 0으로 만드는 보스(승천의 탑 하드의 시치후자의 그림자 등)에 대해: {P/Delta}는 정상적으로 데미지를 줄 수 있습니다. {P/Demiurge Stella}의 데미지는 한 자릿수까지 감소합니다.', zh: '对于将{S/ATK}设为0的BOSS（如升天之塔困难的七伏影）：{P/Delta}可以正常造成伤害。{P/Demiurge Stella}的伤害会降到个位数。', fr: 'Contre les bosses qui mettent votre {S/ATK} à 0 (comme Shichifuja\'s Shadow dans Skyward Tower Hard) : {P/Delta} peut infliger des dégâts normalement. Les dégâts de {P/Demiurge Stella} tombent à un chiffre.' } satisfies LangMap,
} as const;

/* ── Redesign UI chrome strings (presentation only) ─────── */

const UI_ON_THIS_PAGE: LangMap = {
  en: 'On this page', jp: 'このページの内容', kr: '이 페이지에서', zh: '本页内容', fr: 'Sur cette page',
};
const UI_START_HERE: LangMap = {
  en: 'Start here', jp: 'まずここから', kr: '여기부터', zh: '从这里开始', fr: 'Commencez ici',
};

/* ── Redesign presentation atoms ────────────────────────── */

const FA = {
  card: 'rgba(15,23,42,.55)',
  cardHi: 'rgba(30,41,59,.55)',
  border: '#27272a',
  borderSoft: 'rgba(39,39,42,.55)',
  divider: 'rgba(63,63,70,.5)',
  text: '#fafafa',
  text2: '#d4d4d8',
  text3: '#a1a1aa',
  text4: '#71717a',
  text5: '#52525b',
} as const;

type AccentKey = 'sky' | 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan';
const FAQ_COLORS: Record<AccentKey, { base: string; soft: string; dim: string; line: string }> = {
  sky:     { base: '#38bdf8', soft: 'rgba(56,189,248,.13)',  dim: 'rgba(56,189,248,.06)',  line: 'rgba(56,189,248,.35)' },
  violet:  { base: '#a78bfa', soft: 'rgba(167,139,250,.13)', dim: 'rgba(167,139,250,.06)', line: 'rgba(167,139,250,.35)' },
  emerald: { base: '#4ade80', soft: 'rgba(74,222,128,.13)',  dim: 'rgba(74,222,128,.06)',  line: 'rgba(74,222,128,.32)' },
  amber:   { base: '#fbbf24', soft: 'rgba(251,191,36,.13)',  dim: 'rgba(251,191,36,.06)',  line: 'rgba(251,191,36,.32)' },
  rose:    { base: '#fb7185', soft: 'rgba(251,113,133,.13)', dim: 'rgba(251,113,133,.06)', line: 'rgba(251,113,133,.34)' },
  cyan:    { base: '#22d3ee', soft: 'rgba(34,211,238,.13)',  dim: 'rgba(34,211,238,.06)',  line: 'rgba(34,211,238,.32)' },
};

/* Item-rarity colors (shared OP tokens). */
const RARITY: Record<string, string> = {
  legendary: '#f87171',
  epic:      '#93c5fd',
  superior:  '#4ade80',
};

const monoFace = 'var(--font-geist-mono), ui-monospace, monospace';
const titleFace = 'var(--font-geist-sans), system-ui, sans-serif';
const bodyFace = 'var(--font-geist-sans), system-ui, sans-serif';

/* Stable across renders — labels are localized, ids are not. */
const SECTION_IDS = ['getting-started', 'heroes-pulling', 'gear-equipment', 'progression-resources', 'advanced-tips'] as const;

/* ───────────────────────── scrollspy ───────────────────────── */
function useScrollSpy(ids: readonly string[]) {
  const [activeId, setActiveId] = useState<string>(ids[0]);

  useEffect(() => {
    const onScroll = () => {
      const trigger = window.scrollY + window.innerHeight * 0.28;
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= trigger) current = id;
      }
      setActiveId(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [ids]);

  const jump = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
  }, []);

  return { activeId, jump };
}

type TocSection = { id: string; color: AccentKey; label: string };

/* ───────────────────────── TOC (horizontal sticky bar) ───────────────────────── */
function TocBar({ sections, activeId, onJump }: {
  sections: readonly TocSection[]; activeId: string; onJump: (id: string) => void;
}) {
  const { lang } = useI18n();
  return (
    <nav
      aria-label={lRec(UI_ON_THIS_PAGE, lang)}
      className="sticky top-14 z-30 -mx-4 mb-8 border-y border-white/6 bg-slate-950/85 px-4 backdrop-blur md:-mx-6 md:px-6"
    >
      <ul className="flex flex-wrap justify-center gap-1.5 py-2.5">
        {sections.map((s) => {
          const c = FAQ_COLORS[s.color];
          const on = s.id === activeId;
          return (
            <li key={s.id}>
              <a
                href={'#' + s.id}
                onClick={(e) => { e.preventDefault(); onJump(s.id); }}
                style={on ? { color: c.base, backgroundColor: c.soft, borderColor: c.line } : undefined}
                className={[
                  'inline-flex items-center rounded-full border px-3 py-1 text-[12.5px] transition-colors',
                  on ? 'font-medium' : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200',
                ].join(' ')}
              >
                {s.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ───────────────────────── Section heading ───────────────────────── */
function SectionHeading({ color, title }: { color: AccentKey; title: string }) {
  const c = FAQ_COLORS[color];
  return (
    <header style={{ marginBottom: 18 }}>
      <h3 style={{ fontFamily: titleFace, fontSize: 25, fontWeight: 600, letterSpacing: '-0.02em', color: FA.text, margin: 0, lineHeight: 1.1 }}>{title}</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
        <span style={{ height: 2, width: 30, borderRadius: 2, background: c.base, flexShrink: 0 }} />
        <span style={{ height: 1, flex: 1, background: c.line, opacity: 0.5 }} />
      </div>
    </header>
  );
}

/* ───────────────────────── Q→A card ───────────────────────── */
function QACard({ color, featured, badge, q, children }: {
  color: AccentKey; featured?: boolean; badge?: string; q: ReactNode; children: ReactNode;
}) {
  const c = FAQ_COLORS[color];
  return (
    <article style={{
      position: 'relative', borderRadius: 12,
      border: `1px solid ${featured ? c.line : FA.border}`,
      background: featured ? `linear-gradient(180deg, ${c.dim}, transparent 70%), ${FA.card}` : FA.card,
      padding: '20px 22px', overflow: 'hidden',
    }}>
      {featured && <span style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: c.base }} />}
      <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
        <span style={{
          flexShrink: 0, width: 27, height: 27, borderRadius: 7, background: c.soft, border: `1px solid ${c.line}`,
          color: c.base, fontFamily: monoFace, fontSize: 12, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
        }}>Q</span>
        <h4 style={{ fontFamily: titleFace, fontSize: 17.5, fontWeight: 600, letterSpacing: '-0.01em', color: FA.text, margin: 0, lineHeight: 1.35, paddingTop: 2 }}>
          {featured && badge && (
            <span style={{
              display: 'inline-block', verticalAlign: 'middle', marginRight: 9,
              fontFamily: monoFace, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
              color: c.base, background: c.soft, border: `1px solid ${c.line}`, borderRadius: 4, padding: '3px 7px', lineHeight: 1,
            }}>{badge}</span>
          )}
          {q}
        </h4>
      </div>
      <div className="faq-answer" style={{ marginTop: 11, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {children}
      </div>
    </article>
  );
}

function Prose({ children }: { children: ReactNode }) {
  return <p style={{ fontFamily: bodyFace, fontSize: 14.5, lineHeight: 1.72, color: FA.text3, margin: 0, textWrap: 'pretty' }}>{children}</p>;
}

/* Inline link, section-accent tinted. */
function InlineA({ href: hrefTo, color, children }: { href: Route; color: AccentKey; children: ReactNode }) {
  return <Link href={hrefTo} style={{ color: FAQ_COLORS[color].base, textDecoration: 'underline', textUnderlineOffset: 2 }}>{children}</Link>;
}

/* Harmonized callout — accent hex + optional label line. */
function AccentCallout({ accent, label, children }: { accent: string; label?: ReactNode; children: ReactNode }) {
  return (
    <div style={{
      borderRadius: 9, border: `1px solid ${accent}33`, borderLeft: `2px solid ${accent}`,
      background: `${accent}0e`, padding: '12px 14px',
    }}>
      {label && (
        <span style={{ fontFamily: monoFace, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: accent, display: 'block', marginBottom: 7 }}>{label}</span>
      )}
      <div style={{ fontFamily: bodyFace, fontSize: 13.5, lineHeight: 1.6, color: FA.text3 }}>{children}</div>
    </div>
  );
}

/* Accent-topped mini panel (who-to-pull columns, base order, etc.). */
function MiniPanel({ accent, title, children }: { accent: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div style={{ borderRadius: 9, border: `1px solid ${FA.border}`, background: FA.cardHi, padding: '13px 14px', borderTop: `2px solid ${accent}` }}>
      <div style={{ fontFamily: titleFace, fontSize: 14.5, fontWeight: 600, color: FA.text, marginBottom: children ? 8 : 0 }}>{title}</div>
      {children && <div style={{ fontFamily: bodyFace, fontSize: 13, lineHeight: 1.55, color: FA.text3 }}>{children}</div>}
    </div>
  );
}

/* Numbered, accent-keyed ordered list (reforge rules, skill-up, base order). */
function NumberedList({ color, items }: { color: AccentKey; items: ReactNode[] }) {
  const c = FAQ_COLORS[color];
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((it, i) => (
        <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{
            flexShrink: 0, width: 22, height: 22, borderRadius: 6, marginTop: 1, background: c.soft, border: `1px solid ${c.line}`,
            color: c.base, fontFamily: monoFace, fontSize: 11, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>{i + 1}</span>
          <span style={{ fontFamily: bodyFace, fontSize: 14, lineHeight: 1.55, color: FA.text2, paddingTop: 1 }}>{it}</span>
        </li>
      ))}
    </ol>
  );
}

/* Accent-dot bullet list (where-to-go pointers). */
function DotList({ color, items }: { color: AccentKey; items: ReactNode[] }) {
  const c = FAQ_COLORS[color];
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((it, i) => (
        <li key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, marginTop: 8, flexShrink: 0, background: c.base, boxShadow: `0 0 8px ${c.base}` }} />
          <span style={{ fontFamily: bodyFace, fontSize: 14, lineHeight: 1.6, color: FA.text2 }}>{it}</span>
        </li>
      ))}
    </ul>
  );
}

/* Compact "mode → when" row table (base upgrade order). */
function StepRows({ items }: { items: { tone: AccentKey; n: string; label: ReactNode }[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 9, overflow: 'hidden', border: `1px solid ${FA.border}` }}>
      {items.map((it, i) => {
        const c = FAQ_COLORS[it.tone];
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: FA.cardHi }}>
            <span style={{
              fontFamily: monoFace, fontSize: 11, fontWeight: 700, color: c.base, background: c.soft,
              border: `1px solid ${c.line}`, borderRadius: 5, padding: '3px 8px', flexShrink: 0,
            }}>{it.n}</span>
            <span style={{ fontFamily: bodyFace, fontSize: 14, fontWeight: 600, color: FA.text2 }}>{it.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* Gear rarity table — Rarity · Max substats · stars. */
function GearRarityTable({ rows }: { rows: { rarity: string; rarityColor: keyof typeof RARITY; stars: number; ticks: ReactNode }[] }) {
  return (
    <div style={{ borderRadius: 10, border: `1px solid ${FA.border}`, overflow: 'hidden', background: FA.cardHi }}>
      {rows.map((r, i) => {
        const rc = RARITY[r.rarityColor];
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
            borderBottom: i < rows.length - 1 ? `1px solid ${FA.borderSoft}` : 'none',
          }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 116 }}>
              <span style={{ fontFamily: titleFace, fontSize: 14, fontWeight: 600, color: rc }}>{r.rarity}</span>
              <span style={{ display: 'inline-flex', gap: 1, color: rc, fontSize: 9, lineHeight: 1 }}>
                {Array.from({ length: r.stars }).map((_, k) => <span key={k}>★</span>)}
              </span>
            </span>
            <span style={{
              fontFamily: monoFace, fontSize: 11, fontWeight: 600, color: rc, border: `1px solid ${rc}40`,
              background: `${rc}12`, borderRadius: 5, padding: '4px 9px', lineHeight: 1.2,
            }}>{r.ticks}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ───────────────────────── Related grid ───────────────────────── */
/* icon / title / description are sourced from data/guides/_index.json — single
 * source of truth, so editing a guide there updates these cards automatically. */
type GuideIndexEntry = { icon?: string; title?: LangMap; description?: LangMap };
const GUIDES_INDEX = guidesIndex as Record<string, GuideIndexEntry>;

function RelatedGuides({ heading, items }: {
  heading: string;
  items: { slug: string; href: Route; color: AccentKey }[];
}) {
  const { lang } = useI18n();
  return (
    <section style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <h3 style={{ fontFamily: titleFace, fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', color: FA.text, margin: 0 }}>{heading}</h3>
        <span style={{ height: 1, flex: 1, background: FA.divider }} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((g) => {
          const c = FAQ_COLORS[g.color];
          const meta = GUIDES_INDEX[g.slug] ?? {};
          const label = meta.title ? lRec(meta.title, lang) : g.slug;
          const desc = meta.description ? lRec(meta.description, lang) : '';
          return (
            <Link key={g.slug} href={g.href} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', borderRadius: 11,
              border: `1px solid ${FA.border}`, background: FA.card,
            }}>
              <span style={{
                width: 42, height: 42, borderRadius: 9, flexShrink: 0,
                background: `linear-gradient(135deg, ${c.soft}, ${c.dim})`, border: `1px solid ${c.line}`,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              }}>
                {meta.icon && <Image src={`/images/guides/${meta.icon}.webp`} alt="" width={32} height={32} className="object-contain" />}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontFamily: titleFace, fontSize: 15, fontWeight: 600, color: FA.text }}>{label}</span>
                <span style={{ display: 'block', fontFamily: bodyFace, fontSize: 12.5, color: FA.text4, marginTop: 3, lineHeight: 1.4 }}>{desc}</span>
              </span>
              <span style={{ color: c.base, fontSize: 16, flexShrink: 0 }}>→</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ───────────────────────── Page ───────────────────────── */

export default function BeginnerFAQGuide() {
  const { lang, href } = useI18n();
  const L = (m: LangMap) => lRec(m, lang);
  const { activeId, jump } = useScrollSpy(SECTION_IDS);

  const sections: readonly TocSection[] = [
    { id: SECTION_IDS[0], color: 'sky',     label: L(LABELS.sectionGettingStarted) },
    { id: SECTION_IDS[1], color: 'violet',  label: L(LABELS.sectionHeroesPulling) },
    { id: SECTION_IDS[2], color: 'amber',   label: L(LABELS.sectionGearEquipment) },
    { id: SECTION_IDS[3], color: 'emerald', label: L(LABELS.sectionProgressionResources) },
    { id: SECTION_IDS[4], color: 'rose',    label: L(LABELS.sectionAdvancedTips) },
  ];

  return (
    <GuideTemplate title={L(title)} introduction={L(intro)}>
      <TocBar sections={sections} activeId={activeId} onJump={jump} />

      <div className="flex flex-col gap-14">

          {/* ═══ Getting Started ═══ */}
          <section id={SECTION_IDS[0]} style={{ scrollMarginTop: 90 }}>
            <SectionHeading color="sky" title={L(LABELS.sectionGettingStarted)} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <QACard color="sky" q={L(LABELS.rerollImportance)}>
                <Prose>{parseText(L(LABELS.rerollAnswer))}</Prose>
                <Prose>{parseText(L(LABELS.freeHeroesFoundation))}</Prose>
                <Prose>{parseText(L(LABELS.newAccountStarters))}</Prose>
                <Prose>{L(LABELS.doppelgangerFarm)}</Prose>
              </QACard>

              <QACard color="sky" featured badge={L(UI_START_HERE)} q={L(LABELS.whereGoFirst)}>
                <Prose>{L(LABELS.evaGuideQuests)}</Prose>
                <DotList color="sky" items={[
                  parseText(L(LABELS.underChallengesLine)),
                  L(LABELS.experienceSlow),
                  parseText(L(LABELS.skywardTowerLine)),
                ]} />
              </QACard>
            </div>
          </section>

          {/* ═══ 02 · Heroes & Pulling ═══ */}
          <section id={SECTION_IDS[1]} style={{ scrollMarginTop: 90 }}>
            <SectionHeading color="violet" title={L(LABELS.sectionHeroesPulling)} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <QACard color="violet" q={L(LABELS.whoPullFor)}>
                <Prose>{L(LABELS.wideRangeHeroes)}</Prose>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <MiniPanel accent={FAQ_COLORS.violet.base} title={L(LABELS.limited)}>
                    {parseText(L(LABELS.limitedDesc))}
                  </MiniPanel>
                  <MiniPanel accent={FAQ_COLORS.amber.base} title={L(LABELS.premium)}>
                    {L(LABELS.premiumBannerDesc)}
                    <InlineA href={href('/guides/general-guides/premium-limited')} color="amber">{L(LABELS.dedicatedGuide)}</InlineA>
                    {L(LABELS.periodSeeGuide)}
                  </MiniPanel>
                  <MiniPanel accent={FAQ_COLORS.emerald.base} title={L(LABELS.regular)}>
                    {parseText(L(LABELS.regularHeroesDesc))}
                    <br />
                    {parseText(L(LABELS.customRecruitGoal))}
                    <div style={{ marginTop: 8 }}>{parseText('{P/Valentine} {P/Tamara} {P/Skadi} {P/Charlotte}')}</div>
                  </MiniPanel>
                </div>
              </QACard>

              <QACard color="violet" q={L(LABELS.pullForDupes)}>
                <Prose>{L(LABELS.regularHeroesFarm)}</Prose>
                <p style={{ fontFamily: bodyFace, fontSize: 12, color: FA.text4, margin: 0 }}>{L(LABELS.transcendSteps)}</p>
                <DotList color="violet" items={[
                  <><StarBadge level="4" />{L(LABELS.star4WeaknessGauge)}</>,
                  <><StarBadge level="5" />{L(LABELS.star5Burst3)}</>,
                  <><StarBadge level="6" />{L(LABELS.star6NotPriority)}</>,
                ]} />
                <Prose>
                  {L(LABELS.premiumLimitedLead)}
                  <strong style={{ color: FAQ_COLORS.amber.base, fontWeight: 600 }}>{L(LABELS.premium)}</strong>
                  {L(LABELS.andKwa)}
                  <strong style={{ color: FAQ_COLORS.violet.base, fontWeight: 600 }}>{L(LABELS.limited)}</strong>
                  {L(LABELS.premiumLimitedTranscend)}
                  <InlineA href={href('/guides/general-guides/premium-limited')} color="violet">{L(LABELS.here)}</InlineA>
                  {L(LABELS.periodSeeGuide)}
                </Prose>
              </QACard>

              <QACard color="violet" q={L(LABELS.whatTeam)}>
                <Prose>{L(LABELS.standardTeam)}</Prose>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <AccentCallout accent={FAQ_COLORS.rose.base} label={L(LABELS.dpsFromStartDash)}>
                    {parseText('{P/Ame} {P/Rey} {P/Rin} {P/Vlada}')}
                  </AccentCallout>
                  <AccentCallout accent={FAQ_COLORS.sky.base} label={L(LABELS.critBuffFromCustom)}>
                    {parseText('{P/Valentine} {P/Tamara} {P/Skadi} {P/Charlotte}')}
                  </AccentCallout>
                  <AccentCallout accent={FAQ_COLORS.emerald.base} label={L(LABELS.healers)}>
                    {parseText(L(LABELS.healersLine))}
                  </AccentCallout>
                  <AccentCallout accent={FAQ_COLORS.amber.base} label={L(LABELS.flexSupport)}>
                    {parseText(L(LABELS.flexLine))}
                  </AccentCallout>
                </div>
                <AccentCallout accent={FAQ_COLORS.amber.base} label={L(LABELS.firstBossPriorities)}>
                  <ul style={{ listStyle: 'none', margin: '2px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <li>
                      <InlineIcon icon="/images/characters/boss/atb/IG_Turn_4034002.webp" label={L(LABELS.unidentifiedChimera)} size={28} underline={false} />
                      {' '}{parseText(L(LABELS.chimeraArmorSets))}
                    </li>
                    <li>
                      <InlineIcon icon="/images/characters/boss/atb/IG_Turn_4076001.webp" label={L(LABELS.glicys)} size={28} underline={false} />
                      {' '}{L(LABELS.and)}{' '}
                      <InlineIcon icon="/images/characters/boss/atb/IG_Turn_4076002.webp" label={L(LABELS.blazingKnightMeteos)} size={28} underline={false} />
                      {' '}{L(LABELS.forWeaponsAccessories)}
                    </li>
                  </ul>
                  <p style={{ margin: '12px 0 0' }}>{parseText(L(LABELS.earthFireTeam))}</p>
                  <div style={{ marginTop: 12 }}>
                    <AccentCallout accent={FAQ_COLORS.emerald.base} label={L(LABELS.tip)}>
                      {L(LABELS.friendSupportTip)}
                    </AccentCallout>
                  </div>
                </AccentCallout>
              </QACard>
            </div>
          </section>

          {/* ═══ 03 · Gear & Equipment ═══ */}
          <section id={SECTION_IDS[2]} style={{ scrollMarginTop: 90 }}>
            <SectionHeading color="amber" title={L(LABELS.sectionGearEquipment)} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <QACard color="amber" q={L(LABELS.howGetGear)}>
                <Prose>{L(LABELS.gearSourceDesc)}</Prose>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <AccentCallout accent={FAQ_COLORS.cyan.base} label={L(LABELS.armorPriority)}>
                    <InlineIcon icon="/images/characters/boss/atb/IG_Turn_4034002.webp" label={L(LABELS.unidentifiedChimera)} size={28} underline={false} />
                    {' '}{L(LABELS.chimeraArmorDesc)}
                  </AccentCallout>
                  <AccentCallout accent={FAQ_COLORS.rose.base} label={L(LABELS.weaponsAccessories)}>
                    {L(LABELS.weaponAccessorySkills)}
                    <br />
                    <InlineIcon icon="/images/characters/boss/atb/IG_Turn_4076001.webp" label={L(LABELS.glicys)} size={28} underline={false} />
                    {' '}{L(LABELS.glicysAccessoryDesc)}
                    <br />
                    <InlineIcon icon="/images/characters/boss/atb/IG_Turn_4076002.webp" label={L(LABELS.meteos)} size={28} underline={false} />
                    {' '}{L(LABELS.meteosAccessoryDesc)}
                  </AccentCallout>
                </div>
              </QACard>

              <QACard color="amber" q={L(LABELS.howGetEETalismans)}>
                <AccentCallout accent={FAQ_COLORS.violet.base} label={L(LABELS.exclusiveEquipment)}>
                  {L(LABELS.exclusiveEquipmentDesc)}
                </AccentCallout>
                <AccentCallout accent={FAQ_COLORS.sky.base} label={L(LABELS.talismansAndCharms)}>
                  {L(LABELS.talismansDesc)}
                </AccentCallout>
              </QACard>

              <QACard color="amber" q={L(LABELS.gearWorthKeeping)}>
                <AccentCallout accent={FAQ_COLORS.rose.base}>
                  <strong style={{ color: FAQ_COLORS.rose.base, fontWeight: 600 }}>{L(LABELS.dontThrowBlues)}</strong>
                </AccentCallout>
                <Prose>{L(LABELS.epicGearStaple)}</Prose>
                <Prose>{L(LABELS.gearReforge)}</Prose>
                <GearRarityTable rows={[
                  { rarity: L(LABELS.sixStarLegendary), rarityColor: 'legendary', stars: 6, ticks: L(LABELS.eighteenTicks) },
                  { rarity: L(LABELS.sixStarEpic),      rarityColor: 'epic',      stars: 6, ticks: L(LABELS.seventeenTicks) },
                  { rarity: L(LABELS.sixStarSuperior),  rarityColor: 'superior',  stars: 6, ticks: L(LABELS.sixteenTicks) },
                ]} />
                <Prose>{L(LABELS.gearRarityMeaning)}</Prose>
              </QACard>

              <QACard color="amber" q={L(LABELS.whenUpgradeGear)}>
                <NumberedList color="amber" items={[
                  <><strong style={{ color: FA.text, fontWeight: 600 }}>{L(LABELS.enhancingWeapons)}</strong> {L(LABELS.enhancingWeaponsDesc)}</>,
                  <><strong style={{ color: FA.text, fontWeight: 600 }}>{L(LABELS.accessories)}</strong> {L(LABELS.accessoriesCritDesc)}</>,
                  <><strong style={{ color: FA.text, fontWeight: 600 }}>{L(LABELS.armor)}</strong> {L(LABELS.armorLaterChapters)}</>,
                  <><strong style={{ color: FA.text, fontWeight: 600 }}>{L(LABELS.reforgeBreakthrough)}</strong> {L(LABELS.reforgeNotImportant)}</>,
                ]} />
                <DotList color="amber" items={[
                  L(LABELS.substatsAtSixStar),
                  L(LABELS.breakthroughDesc),
                  L(LABELS.gemsForSpecialGear),
                ]} />
              </QACard>
            </div>
          </section>

          {/* ═══ 04 · Progression & Resources ═══ */}
          <section id={SECTION_IDS[3]} style={{ scrollMarginTop: 90 }}>
            <SectionHeading color="emerald" title={L(LABELS.sectionProgressionResources)} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <QACard color="emerald" q={L(LABELS.skillManualsFirst)}>
                <AccentCallout accent={FAQ_COLORS.amber.base} label={L(LABELS.skillUpRule)}>
                  <div style={{ marginTop: 2 }}>
                    <NumberedList color="amber" items={[
                      L(LABELS.skillLevel2Weakness),
                      L(LABELS.effectChanceDuration),
                      L(LABELS.damageIncreasesDps),
                    ]} />
                  </div>
                </AccentCallout>
                <Prose>{L(LABELS.chainPassive)}</Prose>
              </QACard>

              <QACard color="emerald" q={L(LABELS.baseUpgrades)}>
                <Prose>{L(LABELS.baseUpgradeOrder)}</Prose>
                <StepRows items={[
                  { tone: 'rose',    n: '01', label: <>{L(LABELS.antiparticleGenerator)} <span style={{ color: FA.text4, fontWeight: 400 }}>· {L(LABELS.maxThisFirst)}</span></> },
                  { tone: 'amber',   n: '02', label: L(LABELS.synchroRoom) },
                  { tone: 'emerald', n: '03', label: L(LABELS.katesWorkshop) },
                  { tone: 'sky',     n: '04', label: L(LABELS.supplyModule) },
                ]} />
                <Prose>{L(LABELS.unlockQuirks)}</Prose>
              </QACard>

              <QACard color="emerald" q={L(LABELS.quirksPriority)}>
                <Prose>{L(LABELS.quirksUpgradeOrder)}</Prose>
                <Prose>{L(LABELS.dpsSubclassFirst)}</Prose>
                <Prose>{L(LABELS.quirkLevel5)}</Prose>
                <Prose>{L(LABELS.utilityQoL)}</Prose>
              </QACard>

              <QACard color="emerald" q={L(LABELS.guildImportance)}>
                <Prose>{L(LABELS.guildDesc)}</Prose>
              </QACard>
            </div>
          </section>

          {/* ═══ 05 · Advanced Tips ═══ */}
          <section id={SECTION_IDS[4]} style={{ scrollMarginTop: 90 }}>
            <SectionHeading color="rose" title={L(LABELS.sectionAdvancedTips)} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <QACard color="rose" q={L(LABELS.heroScaleHealth)}>
                <Prose>
                  {L(LABELS.keyWordsLookFor)}
                  <strong style={{ color: FA.text, fontWeight: 600, textDecoration: 'underline' }}>{L(LABELS.insteadOfAttack)}</strong>
                  {L(LABELS.proportionalStat)}
                </Prose>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <MiniPanel accent={FAQ_COLORS.emerald.base} title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{parseText('{P/Delta}')}<span style={{ fontSize: 12, color: FA.text4 }}>{L(LABELS.deltaHpInstead)}</span></span>}>
                    <div style={{ marginBottom: 6 }}>
                      {parseText('{SK/Delta|S1} {SK/Delta|S2} {SK/Delta|S3}')}
                    </div>
                    {parseText(L(LABELS.deltaScaleDesc))}
                  </MiniPanel>
                  <MiniPanel accent={FAQ_COLORS.amber.base} title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{parseText('{P/Demiurge Stella}')}<span style={{ fontSize: 12, color: FA.text4 }}>{L(LABELS.stellaHpBonus)}</span></span>}>
                    <div style={{ marginBottom: 6 }}>
                      {parseText('{SK/Demiurge Stella|S1} {SK/Demiurge Stella|S2} {SK/Demiurge Stella|S3}')}
                    </div>
                    {parseText(L(LABELS.stellaScaleDesc))}
                  </MiniPanel>
                </div>
                <AccentCallout accent={FAQ_COLORS.violet.base}>
                  {parseText(L(LABELS.atkZeroBossExample))}
                </AccentCallout>
              </QACard>
            </div>
          </section>

          {/* ═══ Related Guides ═══ */}
          <RelatedGuides
            heading={L(LABELS.sectionRelatedGuides)}
            items={[
              { slug: 'free-heroes-start-banner', href: href('/guides/general-guides/free-heroes-start-banner'), color: 'sky' },
              { slug: 'premium-limited',          href: href('/guides/general-guides/premium-limited'),          color: 'violet' },
              { slug: 'gear',                     href: href('/guides/general-guides/gear'),                     color: 'amber' },
              { slug: 'heroes-growth',            href: href('/guides/general-guides/heroes-growth'),            color: 'emerald' },
            ]}
          />
      </div>
    </GuideTemplate>
  );
}
