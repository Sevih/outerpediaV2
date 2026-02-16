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

  // Contributors
  'contributors.title': 'Outerpedia Contributors',
  'contributors.description':
    'Thank you to everyone who has contributed to making Outerpedia a valuable resource for the Outerplane community.',

  // Changelog
  'changelog.title': 'Changelog',
  'changelog.description':
    'Track all updates made to Outerpedia: guides, characters, tools, and more.',
  'changelog.view_full': 'View full changelog',

  // Page metadata (titles reuse nav.* keys, only descriptions here)
  'page.home.title': 'Outerpedia — Outerplane Wiki & Database',
  'page.home.description':
    'Outerpedia is a community-driven wiki and database for Outerplane. Find character builds, tier lists, guides, equipment recommendations, and more.',
  'page.characters.description':
    'Browse all Outerplane characters. Filter by element, class, and rarity. Find builds, skills, and team recommendations.',
  'page.equipments.description':
    'Explore all Outerplane weapons, amulets, talismans, and armor sets. Compare stats and find the best gear for your characters.',
  'page.tierlist.description':
    'Outerplane tier list ranking all characters by role and content type. Updated regularly with the latest meta.',
  'page.tools.description':
    'Outerplane tools: gear solver, team planner, pull simulator, progress tracker, and more.',
  'page.guides.description':
    'Outerplane guides for adventure stages, boss fights, guild raids, world bosses, and beginner tips.',

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
} as const;

export default en;
export type TranslationKey = keyof typeof en;
