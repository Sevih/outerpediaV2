'use client';

import GuideTemplate from '@/app/components/guides/GuideTemplate';
import BossPortrait from '@/app/components/guides/BossPortrait';
import InlineIcon from '@/app/components/inline/InlineIcon';
import ItemInline from '@/app/components/inline/ItemInline';
import ElementInline from '@/app/components/inline/ElementInline';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { LangMap } from '@/types/common';

/* ── Helpers ────────────────────────────────────────────── */

function I({ name, label }: { name: string; label: string }) {
  return <InlineIcon icon={`/images/items/${name}.webp`} label={label} />;
}

const BOSSES = {
  ironStretcher:  { icons: '4013071', name: { en: 'Iron Stretcher', kr: '아이언 스트레쳐', jp: 'アイアンストレッチャー', zh: '铁血伸张者' } satisfies LangMap },
  blockbuster:    { icons: '4013072', name: { en: 'Blockbuster', kr: '블록버스터', jp: 'ブラックバスター', zh: '破坏猛兽' } satisfies LangMap },
  mutatedWyvre:   { icons: '4014003', name: { en: 'Mutated Wyvre', kr: '변이된 와이브르', jp: '変異したワイブル', zh: '变异双足飞龙' } satisfies LangMap },
  irregularQueen: { icons: '4089001', name: { en: 'Irregular Queen', kr: '이레귤러 퀸', jp: 'イレギュラークイーン', zh: '异型怪女王' } satisfies LangMap },
} as const;

/* ── LangMap constants ──────────────────────────────────── */

const LABELS = {
  roadmap: {
    en: 'Roadmap',
    jp: 'ロードマップ',
    kr: '로드맵',
    zh: '路线图',
  } satisfies LangMap,
  intro: {
    en: 'Learn how to efficiently spend your stamina daily in Outerplane with this step-by-step guide.',
    jp: 'この手順ガイドで、Outerplane の毎日のスタミナを効率よく使う方法を学びましょう。',
    kr: '이 단계별 가이드로 Outerplane에서 매일 스태미나를 효율적으로 사용하는 법을 알아보세요.',
    zh: '通过这份分步指南，了解每日如何在异域战记中高效地消耗体力',
  } satisfies LangMap,

  /* ── Intro paragraphs ── */
  spending: {
    en: 'Spending ',
    jp: '',
    kr: '',
    zh: '高效使用',
  } satisfies LangMap,
  spendingEfficiently: {
    en: ' efficiently is one of the most important things you can do to progress in this game — especially if you plan to play long-term.',
    jp: 'を効率的に使うことは、このゲームで進行する上で最も重要なことの一つです — 特に長期的にプレイする予定なら。',
    kr: '를 효율적으로 사용하는 것은 이 게임에서 성장하는 데 가장 중요한 일 중 하나입니다 — 특히 장기 플레이를 계획한다면.',
    zh: '是游戏中最重要的事情之一 — 尤其是如果你计划长期游玩。',
  } satisfies LangMap,
  herePriorities: {
    en: "Here's a list of daily priorities to help you spend your ",
    jp: '以下は',
    kr: '다음은 ',
    zh: '以下是帮助你明智使用',
  } satisfies LangMap,
  prioritiesWisely: {
    en: ' wisely and keep resources flowing into your account:',
    jp: 'を賢く使い、アカウントにリソースを流し続けるための毎日の優先事項リストです：',
    kr: '를 현명하게 사용하고 계정에 지속적으로 자원을 확보하기 위한 일일 우선순위 목록입니다:',
    zh: '并持续获取资源的每日优先事项列表：',
  } satisfies LangMap,

  /* ── Doppelgänger ── */
  heading_doppelganger: {
    en: 'Doppelgänger',
    jp: 'ドッペルゲンガー',
    kr: '도플갱어',
    zh: '分身挑战',
  } satisfies LangMap,
  costs60: {
    en: 'Costs 60 ',
    jp: '1日60',
    kr: '하루 60',
    zh: '每日消耗60',
  } satisfies LangMap,
  perDay: {
    en: ' per day.',
    jp: '消費。',
    kr: ' 소모.',
    zh: '。',
  } satisfies LangMap,

  /* ── Terminus Isle ── */
  heading_terminusIsle: {
    en: 'Terminus Isle',
    jp: 'ターミナルアイル',
    kr: '터미널 아일',
    zh: '终点岛',
  } satisfies LangMap,
  costs30: {
    en: 'Costs 30 ',
    jp: '1日30',
    kr: '하루 30',
    zh: '每日消耗30',
  } satisfies LangMap,

  /* ── Stage 13 Weapon/Accessory Bosses ── */
  heading_stage13WeaponAccessory: {
    en: 'Stage 13 Weapon/Accessory Bosses',
    jp: 'ステージ13 武器/アクセサリーボス',
    kr: '스테이지 13 무기/악세서리 보스',
    zh: '第13关 武器/饰品Boss',
  } satisfies LangMap,
  clearAll5Bosses: {
    en: 'Clear all 5 bosses, 3 times each (daily cap). Costs 240 ',
    jp: '全5ボスを各3回クリア（1日の上限）。240',
    kr: '5개 보스 모두 각 3회 클리어(일일 상한). 240',
    zh: '通关全部5个Boss，每个3次（每日上限）。消耗240',
  } satisfies LangMap,
  dotSuffix: {
    en: '.',
    jp: '消費。',
    kr: ' 소모.',
    zh: '。',
  } satisfies LangMap,
  rewards: {
    en: 'Rewards: ',
    jp: '報酬：',
    kr: '보상: ',
    zh: '奖励：',
  } satisfies LangMap,
  eeEnhancement: {
    en: ' (EE enhancement), ',
    jp: '（専用装備強化）、',
    kr: '(전용 장비 강화), ',
    zh: '（专属装备强化）、',
  } satisfies LangMap,
  talismanEnhancement: {
    en: ' (Talisman enhancement), ',
    jp: '（タリスマン強化）、',
    kr: '(탈리스만 강화), ',
    zh: '（护符强化）、',
  } satisfies LangMap,
  randomLegendaryGear: {
    en: ', and random 6★ legendary gear (useful for transcend fodder if stats are bad).',
    jp: '、ランダムな6★レジェンダリー装備（ステータスが悪ければ超越素材として使用可能）。',
    kr: ', 랜덤 6★ 레전더리 장비(스탯이 나쁘면 초월 재료로 사용 가능).',
    zh: '、随机6★传说装备（属性差可作为超越材料）。',
  } satisfies LangMap,

  /* ── Hard Mode Story Final Bosses ── */
  heading_hardModeStoryBosses: {
    en: 'Hard Mode Story Final Bosses',
    jp: 'ハードモード ストーリー最終ボス',
    kr: '하드 모드 스토리 최종 보스',
    zh: '困难模式 剧情最终Boss',
  } satisfies LangMap,
  startingSeason3: {
    en: 'Starting from Season 3 stage 5-10, each chapter costs 50 ',
    jp: 'シーズン3ステージ5-10から、各章のクリアに50',
    kr: '시즌 3 스테이지 5-10부터 각 챕터 클리어에 50',
    zh: '从第3季5-10关开始，每章通关消耗50',
  } satisfies LangMap,
  toClear150: {
    en: ' to clear (150 total currently and increasing).',
    jp: '消費（現在合計150、今後増加予定）。',
    kr: ' 소모(현재 총 150, 계속 증가 중).',
    zh: '（目前共150，持续增加中）。',
  } satisfies LangMap,
  greatForFarming: {
    en: 'Great for farming ',
    jp: '',
    kr: '',
    zh: '非常适合刷取',
  } satisfies LangMap,
  commaSep: {
    en: ', ',
    jp: '、',
    kr: ', ',
    zh: '、',
  } satisfies LangMap,
  from5starDismantleAndRedGear: {
    en: ' (from 5★ dismantle), and 6★ red gear.',
    jp: '（5★分解から）、6★赤装備のファームに最適。',
    kr: '(5★ 분해로 획득), 6★ 레드 장비 파밍에 최적.',
    zh: '（5★分解获得）和6★红色装备。',
  } satisfies LangMap,

  /* ── Irregular Bosses ── */
  heading_irregularBosses: {
    en: 'Irregular Bosses',
    jp: 'イレギュラーボス',
    kr: '이레귤러 보스',
    zh: '异常Boss',
  } satisfies LangMap,
  clearInfiltration: {
    en: "Clear the Infiltration stage. For Pursuit, joining other players' bosses costs 20 ",
    jp: '侵入ステージをクリア。追跡では、他プレイヤーのボスに参加すると1回20',
    kr: '침투 스테이지 클리어. 추적에서 다른 플레이어의 보스 참가 시 1회 20',
    zh: '通关渗透关卡。追踪中加入其他玩家的Boss每次消耗20',
  } satisfies LangMap,
  perRunVeryHard: {
    en: ' per run (Very Hard).',
    jp: '消費（ベリーハード）。',
    kr: ' 소모(베리 하드).',
    zh: '（超难）。',
  } satisfies LangMap,
  rewards50kGold: {
    en: 'Rewards: 50K ',
    jp: '報酬：50K',
    kr: '보상: 50K',
    zh: '奖励：50K',
  } satisfies LangMap,
  smallChanceIrregularGear: {
    en: ', and a small (~5%) chance for Irregular gear:',
    jp: '、イレギュラー装備の低確率（約5%）：',
    kr: ', 이레귤러 장비 저확률(약 5%):',
    zh: '、低概率（约5%）获得异常装备：',
  } satisfies LangMap,
  from: {
    en: ' from ',
    jp: '：',
    kr: ': ',
    zh: '：来自',
  } satisfies LangMap,
  farmUntil8kCells: {
    en: 'Farm until you reach 8K cells/month (for 2K ',
    jp: '月8Kセルに達するまでファーム（2K',
    kr: '월 8K 셀에 도달할 때까지 파밍(2K',
    zh: '刷到月8K细胞为止（用于2K',
  } satisfies LangMap,
  passRewardsThenExtra: {
    en: ' pass rewards), then use any extra stamina to farm more if you need.',
    jp: 'パス報酬のため）、その後必要に応じて余ったスタミナでさらにファーム。',
    kr: ' 패스 보상용), 이후 필요시 남은 스태미나로 추가 파밍.',
    zh: '通行证奖励），之后如有需要可用剩余体力继续刷。',
  } satisfies LangMap,

  /* ── Tower Floors ── */
  heading_towerFloors: {
    en: 'Tower Floors',
    jp: '塔フロア',
    kr: '탑 층',
    zh: '塔层',
  } satisfies LangMap,
  towerClearMonthly: {
    en: 'At least clear Normal floor 100 and Hard floor 17 each month (clear all floor if possible to empty the shop). Will cost 500+ ',
    jp: '毎月最低でもノーマル100階とハード17階をクリア（可能なら全階クリアしてショップを空に）。500+',
    kr: '매월 최소 노말 100층과 하드 17층 클리어(가능하면 전층 클리어하여 상점 비우기). 500+',
    zh: '每月至少通关普通100层和困难17层（如果可能的话全层通关以清空商店）。消耗500+',
  } satisfies LangMap,
  dependingOnProgress: {
    en: ', depending on progress.',
    jp: '消費、進行度による。',
    kr: ' 소모, 진행도에 따라 다름.',
    zh: '，取决于进度。',
  } satisfies LangMap,

  /* ── Adventure License ── */
  heading_adventureLicense: {
    en: 'Adventure License',
    jp: '冒険免許',
    kr: '모험 면허',
    zh: '冒险执照',
  } satisfies LangMap,
  clearBossesWeekly: {
    en: 'Clear as many bosses as you can weekly. Each attempt costs 10 ',
    jp: '毎週できるだけ多くのボスをクリア。1回10',
    kr: '매주 최대한 많은 보스 클리어. 1회 10',
    zh: '每周尽可能多地通关Boss。每次消耗10',
  } satisfies LangMap,
  twoAttemptsPerBoss: {
    en: " (2 attempts per boss). Doing 1 per day helps avoid a large stamina drain at week's end.",
    jp: '消費（ボスごとに2回まで）。1日1回やることで週末の大量スタミナ消費を回避。',
    kr: ' 소모(보스당 2회까지). 하루에 1개씩 하면 주말에 대량 스태미나 소모를 피할 수 있음.',
    zh: '（每个Boss 2次）。每天做1个可以避免周末大量消耗体力。',
  } satisfies LangMap,
  chestCanReward15: {
    en: ' (note that the chest can reward you with 15 ',
    jp: '（チェストから15',
    kr: '(상자에서 15',
    zh: '（宝箱可能奖励15',
  } satisfies LangMap,
  closeParen: {
    en: ')',
    jp: 'が出ることもある）',
    kr: '가 나올 수 있음)',
    zh: '）',
  } satisfies LangMap,

  /* ── Total baseline ── */
  heading_totalBaseline: {
    en: 'Total baseline',
    jp: '基本合計',
    kr: '기본 총량',
    zh: '基础总量',
  } satisfies LangMap,
  approx560: {
    en: '~560 ',
    jp: '約560',
    kr: '약 560',
    zh: '约560',
  } satisfies LangMap,
  plusIrregularTowerLicense: {
    en: ' + however much you spend on Irregular Bosses, Tower, and Adventure License.',
    jp: ' + イレギュラーボス、塔、冒険免許に使う分。',
    kr: ' + 이레귤러 보스, 탑, 모험 면허에 사용하는 양.',
    zh: ' + 异常Boss、塔、冒险执照的消耗量。',
  } satisfies LangMap,

  /* ── (Optional) Monad Gate ── */
  heading_monadGate: {
    en: '(Optional) Monad Gate',
    jp: '（オプション）モナドゲート',
    kr: '(선택) 모나드 게이트',
    zh: '（可选）莫纳德之门',
  } satisfies LangMap,
  monadGateConsider: {
    en: 'Doing 1 run per day is to consider since you can grab some useful titles like ',
    jp: '1日1回は検討の価値あり。',
    kr: '하루 1회 진행 고려. ',
    zh: '每日1次值得考虑。可以获得',
  } satisfies LangMap,
  tunerLabel: {
    en: 'Tuner',
    jp: 'チューナー',
    kr: '튜너',
    zh: '调谐者',
  } satisfies LangMap,
  thatGives10pct: {
    en: ' that gives you +10% ',
    jp: 'のような便利な称号が手に入り、',
    kr: ' 같은 유용한 칭호를 얻을 수 있으며, ',
    zh: '等有用称号，提供',
  } satisfies LangMap,
  and15pctDropRate: {
    en: ' and 15% increased drop rate during Special Request content.',
    jp: '+10%とスペシャルリクエストコンテンツでのドロップ率15%増加が得られます。',
    kr: ' +10%와 특별 의뢰 콘텐츠에서 드롭률 15% 증가 효과가 있음.',
    zh: '+10%和特别委托内容掉落率增加15%。',
  } satisfies LangMap,
  costs30run: {
    en: 'Costs 30 ',
    jp: '1回30',
    kr: '1회 30',
    zh: '每次消耗30',
  } satisfies LangMap,
  perRun: {
    en: ' per run.',
    jp: '消費。',
    kr: ' 소모.',
    zh: '。',
  } satisfies LangMap,

  /* ── (Optional) Stage 13 Armor Bosses ── */
  heading_stage13Armor: {
    en: '(Optional) Stage 13 Armor Bosses',
    jp: '（オプション）ステージ13 防具ボス',
    kr: '(선택) 스테이지 13 방어구 보스',
    zh: '（可选）第13关 防具Boss',
  } satisfies LangMap,
  lowOnTranscendFodder: {
    en: "If you're low on transcend fodder and want ",
    jp: '超越素材が不足していて',
    kr: '초월 재료가 부족하고 ',
    zh: '如果超越材料不足且需要',
  } satisfies LangMap,
  farmThemToGet: {
    en: ', farm them to get ',
    jp: 'が欲しい場合、',
    kr: '가 필요하면 ',
    zh: '，可以刷取',
  } satisfies LangMap,
  periodSuffix: {
    en: '.',
    jp: 'を入手するためにファーム。',
    kr: '을 얻기 위해 파밍.',
    zh: '。',
  } satisfies LangMap,
  costs240: {
    en: 'Costs 240 ',
    jp: '1日240',
    kr: '하루 240',
    zh: '每日消耗240',
  } satisfies LangMap,

  /* ── Non-endgame suggestions ── */
  notYetEndgame: {
    en: "If you're not yet in the endgame, here are other suggestions:",
    jp: 'まだエンドゲームに達していない場合の他の提案：',
    kr: '아직 엔드게임에 도달하지 않았다면 다른 제안:',
    zh: '如果你还没到达终局内容，以下是其他建议：',
  } satisfies LangMap,
  farmStage12ArmorBosses: {
    en: 'Farm Stage 12 Armor Bosses',
    jp: 'ステージ12 防具ボスをファーム',
    kr: '스테이지 12 방어구 보스 파밍',
    zh: '刷第12关 防具Boss',
  } satisfies LangMap,
  focusOn: {
    en: ': Focus on ',
    jp: '：必要なものが手に入るまで',
    kr: ': 필요한 것을 얻을 때까지 ',
    zh: '：专注于',
  } satisfies LangMap,
  andEither: {
    en: ', and either ',
    jp: '、そして',
    kr: ', 그리고 ',
    zh: '，以及',
  } satisfies LangMap,
  or: {
    en: ' or ',
    jp: 'か',
    kr: ' 또는 ',
    zh: '或',
  } satisfies LangMap,
  untilYouGetWhatYouNeed: {
    en: " until you get what you need. ",
    jp: 'に集中。',
    kr: '에 집중. ',
    zh: '，直到获得所需装备。',
  } satisfies LangMap,
  fireGearLessUseful: {
    en: " gear is less useful unless you're chasing specific stats. Clearing 3 stage 12 bosses costs 36 ",
    jp: '装備は特定のステータスを狙っていない限り有用性が低い。ステージ12ボス3体クリアで36',
    kr: ' 장비는 특정 스탯을 노리지 않는 한 유용성이 낮음. 스테이지 12 보스 3개 클리어에 36',
    zh: '装备除非追求特定属性否则用处不大。通关3个第12关Boss消耗36',
  } satisfies LangMap,
  heading_hardModeStoryBossesAlt: {
    en: 'Hard Mode Story Bosses',
    jp: 'ハードモード ストーリーボス',
    kr: '하드 모드 스토리 보스',
    zh: '困难模式 剧情Boss',
  } satisfies LangMap,
  greatFor: {
    en: ': Great for ',
    jp: '：',
    kr: ': ',
    zh: '：非常适合获取',
  } satisfies LangMap,
  affectionItemsLabel: {
    en: 'Affection Items',
    jp: '好感度アイテム',
    kr: '호감도 아이템',
    zh: '好感度道具',
  } satisfies LangMap,
  upgradeStonesLabel: {
    en: 'Upgrade Stones',
    jp: '強化石',
    kr: '강화석',
    zh: '强化石',
  } satisfies LangMap,
  andSep: {
    en: ', and ',
    jp: '、',
    kr: ', ',
    zh: '和',
  } satisfies LangMap,
  from5starDismantle: {
    en: ' (from 5★ dismantle).',
    jp: '（5★分解から）に最適。',
    kr: '(5★ 분해로 획득)에 최적.',
    zh: '（5★分解获得）。',
  } satisfies LangMap,

  /* ── Pro tips ── */
  avoidReceiveAll: {
    en: 'Avoid clicking "Receive All" in your mailbox',
    jp: 'メールボックスの「すべて受け取る」をクリックしないで',
    kr: '우편함에서 "모두 받기"를 클릭하지 마세요',
    zh: '避免点击邮箱中的「全部领取」',
  } satisfies LangMap,
  staminaRewardsStay: {
    en: ': Stamina rewards stay for ~6 days. Let your bar regenerate naturally, then claim rewards as needed to cover your dailies.',
    jp: '：スタミナ報酬は約6日間保持されます。バーを自然に回復させ、必要に応じてデイリーをカバーするために報酬を受け取りましょう。',
    kr: ': 스태미나 보상은 약 6일간 보관됩니다. 바가 자연 회복되도록 두고, 일일 과제를 위해 필요할 때 보상을 받으세요.',
    zh: '：体力奖励会保留约6天。让体力条自然恢复，需要时再领取奖励来完成每日任务。',
  } satisfies LangMap,
  noteOtherDailies: {
    en: 'Note: Other dailies like ',
    jp: '注意：',
    kr: '참고: ',
    zh: '注意：',
  } satisfies LangMap,
  bountyHunter: {
    en: 'Bounty Hunter',
    jp: 'バウンティハンター',
    kr: '현상금 사냥꾼',
    zh: '赏金猎人',
  } satisfies LangMap,
  alsoValuableButUse: {
    en: ' are also valuable, but they use ',
    jp: 'など他のデイリーも価値がありますが、',
    kr: ' 등 다른 일일 과제도 가치가 있지만, ',
    zh: '等其他每日任务也很有价值，但使用的是',
  } satisfies LangMap,
  notStamina: {
    en: ', not ',
    jp: 'を使用し、',
    kr: '을 사용하며, ',
    zh: '而不是',
  } satisfies LangMap,
  periodEnd: {
    en: '.',
    jp: 'ではありません。',
    kr: '가 아닙니다.',
    zh: '。',
  } satisfies LangMap,
} as const;

/* ── Component ──────────────────────────────────────────── */

const HL = 'text-yellow-400 underline';

export default function DailyStaminaGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate title={lRec(LABELS.roadmap, lang)} introduction={lRec(LABELS.intro, lang)}>
      <div className="space-y-6">

        {/* ── Intro paragraphs ── */}

        <p>
          {lRec(LABELS.spending, lang)}
          <ItemInline name="Stamina" />
          {lRec(LABELS.spendingEfficiently, lang)}
        </p>

        <p>
          {lRec(LABELS.herePriorities, lang)}
          <ItemInline name="Stamina" />
          {lRec(LABELS.prioritiesWisely, lang)}
        </p>

        {/* ── Doppelgänger ── */}

        <h3>
          {lRec(LABELS.heading_doppelganger, lang)}
        </h3>
        <p>
          {lRec(LABELS.costs60, lang)}
          <ItemInline name="Stamina" />
          {lRec(LABELS.perDay, lang)}
        </p>

        {/* ── Terminus Isle ── */}

        <h3>
          {lRec(LABELS.heading_terminusIsle, lang)}
        </h3>
        <p>
          {lRec(LABELS.costs30, lang)}
          <ItemInline name="Stamina" />
          {lRec(LABELS.perDay, lang)}
        </p>

        {/* ── Stage 13 Weapon/Accessory Bosses ── */}

        <h3>
          {lRec(LABELS.heading_stage13WeaponAccessory, lang)}
        </h3>
        <p>
          {lRec(LABELS.clearAll5Bosses, lang)}
          <ItemInline name="Stamina" />
          {lRec(LABELS.dotSuffix, lang)}
          <br />
          {lRec(LABELS.rewards, lang)}
          <ItemInline name="Blue Memory Piece" />
          {lRec(LABELS.eeEnhancement, lang)}
          <ItemInline name="Blue Star Mist" />
          {lRec(LABELS.talismanEnhancement, lang)}
          <ItemInline name="Gold" />
          {lRec(LABELS.randomLegendaryGear, lang)}
        </p>

        {/* ── Hard Mode Story Final Bosses ── */}

        <h3>
          {lRec(LABELS.heading_hardModeStoryBosses, lang)}
        </h3>
        <p>
          {lRec(LABELS.startingSeason3, lang)}
          <ItemInline name="Stamina" />
          {lRec(LABELS.toClear150, lang)}
          <br />
          {lRec(LABELS.greatForFarming, lang)}
          <ItemInline name="Gold" />
          {lRec(LABELS.commaSep, lang)}
          <ItemInline name="Gems" />
          {lRec(LABELS.commaSep, lang)}
          <ItemInline name="Legendary Reforge Catalyst" />
          {lRec(LABELS.from5starDismantleAndRedGear, lang)}
        </p>

        {/* ── Irregular Bosses ── */}

        <h3>
          {lRec(LABELS.heading_irregularBosses, lang)}
        </h3>
        <p>
          {lRec(LABELS.clearInfiltration, lang)}
          <ItemInline name="Stamina" />
          {lRec(LABELS.perRunVeryHard, lang)}
          <br />
          {lRec(LABELS.rewards50kGold, lang)}
          <ItemInline name="Gold" />
          {lRec(LABELS.commaSep, lang)}
          <ItemInline name="Irregular Cell Type IV" />
          {lRec(LABELS.commaSep, lang)}
          <ItemInline name="Epic Quality Present Selection Chest" />
          {lRec(LABELS.commaSep, lang)}
          <ItemInline name="Random Upgrade Stone Chest" />
          {lRec(LABELS.smallChanceIrregularGear, lang)}
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <span className="font-semibold text-equipment">Briareos Collection</span>
            {lRec(LABELS.from, lang)}
            <span className="inline-flex items-center gap-1.5 align-middle">
              <BossPortrait icons={BOSSES.ironStretcher.icons} name={lRec(BOSSES.ironStretcher.name, lang)} size="sm" />
              <span className="font-medium">{lRec(BOSSES.ironStretcher.name, lang)}</span>
            </span>
            {' / '}
            <span className="inline-flex items-center gap-1.5 align-middle">
              <BossPortrait icons={BOSSES.blockbuster.icons} name={lRec(BOSSES.blockbuster.name, lang)} size="sm" />
              <span className="font-medium">{lRec(BOSSES.blockbuster.name, lang)}</span>
            </span>
          </li>
          <li>
            <span className="font-semibold text-equipment">Gorgon Collection</span>
            {lRec(LABELS.from, lang)}
            <span className="inline-flex items-center gap-1.5 align-middle">
              <BossPortrait icons={BOSSES.mutatedWyvre.icons} name={lRec(BOSSES.mutatedWyvre.name, lang)} size="sm" />
              <span className="font-medium">{lRec(BOSSES.mutatedWyvre.name, lang)}</span>
            </span>
            {' / '}
            <span className="inline-flex items-center gap-1.5 align-middle">
              <BossPortrait icons={BOSSES.irregularQueen.icons} name={lRec(BOSSES.irregularQueen.name, lang)} size="sm" />
              <span className="font-medium">{lRec(BOSSES.irregularQueen.name, lang)}</span>
            </span>
          </li>
        </ul>
        <p>
          {lRec(LABELS.farmUntil8kCells, lang)}
          <ItemInline name="Ether" />
          {lRec(LABELS.passRewardsThenExtra, lang)}
        </p>

        {/* ── Tower Floors ── */}

        <h3>
          {lRec(LABELS.heading_towerFloors, lang)}
        </h3>
        <p>
          {lRec(LABELS.towerClearMonthly, lang)}
          <ItemInline name="Stamina" />
          {lRec(LABELS.dependingOnProgress, lang)}
        </p>

        {/* ── Adventure License ── */}

        <h3>
          {lRec(LABELS.heading_adventureLicense, lang)}
        </h3>
        <p>
          {lRec(LABELS.clearBossesWeekly, lang)}
          <ItemInline name="Stamina" />
          {lRec(LABELS.twoAttemptsPerBoss, lang)}
          <br />
          {lRec(LABELS.rewards, lang)}
          <ItemInline name="Gold" />
          {', '}
          <ItemInline name="License Point" />
          {', '}
          <ItemInline name="Adventurer Chest" />
          {lRec(LABELS.chestCanReward15, lang)}
          <ItemInline name="Stamina" />
          {lRec(LABELS.closeParen, lang)}
        </p>

        {/* ── Total baseline ── */}

        <h3>
          {lRec(LABELS.heading_totalBaseline, lang)}
        </h3>
        <p>
          {lRec(LABELS.approx560, lang)}
          <ItemInline name="Stamina" />
          {lRec(LABELS.plusIrregularTowerLicense, lang)}
        </p>

        {/* ── (Optional) Monad Gate ── */}

        <h3>
          {lRec(LABELS.heading_monadGate, lang)}
        </h3>
        <p>
          {lRec(LABELS.monadGateConsider, lang)}
          <I name="EBT_WORLD_BOSS_TITLE" label={lRec(LABELS.tunerLabel, lang)} />
          {lRec(LABELS.thatGives10pct, lang)}
          <ItemInline name="Gold" />
          {lRec(LABELS.and15pctDropRate, lang)}
          <br />
          {lRec(LABELS.costs30run, lang)}
          <ItemInline name="Stamina" />
          {lRec(LABELS.perRun, lang)}
        </p>

        {/* ── (Optional) Stage 13 Armor Bosses ── */}

        <h3>
          {lRec(LABELS.heading_stage13Armor, lang)}
        </h3>
        <p>
          {lRec(LABELS.lowOnTranscendFodder, lang)}
          <ItemInline name="Armor Glunite" />
          {lRec(LABELS.farmThemToGet, lang)}
          <ItemInline name="Armor Glunite Fragment" />
          {lRec(LABELS.periodSuffix, lang)}
          <br />
          {lRec(LABELS.costs240, lang)}
          <ItemInline name="Stamina" />
          {lRec(LABELS.perDay, lang)}
        </p>

        {/* ── Separator ── */}

        <hr className="my-4 border-neutral-700" />

        {/* ── Non-endgame suggestions ── */}

        <p>
          {lRec(LABELS.notYetEndgame, lang)}
        </p>

        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong className={HL}>
              {lRec(LABELS.farmStage12ArmorBosses, lang)}
            </strong>
            {lRec(LABELS.focusOn, lang)}
            <ElementInline element="Earth" />
            {', '}
            <ElementInline element="Light" />
            {lRec(LABELS.andEither, lang)}
            <ElementInline element="Dark" />
            {lRec(LABELS.or, lang)}
            <ElementInline element="Water" />
            {lRec(LABELS.untilYouGetWhatYouNeed, lang)}
            <ElementInline element="Fire" />
            {lRec(LABELS.fireGearLessUseful, lang)}
            <ItemInline name="Stamina" />
            {'.'}
          </li>
          <li>
            <strong className={HL}>
              {lRec(LABELS.heading_hardModeStoryBossesAlt, lang)}
            </strong>
            {lRec(LABELS.greatFor, lang)}
            <I name="TI_Present_01_01" label={lRec(LABELS.affectionItemsLabel, lang)} />
            {', '}
            <I name="TI_Item_Growth_Earth_02" label={lRec(LABELS.upgradeStonesLabel, lang)} />
            {', '}
            <ItemInline name="Gems" />
            {lRec(LABELS.andSep, lang)}
            <ItemInline name="Legendary Reforge Catalyst" />
            {lRec(LABELS.from5starDismantle, lang)}
          </li>
        </ul>

        {/* ── Pro tips ── */}

        <p>
          {'⚠️ '}
          <strong className={HL}>
            {lRec(LABELS.avoidReceiveAll, lang)}
          </strong>
          {lRec(LABELS.staminaRewardsStay, lang)}
        </p>

        <p>
          {lRec(LABELS.noteOtherDailies, lang)}
          <strong>
            {lRec(LABELS.bountyHunter, lang)}
          </strong>
          {lRec(LABELS.alsoValuableButUse, lang)}
          <ItemInline name="Bounty Hunter Ticket(s)" />
          {lRec(LABELS.notStamina, lang)}
          <ItemInline name="Stamina" />
          {lRec(LABELS.periodEnd, lang)}
        </p>

      </div>
    </GuideTemplate>
  );
}
