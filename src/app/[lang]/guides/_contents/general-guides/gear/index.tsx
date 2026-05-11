'use client';

import { useCallback, useState } from 'react';
import GuideTemplate from '@/app/components/guides/GuideTemplate';
import Tabs from '@/app/components/ui/Tabs';
import Accordion from '@/app/components/ui/Accordion';
import ItemInline from '@/app/components/inline/ItemInline';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { LangMap } from '@/types/common';

import InlineIcon from '@/app/components/inline/InlineIcon';

import {
  type TabKey,
  type EquipmentPropertyKey,
  SubstatColorLegend,
  PerfectSubstatsExample,
  MaterialsList,
  HAMMER_ITEMS,
  CATALYST_ITEMS,
  GLUNITE_ITEMS,
  EnhancementComparisonGrid,
  BreakthroughExamplesGrid,
  GearPriorityList,
  UpgradeMethodsGrid,
  SectionHeader,
  ChangeStatsModesGrid,
  ObtainingMethodsList,
  EquipmentIntro,
  StarLevel,
  ASCENSION_INIT,
  ASCENSION_BONUS_OFFENSIVE,
  ASCENSION_BONUS_DEFENSIVE,
  ASCENSION_REROLL,
  AscensionStepsTable,
  AscensionBonusEffectsTable,
  GradeLegend,
  type BonusTableMode,
} from './helpers';

// ============================================================================
// LOCALIZED CONTENT (all 4 languages merged as LangMap)
// ============================================================================

const LABELS = {
  title: { en: 'Equipment Guide', jp: '装備ガイド', kr: '장비 가이드', zh: '装备指南', fr: 'Guide Équipement' } satisfies LangMap,
  heading: { en: 'Mechanics & Optimization', jp: '仕組みと最適化', kr: '시스템 및 최적화', zh: '机制与优化', fr: 'Mécaniques & Optimisation' } satisfies LangMap,
  intro: {
    en: 'A comprehensive guide covering gear mechanics, upgrading systems, and how to obtain the best equipment in Outerplane.',
    jp: 'アウタープレーンの装備の仕組み、強化システム、最高の装備の入手方法を網羅したガイドです。',
    kr: '아우터플레인의 장비 시스템, 강화 방법, 최고의 장비를 얻는 방법을 다루는 종합 가이드입니다.',
    zh: '本指南全面介绍异域战记的装备机制、强化系统以及如何获取最佳装备。',
    fr: 'Guide complet couvrant les mécaniques d\'équipement, les systèmes d\'upgrade et comment obtenir le meilleur équipement dans Outerplane.',
  } satisfies LangMap,

  // ── Tabs ──
  tab_basics: { en: 'Gear Basics', jp: '装備の基本', kr: '장비 기초', zh: '装备基础', fr: 'Bases du Gear' } satisfies LangMap,
  tab_upgrading: { en: 'Upgrading Gear', jp: '装備強化', kr: '장비 강화', zh: '装备强化', fr: 'Upgrade du Gear' } satisfies LangMap,
  tab_ascension: { en: 'Singularity Ascension', jp: '特異点昇華', kr: '특이점 승화', zh: '奇点升华', fr: 'Singularity Ascension' } satisfies LangMap,
  tab_obtaining: { en: 'Obtaining Gear', jp: '装備入手', kr: '장비 획득', zh: '装备获取', fr: 'Obtention du Gear' } satisfies LangMap,
  tab_faq: { en: 'FAQ', jp: 'よくある質問', kr: 'FAQ', zh: '常见问题', fr: 'FAQ' } satisfies LangMap,

  // ── Common labels ──
  materials: { en: 'Materials:', jp: '素材：', kr: '재료:', zh: '材料：', fr: 'Matériaux :' } satisfies LangMap,
  tip: { en: 'Tip:', jp: 'ヒント：', kr: '팁:', zh: '提示：', fr: 'Astuce :' } satisfies LangMap,
  note: { en: 'Note:', jp: '注意：', kr: '참고:', zh: '注意：', fr: 'Note :' } satisfies LangMap,

  // ── Basics section ──
  basics_overviewTitle: { en: 'Overview', jp: '概要', kr: '개요', zh: '概述', fr: 'Aperçu' } satisfies LangMap,
  basics_overviewText: {
    en: 'Gear plays a crucial role in a hero\'s power. Each hero can equip three different types of gear:',
    jp: '装備はヒーローの戦力に重要な役割を果たします。各ヒーローは3種類の装備を装着できます：',
    kr: '장비는 영웅의 전투력에 중요한 역할을 합니다. 각 영웅은 세 가지 유형의 장비를 장착할 수 있습니다:',
    zh: '装备在英雄的战力中起着关键作用。每个英雄可以装备三种类型的装备：',
    fr: 'L\'équipement joue un rôle crucial dans la puissance d\'un Héros. Chaque Héros peut équiper trois types d\'équipement différents :',
  } satisfies LangMap,
  basics_weapon: { en: 'Weapon', jp: '武器', kr: '무기', zh: '武器', fr: 'Arme' } satisfies LangMap,
  basics_accessory: { en: 'Accessory', jp: 'アクセサリー', kr: '액세서리', zh: '饰品', fr: 'Accessoire' } satisfies LangMap,
  basics_armor: { en: 'Armor', jp: '防具', kr: '방어구', zh: '防具', fr: 'Armor' } satisfies LangMap,
  basics_gearTypesEnd: {
    en: ', each contributing to their overall stats and performance in battle.',
    jp: '。それぞれが戦闘でのステータスとパフォーマンスに影響します。',
    kr: '. 각각은 전투에서의 스탯과 성능에 기여합니다.',
    zh: '，它们分别影响战斗中的属性和表现。',
    fr: ', chacun contribuant aux stats globales et aux performances en combat.',
  } satisfies LangMap,
  basics_propertiesTitle: { en: 'Gear Properties', jp: '装備のプロパティ', kr: '장비 속성', zh: '装备属性', fr: 'Propriétés du Gear' } satisfies LangMap,
  basics_propertiesText: {
    en: 'Each piece of gear has several properties:',
    jp: '各装備には以下のプロパティがあります：',
    kr: '각 장비에는 다음과 같은 속성이 있습니다:',
    zh: '每件装备有以下属性：',
    fr: 'Chaque pièce de gear a plusieurs propriétés :',
  } satisfies LangMap,

  // Equipment properties (for EquipmentIntro)
  prop_stars: { en: 'Star Level: from 1★ yellow star to 6★ yellow', jp: 'スターレベル：1★黄色から6★黄色まで', kr: '스타 레벨: 1★ 노란색부터 6★ 노란색까지', zh: '星级：从1★黄色到6★黄色', fr: 'Star Level : de 1★ jaune à 6★ jaune' } satisfies LangMap,
  prop_reforge: { en: 'Reforge Level: from 1★ orange to 6★ orange', jp: '再鍛造レベル：1★オレンジから6★オレンジまで', kr: '재련 레벨: 1★ 주황색부터 6★ 주황색까지', zh: '重铸等级：从1★橙色到6★橙色', fr: 'Reforge Level : de 1★ orange à 6★ orange' } satisfies LangMap,
  prop_rarity: { en: 'Grade: Normal, Superior, Epic, Legendary', jp: 'グレード：ノーマル、スーペリア、エピック、レジェンダリー', kr: '등급: 노말, 슈페리어, 에픽, 레전드', zh: '品质：普通、精良、史诗、传说', fr: 'Grade : Normal, Superior, Epic, Legendary' } satisfies LangMap,
  prop_upgrade: { en: 'Upgrade Level: from 0 to +10 (or +15 with Singularity Ascension)', jp: '強化レベル：0から+10まで（特異点昇華で+15まで）', kr: '강화 레벨: 0부터 +10까지 (특이점 승화로 +15까지)', zh: '强化等级：从0到+10（通过奇点升华可达+15）', fr: 'Upgrade Level : de 0 à +10 (ou +15 avec Singularity Ascension)' } satisfies LangMap,
  prop_tier: { en: 'Breakthrough: from T0 to T4', jp: '突破：T0からT4まで', kr: '돌파: T0부터 T4까지', zh: '突破：从T0到T4', fr: 'Breakthrough : de T0 à T4' } satisfies LangMap,
  prop_set: { en: 'Set Effect or Unique Effect', jp: 'セット効果または固有効果', kr: '세트 효과 또는 고유 효과', zh: '套装效果或独特效果', fr: 'Effet de Set ou Effet Unique' } satisfies LangMap,
  prop_class: { en: 'Class restriction (Legendary weapons & accessories)', jp: 'クラス制限（レジェンダリー武器＆アクセサリー）', kr: '클래스 제한 (레전드 무기 & 액세서리)', zh: '职业限制（传说武器和饰品）', fr: 'Restriction de Class (armes et accessoires Legendary)' } satisfies LangMap,

  // Substats
  basics_substatsTitle: { en: 'Understanding Substats', jp: 'サブステータスについて', kr: '부옵션 이해하기', zh: '理解副属性', fr: 'Comprendre les Substats' } satisfies LangMap,
  basics_substatsRule: {
    en: 'Each stat can only appear once per item, regardless of whether it is a main stat or a substat (e.g: you cannot roll a speed substat on a speed mainstat Accessory).',
    jp: '各ステータスはアイテムごとに1回のみ出現します。メインステータスかサブステータスかに関わらず同じです（例：速度メインのアクセサリーに速度サブは付きません）。',
    kr: '각 스탯은 메인 스탯이든 부옵션이든 아이템당 한 번만 나타납니다 (예: 속도 메인옵 액세서리에는 속도 부옵이 붙지 않습니다).',
    zh: '每个属性在一件装备上只能出现一次，无论是主属性还是副属性（例如：速度主属的饰品不能有速度副属性）。',
    fr: 'Chaque stat ne peut apparaître qu\'une fois par item, qu\'elle soit main stat ou substat (par exemple : vous ne pouvez pas roll un substat SPD sur un accessoire avec SPD en main stat).',
  } satisfies LangMap,
  basics_substatsColorIntro: {
    en: 'Substat values are represented as a bar with 6 segments using the following color code:',
    jp: 'サブステータスの値は6つのセグメントで表され、以下の色で示されます：',
    kr: '부옵션 값은 6개의 세그먼트로 표시되며 다음 색상 코드를 사용합니다:',
    zh: '副属性值由6个条段表示，使用以下颜色代码：',
    fr: 'Les valeurs de substat sont représentées sous forme d\'une barre à 6 segments selon le code couleur suivant :',
  } satisfies LangMap,
  color_gray: { en: 'Gray — Inactive', jp: 'グレー — 非活性', kr: '회색 — 비활성', zh: '灰色 — 未激活', fr: 'Gris — Inactif' } satisfies LangMap,
  color_yellow: { en: 'Yellow — Active (from initial roll)', jp: 'イエロー — 活性（初期抽選）', kr: '노란색 — 활성 (초기 추첨)', zh: '黄色 — 已激活（初始抽取）', fr: 'Jaune — Actif (depuis le roll initial)' } satisfies LangMap,
  color_orange: { en: 'Orange — Active (gained through reforge)', jp: 'オレンジ — 活性（再鍛造で獲得）', kr: '주황색 — 활성 (재련으로 획득)', zh: '橙色 — 已激活（通过重铸获得）', fr: 'Orange — Actif (gagné via reforge)' } satisfies LangMap,
  basics_maxYellowTitle: { en: 'Maximum Yellow Segments', jp: '黄色セグメントの最大数', kr: '최대 노란색 세그먼트', zh: '黄色条段上限', fr: 'Segments Jaunes Maximum' } satisfies LangMap,
  basics_maxYellowText: {
    en: 'The maximum number of yellow segments per substat is 3, except for some items in the event shop where you may see 4. Rico\'s Secret Shop can grant 4 bars on a single substat, but this requires the shop to be max level (and even then, the chance is rare).',
    jp: 'サブステータスごとの黄色セグメントの最大数は3です。ただし、イベントショップの一部アイテムでは4が見られる場合があります。リコの秘密ショップでは単一のサブステに4本のバーが付くこともありますが、ショップが最大レベルである必要があり、確率も低いです。',
    kr: '부옵션당 노란색 세그먼트의 최대 수는 3개입니다. 단, 이벤트 상점의 일부 아이템에서는 4개가 나올 수 있습니다. 리코의 비밀 상점에서는 단일 부옵에 4칸이 붙을 수 있지만, 상점이 최대 레벨이어야 하며 확률도 낮습니다.',
    zh: '每个副属性的黄色条段最多为3条，但活动商店的某些物品可能会出现4条。里科的秘密商店可以给单个副属性4条，但需要商店达到最高等级（即使如此，概率也很低）。',
    fr: 'Le nombre maximum de segments jaunes par substat est de 3, sauf pour certains items des event shops où vous pouvez en voir 4. Rico\'s Secret Shop peut donner 4 barres sur un seul substat, mais cela requiert que le shop soit au niveau max (et même là, la chance est rare).',
  } satisfies LangMap,
  basics_perfectExample: {
    en: 'A "perfect" gear example (excluding shop) might look like:',
    jp: '「完璧な」装備の例（ショップ除く）：',
    kr: '"완벽한" 장비 예시 (상점 제외):',
    zh: '"完美"装备示例（不含商店）：',
    fr: 'Un exemple de gear "parfait" (hors shop) ressemble à ceci :',
  } satisfies LangMap,

  // ── Upgrading section ──
  upgrading_title: { en: 'Gear Enhancement Systems', jp: '装備強化システム', kr: '장비 강화 시스템', zh: '装备强化系统', fr: 'Systèmes d\'Enhancement du Gear' } satisfies LangMap,
  upgrading_intro: {
    en: 'There are four main ways to improve your gear:',
    jp: '装備を強化する方法は4つあります：',
    kr: '장비를 개선하는 네 가지 방법이 있습니다:',
    zh: '有四种主要方式来提升装备：',
    fr: 'Il existe quatre méthodes principales pour améliorer votre gear :',
  } satisfies LangMap,

  method_enhance_title: { en: 'Enhance', jp: '強化', kr: '강화', zh: '强化', fr: 'Enhance' } satisfies LangMap,
  method_enhance_desc: { en: 'Increase main stat via enhancement level', jp: '強化レベルでメインステータスを上昇', kr: '강화 레벨로 메인 스탯 증가', zh: '通过强化等级提升主属性', fr: 'Augmente la main stat via le niveau d\'enhancement' } satisfies LangMap,
  method_reforge_title: { en: 'Reforge', jp: '再鍛造', kr: '재련', zh: '重铸', fr: 'Reforge' } satisfies LangMap,
  method_reforge_desc: { en: 'Add or improve substats', jp: 'サブステータスを追加または改善', kr: '부옵션 추가 또는 개선', zh: '添加或提升副属性', fr: 'Ajoute ou améliore les substats' } satisfies LangMap,
  method_breakthrough_title: { en: 'Breakthrough', jp: '突破', kr: '돌파', zh: '突破', fr: 'Breakthrough' } satisfies LangMap,
  method_breakthrough_desc: { en: 'Unlock set bonuses and improve effects', jp: 'セット効果を解放し効果を向上', kr: '세트 효과 해금 및 효과 향상', zh: '解锁套装效果并提升效果', fr: 'Débloque les set bonuses et améliore les effets' } satisfies LangMap,
  method_changeStats_title: { en: 'Change Stats', jp: 'ステータス変更', kr: '스탯 변경', zh: '更换属性', fr: 'Change Stats' } satisfies LangMap,
  method_changeStats_desc: { en: 'Reroll substats with Transistones', jp: 'トランジストーンでサブステを再抽選', kr: '트랜지스톤으로 부옵 재추첨', zh: '用转换石重新随机副属性', fr: 'Reroll les substats avec des Transistones' } satisfies LangMap,

  // Enhance
  enhanceText: {
    en: 'Available via the Enhance menu, using hammers to increase the item\'s enhancement level up to +10 (or +15 once Singularity Ascension is unlocked). This improves the Main Stat only, based on the item\'s grade and star level.',
    jp: '強化メニューから利用可能。ハンマーを使用してアイテムの強化レベルを+10まで（特異点昇華解放後は+15まで）上げます。これはメインステータスのみを向上させ、アイテムのグレードと星レベルに基づきます。',
    kr: '강화 메뉴에서 사용 가능. 망치를 사용하여 아이템의 강화 레벨을 +10까지 (특이점 승화 해방 후 +15까지) 올립니다. 이는 아이템의 등급과 별 레벨에 따라 메인 스탯만 향상시킵니다.',
    zh: '通过强化菜单使用锤子将装备强化等级提升至+10（解锁奇点升华后可达+15）。这只会根据装备的品质和星级提升主属性。',
    fr: 'Disponible via le menu Enhance, utilise des hammers pour augmenter le niveau d\'enhancement de l\'item jusqu\'à +10 (ou +15 une fois Singularity Ascension débloqué). Cela améliore uniquement la Main Stat, en fonction du grade et du star level de l\'item.',
  } satisfies LangMap,
  enhanceTip1: {
    en: 'You can convert hammers to a higher grade in your inventory with a 2:1 ratio.',
    jp: 'インベントリでハンマーを2:1の比率で上位グレードに変換できます。',
    kr: '인벤토리에서 망치를 2:1 비율로 상위 등급으로 변환할 수 있습니다.',
    zh: '你可以在背包中以2:1的比例将锤子转换为更高等级。',
    fr: 'Vous pouvez convertir les hammers vers un grade supérieur dans votre inventaire avec un ratio 2:1.',
  } satisfies LangMap,
  enhanceTip2: {
    en: 'Converting hammers is only useful for enhancing Special Gear — there is no benefit for regular enhancing.',
    jp: 'ハンマーの変換は特殊装備の強化にのみ有用です。通常の強化では意味がありません。',
    kr: '망치 변환은 특수 장비 강화에만 유용합니다. 일반 강화에는 이점이 없습니다.',
    zh: '转换锤子只对强化特殊装备有用，对普通强化没有好处。',
    fr: 'Convertir les hammers n\'est utile que pour enhance du Special Gear : aucun bénéfice pour l\'enhancement classique.',
  } satisfies LangMap,
  enhanceTip3: {
    en: 'Combining Apprentice\'s Hammers can yield slightly more total EXP (200 EXP vs. 250 EXP when converted), but it costs gold — so the gain is often offset by the conversion expense.',
    jp: '見習いのハンマーを合成すると合計経験値がやや多くなります（変換時の250に対して200）が、ゴールドがかかるため、得られる利益は変換コストで相殺されることが多いです。',
    kr: '견습생의 망치를 조합하면 총 경험치가 약간 더 많아집니다 (변환 시 250 대비 200), 하지만 골드가 들어 이득이 변환 비용으로 상쇄되는 경우가 많습니다.',
    zh: '合成学徒之锤可以获得略多的总经验值（200对比转换后的250），但需要花费金币，所以收益往往被转换费用抵消。',
    fr: 'Combiner des Apprentice\'s Hammers peut donner un peu plus d\'EXP total (200 EXP vs 250 EXP après conversion), mais cela coûte du gold, donc le gain est souvent compensé par le coût de conversion.',
  } satisfies LangMap,
  enhanceComparisonTitle: {
    en: 'Enhancement Comparison by Rarity:',
    jp: 'レアリティ別の強化比較：',
    kr: '희귀도별 강화 비교:',
    zh: '按稀有度强化对比：',
    fr: 'Comparaison d\'Enhancement par Rareté :',
  } satisfies LangMap,
  enhanceLabel_normal: { en: 'Normal (1★)', jp: 'ノーマル (1★)', kr: '노멀 (1★)', zh: '普通 (1★)', fr: 'Normal (1★)' } satisfies LangMap,
  enhanceLabel_epic: { en: 'Epic (2★)', jp: 'エピック (2★)', kr: '에픽 (2★)', zh: '史诗 (2★)', fr: 'Epic (2★)' } satisfies LangMap,
  enhanceLabel_legendary: { en: 'Legendary (1★)', jp: 'レジェンダリー (1★)', kr: '레전드 (1★)', zh: '传说 (1★)', fr: 'Legendary (1★)' } satisfies LangMap,

  // Reforge
  reforgeText: {
    en: 'Available via the Reforge tab in the Enhance menu. Reforging uses catalysts to improve substats.',
    jp: '強化メニューの再鍛造タブから利用可能。再鍛造は触媒を使用してサブステータスを改善します。',
    kr: '강화 메뉴의 재련 탭에서 사용 가능. 재련은 촉매를 사용하여 부옵션을 개선합니다.',
    zh: '通过强化菜单的重铸标签使用催化剂来提升副属性。',
    fr: 'Disponible via l\'onglet Reforge du menu Enhance. Le Reforge utilise des catalysts pour améliorer les substats.',
  } satisfies LangMap,
  reforgeTip: {
    en: 'Like hammers, you can convert catalysts to the upper grade in your inventory with a 6:1 ratio.',
    jp: 'ハンマーと同様に、インベントリで触媒を6:1の比率で上位グレードに変換できます。',
    kr: '망치와 마찬가지로 인벤토리에서 촉매를 6:1 비율로 상위 등급으로 변환할 수 있습니다.',
    zh: '和锤子一样，你可以在背包中以6:1的比例将催化剂转换为更高等级。',
    fr: 'Comme pour les hammers, vous pouvez convertir les catalysts vers le grade supérieur dans votre inventaire avec un ratio 6:1.',
  } satisfies LangMap,
  reforgeHowTitle: {
    en: 'How Reforging Works:',
    jp: '再鍛造の仕組み：',
    kr: '재련 작동 방식:',
    zh: '重铸机制：',
    fr: 'Comment fonctionne le Reforge :',
  } satisfies LangMap,
  reforgeStep1: {
    en: 'If the item has less than 4 substats, it will add one (up to 4 total)',
    jp: 'サブステータスが4つ未満の場合、1つ追加されます（最大4つまで）',
    kr: '아이템에 부옵션이 4개 미만이면 하나가 추가됩니다 (최대 4개)',
    zh: '如果装备副属性少于4条，会添加一条（最多4条）',
    fr: 'Si l\'item a moins de 4 substats, une nouvelle substat est ajoutée (jusqu\'à 4 au total)',
  } satisfies LangMap,
  reforgeStep2: {
    en: 'If the item has 4 substats, it will enhance one (adds an orange segment) up to a maximum of 6 active segments per substat',
    jp: 'サブステータスが4つある場合、1つが強化されます（オレンジセグメントが追加、最大6セグメントまで）',
    kr: '아이템에 부옵션이 4개 있으면 하나가 강화됩니다 (주황색 세그먼트 추가, 최대 6개)',
    zh: '如果装备已有4条副属性，会强化其中一条（添加橙色条段，每个副属性最多6条）',
    fr: 'Si l\'item a 4 substats, l\'une d\'elles est améliorée (ajout d\'un segment orange) jusqu\'à un maximum de 6 segments actifs par substat',
  } satisfies LangMap,
  reforgeLimitTitle: { en: 'Reforge Limit', jp: '再鍛造の上限', kr: '재련 한도', zh: '重铸上限', fr: 'Limite de Reforge' } satisfies LangMap,
  reforgeLimitText: {
    en: 'You can reforge an item up to its star level (one time for 1★ gear and up to six times for 6★ gear).',
    jp: 'アイテムは星レベルまで再鍛造できます（1★装備は1回、6★装備は最大6回）。',
    kr: '아이템은 별 레벨까지 재련할 수 있습니다 (1★ 장비는 1회, 6★ 장비는 최대 6회).',
    zh: '装备可以重铸的次数等于其星级（1★装备1次，6★装备最多6次）。',
    fr: 'Vous pouvez reforger un item autant de fois que son star level (une fois pour du 1★ et jusqu\'à six fois pour du 6★).',
  } satisfies LangMap,

  // Breakthrough
  breakthroughText: {
    en: 'Available via the Breakthrough tab in the Enhance menu. Breakthrough increases the item\'s tier up to T4, improving the main stat and item\'s effect.',
    jp: '強化メニューの突破タブから利用可能。突破はアイテムのティアをT4まで上げ、メインステータスとアイテム効果を向上させます。',
    kr: '강화 메뉴의 돌파 탭에서 사용 가능. 돌파는 아이템의 티어를 T4까지 올려 메인 스탯과 아이템 효과를 향상시킵니다.',
    zh: '通过强化菜单的突破标签使用格鲁奈特将装备突破至T4，提升主属性和装备效果。',
    fr: 'Disponible via l\'onglet Breakthrough du menu Enhance. Le Breakthrough augmente le tier de l\'item jusqu\'à T4, améliorant la main stat et l\'effet de l\'item.',
  } satisfies LangMap,
  breakthroughTip: {
    en: 'You can use a duplicate item instead of Glunite (it must be the same grade, same effect, and same slot).',
    jp: 'グルナイトの代わりに同一アイテムを使用できます（同じグレード、同じ効果、同じスロットである必要があります）。',
    kr: '글루나이트 대신 동일 아이템을 사용할 수 있습니다 (같은 등급, 같은 효과, 같은 슬롯이어야 합니다).',
    zh: '你可以使用相同的装备代替格鲁奈特（必须是相同品质、相同效果、相同部位）。',
    fr: 'Vous pouvez utiliser un item dupliqué à la place du Glunite (même grade, même effet et même slot).',
  } satisfies LangMap,
  breakthroughExamplesTitle: {
    en: 'Breakthrough Examples:',
    jp: '突破の例：',
    kr: '돌파 예시:',
    zh: '突破示例：',
    fr: 'Exemples de Breakthrough :',
  } satisfies LangMap,

  // Change Stats
  changeStatsText: {
    en: 'Available via the Change Stat menu. There are two modes available:',
    jp: 'ステータス変更メニューから利用可能。2つのモードがあります：',
    kr: '스탯 변경 메뉴에서 사용 가능. 두 가지 모드가 있습니다:',
    zh: '通过更换属性菜单使用。有两种模式：',
    fr: 'Disponible via le menu Change Stat. Deux modes sont disponibles :',
  } satisfies LangMap,
  changeAll_title: {
    en: 'Change All (Transistone Total)',
    jp: '全変更（トランジストーン・トータル）',
    kr: '전체 변경 (트랜지스톤 토탈)',
    zh: '全部更换（转换石·全体）',
    fr: 'Change All (Transistone Total)',
  } satisfies LangMap,
  changeAll_desc: {
    en: 'Rerolls all 4 substats and their yellow segments. Orange segments remain fixed. This also unlocks any stats that were previously locked by Select & Change.',
    jp: '4つのサブステすべてと黄色セグメントを再抽選します。オレンジセグメントは固定されたままです。また、選択変更でロックされていたステータスも解除されます。',
    kr: '4개의 부옵션 모두와 노란색 세그먼트를 재추첨합니다. 주황색 세그먼트는 고정됩니다. 또한 선택 변경으로 잠긴 스탯도 해제됩니다.',
    zh: '重新随机全部4条副属性及其黄色条段。橙色条段保持固定。这也会解锁之前被选择更换锁定的属性。',
    fr: 'Reroll les 4 substats et leurs segments jaunes. Les segments orange restent fixes. Cela débloque aussi toute stat précédemment lockée par Select & Change.',
  } satisfies LangMap,
  selectChange_title: {
    en: 'Select & Change (Transistone Individual)',
    jp: '選択変更（トランジストーン・インディビジュアル）',
    kr: '선택 변경 (트랜지스톤 개별)',
    zh: '选择更换（转换石·单体）',
    fr: 'Select & Change (Transistone Individual)',
  } satisfies LangMap,
  selectChange_desc: {
    en: 'Rerolls only one selected substat. The other 3 substats are locked and will not change. Once a stat type is locked this way, it stays locked until you use Change All. Yellow segment count will change, but orange ones remain.',
    jp: '選択した1つのサブステのみを再抽選します。他の3つのサブステはロックされ、変更されません。この方法でロックされたステータスは、全変更を使用するまでロックされたままです。黄色セグメントの数は変わりますが、オレンジは固定です。',
    kr: '선택한 하나의 부옵션만 재추첨합니다. 나머지 3개의 부옵션은 잠기며 변경되지 않습니다. 이 방법으로 잠긴 스탯은 전체 변경을 사용할 때까지 잠긴 상태로 유지됩니다. 노란색 세그먼트 수는 변하지만 주황색은 고정됩니다.',
    zh: '只重新随机选中的一条副属性。其他3条副属性会被锁定，不会改变。一旦某个属性被这样锁定，在使用全部更换之前会一直保持锁定。黄色条段数量会改变，但橙色保持固定。',
    fr: 'Reroll uniquement une substat sélectionnée. Les 3 autres substats sont lockées et ne changent pas. Une fois lockée de cette manière, la stat reste lockée jusqu\'à utilisation de Change All. Le nombre de segments jaunes change, mais les orange restent.',
  } satisfies LangMap,
  changeStatsWarningTitle: { en: 'Warning', jp: '注意', kr: '주의', zh: '注意', fr: 'Attention' } satisfies LangMap,
  changeStatsWarningText: {
    en: 'Avoid rerolling stats using Transistone (Individual) if the substat already has 4 or more orange segments. Since orange segments are fixed, the reroll range drops from 1-3 to 1-2 yellow segments.',
    jp: 'サブステにすでに4つ以上のオレンジセグメントがある場合、トランジストーン（インディビジュアル）での再抽選は避けてください。オレンジセグメントは固定されるため、再抽選の範囲が1〜3から1〜2黄色セグメントに減少します。',
    kr: '부옵션에 이미 4개 이상의 주황색 세그먼트가 있는 경우 트랜지스톤 (개별)으로 재추첨하지 마세요. 주황색 세그먼트는 고정되므로 재추첨 범위가 1-3에서 1-2 노란색 세그먼트로 줄어듭니다.',
    zh: '如果副属性已有4条或更多橙色条段，避免使用转换石（单体）重随。因为橙色条段固定，重随范围会从1-3黄色条段降至1-2条。',
    fr: 'Évitez de reroll des stats via Transistone (Individual) si la substat a déjà 4 segments orange ou plus. Les segments orange étant fixes, la plage de roll passe de 1-3 à 1-2 segments jaunes.',
  } satisfies LangMap,

  // ── Singularity Ascension section ──
  ascension_title: { en: 'Singularity Ascension', jp: '特異点昇華', kr: '특이점 승화', zh: '奇点升华', fr: 'Singularity Ascension' } satisfies LangMap,
  ascension_intro: {
    en: 'Singularity Ascension extends the enhancement cap of a +10 / max-Reforge gear from +10 to +15. It is performed at the Singularity Ascension Device unlocked through Dimensional Singularity (Monad Gate).',
    jp: '特異点昇華は、+10かつ再鍛造最大の装備の強化上限を+10から+15まで拡張します。次元特異点（モナドゲート）から解放される特異点昇華装置で行います。',
    kr: '특이점 승화는 +10이며 재련이 최대인 장비의 강화 상한을 +10에서 +15까지 확장합니다. 차원 특이점(모나드 게이트)에서 해방되는 특이점 승화 장치에서 수행합니다.',
    zh: '奇点升华可将已达到+10且重铸已满的装备强化上限从+10扩展至+15。在通过次元奇点（莫纳德之门）解锁的奇点升华装置中进行。',
    fr: 'La Singularity Ascension étend le cap d\'enhancement d\'un gear +10 / max-Reforge de +10 à +15. Elle se fait au Singularity Ascension Device débloqué via Dimensional Singularity (Monad Gate).',
  } satisfies LangMap,
  ascension_prereqTitle: { en: 'Prerequisites', jp: '前提条件', kr: '전제 조건', zh: '前提条件', fr: 'Prérequis' } satisfies LangMap,
  ascension_prereqText: {
    en: 'The gear must be at +10 enhancement and have its Reforge counter at maximum before activation.',
    jp: '装備は強化+10、再鍛造カウンターも最大の状態である必要があります。',
    kr: '장비는 강화 +10이며 재련 카운터가 최대 상태여야 활성화할 수 있습니다.',
    zh: '装备必须达到强化+10且重铸次数已满才能进行升华。',
    fr: 'Le gear doit être à +10 d\'enhancement et avoir son compteur de Reforge au maximum avant activation.',
  } satisfies LangMap,
  ascension_warningTitle: { en: 'Warning — Irreversible', jp: '注意 — 不可逆', kr: '주의 — 되돌릴 수 없음', zh: '警告 — 不可逆', fr: 'Attention — Irréversible' } satisfies LangMap,
  ascension_warningText: {
    en: 'Once activated, the Gear Reset Module can no longer be used on this item. Any substat locks placed by Select & Change (Transistone Individual) are also cleared. Plan your build first.',
    jp: '一度活性化すると、ギアリセットモジュールはこの装備に使用できなくなります。選択変更（トランジストーン・インディビジュアル）で設定したサブステのロックもすべて解除されます。事前にビルドを計画してください。',
    kr: '한 번 활성화되면 기어 리셋 모듈을 더 이상 이 장비에 사용할 수 없습니다. 선택 변경 (트랜지스톤 개별)으로 설정한 부옵 잠금도 모두 해제됩니다. 빌드를 미리 계획하세요.',
    zh: '一旦激活，装备重置模块将无法再用于该装备。通过选择更换（转换石·单体）设置的副属性锁定也会全部解除。请先规划好你的配装。',
    fr: 'Une fois activé, le Gear Reset Module ne peut plus être utilisé sur cet item. Toutes les substat locks posées par Select & Change (Transistone Individual) sont également effacées. Planifiez votre build avant.',
  } satisfies LangMap,

  // Activation card
  ascension_activationTitle: { en: 'Activation', jp: '活性化', kr: '활성화', zh: '激活', fr: 'Activation' } satisfies LangMap,
  ascension_activationDesc: {
    en: 'Performed on a +10 / max-Reforge gear. Activation does NOT consume an enhancement level — the gear stays at +10. It raises the underlying stat multiplier (5.00 → 5.15) and grants three immediate effects:',
    jp: '+10かつ再鍛造最大の装備に対して行います。活性化は強化レベルを消費しません — 装備は+10のままです。内部ステータス倍率を上昇させ（5.00 → 5.15）、即時に3つの効果を付与します：',
    kr: '+10이며 재련이 최대인 장비에 수행합니다. 활성화는 강화 레벨을 소비하지 않습니다 — 장비는 +10을 유지합니다. 내부 스탯 배율이 상승하며 (5.00 → 5.15) 즉시 세 가지 효과를 부여합니다:',
    zh: '对+10且重铸已满的装备进行。激活不会消耗强化等级 — 装备保持+10。会提升内部属性倍率（5.00 → 5.15），并立即获得三项效果：',
    fr: 'S\'effectue sur un gear +10 / max-Reforge. L\'activation NE consomme PAS de niveau d\'enhancement : le gear reste à +10. Elle augmente le multiplicateur de stat sous-jacent (5.00 → 5.15) et octroie trois effets immédiats :',
  } satisfies LangMap,
  ascension_benefit_cap: { en: 'Unlocks the +15 enhancement cap', jp: '+15強化上限を解放', kr: '+15 강화 상한 해방', zh: '解锁+15强化上限', fr: 'Débloque le cap d\'enhancement +15' } satisfies LangMap,
  ascension_benefit_reforge: { en: '+3 Reforge Attempts', jp: '再鍛造回数+3', kr: '재련 횟수 +3', zh: '重铸次数+3', fr: '+3 tentatives de Reforge' } satisfies LangMap,
  ascension_benefit_mainStat: { en: '+3% Main Stat (immediate, vs the standard +10 value)', jp: 'メインステータス+3%（即時、通常の+10時の値基準）', kr: '메인 스탯 +3% (즉시, 일반 +10 시점 값 기준)', zh: '主属性+3%（立即生效，以普通+10时数值为基准）', fr: '+3% Main Stat (immédiat, par rapport à la valeur standard +10)' } satisfies LangMap,

  // Steps section
  ascension_stepsTitle: { en: 'Enhancement +11 → +15', jp: '強化 +11 → +15', kr: '강화 +11 → +15', zh: '强化 +11 → +15', fr: 'Enhancement +11 → +15' } satisfies LangMap,
  ascension_stepsDesc: {
    en: 'Once activated, you can enhance the gear from +10 to +15 across 5 successful steps. Each step consumes Gold + Singularity materials, raises the enhancement level by 1 on success, and may fail (success rate decreases as the level rises). Each step adds to the stat multiplier independently (additive, not compounded): +0.10 for each +10→+14 step (≈+2 % vs the +10 value), +0.20 for the final +14→+15 step (≈+4 %). Cumulated with activation, total Main Stat gain at +15 is ≈+15 % over the standard +10 value. The final step also unlocks a random bonus effect (offensive for Weapon/Accessory, defensive for Armor pieces).',
    jp: '活性化後、5回の成功で装備を+10から+15まで強化できます。各段階はゴールドと特異点素材を消費し、成功時に強化レベルを1上げます（成功率はレベルが上がるにつれて低下）。各段階は内部倍率に独立して加算（複利ではなく加算）：+10→+14は各+0.10（+10時の値の約+2%相当）、最終 +14→+15 は+0.20（約+4%相当）。活性化と合わせると、+15での累計メインステ上昇は通常の+10時の値の約+15%。最終段階ではランダムなボーナス効果も解放されます（武器・アクセサリーは攻撃系、防具は防御系）。',
    kr: '활성화 후, 장비를 5번의 성공 단계로 +10에서 +15까지 강화할 수 있습니다. 각 단계는 골드와 특이점 재료를 소비하며, 성공 시 강화 레벨을 1 올립니다 (레벨이 오를수록 성공률 감소). 각 단계는 내부 배율에 독립적으로 가산됩니다 (복리가 아닌 가산): +10→+14 각 단계 +0.10 (+10 시점 값 기준 약 +2%), 최종 +14→+15 +0.20 (약 +4%). 활성화와 합쳐, +15에서 누적 메인 스탯 상승은 일반 +10 시점 값의 약 +15%. 최종 단계에서는 랜덤 보너스 효과도 해방됩니다 (무기/액세서리는 공격형, 방어구는 방어형).',
    zh: '激活后，可通过 5 次成功阶段将装备从 +10 提升至 +15。每一阶段消耗金币和奇点材料，成功时强化等级 +1（随等级提升，成功率递减）。每一阶段对内部倍率独立叠加（加法，非复利）：+10→+14 每段 +0.10（相当于 +10 时数值的约 +2%），最终 +14→+15 +0.20（约 +4%）。结合激活，+15 时主属性累计提升约为普通 +10 时数值的 +15%。最终阶段还会解锁随机额外效果（武器/饰品为攻击系，防具为防御系）。',
    fr: 'Une fois activée, vous pouvez enhance le gear de +10 à +15 en 5 étapes réussies. Chaque étape consomme du Gold et des matériaux Singularity, monte le niveau d\'enhancement de 1 en cas de succès, et peut échouer (le taux de réussite baisse avec le niveau). Chaque étape ajoute au multiplicateur de stat de manière indépendante (additif, pas multiplicatif) : +0.10 pour chaque étape +10→+14 (environ +2% par rapport à la valeur +10), +0.20 pour la dernière étape +14→+15 (environ +4%). Cumulé avec l\'activation, le gain total de Main Stat à +15 est d\'environ +15% par rapport à la valeur standard +10. La dernière étape débloque aussi un bonus effect aléatoire (offensif pour Weapon/Accessory, défensif pour les pièces d\'Armor).',
  } satisfies LangMap,
  // Failure note (verified in-game)
  ascension_failTitle: { en: 'On Failure', jp: '失敗時', kr: '실패 시', zh: '失败时', fr: 'En cas d\'échec' } satisfies LangMap,
  ascension_failText: {
    en: 'A failed step has no impact on the gear: no level loss, no stat penalty, no bonus reset. Only the Gold and materials spent on that attempt are consumed — you can simply retry.',
    jp: '失敗しても装備への影響は一切ありません：レベル低下なし、ステータス低下なし、ボーナスのリセットなし。失敗した試行のゴールドと素材のみが消費され、そのまま再挑戦できます。',
    kr: '실패해도 장비에 영향은 전혀 없습니다: 레벨 감소 없음, 스탯 감소 없음, 보너스 초기화 없음. 실패한 시도의 골드와 재료만 소모되며, 바로 다시 시도할 수 있습니다.',
    zh: '失败不会对装备产生任何影响：不会掉级、不会降低属性、不会重置加成。仅消耗本次尝试所用的金币和材料，可直接重试。',
    fr: 'Une étape échouée n\'a aucun impact sur le gear : pas de perte de niveau, pas de pénalité de stat, pas de reset de bonus. Seuls le Gold et les matériaux utilisés pour cette tentative sont consommés ; vous pouvez simplement réessayer.',
  } satisfies LangMap,

  // Steps table headers
  ascensionTable_from: { en: 'Step', jp: '段階', kr: '단계', zh: '阶段', fr: 'Étape' } satisfies LangMap,
  ascensionTable_success: { en: 'Success', jp: '成功率', kr: '성공률', zh: '成功率', fr: 'Réussite' } satisfies LangMap,
  ascensionTable_gold: { en: 'Gold', jp: 'ゴールド', kr: '골드', zh: '金币', fr: 'Gold' } satisfies LangMap,
  ascensionTable_chip: { en: 'Chip', jp: 'チップ', kr: '칩', zh: '芯片', fr: 'Chip' } satisfies LangMap,
  ascensionTable_hammer: { en: 'Hammer', jp: 'ハンマー', kr: '망치', zh: '锤子', fr: 'Hammer' } satisfies LangMap,
  ascensionTable_mainStat: { en: 'Main Stat', jp: 'メインステ', kr: '메인 스탯', zh: '主属性', fr: 'Main Stat' } satisfies LangMap,
  ascensionTable_bonus: { en: 'Bonus', jp: 'ボーナス', kr: '보너스', zh: '加成', fr: 'Bonus' } satisfies LangMap,

  // Bonus effects section
  ascension_bonusTitle: { en: 'Bonus Effect at +15', jp: '+15時のボーナス効果', kr: '+15 보너스 효과', zh: '+15额外效果', fr: 'Bonus Effect à +15' } satisfies LangMap,
  ascension_bonusDesc: {
    en: 'When the +14 → +15 step succeeds, the gear gains one random bonus effect. The pool depends on the slot: offensive options for Weapons & Accessories, defensive options for Armor pieces. Within each pool, the rolled tier determines a grade from C (lowest) to S+ (highest).',
    jp: '+14 → +15が成功すると、装備はランダムなボーナス効果を1つ獲得します。プールはスロットに依存します：武器・アクセサリーは攻撃系オプション、防具系は防御系オプションです。各プール内で抽選された段階により、グレードがC（最低）からS+（最高）まで決定されます。',
    kr: '+14 → +15에 성공하면 장비는 랜덤 보너스 효과 1개를 얻습니다. 풀은 슬롯에 따라 다릅니다: 무기·액세서리는 공격형 옵션, 방어구 계열은 방어형 옵션. 각 풀 내에서 추첨된 단계에 따라 C(최저)부터 S+(최고)까지의 등급이 결정됩니다.',
    zh: '+14 → +15 成功时装备获得一项随机额外效果。效果池根据装备槽位决定：武器与饰品为攻击型选项，防具类为防御型选项。每个池内根据抽到的阶段确定从C（最低）到S+（最高）的等级。',
    fr: 'Lorsque l\'étape +14 → +15 réussit, le gear gagne un bonus effect aléatoire. Le pool dépend du slot : options offensives pour Weapons et Accessories, options défensives pour les pièces d\'Armor. Dans chaque pool, le tier roll détermine un grade de C (le plus bas) à S+ (le plus haut).',
  } satisfies LangMap,
  ascension_offensiveTitle: { en: 'Offensive Pool — Weapon & Accessory', jp: '攻撃プール — 武器＆アクセサリー', kr: '공격 풀 — 무기 & 액세서리', zh: '攻击池 — 武器与饰品', fr: 'Pool Offensif — Weapon & Accessory' } satisfies LangMap,
  ascension_defensiveTitle: { en: 'Defensive Pool — Helmet, Armor, Gloves, Shoes', jp: '防御プール — ヘルメット・アーマー・グローブ・シューズ', kr: '방어 풀 — 헬멧, 아머, 장갑, 신발', zh: '防御池 — 头盔、护甲、手套、鞋子', fr: 'Pool Défensif — Helmet, Armor, Gloves, Shoes' } satisfies LangMap,
  ascension_gradeLegend: { en: 'Grade legend (C → S+):', jp: 'グレード一覧（C → S+）：', kr: '등급 표시 (C → S+):', zh: '等级图例（C → S+）：', fr: 'Légende des grades (C → S+) :' } satisfies LangMap,
  ascension_randomTitle: { en: 'Random Element', jp: '属性はランダム', kr: '속성 랜덤', zh: '属性随机', fr: 'Élément Aléatoire' } satisfies LangMap,
  ascension_randomText: {
    en: 'For elemental options, the targeted element is rolled randomly from the 5 elements at +14 → +15 (each element has its own ~12 % pool slot). The in-game label is a generic "Elemental Target DMG Increase" / "Reduced DMG Taken vs Element"; the actual rolled element is fixed once obtained and can only change via Reload Cartridge.',
    jp: '属性オプションでは、+14 → +15で5属性の中からランダムに対象属性が決定されます（各属性は独立して約12%のプール枠を持ちます）。ゲーム内の表示は汎用的な「属性対象ダメージUP」「属性対象受ダメージDOWN」で、抽選結果の属性はリロードカートリッジで再抽選しない限り変更できません。',
    kr: '속성 옵션의 경우 +14 → +15 단계에서 5속성 중 하나가 랜덤으로 결정됩니다 (각 속성은 약 12% 의 풀을 차지). 게임 내 표시는 일반적인 "속성 대상 피해 증가" / "속성 대상 받는 피해 감소"이며, 일단 추첨된 속성은 리로드 카트리지로 재추첨하기 전까지 고정됩니다.',
    zh: '对于属性类选项，目标属性在 +14 → +15 时从 5 种属性中随机抽选（每种属性独立占约 12% 池权重）。游戏内显示为通用「属性目标伤害提升」/「受属性目标伤害减免」，抽中的属性会被固定，仅能通过换弹匣重新随机。',
    fr: 'Pour les options élémentaires, l\'Élément cible est tiré aléatoirement parmi les 5 Éléments à +14 → +15 (chaque Élément a son propre slot de pool d\'environ 12%). Le libellé in-game est générique : "Elemental Target DMG Increase" / "Reduced DMG Taken vs Élément" ; l\'Élément réellement tiré est fixé une fois obtenu et ne peut changer que via Reload Cartridge.',
  } satisfies LangMap,
  ascension_defensiveSplitNote: {
    en: 'F/W/E ≈ rolled vs Fire/Water/Earth (~36 % combined pool, range 20 %–50 %) · L/D ≈ rolled vs Light/Dark (~24 % combined pool, range 15 %–25 %).',
    jp: 'F/W/E ≈ 火/水/土に対する抽選（合計約36%、範囲20%〜50%）・L/D ≈ 光/闇に対する抽選（合計約24%、範囲15%〜25%）。',
    kr: 'F/W/E ≈ 화/수/토 추첨 (합계 약 36%, 범위 20%–50%) · L/D ≈ 광/암 추첨 (합계 약 24%, 범위 15%–25%).',
    zh: 'F/W/E ≈ 抽中火/水/地（合计约 36%，范围 20%–50%）· L/D ≈ 抽中光/暗（合计约 24%，范围 15%–25%）。',
    fr: 'F/W/E ≈ tiré vs Fire/Water/Earth (pool combiné d\'environ 36%, plage 20%-50%) · L/D ≈ tiré vs Light/Dark (pool combiné d\'environ 24%, plage 15%-25%).',
  } satisfies LangMap,
  ascension_modeSimple: { en: 'Simple', jp: 'シンプル', kr: '간단', zh: '简洁', fr: 'Simple' } satisfies LangMap,
  ascension_modeComplete: { en: 'Complete', jp: '完全', kr: '상세', zh: '完整', fr: 'Complet' } satisfies LangMap,

  // Bonus table headers
  ascensionBonus_effect: { en: 'Effect', jp: '効果', kr: '효과', zh: '效果', fr: 'Effet' } satisfies LangMap,
  ascensionBonus_chance: { en: 'Pool chance', jp: '出現率', kr: '풀 확률', zh: '出现概率', fr: 'Chance dans le pool' } satisfies LangMap,
  ascensionBonus_range: { en: 'Range (C → S+)', jp: '範囲（C → S+）', kr: '범위 (C → S+)', zh: '范围（C → S+）', fr: 'Plage (C → S+)' } satisfies LangMap,

  // Effect names (offensive)
  bonus_dmg: { en: 'DMG Increase', jp: 'ダメージUP', kr: '피해 증가', zh: '伤害提升', fr: 'DMG Increase' } satisfies LangMap,
  bonus_dmg_singular: { en: 'DMG Increase (in Singularity)', jp: 'ダメージUP（特異点内）', kr: '피해 증가 (특이점 내)', zh: '伤害提升（奇点内）', fr: 'DMG Increase (en Singularity)' } satisfies LangMap,
  bonus_dmg_skill3_singular: { en: 'Ultimate Skill DMG Increase (in Singularity)', jp: 'アルティメットスキルダメージUP（特異点内）', kr: '궁극기 피해 증가 (특이점 내)', zh: '终极技能伤害提升（奇点内）', fr: 'Ultimate Skill DMG Increase (en Singularity)' } satisfies LangMap,
  bonus_dmg_to_element: { en: 'Elemental Target DMG Increase (random element)', jp: '属性対象ダメージUP（属性ランダム）', kr: '속성 대상 피해 증가 (속성 랜덤)', zh: '属性目标伤害提升（属性随机）', fr: 'Elemental Target DMG Increase (Élément aléatoire)' } satisfies LangMap,

  // Effect names (defensive)
  bonus_dmg_reduce: { en: 'DMG Reduction', jp: '被ダメージDOWN', kr: '받는 피해 감소', zh: '受到伤害减免', fr: 'DMG Reduction' } satisfies LangMap,
  bonus_dmg_reduce_singular: { en: 'DMG Reduction (in Singularity)', jp: '被ダメージDOWN（特異点内）', kr: '받는 피해 감소 (특이점 내)', zh: '受到伤害减免（奇点内）', fr: 'DMG Reduction (en Singularity)' } satisfies LangMap,
  bonus_dmg_reduce_by_element: { en: 'Reduced DMG Taken vs Element (random element)', jp: '属性対象受ダメージDOWN（属性ランダム）', kr: '속성 대상 받는 피해 감소 (속성 랜덤)', zh: '受属性目标伤害减免（属性随机）', fr: 'Reduced DMG Taken vs Élément (Élément aléatoire)' } satisfies LangMap,

  // Reroll
  ascension_rerollTitle: { en: 'Reroll the Bonus (Reload Cartridge)', jp: 'ボーナス再抽選（リロードカートリッジ）', kr: '보너스 재추첨 (리로드 카트리지)', zh: '重新随机额外效果（换弹匣）', fr: 'Reroll du Bonus (Reload Cartridge)' } satisfies LangMap,
  ascension_rerollDesc: {
    en: 'Once a bonus effect is set at +15, it can be rerolled at any time using a Reload Cartridge. The reroll changes the rolled effect within the same pool — useful for chasing higher tiers or a specific element.',
    jp: '+15で設定されたボーナス効果は、リロードカートリッジを使用していつでも再抽選できます。再抽選は同じプール内で抽選結果を変更します — 高い段階や特定の属性を狙う際に便利です。',
    kr: '+15에서 설정된 보너스 효과는 언제든 리로드 카트리지를 사용해 재추첨할 수 있습니다. 재추첨은 같은 풀 내에서 결과를 변경합니다 — 높은 등급이나 특정 속성을 노릴 때 유용합니다.',
    zh: '+15 设定的额外效果可随时使用换弹匣重新随机。重新随机会在同一池中更换效果，适合追求更高等级或特定属性。',
    fr: 'Une fois qu\'un bonus effect est fixé à +15, il peut être reroll à tout moment via un Reload Cartridge. Le reroll change l\'effet rollé dans le même pool : utile pour viser des tiers plus élevés ou un Élément spécifique.',
  } satisfies LangMap,

  // ── Obtaining section ──
  obtaining_title: { en: 'How to Get 6-Star Gear', jp: '6★装備の入手方法', kr: '6성 장비 획득 방법', zh: '如何获取6星装备', fr: 'Comment Obtenir du Gear 6-Star' } satisfies LangMap,
  obtaining_intro: {
    en: 'There are four main ways to acquire 6-star gear in Outerplane:',
    jp: 'アウタープレーンで6★装備を入手する主な方法は4つあります：',
    kr: '아우터플레인에서 6성 장비를 획득하는 네 가지 주요 방법이 있습니다:',
    zh: '在异域战记中获取6星装备有四种主要方式：',
    fr: 'Il existe quatre méthodes principales pour acquérir du gear 6-star dans Outerplane :',
  } satisfies LangMap,

  obt_farmBosses_title: { en: 'Farm Gear Bosses & Story Stages', jp: '装備ボス＆ストーリーステージを周回', kr: '장비 보스 & 스토리 스테이지 파밍', zh: '刷装备Boss和故事关卡', fr: 'Farm les Gear Bosses & Story Stages' } satisfies LangMap,
  obt_farmBosses_desc: {
    en: 'Farm gear bosses and story hard stages starting from Season 3, 5-10. Prioritize farming armor, as weapons and accessories involve heavy RNG on main stats and skills.',
    jp: 'シーズン3の5-10以降の装備ボスとストーリーハードステージを周回。武器とアクセサリーはメインステータスとスキルのRNGが重いため、防具の周回を優先しましょう。',
    kr: '시즌 3, 5-10부터 장비 보스와 스토리 하드 스테이지를 파밍하세요. 무기와 액세서리는 메인 스탯과 스킬의 RNG가 심하므로 방어구 파밍을 우선시하세요.',
    zh: '从第三季5-10开始刷装备Boss和故事困难关卡。武器和饰品的主属性和技能RNG较重，优先刷防具。',
    fr: 'Farmez les gear bosses et les story hard stages à partir de Season 3, 5-10. Privilégiez le farm d\'armor, car les armes et accessoires impliquent un gros RNG sur les main stats et les skills.',
  } satisfies LangMap,
  obt_craftArmor_title: { en: "Craft Armor at Kate's Shop", jp: 'ケイトのショップで防具を製作', kr: '케이트 상점에서 방어구 제작', zh: '在凯特商店制作防具', fr: "Craft de l'Armor a la Kate's Shop" } satisfies LangMap,
  obt_craftArmor_desc: {
    en: 'Craft armor during crafting discount weeks (1 week/month). Use {ITEM} to select your desired armor set.',
    jp: '製作割引週間（月1回）に防具を製作。{ITEM}を使用して希望の防具セットを選択できます。',
    kr: '제작 할인 주간 (월 1회)에 방어구를 제작하세요. {ITEM}을 사용하여 원하는 방어구 세트를 선택할 수 있습니다.',
    zh: '在制作折扣周（每月一周）制作防具。使用{ITEM}选择你想要的防具套装。',
    fr: 'Craftez de l\'armor pendant les semaines de discount craft (1 semaine/mois). Utilisez {ITEM} pour sélectionner votre set d\'armor souhaité.',
  } satisfies LangMap,
  obt_craftArmor_warning: {
    en: 'Avoid crafting weapons/accessories due to RNG.',
    jp: 'RNGのため武器/アクセサリーの製作は避けてください。',
    kr: 'RNG 때문에 무기/액세서리 제작은 피하세요.',
    zh: '由于RNG，避免制作武器/饰品。',
    fr: 'Évitez de craft des armes/accessoires en raison du RNG.',
  } satisfies LangMap,
  obt_preciseCraft_title: { en: 'Use Precise Craft', jp: '精密製作を使用', kr: '정밀 제작 사용', zh: '使用精确制作', fr: 'Utilisez Precise Craft' } satisfies LangMap,
  obt_preciseCraft_desc: {
    en: 'For weapons and accessories, use Precise Craft. This uses {ITEM1} and allows sub-stat rerolling, helping you save {ITEM2}.',
    jp: '武器とアクセサリーには精密製作を使用。{ITEM1}を使用し、サブステの再抽選が可能で、{ITEM2}の節約になります。',
    kr: '무기와 액세서리에는 정밀 제작을 사용하세요. {ITEM1}을 사용하며 부옵 재추첨이 가능해 {ITEM2}을 절약할 수 있습니다.',
    zh: '对于武器和饰品，使用精确制作。这会消耗{ITEM1}，允许副属性重随，帮你节省{ITEM2}。',
    fr: 'Pour les armes et accessoires, utilisez Precise Craft. Cela consomme {ITEM1} et permet le reroll des substats, vous aidant à économiser {ITEM2}.',
  } satisfies LangMap,
  obt_irregularBosses_title: { en: 'Farm Irregular Bosses', jp: 'イレギュラーボスを周回', kr: '이레귤러 보스 파밍', zh: '刷异变Boss', fr: 'Farm des Irregular Bosses' } satisfies LangMap,
  obt_irregularBosses_desc: {
    en: 'Queen and Wyvre drop one gear set, while the other two bosses drop a different set. Check drop tables to farm the right bosses for your build.',
    jp: 'クイーンとワイバーンは1つの装備セットをドロップし、他の2体のボスは別のセットをドロップします。ビルドに合わせて適切なボスを周回しましょう。',
    kr: '퀸과 와이번은 한 장비 세트를 드롭하고, 나머지 두 보스는 다른 세트를 드롭합니다. 빌드에 맞는 보스를 파밍하세요.',
    zh: '女王和飞龙掉落一套装备，另外两个Boss掉落另一套。查看掉落表，刷适合你配装的Boss。',
    fr: 'Queen et Wyvre droppent un set de gear, tandis que les deux autres bosses droppent un set différent. Consultez les drop tables pour farmer les bons bosses pour votre build.',
  } satisfies LangMap,

  obtaining_dropRateTitle: { en: 'Increasing Drop Rates', jp: 'ドロップ率の向上', kr: '드롭률 높이기', zh: '提高掉落率', fr: 'Augmenter les Taux de Drop' } satisfies LangMap,
  obtaining_dropRateText_before: {
    en: 'Use Monad Gate titles that increase drop rates from Special Request stages. Some titles, like ',
    jp: 'スペシャルリクエストステージのドロップ率を上げるモナドゲートの称号を使用しましょう。',
    kr: '스페셜 리퀘스트 스테이지의 드롭률을 높이는 모나드 게이트 칭호를 사용하세요. ',
    zh: '使用提高特殊请求关卡掉落率的莫纳德之门称号。像',
    fr: 'Utilisez des titres Monad Gate qui augmentent les drop rates des Special Request stages. Certains titres, comme ',
  } satisfies LangMap,
  obtaining_dropRateText_after: {
    en: ', can boost drop rates by up to 30%, helping reduce RNG frustration.',
    jp: 'などの称号は最大30%のドロップ率アップが可能で、RNGのストレスを軽減できます。',
    kr: ' 같은 칭호는 최대 30%의 드롭률 증가가 가능해 RNG 스트레스를 줄여줍니다.',
    zh: '这样的称号可以将掉落率提高最多30%，帮助减少RNG的烦恼。',
    fr: ', peuvent augmenter les drop rates jusqu\'à 30%, ce qui aide à réduire la frustration liée au RNG.',
  } satisfies LangMap,

  obtaining_shopsTitle: { en: 'Special Shops & Events', jp: '特別ショップ＆イベント', kr: '특별 상점 & 이벤트', zh: '特殊商店和活动', fr: 'Shops Spéciaux & Events' } satisfies LangMap,
  obtaining_limitedShopsTitle: { en: 'Limited-Time Shops', jp: '期間限定ショップ', kr: '기간 한정 상점', zh: '限时商店', fr: 'Shops en Temps Limité' } satisfies LangMap,
  obtaining_limitedShopsText_before: {
    en: 'A few times a year, limited shops offer legendary gear with 3×4 substats (or better) purchasable with ',
    jp: '年に数回、期間限定ショップで3×4サブステ（またはそれ以上）のレジェンダリー装備が',
    kr: '1년에 몇 번, 기간 한정 상점에서 3×4 부옵 (또는 그 이상)의 레전드 장비를 ',
    zh: '每年几次，限时商店会提供3×4副属性（或更好）的传说装备，可用',
    fr: 'Quelques fois par an, des shops limités proposent du gear legendary avec 3×4 substats (ou mieux) achetable avec ',
  } satisfies LangMap,
  obtaining_limitedShopsText_after: {
    en: '. These are excellent deals and should be prioritized.',
    jp: 'で購入できます。非常にお得なので優先しましょう。',
    kr: '로 구매할 수 있습니다. 매우 좋은 거래이므로 우선시하세요.',
    zh: '购买。这是非常划算的交易，应该优先购买。',
    fr: '. Ce sont d\'excellentes affaires et ils doivent être prioritaires.',
  } satisfies LangMap,
  obtaining_eventChestsTitle: { en: 'Event Selection Chests', jp: 'イベント選択チェスト', kr: '이벤트 선택 상자', zh: '活动选择宝箱', fr: 'Coffres de Sélection d\'Event' } satisfies LangMap,
  obtaining_eventChestsText: {
    en: 'Events often include weapon, accessory, and armor chests. Check if the main stat is fixed or random. Sub-stats are usually random unless stated otherwise.',
    jp: 'イベントでは武器、アクセサリー、防具のチェストが含まれることが多いです。メインステータスが固定かランダムか確認しましょう。サブステは特に記載がない限り通常ランダムです。',
    kr: '이벤트에는 무기, 액세서리, 방어구 상자가 포함되는 경우가 많습니다. 메인 스탯이 고정인지 랜덤인지 확인하세요. 부옵션은 별도 표시가 없으면 보통 랜덤입니다.',
    zh: '活动通常包含武器、饰品和防具宝箱。检查主属性是固定还是随机的。除非另有说明，副属性通常是随机的。',
    fr: 'Les events incluent souvent des coffres d\'armes, d\'accessoires et d\'armor. Vérifiez si la main stat est fixe ou aléatoire. Les substats sont généralement aléatoires sauf indication contraire.',
  } satisfies LangMap,

  obtaining_priorityTitle: { en: 'Gear Priority by Slot', jp: 'スロット別装備優先度', kr: '슬롯별 장비 우선순위', zh: '装备部位优先级', fr: 'Priorité du Gear par Slot' } satisfies LangMap,
  obtaining_priorityIntro: {
    en: 'Where to focus your Legendary gear farming and Transistone usage:',
    jp: 'レジェンダリー装備の周回とトランジストーン使用の優先順位：',
    kr: '레전드 장비 파밍과 트랜지스톤 사용의 우선순위:',
    zh: '传说装备刷取和转换石使用的优先顺序：',
    fr: 'Où concentrer votre farm de gear Legendary et votre utilisation des Transistones :',
  } satisfies LangMap,

  slot_weapons: { en: 'Weapons', jp: '武器', kr: '무기', zh: '武器', fr: 'Armes' } satisfies LangMap,
  slot_accessories: { en: 'Accessories', jp: 'アクセサリー', kr: '액세서리', zh: '饰品', fr: 'Accessoires' } satisfies LangMap,
  slot_gloves: { en: 'Gloves', jp: 'グローブ', kr: '장갑', zh: '手套', fr: 'Gloves' } satisfies LangMap,
  slot_otherArmor: { en: 'Other Armor', jp: 'その他の防具', kr: '기타 방어구', zh: '其他防具', fr: 'Autres Armors' } satisfies LangMap,
  slotDesc_weapons: { en: 'Unique skills, highest priority for Legendary', jp: '固有スキルあり、レジェンダリー最優先', kr: '고유 스킬 보유, 레전드 최우선', zh: '有独特技能，传说优先级最高', fr: 'Skills uniques, priorité maximale pour le Legendary' } satisfies LangMap,
  slotDesc_accessories: { en: 'Unique skills, main stat matters for DPS', jp: '固有スキルあり、DPSにはメインステが重要', kr: '고유 스킬 보유, DPS에게 메인 스탯 중요', zh: '有独特技能，DPS需要关注主属性', fr: 'Skills uniques, la main stat compte pour les DPS' } satisfies LangMap,
  slotDesc_gloves: { en: 'Effectiveness main stat useful for debuffers', jp: 'デバッファーには効果命中メインステが有用', kr: '디버퍼에게 효과 적중 메인 스탯 유용', zh: '对减益角色效果命中主属性有用', fr: 'EFF en main stat utile pour les debuffers' } satisfies LangMap,
  slotDesc_otherArmor: { en: 'Epic is viable, focus on substats over rarity', jp: 'エピックでも使える、レアリティよりサブステ重視', kr: '에픽도 사용 가능, 희귀도보다 부옵 중시', zh: '史诗也可用，副属性比稀有度更重要', fr: 'L\'Epic est viable, privilégiez les substats plutôt que la rareté' } satisfies LangMap,

  // ── FAQ section ──
  faq_qualityTitle: { en: 'Gear Quality & Rarity', jp: '装備の品質とレアリティ', kr: '장비 품질 & 희귀도', zh: '装备品质和稀有度', fr: 'Qualité & Rareté du Gear' } satisfies LangMap,
  faq_upgradingTitle: { en: 'Upgrading & Resources', jp: '強化とリソース', kr: '강화 & 자원', zh: '强化和资源', fr: 'Upgrades & Ressources' } satisfies LangMap,
  faq_farmingTitle: { en: 'Farming & Acquisition', jp: '周回と入手', kr: '파밍 & 획득', zh: '刷取和获取', fr: 'Farm & Acquisition' } satisfies LangMap,

  faq_legendaryOnly_q: {
    en: 'Should I only aim for Legendary gear?',
    jp: 'レジェンダリー装備だけを狙うべき？',
    kr: '레전드 장비만 노려야 하나요?',
    zh: '应该只追求传说装备吗？',
    fr: 'Faut-il uniquement viser du gear Legendary ?',
  } satisfies LangMap,
  faq_legendaryOnly_a1: { en: 'No! Epic gear is a strong alternative, especially on armor.', jp: 'いいえ！エピック装備は特に防具で強力な代替品です。', kr: '아닙니다! 에픽 장비는 특히 방어구에서 강력한 대안입니다.', zh: '不！史诗装备是很好的替代品，特别是防具。', fr: 'Non ! Le gear Epic est une alternative solide, surtout sur l\'armor.' } satisfies LangMap,
  faq_legendaryOnly_a2: { en: 'It is cheaper to upgrade and the maximum stats are just 1 reforge lower than Legendary.', jp: '強化コストが安く、最大ステータスはレジェンダリーより再鍛造1回分少ないだけです。', kr: '강화 비용이 저렴하고 최대 스탯은 레전드보다 재련 1회 적을 뿐입니다.', zh: '强化成本更低，最大属性只比传说少一次重铸。', fr: 'Il est moins cher à upgrade et ses stats maximales sont juste 1 reforge en-dessous du Legendary.' } satisfies LangMap,
  faq_legendaryOnly_a3: {
    en: 'Weapons and Accessories have unique skills, so you would prefer looking for Legendary gear here, followed by Gloves for Effectiveness on debuffers.',
    jp: '武器とアクセサリーには固有スキルがあるため、ここではレジェンダリーを優先し、デバッファーには効果命中のためグローブを狙いましょう。',
    kr: '무기와 액세서리는 고유 스킬이 있어 레전드를 우선하고, 디버퍼는 효과 적중을 위해 장갑을 노리세요.',
    zh: '武器和饰品有独特技能，所以这里优先传说，减益角色其次是效果命中手套。',
    fr: 'Les armes et accessoires ont des skills uniques, vous préférerez donc chercher du Legendary ici, suivi des Gloves pour l\'EFF des debuffers.',
  } satisfies LangMap,

  faq_sixVsFive_q: { en: 'Is 6-star gear always better than 5-star legendary gear?', jp: '6★装備は常に5★レジェンダリーより良い？', kr: '6성 장비가 항상 5성 레전드보다 좋나요?', zh: '6星装备一定比5星传说更好吗？', fr: 'Le gear 6-star est-il toujours meilleur que le 5-star legendary ?' } satisfies LangMap,
  faq_sixVsFive_a1: {
    en: 'In general, all 6-star gear is better than 5-star legendary (red) gear. The only 5-star gear worth keeping are those from event shops with unique passives (you can view them by going to the equipment page and selecting 5 stars on weapons and accessories).',
    jp: '一般的に、すべての6★装備は5★レジェンダリー（赤）装備より優れています。保持する価値のある5★装備は、固有パッシブを持つイベントショップのものだけです（装備ページで5★の武器とアクセサリーを選択すると確認できます）。',
    kr: '일반적으로 모든 6성 장비는 5성 레전드 (빨간색) 장비보다 좋습니다. 보관할 가치가 있는 5성 장비는 고유 패시브가 있는 이벤트 상점 아이템뿐입니다 (장비 페이지에서 5성 무기와 액세서리를 선택하면 확인 가능).',
    zh: '一般来说，所有6星装备都比5星传说（红色）装备好。唯一值得保留的5星装备是活动商店中有独特被动的（你可以在装备页面选择5星武器和饰品查看）。',
    fr: 'En général, tout le gear 6-star est meilleur que le 5-star legendary (rouge). Les seuls 5-star à garder sont ceux des event shops avec des passives uniques (vous pouvez les voir en allant sur la page d\'équipement et en sélectionnant 5 étoiles sur les armes et accessoires).',
  } satisfies LangMap,
  faq_sixVsFive_a2: { en: '6-star blue armor is viable for end-game content and is easier to upgrade.', jp: '6★青防具はエンドゲームコンテンツでも使用可能で、強化も簡単です。', kr: '6성 파란색 방어구는 엔드게임 콘텐츠에서도 사용 가능하며 강화도 쉽습니다.', zh: '6星蓝色防具在终局内容中也可用，而且更容易强化。', fr: 'L\'armor 6-star bleu est viable pour le contenu end-game et est plus facile à upgrade.' } satisfies LangMap,
  faq_sixVsFive_a3: { en: 'Grey/Green 6-star armor should only be used temporarily until you get better blue or red gear.', jp: 'グレー/グリーンの6★防具は、より良い青や赤の装備を入手するまでの一時的な使用にとどめましょう。', kr: '회색/초록색 6성 방어구는 더 좋은 파란색이나 빨간색 장비를 얻을 때까지 임시로만 사용하세요.', zh: '灰色/绿色6星防具只应临时使用，直到获得更好的蓝色或红色装备。', fr: 'L\'armor 6-star Gris/Vert ne doit être utilisé que temporairement, le temps d\'obtenir mieux en bleu ou rouge.' } satisfies LangMap,

  faq_transistoneUsage_q: { en: 'When should I use Transistones?', jp: 'トランジストーンはいつ使うべき？', kr: '트랜지스톤은 언제 사용해야 하나요?', zh: '什么时候应该使用转换石？', fr: 'Quand utiliser les Transistones ?' } satisfies LangMap,
  faq_transistoneUsage_a: { en: 'Use Transistones primarily on Irregular gear, then red armor. Do not use them on any other non-red gear.', jp: 'トランジストーンは主にイレギュラー装備に使用し、次に赤防具に使用します。赤以外の装備には使用しないでください。', kr: '트랜지스톤은 주로 이레귤러 장비에 사용하고, 그 다음으로 빨간 방어구에 사용하세요. 빨간색이 아닌 장비에는 사용하지 마세요.', zh: '转换石主要用于异变装备，其次是红色防具。不要用在非红色装备上。', fr: 'Utilisez les Transistones principalement sur l\'Irregular gear, puis sur l\'armor rouge. Ne les utilisez pas sur d\'autres gears non-rouges.' } satisfies LangMap,

  faq_badMainStat_q: { en: 'What if I get a good weapon/accessory with a bad main stat?', jp: '良い武器/アクセサリーでメインステが悪い場合は？', kr: '좋은 무기/액세서리인데 메인 스탯이 안 좋으면?', zh: '好武器/饰品但主属性不好怎么办？', fr: 'Que faire si j\'obtiens une bonne arme/un bon accessoire avec une mauvaise main stat ?' } satisfies LangMap,
  faq_badMainStat_a: { en: 'Save it as transcend fodder. When you get a better version with the right main stat, you can use it to breakthrough that gear.', jp: '突破用の素材として保存しておきましょう。正しいメインステを持つより良いバージョンを入手したら、その装備の突破に使用できます。', kr: '돌파 재료로 보관하세요. 올바른 메인 스탯을 가진 더 좋은 버전을 얻으면 해당 장비의 돌파에 사용할 수 있습니다.', zh: '作为突破材料保存。当你获得主属性正确的更好版本时，可以用它来突破那件装备。', fr: 'Gardez-le comme fodder de transcend. Quand vous obtiendrez une meilleure version avec la bonne main stat, vous pourrez l\'utiliser pour breakthrough ce gear.' } satisfies LangMap,

  faq_badSubstats_q: { en: 'What to do with red armor that has bad sub-stats?', jp: 'サブステが悪い赤防具はどうする？', kr: '부옵이 안 좋은 빨간 방어구는 어떻게 하나요?', zh: '副属性不好的红色防具怎么办？', fr: 'Que faire d\'un armor rouge avec de mauvaises substats ?' } satisfies LangMap,

  faq_howToGet_q: { en: 'What are the main ways to get 6-star gear?', jp: '6★装備を入手する主な方法は？', kr: '6성 장비를 얻는 주요 방법은?', zh: '获取6星装备的主要方式是什么？', fr: 'Quels sont les principaux moyens d\'obtenir du gear 6-star ?' } satisfies LangMap,
  faq_howToGet_intro: { en: 'Here are your 4 main options:', jp: '主な4つの選択肢：', kr: '네 가지 주요 옵션:', zh: '四个主要选项：', fr: 'Voici vos 4 options principales :' } satisfies LangMap,

  faq_dropBoost_q: { en: 'How can I increase gear drop rates?', jp: '装備のドロップ率を上げるには？', kr: '장비 드롭률을 높이려면?', zh: '如何提高装备掉落率？', fr: 'Comment augmenter les drop rates de gear ?' } satisfies LangMap,
  faq_limitedShop_q: { en: 'Are limited-time shops worth it?', jp: '期間限定ショップは価値がある？', kr: '기간 한정 상점은 가치가 있나요?', zh: '限时商店值得吗？', fr: 'Les shops en temps limité valent-ils le coup ?' } satisfies LangMap,
  faq_eventChests_q: { en: 'What about gear selection chests from events?', jp: 'イベントの装備選択チェストについては？', kr: '이벤트 장비 선택 상자는?', zh: '活动装备选择宝箱呢？', fr: 'Et les coffres de sélection de gear des events ?' } satisfies LangMap,
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const TAB_KEYS: TabKey[] = ['basics', 'upgrading', 'ascension', 'obtaining', 'faq'];

export default function GearGuide() {
  const { lang } = useI18n();
  const [selected, setSelected] = useState<TabKey>('basics');
  const onChange = useCallback((v: string) => setSelected(v as TabKey), []);

  const tabLabels = [
    lRec(LABELS.tab_basics, lang),
    lRec(LABELS.tab_upgrading, lang),
    lRec(LABELS.tab_ascension, lang),
    lRec(LABELS.tab_obtaining, lang),
    lRec(LABELS.tab_faq, lang),
  ];

  const content: Record<TabKey, React.ReactNode> = {
    basics: <GearBasicsContent />,
    upgrading: <UpgradingGearContent />,
    ascension: <AscensionGearContent />,
    obtaining: <ObtainingGearContent />,
    faq: <FAQContent />,
  };

  return (
    <GuideTemplate title={lRec(LABELS.heading, lang)} introduction={lRec(LABELS.intro, lang)}>
      <div className="flex justify-center mb-6 mt-4">
        <Tabs items={TAB_KEYS} labels={tabLabels} value={selected} onChange={onChange} hashPrefix="tab" />
      </div>
      <section className="guide-version-content mt-6">{content[selected]}</section>
    </GuideTemplate>
  );
}

// ============================================================================
// GEAR BASICS CONTENT
// ============================================================================

function GearBasicsContent() {
  const { lang } = useI18n();

  const equipProps: Record<EquipmentPropertyKey, string> = {
    stars: lRec(LABELS.prop_stars, lang), reforge: lRec(LABELS.prop_reforge, lang), rarity: lRec(LABELS.prop_rarity, lang),
    upgrade: lRec(LABELS.prop_upgrade, lang), tier: lRec(LABELS.prop_tier, lang), set: lRec(LABELS.prop_set, lang), class: lRec(LABELS.prop_class, lang),
  };

  return (
    <div className="space-y-8">
      <h2>{lRec(LABELS.basics_overviewTitle, lang)}</h2>

      <div className="rounded-xl border border-slate-700 bg-linear-to-br from-slate-800/50 to-slate-900/30 p-6 space-y-4">
        <p>
          {lRec(LABELS.basics_overviewText, lang)}{' '}
          <strong className="text-red-400">{lRec(LABELS.basics_weapon, lang)}</strong>
          {lang === 'en' ? ', ' : '、'}
          <strong className="text-purple-400">{lRec(LABELS.basics_accessory, lang)}</strong>
          {lang === 'en' ? ', and ' : lang === 'zh' ? '、' : '、'}
          <strong className="text-blue-400">{lRec(LABELS.basics_armor, lang)}</strong>
          {lRec(LABELS.basics_gearTypesEnd, lang)}
        </p>
      </div>

      <h2>{lRec(LABELS.basics_propertiesTitle, lang)}</h2>
      <p className="mb-4">{lRec(LABELS.basics_propertiesText, lang)}</p>
      <EquipmentIntro labels={equipProps} />

      <h2>{lRec(LABELS.basics_substatsTitle, lang)}</h2>

      <div className="rounded-xl border border-slate-700 bg-linear-to-br from-slate-800/50 to-slate-900/30 p-6 space-y-4">
        <p>{lRec(LABELS.basics_substatsRule, lang)}</p>
        <div className="mt-4">
          <p className="mb-2">{lRec(LABELS.basics_substatsColorIntro, lang)}</p>
          <SubstatColorLegend labels={{ gray: lRec(LABELS.color_gray, lang), yellow: lRec(LABELS.color_yellow, lang), orange: lRec(LABELS.color_orange, lang) }} />
        </div>
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-900/20 p-4">
          <p className="font-semibold text-amber-300">{lRec(LABELS.basics_maxYellowTitle, lang)}</p>
          <p className="mt-2 text-sm">{lRec(LABELS.basics_maxYellowText, lang)}</p>
        </div>
        <div className="mt-6">
          <p className="mb-3">{lRec(LABELS.basics_perfectExample, lang)}</p>
          <PerfectSubstatsExample />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// UPGRADING GEAR CONTENT
// ============================================================================

function UpgradingGearContent() {
  const { lang } = useI18n();

  const methods = {
    enhance: { title: lRec(LABELS.method_enhance_title, lang), desc: lRec(LABELS.method_enhance_desc, lang) },
    reforge: { title: lRec(LABELS.method_reforge_title, lang), desc: lRec(LABELS.method_reforge_desc, lang) },
    breakthrough: { title: lRec(LABELS.method_breakthrough_title, lang), desc: lRec(LABELS.method_breakthrough_desc, lang) },
    changeStats: { title: lRec(LABELS.method_changeStats_title, lang), desc: lRec(LABELS.method_changeStats_desc, lang) },
  };

  const reforgeLimitText = lRec(LABELS.reforgeLimitText, lang);
  const parts1 = reforgeLimitText.split('1★');
  const parts6 = (parts1[1] ?? '').split('6★');

  return (
    <div className="space-y-8">
      <h2>{lRec(LABELS.upgrading_title, lang)}</h2>
      <p className="mb-6 text-neutral-300">{lRec(LABELS.upgrading_intro, lang)}</p>
      <UpgradeMethodsGrid labels={methods} />

      {/* Enhance Section */}
      <div className="rounded-xl border border-slate-700 bg-linear-to-br from-slate-800/50 to-slate-900/30 p-6 space-y-4">
        <SectionHeader number={1} title={methods.enhance.title} color="green" />
        <p>{lRec(LABELS.enhanceText, lang)}</p>
        <MaterialsList label={lRec(LABELS.materials, lang)} items={HAMMER_ITEMS} />
        <div className="space-y-2 rounded-lg border border-slate-600 bg-slate-900/50 p-4 text-sm">
          <p className="text-neutral-400"><strong className="text-neutral-200">{lRec(LABELS.tip, lang)}</strong> {lRec(LABELS.enhanceTip1, lang)}</p>
          <p className="text-neutral-400">{lRec(LABELS.enhanceTip2, lang)}</p>
          <p className="text-neutral-400">{lRec(LABELS.enhanceTip3, lang)}</p>
        </div>
        <div className="mt-6">
          <p className="mb-4 font-semibold">{lRec(LABELS.enhanceComparisonTitle, lang)}</p>
          <EnhancementComparisonGrid labels={{ normal: lRec(LABELS.enhanceLabel_normal, lang), epic: lRec(LABELS.enhanceLabel_epic, lang), legendary: lRec(LABELS.enhanceLabel_legendary, lang) }} />
        </div>
      </div>

      {/* Reforge Section */}
      <div className="rounded-xl border border-slate-700 bg-linear-to-br from-slate-800/50 to-slate-900/30 p-6 space-y-4">
        <SectionHeader number={2} title={methods.reforge.title} color="purple" />
        <p>{lRec(LABELS.reforgeText, lang)}</p>
        <MaterialsList label={lRec(LABELS.materials, lang)} items={CATALYST_ITEMS} />
        <div className="rounded-lg border border-slate-600 bg-slate-900/50 p-4 text-sm">
          <p className="text-neutral-400"><strong className="text-neutral-200">{lRec(LABELS.note, lang)}</strong> {lRec(LABELS.reforgeTip, lang)}</p>
        </div>
        <div className="mt-4">
          <p className="mb-3 font-semibold">{lRec(LABELS.reforgeHowTitle, lang)}</p>
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg bg-purple-900/20 p-3">
              <span className="font-bold text-purple-400">1</span>
              <p>{lRec(LABELS.reforgeStep1, lang)}</p>
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-purple-900/20 p-3">
              <span className="font-bold text-purple-400">2</span>
              <p>{lRec(LABELS.reforgeStep2, lang)}</p>
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-purple-500/30 bg-purple-900/20 p-4">
          <p className="font-semibold text-purple-300">{lRec(LABELS.reforgeLimitTitle, lang)}</p>
          <p className="mt-1 text-sm">
            {parts1[0]}<StarLevel levelLabel="1" size={14} />{parts6[0]}<StarLevel levelLabel="6" size={14} />{parts6[1]}
          </p>
        </div>
      </div>

      {/* Breakthrough Section */}
      <div className="rounded-xl border border-slate-700 bg-linear-to-br from-slate-800/50 to-slate-900/30 p-6 space-y-4">
        <SectionHeader number={3} title={methods.breakthrough.title} color="amber" />
        <p>{lRec(LABELS.breakthroughText, lang)}</p>
        <MaterialsList label={lRec(LABELS.materials, lang)} items={GLUNITE_ITEMS} />
        <div className="rounded-lg border border-slate-600 bg-slate-900/50 p-4 text-sm">
          <p className="text-neutral-400"><strong className="text-neutral-200">{lRec(LABELS.note, lang)}</strong> {lRec(LABELS.breakthroughTip, lang)}</p>
        </div>
        <div className="mt-6">
          <p className="mb-4 font-semibold">{lRec(LABELS.breakthroughExamplesTitle, lang)}</p>
          <BreakthroughExamplesGrid lang={lang} />
        </div>
      </div>

      {/* Change Stats Section */}
      <div className="rounded-xl border border-slate-700 bg-linear-to-br from-slate-800/50 to-slate-900/30 p-6 space-y-4">
        <SectionHeader number={4} title={methods.changeStats.title} color="cyan" />
        <p>{lRec(LABELS.changeStatsText, lang)}</p>
        <ChangeStatsModesGrid labels={{
          changeAll: { title: lRec(LABELS.changeAll_title, lang), desc: lRec(LABELS.changeAll_desc, lang) },
          selectChange: { title: lRec(LABELS.selectChange_title, lang), desc: lRec(LABELS.selectChange_desc, lang) },
        }} />
        <div className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-900/20 p-4">
          <p className="font-semibold text-yellow-300">{lRec(LABELS.changeStatsWarningTitle, lang)}</p>
          <p className="mt-1 text-sm">{lRec(LABELS.changeStatsWarningText, lang)}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SINGULARITY ASCENSION CONTENT (gear cap +10 → +15)
// ============================================================================

function AscensionGearContent() {
  const { lang } = useI18n();
  const [bonusMode, setBonusMode] = useState<BonusTableMode>('simple');

  const stepLabels = {
    from: lRec(LABELS.ascensionTable_from, lang),
    success: lRec(LABELS.ascensionTable_success, lang),
    gold: lRec(LABELS.ascensionTable_gold, lang),
    chip: lRec(LABELS.ascensionTable_chip, lang),
    hammer: lRec(LABELS.ascensionTable_hammer, lang),
    mainStat: lRec(LABELS.ascensionTable_mainStat, lang),
    bonus: lRec(LABELS.ascensionTable_bonus, lang),
  };

  const bonusLabels = {
    effect: lRec(LABELS.ascensionBonus_effect, lang),
    chance: lRec(LABELS.ascensionBonus_chance, lang),
    range: lRec(LABELS.ascensionBonus_range, lang),
  };

  const offensiveNames: Record<string, string> = {
    dmg: lRec(LABELS.bonus_dmg, lang),
    dmg_singular: lRec(LABELS.bonus_dmg_singular, lang),
    dmg_skill3_singular: lRec(LABELS.bonus_dmg_skill3_singular, lang),
    dmg_to_element: lRec(LABELS.bonus_dmg_to_element, lang),
  };

  const defensiveNames: Record<string, string> = {
    dmg_reduce: lRec(LABELS.bonus_dmg_reduce, lang),
    dmg_reduce_singular: lRec(LABELS.bonus_dmg_reduce_singular, lang),
    dmg_reduce_by_element: lRec(LABELS.bonus_dmg_reduce_by_element, lang),
  };

  return (
    <div className="space-y-8">
      <h2>{lRec(LABELS.ascension_title, lang)}</h2>
      <p className="text-neutral-300">{lRec(LABELS.ascension_intro, lang)}</p>

      {/* Prerequisites + warning */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-linear-to-br from-slate-800/50 to-slate-900/30 p-5">
          <h3 className="font-semibold text-emerald-300">{lRec(LABELS.ascension_prereqTitle, lang)}</h3>
          <p className="mt-2 text-sm text-neutral-300">{lRec(LABELS.ascension_prereqText, lang)}</p>
        </div>
        <div className="rounded-xl border border-amber-500/40 bg-amber-900/20 p-5">
          <h3 className="font-semibold text-amber-300">{lRec(LABELS.ascension_warningTitle, lang)}</h3>
          <p className="mt-2 text-sm text-neutral-200">{lRec(LABELS.ascension_warningText, lang)}</p>
        </div>
      </div>

      {/* Activation */}
      <div className="rounded-xl border border-slate-700 bg-linear-to-br from-slate-800/50 to-slate-900/30 p-6 space-y-4">
        <SectionHeader number={1} title={lRec(LABELS.ascension_activationTitle, lang)} color="emerald" />
        <p>{lRec(LABELS.ascension_activationDesc, lang)}</p>
        <ul className="space-y-1.5 text-sm text-neutral-200">
          <li className="flex items-center gap-2"><span className="text-emerald-400">●</span> {lRec(LABELS.ascension_benefit_cap, lang)}</li>
          <li className="flex items-center gap-2"><span className="text-emerald-400">●</span> {lRec(LABELS.ascension_benefit_reforge, lang)}</li>
          <li className="flex items-center gap-2"><span className="text-emerald-400">●</span> {lRec(LABELS.ascension_benefit_mainStat, lang)}</li>
        </ul>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-slate-600 bg-slate-900/50 p-4 text-sm">
          <span className="font-semibold text-amber-300">{ASCENSION_INIT.gold.toLocaleString('en')} <span className="text-xs font-normal text-neutral-400">Gold</span></span>
          <span className="flex items-center gap-1.5"><ItemInline name="High-Precision Chip" /> ×{ASCENSION_INIT.chip}</span>
          <span className="flex items-center gap-1.5"><ItemInline name="Artisan's Hammer" /> ×{ASCENSION_INIT.hammer}</span>
        </div>
      </div>

      {/* Steps */}
      <div className="rounded-xl border border-slate-700 bg-linear-to-br from-slate-800/50 to-slate-900/30 p-6 space-y-4">
        <SectionHeader number={2} title={lRec(LABELS.ascension_stepsTitle, lang)} color="amber" />
        <p>{lRec(LABELS.ascension_stepsDesc, lang)}</p>
        <AscensionStepsTable labels={stepLabels} />
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-900/20 p-4 text-sm">
          <p className="font-semibold text-emerald-300">{lRec(LABELS.ascension_failTitle, lang)}</p>
          <p className="mt-1 text-neutral-200">{lRec(LABELS.ascension_failText, lang)}</p>
        </div>
      </div>

      {/* Bonus effects */}
      <div className="rounded-xl border border-slate-700 bg-linear-to-br from-slate-800/50 to-slate-900/30 p-6 space-y-5">
        <SectionHeader number={3} title={lRec(LABELS.ascension_bonusTitle, lang)} color="purple" />
        <p>{lRec(LABELS.ascension_bonusDesc, lang)}</p>

        <div className="rounded-lg border border-cyan-500/40 bg-cyan-900/20 p-4 text-sm">
          <p className="font-semibold text-cyan-300">{lRec(LABELS.ascension_randomTitle, lang)}</p>
          <p className="mt-1 text-neutral-200">{lRec(LABELS.ascension_randomText, lang)}</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <GradeLegend label={lRec(LABELS.ascension_gradeLegend, lang)} />
          <div className="inline-flex rounded-lg border border-slate-600 bg-slate-900/60 p-0.5 text-sm">
            {(['simple', 'complete'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setBonusMode(m)}
                className={`rounded-md px-3 py-1 transition-colors ${bonusMode === m ? 'bg-purple-600 font-semibold text-white' : 'text-neutral-300 hover:text-white'}`}
              >
                {lRec(m === 'simple' ? LABELS.ascension_modeSimple : LABELS.ascension_modeComplete, lang)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 font-semibold text-red-300">{lRec(LABELS.ascension_offensiveTitle, lang)}</h3>
          <AscensionBonusEffectsTable
            effects={ASCENSION_BONUS_OFFENSIVE}
            effectNames={offensiveNames}
            labels={bonusLabels}
            mode={bonusMode}
          />
        </div>

        <div>
          <h3 className="mb-2 font-semibold text-blue-300">{lRec(LABELS.ascension_defensiveTitle, lang)}</h3>
          <AscensionBonusEffectsTable
            effects={ASCENSION_BONUS_DEFENSIVE}
            effectNames={defensiveNames}
            labels={bonusLabels}
            mode={bonusMode}
          />
          <p className="mt-2 text-xs text-neutral-400 italic">{lRec(LABELS.ascension_defensiveSplitNote, lang)}</p>
        </div>
      </div>

      {/* Reroll */}
      <div className="rounded-xl border border-slate-700 bg-linear-to-br from-slate-800/50 to-slate-900/30 p-6 space-y-4">
        <SectionHeader number={4} title={lRec(LABELS.ascension_rerollTitle, lang)} color="cyan" />
        <p>{lRec(LABELS.ascension_rerollDesc, lang)}</p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-slate-600 bg-slate-900/50 p-4 text-sm">
          <span className="font-semibold text-amber-300">{ASCENSION_REROLL.gold.toLocaleString('en')} <span className="text-xs font-normal text-neutral-400">Gold</span></span>
          <span className="flex items-center gap-1.5"><ItemInline name="Reload Cartridge" /> ×{ASCENSION_REROLL.cartridge}</span>
          <span className="rounded bg-emerald-900/40 px-2 py-0.5 text-xs text-emerald-300">100%</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// OBTAINING GEAR CONTENT
// ============================================================================

function ObtainingGearContent() {
  const { lang } = useI18n();

  const methodsContent = {
    farmBosses: {
      title: lRec(LABELS.obt_farmBosses_title, lang),
      content: <p>{lRec(LABELS.obt_farmBosses_desc, lang)}</p>,
    },
    craftArmor: {
      title: lRec(LABELS.obt_craftArmor_title, lang),
      content: (
        <>
          <p>
            {lRec(LABELS.obt_craftArmor_desc, lang).split('{ITEM}')[0]}
            <ItemInline name="Potentium (Armor)" />
            {lRec(LABELS.obt_craftArmor_desc, lang).split('{ITEM}')[1]}
          </p>
          <p className="mt-2 text-sm text-amber-300">{lRec(LABELS.obt_craftArmor_warning, lang)}</p>
        </>
      ),
    },
    preciseCraft: {
      title: lRec(LABELS.obt_preciseCraft_title, lang),
      content: (
        <p>
          {lRec(LABELS.obt_preciseCraft_desc, lang).split('{ITEM1}')[0]}
          <ItemInline name="Effectium" />
          {lRec(LABELS.obt_preciseCraft_desc, lang).split('{ITEM1}')[1]?.split('{ITEM2}')[0]}
          <ItemInline name="Transistone (Individual)" />
          {lRec(LABELS.obt_preciseCraft_desc, lang).split('{ITEM2}')[1]}
        </p>
      ),
    },
    irregularBosses: {
      title: lRec(LABELS.obt_irregularBosses_title, lang),
      content: <p>{lRec(LABELS.obt_irregularBosses_desc, lang)}</p>,
    },
  };

  return (
    <div className="space-y-8">
      <h2>{lRec(LABELS.obtaining_title, lang)}</h2>

      <div className="rounded-xl border border-slate-700 bg-linear-to-br from-slate-800/50 to-slate-900/30 p-6">
        <p className="mb-6">{lRec(LABELS.obtaining_intro, lang)}</p>
        <ObtainingMethodsList content={methodsContent} />
      </div>

      <h2>{lRec(LABELS.obtaining_dropRateTitle, lang)}</h2>
      <div className="rounded-xl border border-slate-700 bg-linear-to-br from-slate-800/50 to-slate-900/30 p-6">
        <p>
          {lRec(LABELS.obtaining_dropRateText_before, lang)}
          <InlineIcon icon={'/images/items/EBT_WORLD_BOSS_TITLE.webp'} label="Worldline Explorer" underline={false} />
          {lRec(LABELS.obtaining_dropRateText_after, lang)}
        </p>
      </div>

      <h2>{lRec(LABELS.obtaining_shopsTitle, lang)}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-linear-to-br from-slate-800/50 to-slate-900/30 p-6">
          <h3>{lRec(LABELS.obtaining_limitedShopsTitle, lang)}</h3>
          <p className="text-sm text-neutral-300">
            {lRec(LABELS.obtaining_limitedShopsText_before, lang)}
            <ItemInline name="Ether" />
            {lRec(LABELS.obtaining_limitedShopsText_after, lang)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-linear-to-br from-slate-800/50 to-slate-900/30 p-6">
          <h3>{lRec(LABELS.obtaining_eventChestsTitle, lang)}</h3>
          <p className="text-sm text-neutral-300">{lRec(LABELS.obtaining_eventChestsText, lang)}</p>
        </div>
      </div>

      <h2>{lRec(LABELS.obtaining_priorityTitle, lang)}</h2>
      <div className="rounded-xl border border-slate-700 bg-linear-to-br from-slate-800/50 to-slate-900/30 p-6">
        <p className="mb-4">{lRec(LABELS.obtaining_priorityIntro, lang)}</p>
        <GearPriorityList
          slots={{ weapons: lRec(LABELS.slot_weapons, lang), accessories: lRec(LABELS.slot_accessories, lang), gloves: lRec(LABELS.slot_gloves, lang), otherArmor: lRec(LABELS.slot_otherArmor, lang) }}
          descriptions={{ weapons: lRec(LABELS.slotDesc_weapons, lang), accessories: lRec(LABELS.slotDesc_accessories, lang), gloves: lRec(LABELS.slotDesc_gloves, lang), otherArmor: lRec(LABELS.slotDesc_otherArmor, lang) }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// FAQ CONTENT
// ============================================================================

function FAQContent() {
  const { lang } = useI18n();

  return (
    <div className="space-y-8">
      {/* Gear Quality */}
      <div className="space-y-4">
        <h2>{lRec(LABELS.faq_qualityTitle, lang)}</h2>
        <Accordion multiple items={[
          {
            key: 'legendaryOnly',
            title: lRec(LABELS.faq_legendaryOnly_q, lang),
            content: (
              <>
                <p><strong>{lRec(LABELS.faq_legendaryOnly_a1, lang)}</strong></p>
                <p className="mt-2">{lRec(LABELS.faq_legendaryOnly_a2, lang)}</p>
                <p className="mt-2">{lRec(LABELS.faq_legendaryOnly_a3, lang)}</p>
              </>
            ),
          },
          {
            key: 'sixVsFive',
            title: lRec(LABELS.faq_sixVsFive_q, lang),
            content: (
              <>
                <p>{lRec(LABELS.faq_sixVsFive_a1, lang)}</p>
                <p className="mt-2">{lRec(LABELS.faq_sixVsFive_a2, lang)}</p>
                <p className="mt-2">{lRec(LABELS.faq_sixVsFive_a3, lang)}</p>
              </>
            ),
          },
        ]} />
      </div>

      {/* Upgrading */}
      <div className="space-y-4">
        <h2>{lRec(LABELS.faq_upgradingTitle, lang)}</h2>
        <Accordion multiple items={[
          {
            key: 'transistoneUsage',
            title: lRec(LABELS.faq_transistoneUsage_q, lang),
            content: <p>{lRec(LABELS.faq_transistoneUsage_a, lang)}</p>,
          },
          {
            key: 'badMainStat',
            title: lRec(LABELS.faq_badMainStat_q, lang),
            content: <p>{lRec(LABELS.faq_badMainStat_a, lang)}</p>,
          },
          {
            key: 'badSubstats',
            title: lRec(LABELS.faq_badSubstats_q, lang),
            content: (
              <p>
                {lRec({
                  en: 'If you don\'t want to use ',
                  jp: '',
                  kr: '',
                  zh: '如果你不想用',
                  fr: 'Si vous ne voulez pas utiliser de ',
                }, lang)}
                <ItemInline name="Transistone (Total)" />
                {lRec({
                  en: ', keep it as transcend fodder. If you do have enough total Transistones, reroll until you get 3 good sub-stats, then use a ',
                  jp: 'を使いたくない場合は、突破用素材として保存。十分なトータル・トランジストーンがある場合は、3つの良いサブステが出るまで再抽選し、最後の1つを',
                  kr: '을 사용하고 싶지 않다면 돌파 재료로 보관하세요. 충분한 토탈 트랜지스톤이 있다면 3개의 좋은 부옵이 나올 때까지 재추첨하고, 마지막 하나는 ',
                  zh: '，就作为突破材料保存。如果你有足够的全体转换石，重随直到获得3条好的副属性，然后用',
                  fr: ', gardez-le comme fodder de transcend. Si vous avez assez de Transistones Total, rerollez jusqu\'à obtenir 3 bonnes substats, puis utilisez un ',
                }, lang)}
                <ItemInline name="Transistone (Individual)" />
                {lRec({
                  en: ' to fix the last one.',
                  jp: 'で修正しましょう。',
                  kr: '로 수정하세요.',
                  zh: '修正最后一条。',
                  fr: ' pour fixer la dernière.',
                }, lang)}
              </p>
            ),
          },
        ]} />
      </div>

      {/* Farming */}
      <div className="space-y-4">
        <h2>{lRec(LABELS.faq_farmingTitle, lang)}</h2>
        <Accordion multiple items={[
          {
            key: 'howToGet',
            title: lRec(LABELS.faq_howToGet_q, lang),
            content: (
              <>
                <p>{lRec(LABELS.faq_howToGet_intro, lang)}</p>
                <ol className="mt-2 ml-4 list-inside list-decimal space-y-2">
                  <li>{lRec(LABELS.obt_farmBosses_desc, lang)}</li>
                  <li>
                    {lRec(LABELS.obt_craftArmor_desc, lang).split('{ITEM}')[0]}
                    <ItemInline name="Potentium (Armor)" />
                    {lRec(LABELS.obt_craftArmor_desc, lang).split('{ITEM}')[1]}
                    {' '}{lRec(LABELS.obt_craftArmor_warning, lang)}
                  </li>
                  <li>
                    {lRec(LABELS.obt_preciseCraft_desc, lang).split('{ITEM1}')[0]}
                    <ItemInline name="Effectium" />
                    {lRec(LABELS.obt_preciseCraft_desc, lang).split('{ITEM1}')[1]?.split('{ITEM2}')[0]}
                    <ItemInline name="Transistone (Individual)" />
                    {lRec(LABELS.obt_preciseCraft_desc, lang).split('{ITEM2}')[1]}
                  </li>
                  <li>{lRec(LABELS.obt_irregularBosses_desc, lang)}</li>
                </ol>
              </>
            ),
          },
          {
            key: 'dropBoost',
            title: lRec(LABELS.faq_dropBoost_q, lang),
            content: (
              <p>
                {lRec(LABELS.obtaining_dropRateText_before, lang)}
                <InlineIcon icon={'/images/items/EBT_WORLD_BOSS_TITLE.webp'} label="Worldline Explorer" underline={false} />
                {lRec(LABELS.obtaining_dropRateText_after, lang)}
              </p>
            ),
          },
          {
            key: 'limitedShop',
            title: lRec(LABELS.faq_limitedShop_q, lang),
            content: (
              <p>
                {lRec(LABELS.obtaining_limitedShopsText_before, lang)}
                <ItemInline name="Ether" />
                {lRec(LABELS.obtaining_limitedShopsText_after, lang)}
              </p>
            ),
          },
          {
            key: 'eventChests',
            title: lRec(LABELS.faq_eventChests_q, lang),
            content: <p>{lRec(LABELS.obtaining_eventChestsText, lang)}</p>,
          },
        ]} />
      </div>
    </div>
  );
}
