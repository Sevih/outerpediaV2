import type { LangMap } from '@/types/common'

// ─────────────────────────────────────────────────────────────────────────
// Editorial layer for the Story Progression Unlock Table.
//
// The unlock CONDITIONS (stage labels + dungeon names) AND the mode names
// come from the game's data via the `unlock-content` pipeline step
// (data/generated/unlock-content.json), populated from:
//   - ContentLockTemplet.UnLockConditionValue   → stage + dungeon name
//   - TextSystem["SYS_CONTENS_LOCK_<CT>"]       → lockScreenName  (PRIMARY)
//   - ContentLockTemplet.TextID                 → officialName    (fallback)
//   - ContentLockTemplet.DescTextID             → officialDescription
//
// Mode-name resolution at render time:
//   editorial `modeName`  →  lockScreenName  →  officialName  →  "?"
//
// Two kinds of entry exist:
//
//   • { source: 'auto', contentType: 'PVE_TOWER', ... }
//     `modeName` here is an OPTIONAL override — set it only when the
//     lock-screen label is stale, contains unwanted formatting, or is
//     simply missing in the data.
//     Descriptions are editorial.
//
//   • { source: 'manual', stage, dungeonName, modeName, ... }
//     For entries that have no direct ContentType in the game data
//     (story-task gates, sub-features like Talisman). Everything is
//     editorial including the mode name.
//
// Intentionally NOT listed (active from game start or irrelevant for a
// progression guide) — these still exist in unlock-content.json but the
// guide skips them on purpose:
//   • CHARACTER_SKILL, CHARACTER_TRANSCENDENT — available from the start
//   • CHARACTER_EVOLUTION — feature deprecated/replaced, no longer relevant
//   • ITEM_BREAK_LIMIT, ITEM_SMELTING — sub-features, not progression gates
//   • FESTIVAL, MIRSHA_SETTLEMENT — event-only content, not a progression gate
//   • PVE_TOWER_HARD — only the Normal tower is shown for clarity
//   • BATTLE_* (Auto, Sweep, Repeat, Burst, Chain, Ultimate Skip, Menu) — UI/QoL
//   • MAIN_MENU_* — menu items, debunked at trivial stages
//   • EQUIP_ALL, UNEQUIP_ALL, EVA_BATTLE_TUTORIAL — UI plumbing
//   • SHOP_*, SUPPORT_SURVEY_SHOP* — shops (out of scope)
//   • GUIDE_QUEST_*, GUILD, IVANEZ_FESTIVAL, DEMIURGE_MISSION,
//     PVE_RAID_*_DARK/LIGHT — variants / misc
// ─────────────────────────────────────────────────────────────────────────

export const CATEGORIES = ['character', 'base', 'gamemodes'] as const
export type Category = typeof CATEGORIES[number]

export const CATEGORY_LABELS: Record<Category, LangMap> = {
  gamemodes: {
    en: 'Game Modes',
    jp: 'ゲームモード',
    kr: '게임 모드',
    zh: '游戏模式',
    fr: 'Modes de Jeu',
  },
  character: {
    en: 'Heroes & Equipment',
    jp: 'ヒーロー & 装備',
    kr: '영웅 & 장비',
    zh: '英雄 & 装备',
    fr: 'Héros & Équipement',
  },
  base: {
    en: 'Base',
    jp: 'アジト',
    kr: '아지트',
    zh: '基地',
    fr: 'Base',
  },
}

export type AutoEntry = {
  source: 'auto'
  category: Category
  contentType: string
  /** Optional override; falls back to officialName from the JSON. */
  modeName?: LangMap
  description: LangMap
  customNote?: LangMap
}

export type ManualEntry = {
  source: 'manual'
  category: Category
  slug: string
  stage: string
  dungeonName: LangMap
  modeName: LangMap
  description: LangMap
  customNote?: LangMap
}

export type GuideEntry = AutoEntry | ManualEntry

export const ENTRIES: GuideEntry[] = [
  // ─── Game Modes ────────────────────────────────────────────────────────
  {
    source: 'auto',
    category: 'gamemodes',
    contentType: 'WORLD_BOSS',
    // lockScreenName: "World Boss"
    description: {
      en: 'Battle with 8 heroes and rank against other players',
      jp: '8人のヒーローで戦い、他のプレイヤーと順位を競う',
      kr: '8명의 영웅으로 전투하고 다른 플레이어와 순위 경쟁',
      zh: '使用8名英雄战斗并与其他玩家排名',
      fr: 'Combattez avec 8 Héros et classez-vous contre les autres joueurs',
    },
  },
  {
    source: 'auto',
    category: 'gamemodes',
    contentType: 'MONADGATE',
    // lockScreenName: "Monad Gate"
    description: {
      en: 'Endgame depth-based dungeon with permanent buff rewards',
      jp: '永続バフ報酬がある深度型エンドゲームダンジョン',
      kr: '영구 버프 보상이 있는 심도형 엔드게임 던전',
      zh: '提供永久增益奖励的深度型终局暗堡',
      fr: 'Dungeon endgame par paliers avec récompenses de buff permanents',
    },
  },
  {
    source: 'auto',
    category: 'gamemodes',
    contentType: 'SINGULARITY',
    // lockScreenName: "Dimensional Singularity" via SYS_SINGULARITY_MAIN_TITLE override
    description: {
      en: 'Weekly score-based boss challenge with seasonal rankings',
      jp: '週替わりスコア競争のボスチャレンジとシーズンランキング',
      kr: '주간 점수 기반 보스 챌린지와 시즌 랭킹',
      zh: '每周积分制Boss挑战与赛季排名',
      fr: 'Challenge boss hebdomadaire au score avec classements saisonniers',
    },
    customNote: {
      en: 'Unlocked after viewing the True Ending of Monad Gate Depth 1',
      jp: 'モナドゲート深度1のトゥルーエンディング鑑賞後に開放',
      kr: '모나드 게이트 심도 1의 트루 엔딩 감상 후 해금',
      zh: '观看单子门户深度1的真结局后开放',
      fr: 'Débloqué après avoir vu la True Ending du Monad Gate Depth 1',
    },
  },
  {
    source: 'auto',
    category: 'gamemodes',
    contentType: 'EVENT_BOSS_CHALLENGE',
    // lockScreenName: "Joint Challenge"
    description: {
      en: 'Co-op mode across the server',
      jp: 'サーバー全体の協力モード',
      kr: '서버 전체 협동 모드',
      zh: '全服协作模式',
      fr: 'Mode co-op à l\'échelle du serveur',
    },
  },
  {
    source: 'auto',
    category: 'gamemodes',
    contentType: 'EVENT_DUNGEON',
    // lockScreenName: "Event Dungeon" via SYS_MENU_EVENT_DUNGEON override
    description: {
      en: 'Allows entry to event dungeons',
      jp: 'イベントダンジョンへの入場が可能に',
      kr: '이벤트 던전 입장 가능',
      zh: '可进入活动暗堡',
      fr: 'Autorise l\'entrée aux event dungeons',
    },
  },
  {
    source: 'auto',
    category: 'gamemodes',
    contentType: 'PVE_EXP_DUNGEON',
    // lockScreenName: "Hypnotic Frog Hall" via SYS_GOLD_DUNGEON override
    // (SYS_CONTENS_LOCK_PVE_EXP_DUNGEON resolves to stale "Bandit Pursuit")
    description: {
      en: 'Farm hero EXP and gold',
      jp: 'ヒーロー経験値とゴールドを集める場所',
      kr: '영웅 경험치와 골드 파밍',
      zh: '刷英雄经验值与金币',
      fr: 'Farm de l\'EXP de Héros et de l\'or',
    },
  },
  {
    source: 'auto',
    category: 'gamemodes',
    contentType: 'PVE_FARMING_DUNGEON',
    // lockScreenName: "Ark Raid" (4 langues) — pas besoin d'override
    description: {
      en: 'Farm Gear Hammers, Affinity Gifts, Gems and Skill Manuals',
      jp: '装備強化ハンマー、親密度ギフト、宝石、スキル教本を集める',
      kr: '장비 강화 도구, 애정도 선물, 보석, 스킬 교본 파밍',
      zh: '刷装备强化道具、亲密度礼物、宝石、技能教材',
      fr: 'Farm de Gear Hammers, Affinity Gifts, Gems et Skill Manuals',
    },
  },
  {
    source: 'auto',
    category: 'gamemodes',
    contentType: 'PVE_REMAINS',
    // lockScreenName: "Demon King's Ruins" (4 langues)
    description: {
      en: 'Dungeon with one-time clear rewards',
      jp: '初回クリア報酬があるダンジョン',
      kr: '1회 클리어 보상이 있는 던전',
      zh: '首次通关奖励的暗堡',
      fr: 'Dungeon avec des récompenses de clear unique',
    },
  },
  {
    source: 'auto',
    category: 'gamemodes',
    contentType: 'PVE_REMAINS_LOOP',
    // lockScreenName: "Endless Corridor" (4 langues)
    description: {
      en: 'Repeatable dungeon with 3-day cooldown rewards',
      jp: '3日クールダウンで報酬を獲得できるダンジョン',
      kr: '3일 쿨다운으로 보상을 받는 던전',
      zh: '每3天冷却可获得奖励的暗堡',
      fr: 'Dungeon répétable avec des récompenses en cooldown de 3 jours',
    },
  },
  {
    source: 'auto',
    category: 'gamemodes',
    contentType: 'PVE_TOWER',
    // Override: lockScreen says "Skyward Tower - Normal" but we drop the suffix
    // since PVE_TOWER_HARD isn't shown in this guide (no need to disambiguate)
    modeName: { en: 'Skyward Tower', jp: 'スカイワードタワー', kr: '스카이워드 타워', zh: '飞天之塔' },
    description: {
      en: 'Monthly tower challenge - unlocks {P/Sigma}',
      jp: '月間リセットの塔チャレンジ - {P/Sigma}を入手可能',
      kr: '월간 리셋 타워 챌린지 - {P/Sigma} 획득 가능',
      zh: '每月重置的塔挑战 - 可获得{P/Sigma}',
      fr: 'Challenge de tour mensuel - débloque {P/Sigma}',
    },
  },
  {
    source: 'auto',
    category: 'gamemodes',
    contentType: 'PVE_TOWER_ELEMENTAL',
    // official: "Elemental Tower"
    description: {
      en: 'Element-specific challenge towers with upgrade materials',
      jp: '強化素材を獲得できる属性別チャレンジタワー',
      kr: '강화 재료를 얻을 수 있는 속성별 챌린지 타워',
      zh: '可获得强化材料的元素挑战塔',
      fr: 'Tours de challenge spécifiques aux Éléments avec des matériaux d\'upgrade',
    },
  },
  {
    source: 'auto',
    category: 'gamemodes',
    contentType: 'PVE_RAID_A',
    // lockScreenName: "Special Request: Ecology Survey" (4 langues)
    description: {
      en: 'Main place to farm armor sets',
      jp: '防具セットを集める主な場所',
      kr: '방어구 세트를 파밍하는 주요 장소',
      zh: '刷防具套装的主要场所',
      fr: 'Endroit principal pour farmer les armor sets',
    },
  },
  {
    source: 'auto',
    category: 'gamemodes',
    contentType: 'PVE_RAID_B',
    // lockScreenName: "Special Request: Identity Analysis" (4 langues — TextID was a copy error)
    description: {
      en: 'Main place to farm weapons and accessories',
      jp: '武器とアクセサリーを集める主な場所',
      kr: '무기와 악세서리를 파밍하는 주요 장소',
      zh: '刷武器和饰品的主要场所',
      fr: 'Endroit principal pour farmer les armes et accessoires',
    },
  },
  {
    source: 'auto',
    category: 'gamemodes',
    contentType: 'PVE_EXPLORATION',
    // lockScreenName: "Isle of Ruin Exploration" (4 langues)
    description: {
      en: 'Farm resources for Quirk and Precise Craft',
      jp: 'ギフトと精密作成のリソースを集める場所',
      kr: '기프트와 정밀 제작 자원을 파밍하는 장소',
      zh: '刷天赋和精密制作资源的场所',
      fr: 'Farm de ressources pour Quirk et Precise Craft',
    },
  },
  {
    source: 'auto',
    category: 'gamemodes',
    contentType: 'PIECE_DUNGEON',
    // lockScreenName: "Doppelgänger Hunt" (4 langues)
    description: {
      en: 'Obtain {I-I/Hero Piece} to transcend heroes',
      jp: '{I-I/Hero Piece}を入手してヒーローを超越',
      kr: '{I-I/Hero Piece}를 획득하여 영웅 초월',
      zh: '获取{I-I/Hero Piece}来超越英雄',
      fr: 'Obtenez des {I-I/Hero Piece} pour transcender les Héros',
    },
  },
  {
    source: 'auto',
    category: 'gamemodes',
    contentType: 'IRREGULAR_INFILTRATE',
    // lockScreenName: "Infiltration Operation" via SYS_IRR_INFILTREATE_NAME_01 override
    description: {
      en: 'Solo mode for exclusive weapons, accessories, and other rewards',
      jp: '限定武器・アクセサリーなどが手に入るソロモード',
      kr: '전용 무기, 악세서리 등을 얻는 솔로 모드',
      zh: '可获得专属武器、饰品等奖励的单人模式',
      fr: 'Mode solo pour armes, accessoires exclusifs et autres récompenses',
    },
  },
  {
    source: 'auto',
    category: 'gamemodes',
    contentType: 'IRREGULAR_CHASE',
    // lockScreenName: "Pursuit Operation" via SYS_IRR_CHASE_NAME_01 override
    // Unlock condition is documented in SYS_GUIDE_IRREGULAR_CHASE_01_1_DESC
    // (the auto-resolved "Search Coordinates: F01_A01_S14" is an internal coord
    // for the Irregular system, not a real story stage)
    description: {
      en: 'Co-op mode for exclusive weapons, accessories, and other rewards',
      jp: '限定武器・アクセサリーなどが手に入る協力モード',
      kr: '전용 무기, 악세서리 등을 얻는 협동 모드',
      zh: '可获得专属武器、饰品等奖励的协作模式',
      fr: 'Mode co-op pour armes, accessoires exclusifs et autres récompenses',
    },
    customNote: {
      en: 'Clear Floor 1 of Infiltration Operation',
      jp: '侵入殲滅戦のフロア1をクリア',
      kr: '침투 섬멸전의 플로어 1을 클리어',
      zh: '通关渗透歼灭战第1层',
      fr: 'Clear le Floor 1 de l\'Infiltration Operation',
    },
  },
  {
    source: 'auto',
    category: 'gamemodes',
    contentType: 'ADVENTURE_LICENSE',
    // official: "Adventure License"
    description: {
      en: 'Weekly challenge mode with various rewards',
      jp: '様々な報酬があるウィークリーチャレンジモード',
      kr: '다양한 보상이 있는 주간 챌린지 모드',
      zh: '有各种奖励的每周挑战模式',
      fr: 'Mode challenge hebdomadaire avec récompenses variées',
    },
    customNote: {
      en: 'Any one of the listed Hard-season finals satisfies the unlock',
      jp: '記載のいずれか1つのハード最終ステージで解放',
      kr: '나열된 하드 시즌 최종 중 하나만 클리어하면 해금',
      zh: '清完所列任一硬核赛季终章即可解锁',
      fr: 'Un seul des stages finaux Hard listés suffit pour débloquer',
    },
  },

  // (PvP entries also categorized as gamemodes)
  {
    source: 'auto',
    category: 'gamemodes',
    contentType: 'PVP',
    // official: "Arena"
    description: {
      en: 'PvP mode against AI defense teams',
      jp: 'AI防衛チームと戦うPvPモード',
      kr: 'AI 방어팀과 싸우는 PvP 모드',
      zh: '与AI防守队伍对战的PvP模式',
      fr: 'Mode PvP contre des équipes de défense IA',
    },
  },
  {
    source: 'auto',
    category: 'gamemodes',
    contentType: 'PVP_REAL_TIME',
    // lockScreenName: "Real Time Arena" (4 langues)
    description: {
      en: 'Live PvP against another player',
      jp: '他プレイヤーとのリアルタイムPvP',
      kr: '다른 플레이어와 실시간 PvP',
      zh: '与其他玩家进行实时PvP',
      fr: 'PvP en direct contre un autre joueur',
    },
  },
  {
    source: 'auto',
    category: 'gamemodes',
    contentType: 'PVP_REAL_TIME_FRIENDLY',
    // lockScreenName: "Friendly Match" (4 langues)
    description: {
      en: 'Practice Real-Time Arena matches without rating impact',
      jp: 'レーティングに影響しないリアルタイムアリーナの練習試合',
      kr: '레이팅에 영향이 없는 실시간 결투장 연습 경기',
      zh: '不影响等级的实时竞技场练习对战',
      fr: 'Matchs d\'entraînement de Real-Time Arena sans impact sur le classement',
    },
  },

  // ─── Heroes & Equipment ────────────────────────────────────────────────
  {
    source: 'auto',
    category: 'character',
    contentType: 'CHARACTER_ENCHANT',
    // official: "Enhance Hero"
    description: {
      en: 'Enhance hero stats with enchant materials',
      jp: '強化素材でヒーローのステータスを上げる',
      kr: '강화 재료로 영웅 능력치 향상',
      zh: '使用强化材料提升英雄属性',
      fr: 'Améliorez les stats des Héros avec des matériaux d\'enchant',
    },
  },
  {
    source: 'auto',
    category: 'character',
    contentType: 'CHARACTER_FUSION',
    // lockScreenName: "Core Fusion" via SYS_CHARACTER_FUSION_TITLE override
    description: {
      en: 'Unlocks a hero\'s potential and strengthens them',
      jp: 'ヒーローの潜在能力を解放し強化する',
      kr: '영웅의 잠재력을 해방하고 강화',
      zh: '释放英雄潜能并加以强化',
      fr: 'Débloque le potentiel d\'un Héros et le renforce',
    },
  },
  {
    source: 'auto',
    category: 'character',
    contentType: 'CHARACTER_EQUIP_SPECIAL',
    // lockScreenName: "Special Gear" (4 langues — TextID had a copy-error multi-name)
    description: {
      en: 'Unlock the exclusive equipment slot',
      jp: '専用装備スロットを解放',
      kr: '전용 장비 슬롯 해금',
      zh: '解锁专属装备栏',
      fr: 'Débloque le slot d\'équipement exclusif',
    },
  },
  {
    source: 'manual',
    category: 'character',
    slug: 'talisman',
    stage: 'S1-5-1',
    dungeonName: { en: 'Onwards to Magnolia', jp: 'マグノリアを目指して', kr: '매그놀리아를 향해', zh: '向着麦格诺里亚' },
    modeName: { en: 'Talisman', jp: 'タリスマン', kr: '탈리스만', zh: '护身符' },
    description: {
      en: 'Unlock the talisman equipment slot',
      jp: 'タリスマン装備スロットを解放',
      kr: '탈리스만 장비 슬롯 해금',
      zh: '解锁护身符装备栏',
      fr: 'Débloque le slot d\'équipement Talisman',
    },
  },

  // ─── Base ──────────────────────────────────────────────────────────────
  {
    source: 'auto',
    category: 'base',
    contentType: 'AGIT_MAIN',
    // official: "Base"
    description: {
      en: 'Unlocks the Base with crafting, shop, and other features',
      jp: '製作、ショップなどの機能を持つアジトを解放',
      kr: '제작, 상점 등의 기능이 있는 아지트 해금',
      zh: '解锁基地,包含制作、商店等功能',
      fr: 'Débloque la Base avec crafting, shop et autres fonctionnalités',
    },
  },
  {
    source: 'auto',
    category: 'base',
    contentType: 'AGIT_SYNCHRO_ROOM',
    // official: "Synchro Room"
    description: {
      en: 'Heroes placed here gain stats based on room upgrades',
      jp: '配置したヒーローがルームのアップグレードに応じてステータスを獲得',
      kr: '배치된 영웅이 룸 업그레이드에 따라 스탯 획득',
      zh: '放置的英雄根据房间升级获得属性',
      fr: 'Les Héros placés ici gagnent des stats selon les upgrades de la room',
    },
  },
  {
    source: 'auto',
    category: 'base',
    contentType: 'AGIT_CUSTOM_CRAFT',
    // lockScreenName: "Precise Craft" via SYS_CRAFT_DETAILS_TITLE override
    description: {
      en: 'Craft equipment and reroll substats until satisfied',
      jp: '装備を作成し、満足するまでサブステータスをリロール',
      kr: '장비를 제작하고 만족할 때까지 부옵션 리롤',
      zh: '制作装备并重新随机副属性直到满意',
      fr: 'Craftez de l\'équipement et reroll les substats jusqu\'à satisfaction',
    },
  },
  {
    source: 'manual',
    category: 'base',
    slug: 'quirk',
    stage: 'S1-9-5',
    dungeonName: { en: 'The Responsibility of the Guilty', jp: '奪った者の責任感', kr: '빼앗은 자의 책임감', zh: '掠夺者的责任感' },
    modeName: { en: 'Quirk', jp: 'ギフト', kr: '기프트', zh: '天赋' },
    description: {
      en: 'Permanent account-wide stat bonuses',
      jp: 'アカウント全体に適用される永続ステータスボーナス',
      kr: '계정 전체에 적용되는 영구 스탯 보너스',
      zh: '全账号永久属性加成',
      fr: 'Bonus de stat permanents à l\'échelle du compte',
    },
  },

]
