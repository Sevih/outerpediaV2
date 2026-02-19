import type { TranslationKey } from './en';

const zh: Record<TranslationKey, string> = {
  // Navigation
  'nav.home': '主页',
  'nav.characters': '角色',
  'nav.equipment': '装备',
  'nav.guides': '攻略指南',
  'nav.utilities': '实用工具',
  'nav.tierlist': '节奏榜',

  // Links
  'link.officialwebsite': 'https://outerplane.vagames.kr/index_en.html',

  // Common
  'common.search': '搜索',
  'common.filter': '筛选',
  'common.all': '全部',
  'common.none': '无',
  'common.back': '返回',
  'common.loading': '加载中...',
  'common.coming_soon': '即将推出。',
  'common.updated': '{monthYear} 更新',

  // Contributors
  'contributors.title': '贡献者',
  'contributors.description':
    '感谢所有做出贡献的人们，你们帮助本站(Outerpedia)成为了异域战记社区的宝贵资源。',
  'contributors.favorite_character': '最喜欢的角色：',

  // Changelog
  'changelog.title': '更新日志',
  'changelog.description':
    '追踪Outerpedia全部更新改动——攻略、角色、工具等。',
  'changelog.view_full': '查看完整更新日志',

  // Page metadata
  'page.home.title': 'Outerpedia — 异域战记 Wiki & 数据库',
  'page.home.description':
    'Outerpedia是异域战记的社区驱动维基和数据库。查找角色配装、节奏榜、攻略指南、装备推荐等。',
  'page.characters.title': '异域战记 角色数据库',
  'page.characters.meta_title': '异域战记 角色数据库 – {monthYear}',
  'page.characters.description':
    '浏览异域战记全部角色。按属性、职业、稀有度筛选。查看配装、技能和队伍推荐。{monthYear}更新。',
  'page.equipments.title': '异域战记 装备数据库',
  'page.equipments.meta_title': '异域战记 装备数据库 – {monthYear}',
  'page.equipments.description':
    '探索异域战记全部装备。武器、护符、宝物、套装效果数据对比。{monthYear}更新。',
  'page.tierlist.title': '异域战记 节奏榜',
  'page.tierlist.meta_title': '异域战记 节奏榜 – {monthYear}',
  'page.tierlist.description':
    '异域战记节奏榜。按角色定位和内容类型排名。{monthYear}更新。',
  'page.tools.title': '异域战记 工具 & 实用程序',
  'page.tools.description':
    '异域战记工具：装备求解器、队伍规划器、抽卡模拟器、进度追踪器等。',
  'page.guides.title': '异域战记 攻略指南',
  'page.guides.description':
    '异域战记攻略指南。冒险关卡、Boss战、公会突袭、世界Boss、新手攻略。',
  'page.contributors.title': '项目贡献者',
  'page.legal.title': '法律声明 & 免责条款',
  'page.legal.description':
    'Outerpedia法律声明、免责条款及内容使用政策 — 非官方异域战记粉丝项目。',
  'page.promo_codes.title': '异域战记 有效兑换码',
  'page.promo_codes.description':
    '异域战记全部有效兑换码。在游戏中兑换免费奖励：以太、招募券等。',
  'promo_codes.expired': '已过期兑换码',
  'promo_codes.active': '有效',
  'promo_codes.upcoming': '即将开放',
  'promo_codes.validity': '{start} — {end}',
  'promo_codes.redeem_android': 'Android: 菜单 → 设置 → 兑换码',
  'promo_codes.redeem_ios': 'iOS: <a href="https://coupon.outerplane.vagames.co.kr:39009/coupon" target="_blank" rel="noopener noreferrer" class="underline text-cyan-400">在官网兑换</a>',

  // Homepage sections
  'home.cta.characters': '查看角色',
  'home.section.banners': '当前限定角色',
  'home.section.codes': '有效兑换码',
  'home.section.beginner': '异域战记新手？',
  'home.beginner.desc': '通过这些新手指南开始你的冒险：',
  'home.beginner.faq': '新手FAQ',
  'home.beginner.faq.desc': '新玩家常见问题解答。',
  'home.beginner.freeheroes': '免费角色 & 新手卡池',
  'home.beginner.freeheroes.desc': '该抽谁，如何高效开局。',
  'home.beginner.stats': '属性 & 战斗基础',
  'home.beginner.stats.desc': '理解属性和战斗机制。',
  'home.beginner.gear': '装备',
  'home.beginner.gear.desc': '装备系统和强化方法。',
  'home.beginner.growth': '角色养成',
  'home.beginner.growth.desc': '升级、超越、好感度等。',
  'home.beginner.footer': '适合新手玩家',
  'home.section.updates': '最近更新',
  'home.codes.copy': '复制',
  'home.codes.copied': '已复制！',
  'home.codes.empty': '当前没有有效兑换码。',
  'home.codes.view_all': '查看全部{count}个有效兑换码',
  'home.discord.title': '加入我们的Discord',
  'home.discord.description':
    '与社区一起分享队伍搭配、提问或进行理论研究。',
  'home.discord.join': '加入',
  'home.discord.members': '{count} 位成员',
  'home.discord.online': '{count} 人在线',
  'home.banner.ends_in': '剩余',
  'home.banner.ended': '已结束',
  'home.resets.title': '服务器重置',
  'home.resets.daily': '每日',
  'home.resets.weekly': '每周',
  'home.resets.monthly': '每月',

  // Search
  'search.placeholder': '搜索角色、页面...',
  'search.no_results': '未找到结果',
  'search.pages': '页面',
  'search.characters': '角色',

  // Navigation (short labels for md-xl breakpoint)
  'nav.characters.short': '角色',
  'nav.equipment.short': '装备',
  'nav.tierlist.short': '榜单',
  'nav.utilities.short': '工具',
  'nav.guides.short': '攻略',

  // Footer
  'footer.tagline': '异域战记粉丝制作数据库。',
  'footer.legal_notice': '法律声明',
  'footer.official_website': '官方网站',
  'footer.social.github': 'GitHub',
  'footer.social.evamains_discord': 'EvaMains Discord',
  'footer.social.official_discord': '官方Discord',
  'footer.social.reddit': 'Reddit',
  'footer.social.youtube': 'YouTube',
  'footer.social.official_x': '官方 X (Twitter)',
  'footer.social.publisher_x': '发行商 X (Twitter)',
  'footer.disclaimer':
    'Outerpedia是非官方粉丝制作项目。与异域战记相关的所有内容（包括角色、图片及其他游戏资产）均为VAGAMES CORP所有。本网站与VAGAMES CORP无任何关联、认可或赞助关系。',

  // Legal page content
  'legal.heading': '法律声明 & 免责条款 | Outerpedia',
  'legal.p1': '本声明为Outerpedia（一个专注于游戏Outerplane的非官方粉丝项目）的法律免责声明。本站使用的所有名称、图像和其他资产均为VAGAMES CORP或其各自所有者的财产。本站与VAGAMES CORP无任何关联、认可或赞助关系。',
  'legal.p2': '本网站仅为非商业、教育和信息目的而创建。不使用任何广告、捐赠、跟踪工具或盈利机制。',
  'legal.p3': 'Outerpedia不托管或重新分发游戏文件。所有视觉资产仅用于评论和文档目的展示。不提供内容下载或再利用。',
  'legal.p4': '如果您是本站展示内容的合法所有者并希望将其删除，请直接联系我们或我们的托管服务商。我们将及时回应任何删除请求。',
  'legal.hosting': '托管服务商',
  'legal.p5': '本站由个人维护。根据法国法律(LCEN)，在通过我们的托管服务商收到法律请求时，可向司法机关披露身份信息。',

  // Errors
  'error.404': '页面未找到',
  'error.500': '出现错误',
  'error.back_home': '返回首页',
  'error.try_again': '重试',

  // Elements
  'sys.element.fire': '火',
  'sys.element.water': '水',
  'sys.element.earth': '土',
  'sys.element.light': '光',
  'sys.element.dark': '暗',

  // Classes
  'sys.class.defender': '防御型',
  'sys.class.striker': '攻击型',
  'sys.class.ranger': '速度型',
  'sys.class.mage': '魔法型',
  'sys.class.healer': '恢复型',

  // Class passives (AP generation & bonus)
  'sys.class.passive.striker': '回合开始时，恢复5AP。攻击时，恢复20AP。暴击率提升5%。',
  'sys.class.passive.defender': '回合开始时，恢复5AP。受到攻击时，恢复35AP。防御力提升15%。',
  'sys.class.passive.ranger': '回合开始时恢复20AP。',
  'sys.class.passive.healer': '回合开始时，恢复5AP。 友军受到攻击时，获得25AP。生命值提升10%。',
  'sys.class.passive.mage': '回合开始时，恢复5AP。使用技能时，分别获得AP。攻击力提升10%。',

  // Subclasses
  'sys.subclass.attacker': '战士',
  'sys.subclass.bruiser': '决斗家',
  'sys.subclass.wizard': '巫师',
  'sys.subclass.enchanter': '控场者',
  'sys.subclass.vanguard': '先锋',
  'sys.subclass.tactician': '战术家',
  'sys.subclass.sweeper': '清道夫',
  'sys.subclass.phalanx': '盾卫',
  'sys.subclass.reliever': '救援者',
  'sys.subclass.sage': '贤者',

  // Subclass descriptions
  'sys.subclass.info.attacker': '拥有强大攻击力，能够迅速粉碎敌人。',
  'sys.subclass.info.bruiser': '攻防实力兼具，擅长持久战。',
  'sys.subclass.info.wizard': '以强力技能横扫战场。',
  'sys.subclass.info.enchanter': '利用多种附加效果，伺机攻击敌人弱点。',
  'sys.subclass.info.vanguard': '快速接近，并瞬间制服敌人。',
  'sys.subclass.info.tactician': '赋予友军有利效果，使战斗优于我方。',
  'sys.subclass.info.sweeper': '沉着应对攻击，并窥视进攻机会。',
  'sys.subclass.info.phalanx': '身为防护专家，善于保护友军。',
  'sys.subclass.info.reliever': '能够在危急时刻恢复友军。',
  'sys.subclass.info.sage': '赋予多种效果，阻断敌人妨碍。',

  // Stats
  'sys.stat.atk': '攻击力',
  'sys.stat.def': '防御力',
  'sys.stat.hp': '生命值',
  'sys.stat.atk_percent': '攻击力(%)',
  'sys.stat.def_percent': '防御力(%)',
  'sys.stat.hp_percent': '生命值(%)',
  'sys.stat.eff': '效果命中',
  'sys.stat.res': '效果抵抗',
  'sys.stat.spd': '速度',
  'sys.stat.chc': '暴击率',
  'sys.stat.chd': '暴击伤害',
  'sys.stat.pen': '穿透力',
  'sys.stat.pen_percent': '穿透力(%)',
  'sys.stat.ls': '吸血',
  'sys.stat.dmg_percentup': '造成伤害提升 %',
  'sys.stat.dmg_up': '造成伤害提升',
  'sys.stat.dmg_red': '受伤害降低',
  'sys.stat.cdmg_red': '受暴击伤害降低',
  'sys.stat.dmg_percentred': '受伤害降低 %',
  'sys.stat.cdmg_percentred': '受暴击伤害降低 %',

  // Filters
  'filters.rarity': '星级',
  'filters.elements': '属性',
  'filters.classes': '战斗类型',
  'filters.roles.dps': '输出',
  'filters.roles.support': '辅助',
  'filters.roles.sustain': '奶/坦',

  // Characters filters
  'characters.filters.chains': '连携技能类型',
  'characters.filters.roles': '角色定位',
  'characters.filters.gifts': '礼物类型',
  'characters.filters.showBuffs': '显示BUFF/DEBUFF筛选',
  'characters.filters.hideBuffs': '隐藏BUFF/DEBUFF筛选',
  'characters.filters.showTags': '显示标签',
  'characters.filters.hideTags': '隐藏标签',
  'characters.filters.reset': '清空筛选',
  'characters.filters.copy': '复制分享链接',
  'characters.filters.copied': '已复制！',
  'characters.filters.unique': '显示角色独有效果',
  'characters.filters.and': 'AND',
  'characters.filters.or': 'OR',
  'characters.filters.buffs': '增益BUFF',
  'characters.filters.debuffs': '减益DEBUFF',
  'characters.filters.sources.filterBySource': '选择技能：',
  'characters.filters.sources.skill1': '基本技能',
  'characters.filters.sources.skill2': '特殊技能',
  'characters.filters.sources.skill3': '必杀技',
  'characters.filters.sources.chainPassive': '连携被动',
  'characters.filters.sources.dualAttack': '夹攻',
  'characters.filters.sources.exclusiveEquip': '专属装备',

  // Characters common
  'characters.loading': '角色加载中……',
  'characters.common.matches': '{count, plural, one {# 个匹配} other {# 个匹配}}',

  // Characters chains
  'characters.chains.starter': '起始',
  'characters.chains.companion': '自由顺序',
  'characters.chains.finisher': '收尾',

  // Characters gifts
  'characters.gifts.science': '科学',
  'characters.gifts.luxury': '奢侈品',
  'characters.gifts.magicTool': '魔法道具',
  'characters.gifts.craftwork': '工艺品',
  'characters.gifts.naturalObject': '自然物件',

  // Characters effects groups
  'characters.effectsGroups.buff.statBoosts': '能力值强化',
  'characters.effectsGroups.buff.supporting': '支援效果',
  'characters.effectsGroups.buff.utility': '其他效果',
  'characters.effectsGroups.buff.unique': '独有效果',
  'characters.effectsGroups.buff.hidden': '隐藏效果',
  'characters.effectsGroups.debuff.statReduction': '能力值弱化',
  'characters.effectsGroups.debuff.cc': '控制效果（控）',
  'characters.effectsGroups.debuff.dot': '持续伤害（DOT）',
  'characters.effectsGroups.debuff.utility': '其他效果',
  'characters.effectsGroups.debuff.unique': '独有效果',
  'characters.effectsGroups.debuff.hidden': '隐藏效果',

  // Characters tags
  'characters.tags.types.mechanic': '机制',
  'characters.tags.types.unit-type': '获得方式',

  // Character detail page
  'page.character.meta_title': '{name} — 技能、配装 & 节奏榜',
  'page.character.meta_description': '{name}（{element} {classType}）— 技能详解、专属装备、推荐配装、节奏榜排名。',
  'page.character.toc.overview': '概览',
  'page.character.toc.ee': '专属装备',
  'page.character.toc.ranking': '评级',
  'page.character.toc.transcend': '超越',
  'page.character.toc.skills': '技能',
  'page.character.toc.chain_dual': '连携 & 夹攻',
  'page.character.toc.stats_ranking': '属性 & 排名',
  'page.character.toc.burst': '爆发',
  'page.character.toc.gear': '推荐装备',
  'page.character.toc.video': '视频',
  'page.character.toc.pros_cons': '优缺点',
  'page.character.toc.synergies': '协同',
  'page.character.pros': '优点',
  'page.character.cons': '缺点',
  'page.character.skill.cooldown': 'CD',
  'page.character.skill.wgr': 'WG',
  'page.character.skill.target_mono': '单体',
  'page.character.skill.target_multi': '全体',
  'page.character.skill.target_duo': '双体',
  'page.character.skill.target_mono_ally': '我方单体',
  'page.character.skill.target_multi_ally': '我方全体',
  'page.character.skill.target_duo_ally': '我方双体',
  'page.character.skill.enhancement': '强化',
  'page.character.skill.burn_cards': '爆发技能',
  'page.character.skill.burn_cost': '消耗',
  'page.character.skill.level': 'Lv.',
  'page.character.skill.type.s1': '技能1',
  'page.character.skill.type.s2': '技能2',
  'page.character.skill.type.ultimate': '必杀技',
  'page.character.skill.type.passive': '被动',
  'page.character.skill.type.chain': '连锁',
  'page.character.ee.effect': '效果',
  'page.character.ee.effect_max': '效果（Lv.10）',
  'page.character.ee.main_stat': '主属性',
  'page.character.ee.rank': '专属装备评级',
  'page.character.ee.title': '专属装备',
  'page.character.ee.badge': '{name}的专属装备',
  'page.character.transcend.title': '超越',
  'page.character.tier.pve': 'PvE评级',
  'page.character.tier.pvp': 'PvP评级',
  'page.character.gear.title': '推荐装备',
  'page.character.gear.substat_prio': '副属性优先级',
  'page.character.gear.note': '备注',
  'page.character.gear.weapon': '武器',
  'page.character.gear.amulet': '护符',
  'page.character.gear.set': '套装',
  'page.character.gear.talisman': '宝物',
  'page.character.voice_actor': '配音',
  'page.character.birthday': '生日',
  'page.character.height': '身高',
  'page.character.weight': '体重',
  'page.character.story': '故事',
  'page.character.chain_effect': '连携效果',
  'page.character.dual_effect': '夹攻效果',
  'page.character.stats.title': '基础属性',
  'page.character.stats.class_passive': '职业被动',
  'page.character.no_reco': '暂无推荐装备。',
};

export default zh;
