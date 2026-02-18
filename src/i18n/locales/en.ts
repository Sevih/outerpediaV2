// Source of truth — exports TranslationKey type

const en = {
  // Navigation
  'nav.home': 'Home',
  'nav.characters': 'Characters',
  'nav.equipment': 'Equipments',
  'nav.guides': 'Guides',
  'nav.utilities': 'Utilities',
  'nav.tierlist': 'Tier List',

  // Links
  'link.officialwebsite': 'https://outerplane.vagames.kr/index_en.html',

  // Common
  'common.search': 'Search',
  'common.filter': 'Filter',
  'common.all': 'All',
  'common.none': 'None',
  'common.back': 'Back',
  'common.loading': 'Loading...',
  'common.coming_soon': 'Coming soon.',
  'common.updated': 'Updated {monthYear}',

  // Contributors
  'contributors.title': 'Outerpedia Contributors',
  'contributors.description':
    'Thank you to everyone who has contributed to making Outerpedia a valuable resource for the Outerplane community.',
  'contributors.favorite_character': 'Favorite Character:',

  // Changelog
  'changelog.title': 'Changelog',
  'changelog.description':
    'Track all updates made to Outerpedia: guides, characters, tools, and more.',
  'changelog.view_full': 'View full changelog',

  // Page metadata
  'page.home.title': 'Outerpedia — Outerplane Wiki & Database',
  'page.home.description':
    'Outerpedia is a community-driven wiki and database for Outerplane. Find character builds, tier lists, guides, equipment recommendations, and more.',
  'page.characters.title': 'Outerplane Characters Database',
  'page.characters.meta_title': 'Outerplane Characters Database – {monthYear}',
  'page.characters.description':
    'Browse all Outerplane characters. Filter by element, class, and rarity. Find builds, skills, and team recommendations. Updated {monthYear}.',
  'page.equipments.title': 'Outerplane Equipment Database',
  'page.equipments.meta_title': 'Outerplane Equipment Database – {monthYear}',
  'page.equipments.description':
    'Explore all Outerplane weapons, amulets, talismans, and armor sets. Compare stats and find the best gear for your characters. Updated {monthYear}.',
  'page.tierlist.title': 'Outerplane Tier List',
  'page.tierlist.meta_title': 'Outerplane Tier List – {monthYear}',
  'page.tierlist.description':
    'Outerplane tier list ranking all characters by role and content type. Updated {monthYear}.',
  'page.tools.title': 'Outerplane Tools & Utilities',
  'page.tools.description':
    'Outerplane tools: gear solver, team planner, pull simulator, progress tracker, and more.',
  'page.guides.title': 'Outerplane Guides',
  'page.guides.description':
    'Outerplane guides for adventure stages, boss fights, guild raids, world bosses, and beginner tips.',
  'page.contributors.title': 'Project Contributors',
  'page.legal.title': 'Legal Notice & Disclaimer',
  'page.legal.description':
    'Legal notice, disclaimer, and content usage policy for Outerpedia — an unofficial Outerplane fan project.',
  'page.promo_codes.title': 'Outerplane Active Promo Codes',
  'page.promo_codes.description':
    'All active Outerplane promo codes. Redeem them in-game for free rewards: ether, recruitment tickets, and more.',
  'promo_codes.expired': 'Expired Codes',
  'promo_codes.active': 'Active',
  'promo_codes.upcoming': 'Upcoming',
  'promo_codes.validity': '{start} — {end}',
  'promo_codes.redeem_android': 'Android: Menu → Settings → Coupon',
  'promo_codes.redeem_ios': 'iOS: <a href="https://coupon.outerplane.vagames.co.kr:39009/coupon" target="_blank" rel="noopener noreferrer" class="underline text-cyan-400">Redeem on the official website</a>',

  // Homepage sections
  'home.cta.characters': 'Browse Characters',
  'home.section.banners': 'Currently Pullable',
  'home.section.codes': 'Active Promo Codes',
  'home.section.beginner': 'New to Outerplane?',
  'home.beginner.desc': 'Start your journey with these beginner-friendly guides:',
  'home.beginner.faq': 'Beginner FAQ',
  'home.beginner.faq.desc': 'common questions and answers for new players.',
  'home.beginner.freeheroes': 'Free Heroes & Starter Banners',
  'home.beginner.freeheroes.desc': 'who to pull and how to start efficiently.',
  'home.beginner.stats': 'Statistics & Combat Basics',
  'home.beginner.stats.desc': 'understand stats and how combat works.',
  'home.beginner.gear': 'Gear',
  'home.beginner.gear.desc': 'how equipment works and how to upgrade it.',
  'home.beginner.growth': 'Hero Growth',
  'home.beginner.growth.desc': 'leveling, transcendence, affinity, and more.',
  'home.beginner.footer': 'Perfect for first-time players',
  'home.section.updates': 'Recent Updates',
  'home.codes.copy': 'Copy',
  'home.codes.copied': 'Copied!',
  'home.codes.empty': 'No active codes right now.',
  'home.codes.view_all': 'View all {count} active codes',
  'home.discord.title': 'Join our Discord',
  'home.discord.description':
    'Share team comps, ask questions, or theorycraft together with the community.',
  'home.discord.join': 'Join',
  'home.discord.members': '{count} members',
  'home.discord.online': '{count} online',
  'home.banner.ends_in': 'Ends in',
  'home.banner.ended': 'Ended',

  // Search
  'search.placeholder': 'Search characters, pages...',
  'search.no_results': 'No results found',
  'search.pages': 'Pages',
  'search.characters': 'Characters',

  // Navigation (short labels for md-xl breakpoint)
  'nav.characters.short': 'Chars',
  'nav.equipment.short': 'Equip',
  'nav.tierlist.short': 'Tier',
  'nav.utilities.short': 'Tools',
  'nav.guides.short': 'Guides',

  // Footer
  'footer.tagline': 'Fanmade Database for Outerplane.',
  'footer.legal_notice': 'Legal Notice',
  'footer.official_website': 'Official Website',
  'footer.social.github': 'GitHub',
  'footer.social.evamains_discord': 'EvaMains Discord',
  'footer.social.official_discord': 'Official Discord',
  'footer.social.reddit': 'Reddit',
  'footer.social.youtube': 'YouTube',
  'footer.social.official_x': 'Official X (Twitter)',
  'footer.social.publisher_x': 'Publisher X (Twitter)',
  'footer.disclaimer':
    'Outerpedia is an unofficial fan-made project. All content related to Outerplane, including characters, images, and other game assets, is the property of VAGAMES CORP. This website is not affiliated with, endorsed by, or sponsored by VAGAMES CORP in any way.',

  // Legal page content
  'legal.heading': 'Legal Notice & Disclaimer | Outerpedia',
  'legal.p1': 'This notice serves as a legal disclaimer for Outerpedia, an unofficial, fan-made project dedicated to the game Outerplane. All names, images, and other assets used on this site are the property of VAGAMES CORP or their respective owners. This site is not affiliated with, endorsed by, or sponsored by VAGAMES CORP.',
  'legal.p2': 'This website was created strictly for non-commercial, educational, and informational purposes. No advertisements, donations, tracking tools, or monetization mechanisms are used.',
  'legal.p3': 'Outerpedia does not host or redistribute game files. All visual assets are displayed for commentary and documentation purposes only. No content is made available for download or reuse.',
  'legal.p4': 'If you are the rightful owner of any content featured on this site and would like it removed, you may contact us or our hosting provider directly. We will respond to any takedown request promptly.',
  'legal.hosting': 'Hosting Provider',
  'legal.p5': 'This site is maintained by a private individual. In accordance with French law (LCEN), identification information may be disclosed to judicial authorities upon legal request via our hosting provider.',

  // Errors
  'error.404': 'Page not found',
  'error.500': 'Something went wrong',
  'error.back_home': 'Back to home',
  'error.try_again': 'Try again',

  // Elements
  'sys.element.fire': 'Fire',
  'sys.element.water': 'Water',
  'sys.element.earth': 'Earth',
  'sys.element.light': 'Light',
  'sys.element.dark': 'Dark',

  // Classes
  'sys.class.defender': 'Defender',
  'sys.class.striker': 'Striker',
  'sys.class.ranger': 'Ranger',
  'sys.class.mage': 'Mage',
  'sys.class.healer': 'Healer',

  // Class passives (AP generation & bonus)
  'sys.class.passive.striker': 'Generates 5 Action Points at the start of turn. Generates 20 Action Points when attacking. Increases Critical Hit Chance by 5%.',
  'sys.class.passive.defender': 'Generates 5 Action Points at the start of turn. Generates 35 Action Points when hit. Increases Defense by 15%.',
  'sys.class.passive.ranger': 'Generates 20 Action Points at the start of turn.',
  'sys.class.passive.healer': 'Generates 5 Action Points at the start of turn. Generates 25 Action Points when an ally is hit. Increases Health by 10%.',
  'sys.class.passive.mage': 'Generates 5 Action Points at the start of turn. Generates Action Points when using skills. Increases Attack by 10%.',

  // Subclasses
  'sys.subclass.attacker': 'Attacker',
  'sys.subclass.bruiser': 'Bruiser',
  'sys.subclass.wizard': 'Wizard',
  'sys.subclass.enchanter': 'Enchanter',
  'sys.subclass.vanguard': 'Vanguard',
  'sys.subclass.tactician': 'Tactician',
  'sys.subclass.sweeper': 'Sweeper',
  'sys.subclass.phalanx': 'Phalanx',
  'sys.subclass.reliever': 'Reliever',
  'sys.subclass.sage': 'Sage',

  // Subclass descriptions
  'sys.subclass.info.attacker': 'A brave warrior who crushes enemies with high Attack.',
  'sys.subclass.info.bruiser': 'A brawler who specializes in prolonged battles with balanced offensive and defensive skills.',
  'sys.subclass.info.wizard': 'A master of magic who wreaks havoc on the battlefield with powerful spells.',
  'sys.subclass.info.enchanter': 'A mastermind in battles who weakens enemies with a variety of additional effects.',
  'sys.subclass.info.vanguard': 'A leader who dominates the enemy with high Speed.',
  'sys.subclass.info.tactician': 'A master strategist who gets the upper hand in battles by granting buffs to allies.',
  'sys.subclass.info.sweeper': 'A combat specialist who waits patiently for an opening.',
  'sys.subclass.info.phalanx': 'A defensive specialist who stands their ground to protect their allies.',
  'sys.subclass.info.reliever': 'A savior who heals allies in moments of peril.',
  'sys.subclass.info.sage': 'A support specialist who thwarts the enemy\'s attempts to hamper their allies by granting them various effects.',

  // Stats
  'sys.stat.atk': 'Attack',
  'sys.stat.def': 'Defense',
  'sys.stat.hp': 'Health',
  'sys.stat.atk_percent': 'Attack %',
  'sys.stat.def_percent': 'Defense %',
  'sys.stat.hp_percent': 'Health %',
  'sys.stat.eff': 'Effectiveness',
  'sys.stat.res': 'Resilience',
  'sys.stat.spd': 'Speed',
  'sys.stat.chc': 'Crit Chance',
  'sys.stat.chd': 'Crit Damage',
  'sys.stat.pen': 'Penetration',
  'sys.stat.pen_percent': 'Penetration %',
  'sys.stat.ls': 'Lifesteal',
  'sys.stat.dmg_percentup': 'Damage Increase %',
  'sys.stat.dmg_up': 'Damage Increase',
  'sys.stat.dmg_red': 'Damage Reduction',
  'sys.stat.cdmg_red': 'Crit Damage Reduction',
  'sys.stat.dmg_percentred': 'Damage Reduction %',
  'sys.stat.cdmg_percentred': 'Crit Damage Reduction %',

  // Filters
  'filters.rarity': 'Rarity',
  'filters.elements': 'Elements',
  'filters.classes': 'Classes',
  'filters.roles.dps': 'DPS',
  'filters.roles.support': 'Support',
  'filters.roles.sustain': 'Sustain',

  // Characters filters
  'characters.filters.chains': 'Chains',
  'characters.filters.roles': 'Roles',
  'characters.filters.gifts': 'Gifts',
  'characters.filters.showBuffs': 'Show Buffs/Debuffs Filters',
  'characters.filters.hideBuffs': 'Hide Buffs/Debuffs Filters',
  'characters.filters.showTags': 'Show Tags',
  'characters.filters.hideTags': 'Hide Tags',
  'characters.filters.reset': 'Reset filters',
  'characters.filters.copy': 'Copy share link',
  'characters.filters.copied': 'Copied!',
  'characters.filters.unique': 'Show Unique Effects',
  'characters.filters.and': 'AND',
  'characters.filters.or': 'OR',
  'characters.filters.buffs': 'Buffs',
  'characters.filters.debuffs': 'Debuffs',
  'characters.filters.sources.filterBySource': 'Filter by Source',
  'characters.filters.sources.skill1': 'Skill 1',
  'characters.filters.sources.skill2': 'Skill 2',
  'characters.filters.sources.skill3': 'Skill 3',
  'characters.filters.sources.chainPassive': 'Chain Passive',
  'characters.filters.sources.dualAttack': 'Dual Attack',
  'characters.filters.sources.exclusiveEquip': 'Exclusive Equipment',

  // Characters common
  'characters.loading': 'Loading characters...',
  'characters.common.matches': '{count, plural, one {# match} other {# matches}}',

  // Characters chains
  'characters.chains.starter': 'Starter',
  'characters.chains.companion': 'Companion',
  'characters.chains.finisher': 'Finisher',

  // Characters gifts
  'characters.gifts.science': 'Science',
  'characters.gifts.luxury': 'Luxury',
  'characters.gifts.magicTool': 'Magic Tool',
  'characters.gifts.craftwork': 'Craftwork',
  'characters.gifts.naturalObject': 'Natural Object',

  // Characters effects groups
  'characters.effectsGroups.buff.statBoosts': 'Stat Boosts',
  'characters.effectsGroups.buff.supporting': 'Supporting',
  'characters.effectsGroups.buff.utility': 'Utility',
  'characters.effectsGroups.buff.unique': 'Unique',
  'characters.effectsGroups.buff.hidden': 'Hidden',
  'characters.effectsGroups.debuff.statReduction': 'Stat Reduction',
  'characters.effectsGroups.debuff.cc': 'Control Effects (CC)',
  'characters.effectsGroups.debuff.dot': 'Damage Over Time (DoT)',
  'characters.effectsGroups.debuff.utility': 'Utility Debuffs',
  'characters.effectsGroups.debuff.unique': 'Unique',
  'characters.effectsGroups.debuff.hidden': 'Hidden',

  // Characters tags
  'characters.tags.types.mechanic': 'Mechanic',
  'characters.tags.types.unit-type': 'Unit Type',

  // Character detail page
  'page.character.meta_title': '{name} — Skills, Builds & Tier',
  'page.character.meta_description': '{name} ({element} {classType}) — skills breakdown, exclusive equipment, recommended gear builds, and tier ranking on Outerpedia.',
  'page.character.toc.overview': 'Overview',
  'page.character.toc.ee': 'Exclusive Equipment',
  'page.character.toc.ranking': 'Ranking',
  'page.character.toc.transcend': 'Transcendence',
  'page.character.toc.skills': 'Skills',
  'page.character.toc.chain_dual': 'Chain & Dual',
  'page.character.toc.stats_ranking': 'Stats & Ranking',
  'page.character.toc.burst': 'Burst',
  'page.character.toc.gear': 'Recommended Gear',
  'page.character.toc.video': 'Video',
  'page.character.skill.cooldown': 'CD',
  'page.character.skill.wgr': 'WGR',
  'page.character.skill.target_mono': 'Single Target',
  'page.character.skill.target_multi': 'All Enemies',
  'page.character.skill.enhancement': 'Enhancement',
  'page.character.skill.burn_cards': 'Burn Cards',
  'page.character.skill.burn_cost': 'Cost',
  'page.character.skill.level': 'Lv.',
  'page.character.ee.effect': 'Effect',
  'page.character.ee.effect_max': 'Effect (Lv.10)',
  'page.character.ee.main_stat': 'Main Stat',
  'page.character.ee.rank': 'EE Rank',
  'page.character.ee.title': 'Exclusive Equipment',
  'page.character.ee.badge': '{name}\'s Exclusive Equipment',
  'page.character.transcend.title': 'Transcendence',
  'page.character.tier.pve': 'PvE Tier',
  'page.character.tier.pvp': 'PvP Tier',
  'page.character.gear.title': 'Recommended Gear',
  'page.character.gear.substat_prio': 'Substat Priority',
  'page.character.gear.note': 'Notes',
  'page.character.gear.weapon': 'Weapon',
  'page.character.gear.amulet': 'Amulet',
  'page.character.gear.set': 'Armor Set',
  'page.character.gear.talisman': 'Talisman',
  'page.character.voice_actor': 'Voice Actor',
  'page.character.birthday': 'Birthday',
  'page.character.height': 'Height',
  'page.character.weight': 'Weight',
  'page.character.story': 'Story',
  'page.character.chain_effect': 'Chain Effect',
  'page.character.dual_effect': 'Dual Attack Effect',
  'page.character.stats.title': 'Base Stats',
  'page.character.stats.coming_soon': 'Coming soon',
  'page.character.no_reco': 'No gear recommendation available yet.',
} as const;

export default en;
export type TranslationKey = keyof typeof en;
