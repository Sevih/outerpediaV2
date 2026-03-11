'use client';

import Link from 'next/link';
import ElementInline from '@/app/components/inline/ElementInline';
import ClassInline from '@/app/components/inline/ClassInline';
import CharacterPortrait from '@/app/components/character/CharacterPortrait';
import ImageLightbox from '@/app/components/ui/ImageLightbox';
import type { ElementType, ClassType } from '@/types/enums';
import type { Lang, LangMap } from '@/types/common';
import { lRec } from '@/lib/i18n/localize';
import { localePath } from '@/lib/navigation';

// Shared styles
export const highlight = "text-yellow-400 font-semibold";
export const newChar = "text-purple-400 font-semibold";
export const coreFusion = "text-pink-400 font-semibold";

// Image base path
const IMG_BASE = "/images/guides/roadmap2026";

// Types
export interface RoadmapQuarter {
  quarter: string;
  title: LangMap;
  items: LangMap[];
}

export interface MonthlyUpdate {
  month: LangMap;
  highlights: LangMap[];
  newCharacters?: LangMap[];
  coreFusions?: string[];
  balance?: LangMap[];
  content?: LangMap[];
}

export interface NewCharacterData {
  name: string;
  element: ElementType;
  classType: ClassType;
  borderColor: string;
  bgColor: string;
  textColor: string;
  pve: LangMap;
  pvp: LangMap;
  images: string[];
  note?: LangMap;
}

export interface CoreFusionChar {
  id: string;
  name: string;
  month: LangMap;
}

// Localized labels
export const LABELS = {
  newCharacters: { en: "New Characters:", jp: "新キャラクター:", kr: "신규 캐릭터:", zh: "新角色:" },
  coreFusion: { en: "Core Fusion:", jp: "コア融合:", kr: "코어 융합:", zh: "核心融合:" },
  balance: { en: "Balance:", jp: "バランス調整:", kr: "밸런스:", zh: "平衡调整:" },
  content: { en: "Content:", jp: "コンテンツ:", kr: "콘텐츠:", zh: "内容:" },
  tacticsLeague: { en: "Tactics League", jp: "タクティクスリーグ", kr: "전술 리그", zh: "战术联赛" },
  mastersLeague: { en: "Masters League", jp: "マスターズリーグ", kr: "마스터스 리그", zh: "大师联赛" },
  rtaRules: { en: "RTA Rules", jp: "RTAルール", kr: "RTA 규칙", zh: "RTA规则" },
  validUntil: { en: "Valid until", jp: "有効期限:", kr: "유효 기간:", zh: "有效期至" },
  translationBy: { en: "Translation by @NewWorld", jp: "翻訳: @NewWorld", kr: "번역: @NewWorld", zh: "翻译: @NewWorld" },
  source: { en: "Source: Outerplane Offline Meeting (January 17, 2026)", jp: "出典: アウタープレイン オフラインミーティング (2026年1月17日)", kr: "출처: 아우터플레인 오프라인 미팅 (2026년 1월 17일)", zh: "来源: Outerplane 线下见面会 (2026年1月17日)" },
  coreFusionDesc: {
    en: "Starting from Lisha in January, 1 per month. Goal: About 10 or more Core Fusion Characters per year.",
    jp: "1月のリシャを皮切りに、毎月1キャラ。目標：年間10キャラ以上のコア融合。",
    kr: "1월 리샤를 시작으로 매월 1명. 목표: 연간 10명 이상의 코어 융합 캐릭터.",
    zh: "从1月的丽莎开始，每月1个。目标：每年约10个以上的核心融合角色。"
  },
  quarterlyOverview: { en: "Quarterly Overview", jp: "四半期概要", kr: "분기별 개요", zh: "季度概览" },
  janMar: { en: "Jan - Mar", jp: "1月〜3月", kr: "1월 - 3월", zh: "1月-3月" },
  aprJul: { en: "Apr - Jul", jp: "4月〜7月", kr: "4월 - 7월", zh: "4月-7月" },
  cfSnowNotia: { en: "CF Snow & Notia", jp: "CF スノウ & ノティア", kr: "CF 스노우 & 노티아", zh: "核心融合 雪诺 & 诺缇亚" },
  dimensionSingularity: { en: "Dimension Singularity", jp: "次元特異点", kr: "차원 특이점", zh: "次元奇点" },
  rtaOverview: { en: "RTA Overview", jp: "RTA概要", kr: "RTA 개요", zh: "RTA(实时对战)概览" },
} as const satisfies Record<string, LangMap>;

// Data
export const ROADMAP_QUARTERS: RoadmapQuarter[] = [
  {
    quarter: "Q1",
    title: { en: "Contents clean up & better up, Season 4 Story, RTA", jp: "コンテンツ整理＆改善、シーズン4ストーリー、RTA", kr: "콘텐츠 정리 및 개선, 시즌 4 스토리, RTA", zh: "内容清理与优化、第4季剧情、RTA" },
    items: [
      { en: "Content cleanup", jp: "コンテンツ整理", kr: "콘텐츠 정리", zh: "内容清理" },
      { en: "Season 4 Chapter 1-2", jp: "シーズン4 チャプター1-2", kr: "시즌 4 챕터 1-2", zh: "第4季第1-2章" },
      { en: "RTA Beta Test", jp: "RTAベータテスト", kr: "RTA 베타 테스트", zh: "RTA B测" },
      { en: "GUI Renewal", jp: "GUI刷新", kr: "GUI 개편", zh: "GUI更新" }
    ]
  },
  {
    quarter: "Q2",
    title: { en: "3rd Anniversary, Contents clean up & better up, New PVE, Subculture taste", jp: "3周年、コンテンツ整理＆改善、新PVE、サブカルテイスト強化", kr: "3주년, 콘텐츠 정리 및 개선, 신규 PVE, 서브컬처 테이스트 강화", zh: "3周年、内容清理与优化、新PVE、亚文化风味" },
    items: [
      { en: "3rd Anniversary", jp: "3周年", kr: "3주년", zh: "3周年" },
      { en: "Contents clean up & better up", jp: "コンテンツ整理＆改善", kr: "콘텐츠 정리 및 개선", zh: "内容清理与优化" },
      { en: "Growth expansion", jp: "成長拡張", kr: "성장 확장", zh: "成长扩展" },
      { en: "New PVE content", jp: "新PVEコンテンツ", kr: "신규 PVE 콘텐츠", zh: "新PVE内容" },
      { en: "Enhancing Subculture taste", jp: "サブカルテイスト強化", kr: "서브컬처 테이스트 강화", zh: "亚文化风味提升" }
    ]
  },
  {
    quarter: "Q3",
    title: { en: "OP 2.0, Story Renewal, Steam Release", jp: "OP 2.0、ストーリーリニューアル、Steam配信", kr: "OP 2.0, 스토리 리뉴얼, Steam 출시", zh: "OP 2.0、故事更新、上线Steam" },
    items: [
      { en: "Outerplane 2.0", jp: "アウタープレイン 2.0", kr: "아우터플레인 2.0", zh: "Outerplane 2.0" },
      { en: "Story Renewal", jp: "ストーリーリニューアル", kr: "스토리 리뉴얼", zh: "剧情更新" },
      { en: "Visual fixes", jp: "ビジュアル修正", kr: "비주얼 수정", zh: "视觉图像修复" },
      { en: "Steam Release", jp: "Steam配信", kr: "Steam 출시", zh: "上线Steam" }
    ]
  },
  {
    quarter: "Q4",
    title: { en: "3.5 Anniversary, New Story Expansion", jp: "3.5周年、新ストーリー拡張", kr: "3.5주년, 신규 스토리 확장", zh: "3.5周年、主线新剧情扩展" },
    items: [
      { en: "3.5 Anniversary", jp: "3.5周年", kr: "3.5주년", zh: "3.5周年" },
      { en: "New Story Expansion", jp: "新ストーリー拡張", kr: "신규 스토리 확장", zh: "新剧情扩展" },
      { en: "Continuous Updates", jp: "継続アップデート", kr: "지속적인 업데이트", zh: "持续更新" }
    ]
  }
];

export const MONTHLY_UPDATES: MonthlyUpdate[] = [
  {
    month: { en: "January", jp: "1月", kr: "1월", zh: "1月" },
    newCharacters: [{ en: "Monad Iota (New Demiurge)", jp: "モナド・イオタ（新デミウルゴス）", kr: "모나드 이오타 (신규 데미우르고스)", zh: "单子·佑妲（新创世之神）" }],
    coreFusions: ["Lisha"],
    balance: [
      { en: "Demiurge Astei", jp: "デミウルゴス・アステイ", kr: "데미우르고스 아스테이", zh: "创世之神 奥斯黛" },
      { en: "Removing Accuracy and Evasion stats", jp: "命中率と回避率の削除", kr: "명중률과 회피율 스탯 제거", zh: "移除能力值的命中和闪避" }
    ],
    content: [
      { en: "Season 4 Chapter 1", jp: "シーズン4 チャプター1", kr: "시즌 4 챕터 1", zh: "第4季第1章" },
      { en: "Event Story: The Sun, Its Light Eternal!", jp: "イベントストーリー: 太陽、その永遠の光!", kr: "이벤트 스토리: 태양, 그 영원한 빛!", zh: "活动剧情：太阳，其永恒之光！" }
    ],
    highlights: []
  },
  {
    month: { en: "February", jp: "2月", kr: "2월", zh: "2月" },
    newCharacters: [{ en: "Classic 3★ Premine (Freemine)", jp: "クラシック3★ プリマイン（フリーマイン）", kr: "클래식 3★ 프리마인 (프리마인)", zh: "普池3★普莉玛茵（弗莉玛茵）" }],
    coreFusions: ["Snow"],
    balance: [{ en: "Demiurge Drakan", jp: "デミウルゴス・ドラカン", kr: "데미우르고스 드라칸", zh: "创世之神 德雷坎" }],
    content: [
      { en: "Season 4 Chapter 2", jp: "シーズン4 チャプター2", kr: "시즌 4 챕터 2", zh: "第4季第2章" },
      { en: "Event Story: Chocolate, Sweet Temptation!", jp: "イベントストーリー: チョコレート、甘い誘惑!", kr: "이벤트 스토리: 초콜릿, 달콤한 유혹!", zh: "活动剧情：巧克力，甜蜜诱惑！" },
      { en: "Elemental Tower Light/Dark 100 floor expansion", jp: "属性の塔 光/闇 100階拡張", kr: "속성의 탑 빛/어둠 100층 확장", zh: "元素塔光/暗100层扩展" },
      { en: "Contents Fix 1", jp: "コンテンツ修正1", kr: "콘텐츠 수정 1", zh: "内容修复1" },
      { en: "GUI Renewal", jp: "GUI刷新", kr: "GUI 개편", zh: "GUI更新" },
      { en: "User Suggestions", jp: "ユーザー要望", kr: "유저 건의사항", zh: "用户建议" }
    ],
    highlights: []
  },
  {
    month: { en: "March", jp: "3月", kr: "3월", zh: "3月" },
    newCharacters: [{ en: "Classic 3★ Eris", jp: "クラシック3★ エリス", kr: "클래식 3★ 에리스", zh: "普池3★厄莉斯" }],
    coreFusions: ["Notia"],
    balance: [{ en: "Demiurge Vlada", jp: "デミウルゴス・ヴラダ", kr: "데미우르고스 블라다", zh: "创世之神 布拉达" }],
    content: [
      { en: "Event Story: Class E Health Teacher", jp: "イベントストーリー: E組の保健教師", kr: "이벤트 스토리: E반 보건 선생님", zh: "活동剧情：E班的保健老师" },
      { en: "RTA Beta Test", jp: "RTAベータテスト", kr: "RTA 베타 테스트", zh: "RTA B测" },
      { en: "Contents Fix 2", jp: "コンテンツ修正2", kr: "콘텐츠 수정 2", zh: "内容修复2" },
      { en: "GUI Renewal", jp: "GUI刷新", kr: "GUI 개편", zh: "GUI更新" },
      { en: "User Suggestions", jp: "ユーザー要望", kr: "유저 건의사항", zh: "用户建议" }
    ],
    highlights: []
  },
  {
    month: { en: "April", jp: "4月", kr: "4월", zh: "4月" },
    newCharacters: [{ en: "Gnosis Domine (New Demiurge)", jp: "グノーシス・ドミネ（新デミウルゴス）", kr: "그노시스 도미네 (신규 데미우르고스)", zh: "诺西斯·多蜜涅（新创世神）" }],
    coreFusions: ["Eternal"],
    balance: [{ en: "Light Type characters (No demiurge or limited)", jp: "光属性キャラ（デミウルゴス・限定除く）", kr: "빛 속성 캐릭터 (데미우르고스/한정 제외)", zh: "光属性角色（除创世神/限定）" }],
    content: [
      { en: "Event Story: Promised Land", jp: "イベントストーリー: 約束の地", kr: "이벤트 스토리: 약속의 땅", zh: "活动剧情：应许之地" },
      { en: "New PVE Content: Dimension Singularity", jp: "新PVEコンテンツ: 次元特異点", kr: "신규 PVE 콘텐츠: 차원 특이점", zh: "新PVE内容：次元奇点" },
      { en: "Character Interaction Update", jp: "キャラクター交流アップデート", kr: "캐릭터 상호작용 업데이트", zh: "角色互动更新" },
      { en: "Expansion of growth cap", jp: "成長上限拡張", kr: "성장 상한 확장", zh: "成长上限扩展" },
      { en: "User Suggestions", jp: "ユーザー要望", kr: "유저 건의사항", zh: "用户建议" },
      { en: "GUI Renewal", jp: "GUI刷新", kr: "GUI 개편", zh: "GUI更新" }
    ],
    highlights: []
  },
  {
    month: { en: "May", jp: "5月", kr: "5월", zh: "5月" },
    newCharacters: [{ en: "Anniversary Limited Character", jp: "周年限定キャラクター", kr: "주년 한정 캐릭터", zh: "周年限定角色" }],
    coreFusions: ["Epsilon"],
    balance: [{ en: "Dark Type characters (No demiurge or limited)", jp: "闇属性キャラ（デミウルゴス・限定除く）", kr: "어둠 속성 캐릭터 (데미우르고스/한정 제외)", zh: "暗属性角色（除创世神/限定）" }],
    content: [
      { en: "Event Story", jp: "イベントストーリー", kr: "이벤트 스토리", zh: "活动剧情" },
      { en: "RTA Official Release", jp: "RTA正式リリース", kr: "RTA 정식 출시", zh: "RTA正式上线" },
      { en: "Premium Gacha Effects enhancing", jp: "プレミアムガチャ演出強化", kr: "프리미엄 가챠 연출 강화", zh: "创世神抽卡特效改进" },
      { en: "User Suggestions", jp: "ユーザー要望", kr: "유저 건의사항", zh: "用户建议" }
    ],
    highlights: [{ en: "3rd Anniversary", jp: "3周年", kr: "3주년", zh: "3周年" }]
  },
  {
    month: { en: "June", jp: "6月", kr: "6월", zh: "6月" },
    newCharacters: [{ en: "Classic 3★ Character", jp: "クラシック3★キャラクター", kr: "클래식 3★ 캐릭터", zh: "普池3★角色" }],
    coreFusions: ["Rin"],
    content: [
      { en: "Story Mode Very Hard Difficulty", jp: "ストーリーモード超高難易度", kr: "스토리 모드 매우 어려움 난이도", zh: "剧情模式超难难度" },
      { en: "Event Story: Early Summer and Graffiti", jp: "イベントストーリー: 初夏とグラフィティ", kr: "이벤트 스토리: 초여름과 그래피티", zh: "活动剧情：初夏与涂鸦" },
      { en: "Steam Binding", jp: "Steam連携", kr: "Steam 연동", zh: "Steam绑定" },
      { en: "User Suggestions", jp: "ユーザー要望", kr: "유저 건의사항", zh: "用户建议" }
    ],
    highlights: []
  },
  {
    month: { en: "July", jp: "7月", kr: "7월", zh: "7月" },
    newCharacters: [
      { en: "Seasonal Limited Character", jp: "シーズン限定キャラクター", kr: "시즌 한정 캐릭터", zh: "季节限定角色" },
      { en: "Classic 3★ Character", jp: "クラシック3★キャラクター", kr: "클래식 3★ 캐릭터", zh: "普池3★角色" }
    ],
    content: [
      { en: "Story Renewal", jp: "ストーリーリニューアル", kr: "스토리 리뉴얼", zh: "剧情更新" },
      { en: "Steam Launching", jp: "Steam配信開始", kr: "Steam 출시", zh: "Steam上线" },
      { en: "Event Story: Automaton of the Horizon", jp: "イベントストーリー: 地平線のオートマトン", kr: "이벤트 스토리: 지평선의 오토마톤", zh: "活动剧情：地平线的自动人偶" }
    ],
    highlights: [{ en: "Steam Release", jp: "Steam配信", kr: "Steam 출시", zh: "Steam发布" }]
  }
];

export const NEW_CHARACTERS: NewCharacterData[] = [
  {
    name: "Monad Iota",
    element: "Dark",
    classType: "Ranger",
    borderColor: "border-purple-700/50",
    bgColor: "bg-purple-900/20",
    textColor: "text-purple-300",
    pve: { en: "Various buff to Dark Type allies, Exclusive Hard CC (Stun, Freeze, etc.), Combination attack and Penetration buff to Dark Type Allies", jp: "闇属性味方への各種バフ、専用ハードCC（スタン、凍結など）、闘属性味方への連携攻撃と貫通バフ", kr: "어둠 속성 아군에게 다양한 버프, 전용 하드 CC(기절, 빙결 등), 어둠 속성 아군에게 연계 공격 및 관통 버프", zh: "对暗属性队友的各种增益，专属硬控（眩晕、冰冻等），对暗属性队友的连携攻击和穿透增益" },
    pvp: { en: "Strengthen Dark Type Allies and weaken enemies using Exclusive Hard CC, The fastest char along with Demiurge Vlada", jp: "専用ハードCCで闇属性味方を強化し敵を弱体化、デミウルゴス・ヴラダと並ぶ最速キャラ", kr: "전용 하드 CC로 어둠 속성 아군 강화 및 적 약화, 데미우르고스 블라다와 함께 가장 빠른 캐릭터", zh: "使用专属硬控强化暗属性队友并削弱敌人，与创世之神布拉达并列最快的角色" },
    images: ["demi-iota.webp", "demi-iota-2.webp"]
  },
  {
    name: "Premine (Freemine)",
    element: "Water",
    classType: "Healer",
    borderColor: "border-blue-700/50",
    bgColor: "bg-blue-900/20",
    textColor: "text-blue-300",
    pve: { en: "Immunity & Shield, Combination attack and Shielded allies dmg increase, When hit applies debuff \"Freeze\" and turn gauge increase", jp: "免疫＆シールド、連携攻撃とシールド味方のダメージ増加、被弾時「凍結」デバフ付与とターンゲージ増加", kr: "면역 & 쉴드, 연계 공격 및 쉴드 아군 데미지 증가, 피격 시 \"빙결\" 디버프 부여 및 턴 게이지 증가", zh: "免疫与护盾，连携攻击和使拥有护盾的队友伤害增加，受击时施加\"冰冻\"减益并增加行动条" },
    pvp: { en: "Joker pick from When hit \"Freeze\" Debuff", jp: "被弾時「凍結」デバフによるジョーカーピック", kr: "피격 시 \"빙결\" 디버프로 조커 픽", zh: "受击时\"冰冻\"减益的万能选择" },
    images: ["premine.webp"]
  },
  {
    name: "Eris",
    element: "Fire",
    classType: "Striker",
    borderColor: "border-red-700/50",
    bgColor: "bg-red-900/20",
    textColor: "text-red-300",
    pve: { en: "VS Irregular Monsters char, Many debuffs and debuff number count DMG increase, Fire Type Attacker allies buff", jp: "VS不規則モンスター特化、多数のデバフとデバフ数に応じたダメージ増加、火属性アタッカー味方へのバフ", kr: "VS 불규칙 몬스터 특화, 다수의 디버프 및 디버프 수에 따른 데미지 증가, 화 속성 공격수 아군 버프", zh: "对战异形怪特化角色，多重减益和靠减益数量叠加的伤害加成，火属性攻击型队友增益" },
    pvp: { en: "Counter Attack block debuff joker pick", jp: "反撃ブロックデバフによるジョーカーピック", kr: "반격 차단 디버프로 조커 픽", zh: "反击封锁减益的万能选择" },
    images: ["eris.webp"]
  },
  {
    name: "Gnosis Domine",
    element: "Dark",
    classType: "Mage",
    borderColor: "border-purple-700/50",
    bgColor: "bg-purple-900/20",
    textColor: "text-purple-300",
    pve: { en: "", jp: "", kr: "", zh: "" },
    pvp: { en: "", jp: "", kr: "", zh: "" },
    note: { en: "New Demiurge coming in April", jp: "4月登場の新デミウルゴス", kr: "4월 출시 예정 신규 데미우르고스", zh: "4月推出的新创世神" },
    images: ["gnosis-domine.webp"]
  }
];

export const CORE_FUSION_CHARS: CoreFusionChar[] = [
  { id: "2000005", name: "Lisha", month: { en: "Jan", jp: "1月", kr: "1월", zh: "1月" } },
  { id: "2000003", name: "Snow", month: { en: "Feb", jp: "2月", kr: "2월", zh: "2月" } },
  { id: "2000056", name: "Notia", month: { en: "Mar", jp: "3月", kr: "3월", zh: "3月" } },
  { id: "2000043", name: "Eternal", month: { en: "Apr", jp: "4月", kr: "4월", zh: "4月" } },
  { id: "2000070", name: "Epsilon", month: { en: "May", jp: "5月", kr: "5월", zh: "5月" } },
  { id: "2000019", name: "Rin", month: { en: "Jun", jp: "6月", kr: "6월", zh: "6月" } },
];

export const DIMENSION_SINGULARITY_FEATURES: LangMap[] = [
  { en: "A singularity observed from the Monad Gate", jp: "モナドゲートから観測された特異点", kr: "모나드 게이트에서 관측된 특이점", zh: "从单子门观测到的奇点" },
  { en: "3 days rotating Ranked Dungeon", jp: "3日ローテーションのランクダンジョン", kr: "3일 로테이션 랭크 던전", zh: "3天轮换的排位地堡" },
  { en: "Highest Difficulty, New Boss (Nornil)", jp: "最高難易度、新ボス（ノルニル）", kr: "최고 난이도, 신규 보스 (노르닐)", zh: "最高难度，新Boss（诺妮尔）" },
  { en: "Growth cap max breakthrough ingredients", jp: "成長上限突破素材", kr: "성장 상한 돌파 재료", zh: "成长上限突破材料" },
  { en: "Expansion Gifts ingredients", jp: "拡張ギフト素材", kr: "확장 선물 재료", zh: "扩展礼物材料" },
  { en: "New equipment growth ingredients farming available", jp: "新装備成長素材のファーミング可能", kr: "신규 장비 성장 재료 파밍 가능", zh: "新装备成长材料开放获取" }
];

export const TACTICS_LEAGUE_RULES: LangMap[] = [
  { en: "5 days a week", jp: "週5日", kr: "주 5일", zh: "每周5天" },
  { en: "All characters & Equipments are borrowed", jp: "全キャラ＆装備は借用", kr: "모든 캐릭터 & 장비 대여", zh: "所有角色和装备为借用" },
  { en: "Growth cap to a certain point", jp: "成長上限が一定", kr: "성장 상한 고정", zh: "成长上限为固定值" },
  { en: "Certain stats are set max caps", jp: "特定ステータスに上限設定", kr: "특정 스탯 상한 설정", zh: "特定属性设有上限" },
  { en: "Dupe character picks available", jp: "重複キャラピック可能", kr: "중복 캐릭터 픽 가능", zh: "可选择重复角色" }
];

export const MASTERS_LEAGUE_RULES: LangMap[] = [
  { en: "Wednesday & Sunday", jp: "水曜・日曜", kr: "수요일 & 일요일", zh: "周三和周日" },
  { en: "Only the Characters you have", jp: "所持キャラのみ", kr: "보유 캐릭터만", zh: "仅限拥有的角色" },
  { en: "No limits", jp: "制限なし", kr: "제한 없음", zh: "无限制" },
  { en: "Dupe characters pick unavailable", jp: "重複キャラピック不可", kr: "중복 캐릭터 픽 불가", zh: "不可选择重复角色" }
];

export const RTA_GENERAL_RULES: LangMap[] = [
  { en: "Set a leader before battle (Leader Character gets a buff)", jp: "バトル前にリーダーを設定（リーダーキャラにバフ）", kr: "전투 전 리더 설정 (리더 캐릭터 버프 획득)", zh: "战斗前设置队长（队长角色获得增益）" },
  { en: "Global Ban & Penalty when more than 2 Demiurge & Limited characters are placed in the team", jp: "デミウルゴス＆限定キャラが2体以上でグローバルBAN＆ペナルティ", kr: "데미우르고스 & 한정 캐릭터 2명 이상 시 글로벌 밴 & 페널티", zh: "队伍中超过2名创世神和限定角色时受到全局禁选和惩罚" },
  { en: "Prizes for the league (All): Ether & Costumes", jp: "リーグ報酬（全員）: エーテル＆コスチューム", kr: "리그 보상 (전원): 에테르 & 코스튬", zh: "联赛奖励（全员）：以太和服装" },
  { en: "Prizes for the league (Rank): Titles, Profile Border, Season Rank", jp: "リーグ報酬（ランク）: 称号、プロフィール枠、シーズンランク", kr: "리그 보상 (랭크): 칭호, 프로필 테두리, 시즌 랭크", zh: "联赛奖励（排位）：称号、头像框、赛季排名" }
];

export const DEMIURGE_LIMITED_PLANS: { label: LangMap; text: LangMap }[] = [
  {
    label: { en: "New Demiurge (Premium):", jp: "新デミウルゴス（プレミアム）:", kr: "신규 데미우르고스 (프리미엄):", zh: "新创世之神：" },
    text: { en: "4 characters per year, One every 3 months", jp: "年4キャラ、3ヶ月に1体", kr: "연간 4캐릭터, 3개월마다 1명", zh: "每年4名角色，每3个月1名" }
  },
  {
    label: { en: "Limited Characters:", jp: "限定キャラ:", kr: "한정 캐릭터:", zh: "限定角色：" },
    text: { en: "2 Seasonal & 1 Anniversary → 3 per year", jp: "季節2体＋周年1体 → 年3体", kr: "시즌 2명 & 주년 1명 → 연간 3명", zh: "2名季节限定+1名周年限定→每年3名" }
  },
  {
    label: { en: "Seasonal Chars Rerun:", jp: "季節キャラ復刻:", kr: "시즌 캐릭터 복각:", zh: "季限角色复刻：" },
    text: { en: "Before new Season Limited Char comes", jp: "新シーズン限定キャラ登場前", kr: "신규 시즌 한정 캐릭터 출시 전", zh: "新季节限定角色推出前" }
  },
  {
    label: { en: "Fest. Limited (O. Nadja, G. Dahlia, G. Nella):", jp: "フェス限定（O.ナジャ、G.ダリア、G.ネラ）:", kr: "페스 한정 (O.나쟈, G.달리아, G.넬라):", zh: "Fes限定（奥米伽 纳吉娅、诺希斯 达利娅、诺希斯 内拉）：" },
    text: { en: "Anniversary & 0.5 Anniversary Rerun", jp: "周年＆0.5周年復刻", kr: "주년 & 0.5주년 복각", zh: "周年和半周年复刻" }
  }
];

export const COUPON_DATA = {
  code: "OLVALENTINE",
  rewards: [
    { en: "OL Valentine skin", jp: "OLバレンタインスキン", kr: "OL 발렌타인 스킨", zh: "OL瓦伦塔茵皮肤" },
    { en: "100 Demiurge Calls", jp: "デミウルゴス召喚100回", kr: "데미우르고스 소환 100회", zh: "100迪米哥乌斯的召唤" },
    { en: "500 Ethers", jp: "エーテル500個", kr: "에테르 500개", zh: "500以太" }
  ] as LangMap[],
  expiry: { en: "May 31, 2026 11:59 KST", jp: "2026年5月31日 23:59 KST", kr: "2026년 5월 31일 오후 11:59 KST", zh: "2026年5月31日 23:59 KST" } as LangMap
};

export const DEVELOPMENT_DIRECTIONS: LangMap[] = [
  { en: "Play fatigue decrease", jp: "プレイ疲労の軽減", kr: "플레이 피로도 감소", zh: "减少游戏疲劳" },
  { en: "Long-term Play Persistence enhancing", jp: "長期プレイ継続性の強化", kr: "장기 플레이 지속성 강화", zh: "增强长期游戏持续性" },
  { en: "Early Story and Visual fix", jp: "序盤ストーリーとビジュアルの修正", kr: "초반 스토리 및 비주얼 수정", zh: "修复早期剧情和视觉修正" },
  { en: "Subculture Taste Enhancing", jp: "サブカルテイスト強化", kr: "서브컬처 테이스트 강화", zh: "增强亚文化风格" },
  { en: "Platform Expanding for user experience supplementation", jp: "ユーザー体験補完のためのプラットフォーム拡張", kr: "사용자 경험 보완을 위한 플랫폼 확장", zh: "扩展平台以补充用户体验" }
];

// Components
export function QuarterCard({ data, lang }: { data: RoadmapQuarter; lang: Lang }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
      <div className="text-2xl font-bold text-blue-400 mb-2">{data.quarter}</div>
      <div className="text-sm text-gray-300 mb-3">{lRec(data.title, lang)}</div>
      <ul className="text-xs text-gray-400 space-y-1">
        {data.items.map((item, i) => (
          <li key={i}>• {lRec(item, lang)}</li>
        ))}
      </ul>
    </div>
  );
}

export function MonthCard({ data, lang }: { data: MonthlyUpdate; lang: Lang }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-4">
      <h4 className="text-lg font-semibold text-white mb-3 border-b border-gray-700 pb-2">
        {lRec(data.month, lang)}
        {data.highlights.length > 0 && (
          <span className="ml-2 text-sm text-yellow-400">
            ({data.highlights.map(h => lRec(h, lang)).join(", ")})
          </span>
        )}
      </h4>
      <div className="space-y-3 text-sm">
        {data.newCharacters && data.newCharacters.length > 0 && (
          <div>
            <span className="text-gray-400">{lRec(LABELS.newCharacters, lang)} </span>
            <span className={newChar}>{data.newCharacters.map(c => lRec(c, lang)).join(", ")}</span>
          </div>
        )}
        {data.coreFusions && data.coreFusions.length > 0 && (
          <div>
            <span className="text-gray-400">{lRec(LABELS.coreFusion, lang)} </span>
            <span className={coreFusion}>{data.coreFusions.join(", ")}</span>
          </div>
        )}
        {data.balance && data.balance.length > 0 && (
          <div>
            <span className="text-gray-400">{lRec(LABELS.balance, lang)} </span>
            <span className="text-orange-400">{data.balance.map(b => lRec(b, lang)).join(", ")}</span>
          </div>
        )}
        {data.content && data.content.length > 0 && (
          <div>
            <span className="text-gray-400">{lRec(LABELS.content, lang)} </span>
            <span className="text-gray-200">{data.content.map(c => lRec(c, lang)).join(" • ")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function NewCharacterCard({ data, lang }: { data: NewCharacterData; lang: Lang }) {
  const pveText = lRec(data.pve, lang);
  const pvpText = lRec(data.pvp, lang);
  const noteText = data.note ? lRec(data.note, lang) : '';

  return (
    <div className={`rounded-lg border ${data.borderColor} ${data.bgColor} p-4 flex gap-4`}>
      <div className="flex-1">
        <h4 className={`font-semibold ${data.textColor} mb-2`}>{data.name}</h4>
        <p className="text-sm text-gray-300 mb-2">
          <ElementInline element={data.element} /> <ClassInline name={data.classType} />
        </p>
        {pveText || pvpText ? (
          <ul className="text-xs text-gray-400 space-y-1">
            {pveText && <li><span className="text-green-400">PVE:</span> {pveText}</li>}
            {pvpText && <li><span className="text-red-400">PVP:</span> {pvpText}</li>}
          </ul>
        ) : noteText ? (
          <p className="text-xs text-gray-400">{noteText}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        {data.images.map((img, i) => (
          <ImageLightbox
            key={i}
            src={`${IMG_BASE}/${img}`}
            alt={data.name}
          />
        ))}
      </div>
    </div>
  );
}

export function CoreFusionSection({ lang }: { lang: Lang }) {
  return (
    <>
      <div className="flex justify-center mb-4">
        <ImageLightbox
          src={`${IMG_BASE}/cf-snow-notia.webp`}
          alt="Core Fusion Snow and Notia"
          caption={lRec(LABELS.cfSnowNotia, lang)}
          thumbnailClassName="max-h-64 w-auto"
        />
      </div>
      <p className="text-gray-300 mb-4">
        {lRec(LABELS.coreFusionDesc, lang)}
      </p>
      <div className="flex flex-wrap gap-4 justify-center">
        {CORE_FUSION_CHARS.map((cf) => (
          <Link
            key={cf.id}
            href={localePath(lang, `/characters/${cf.name.toLowerCase()}`)}
            className="flex flex-col items-center gap-1 hover:scale-105 transition-transform"
          >
            <CharacterPortrait
              id={cf.id}
              size="md"
              className="rounded-lg border-2 border-pink-700/50 bg-gray-900"
              showIcons
            />
            <span className="text-gray-400 text-xs">({lRec(cf.month, lang)})</span>
          </Link>
        ))}
      </div>
    </>
  );
}

export function DimensionSingularitySection({ lang }: { lang: Lang }) {
  return (
    <>
      <div className="flex justify-center mb-4">
        <ImageLightbox
          src={`${IMG_BASE}/dimension-singularity.webp`}
          alt="Dimension Singularity"
          caption={lRec(LABELS.dimensionSingularity, lang)}
          thumbnailClassName="max-h-64 w-auto"
        />
      </div>
      <ul className="list-disc pl-6 space-y-2 text-gray-300">
        {DIMENSION_SINGULARITY_FEATURES.map((feature, i) => (
          <li key={i}>{lRec(feature, lang)}</li>
        ))}
      </ul>
    </>
  );
}

export function RTASection({ lang }: { lang: Lang }) {
  return (
    <>
      <div className="flex justify-center mb-4">
        <ImageLightbox
          src={`${IMG_BASE}/rta.webp`}
          alt="RTA Real-Time Arena"
          caption={lRec(LABELS.rtaOverview, lang)}
          thumbnailClassName="max-h-64 w-auto"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-4">
          <h4 className="font-semibold text-cyan-400 mb-2">{lRec(LABELS.tacticsLeague, lang)}</h4>
          <ul className="text-sm text-gray-300 space-y-1">
            {TACTICS_LEAGUE_RULES.map((rule, i) => (
              <li key={i}>• {lRec(rule, lang)}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-4">
          <h4 className="font-semibold text-yellow-400 mb-2">{lRec(LABELS.mastersLeague, lang)}</h4>
          <ul className="text-sm text-gray-300 space-y-1">
            {MASTERS_LEAGUE_RULES.map((rule, i) => (
              <li key={i}>• {lRec(rule, lang)}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-4 p-4 rounded-lg bg-gray-800/50 border border-gray-700">
        <h4 className="font-semibold text-white mb-2">{lRec(LABELS.rtaRules, lang)}</h4>
        <ul className="text-sm text-gray-300 space-y-1">
          {RTA_GENERAL_RULES.map((rule, i) => (
            <li key={i}>• {lRec(rule, lang)}</li>
          ))}
        </ul>
      </div>
    </>
  );
}

export function CouponSection({ lang }: { lang: Lang }) {
  return (
    <div className="p-4 rounded-lg bg-linear-to-r from-pink-900/30 to-red-900/30 border border-pink-700/50">
      <p className="text-2xl font-mono font-bold text-pink-300 mb-2">{COUPON_DATA.code}</p>
      <ul className="text-sm text-gray-300">
        {COUPON_DATA.rewards.map((reward, i) => (
          <li key={i}>• {lRec(reward, lang)}</li>
        ))}
      </ul>
      <p className="text-xs text-gray-400 mt-2">{lRec(LABELS.validUntil, lang)} {lRec(COUPON_DATA.expiry, lang)}</p>
    </div>
  );
}

export function QuarterlyRoadmapSection({ lang }: { lang: Lang }) {
  return (
    <>
      <div className="flex justify-center mb-4">
        <ImageLightbox
          src={`${IMG_BASE}/road-quarter.webp`}
          alt="2026 Quarterly Roadmap"
          caption={lRec(LABELS.quarterlyOverview, lang)}
          thumbnailClassName="max-h-64 w-auto"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {ROADMAP_QUARTERS.map((q) => (
          <QuarterCard key={q.quarter} data={q} lang={lang} />
        ))}
      </div>
    </>
  );
}

export function MonthlyUpdatesSection({ lang }: { lang: Lang }) {
  return (
    <>
      <div className="flex flex-wrap justify-center gap-4 mb-4">
        <ImageLightbox
          src={`${IMG_BASE}/road-j-m.webp`}
          alt="January to March 2026 Updates"
          caption={lRec(LABELS.janMar, lang)}
          thumbnailClassName="max-h-64 w-auto"
        />
        <ImageLightbox
          src={`${IMG_BASE}/road-a-j.webp`}
          alt="April to July 2026 Updates"
          caption={lRec(LABELS.aprJul, lang)}
          thumbnailClassName="max-h-64 w-auto"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MONTHLY_UPDATES.map((m, i) => (
          <MonthCard key={i} data={m} lang={lang} />
        ))}
      </div>
    </>
  );
}

export function NewCharactersSection({ lang }: { lang: Lang }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {NEW_CHARACTERS.map((char) => (
        <NewCharacterCard key={char.name} data={char} lang={lang} />
      ))}
    </div>
  );
}

export function DemiurgeLimitedPlansSection({ lang }: { lang: Lang }) {
  return (
    <ul className="list-disc pl-6 space-y-2 text-gray-300">
      {DEMIURGE_LIMITED_PLANS.map((plan, i) => (
        <li key={i}><span className={highlight}>{lRec(plan.label, lang)}</span> {lRec(plan.text, lang)}</li>
      ))}
    </ul>
  );
}

export function DevelopmentDirectionSection({ lang }: { lang: Lang }) {
  return (
    <ul className="list-disc pl-6 space-y-2 text-gray-300">
      {DEVELOPMENT_DIRECTIONS.map((direction, i) => (
        <li key={i}>{lRec(direction, lang)}</li>
      ))}
    </ul>
  );
}

export function CreditsSection({ lang }: { lang: Lang }) {
  return (
    <section className="text-sm text-gray-500 border-t border-gray-700 pt-4">
      <p>{lRec(LABELS.translationBy, lang)}</p>
      <p>{lRec(LABELS.source, lang)}</p>
    </section>
  );
}
