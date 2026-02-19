import type { TranslationKey } from './en';

const kr: Record<TranslationKey, string> = {
  // Navigation
  'nav.home': '홈',
  'nav.characters': '캐릭터',
  'nav.equipment': '장비',
  'nav.guides': '가이드',
  'nav.utilities': '유틸리티',
  'nav.tierlist': '티어 리스트',

  // Links
  'link.officialwebsite': 'https://outerplane.vagames.kr/index.html',

  // Common
  'common.search': '검색',
  'common.filter': '필터',
  'common.all': '전체',
  'common.none': '없음',
  'common.back': '뒤로',
  'common.loading': '로딩 중...',
  'common.coming_soon': '곧 공개 예정.',
  'common.updated': '{monthYear} 업데이트',

  // Contributors
  'contributors.title': '기여자',
  'contributors.description':
    'Outerpedia를 Outerplane 커뮤니티를 위한 가치 있는 리소스로 만드는 데 기여해 주신 모든 분들께 감사드립니다.',
  'contributors.favorite_character': '최애 캐릭터:',

  // Changelog
  'changelog.title': '변경 로그',
  'changelog.description':
    'Outerpedia의 모든 업데이트(가이드, 캐릭터, 도구 등)를 확인하세요.',
  'changelog.view_full': '전체 변경 로그 보기',

  // Page metadata
  'page.home.title': 'Outerpedia — 아우터플레인 위키 & 데이터베이스',
  'page.home.description':
    'Outerpedia는 아우터플레인의 커뮤니티 기반 위키 및 데이터베이스입니다. 캐릭터 빌드, 티어 리스트, 공략 가이드, 장비 추천 등.',
  'page.characters.title': '아우터플레인 캐릭터 데이터베이스',
  'page.characters.meta_title': '아우터플레인 캐릭터 데이터베이스 – {monthYear}',
  'page.characters.description':
    '아우터플레인의 모든 캐릭터를 탐색하세요. 속성, 클래스, 희귀도로 필터링. 빌드, 스킬, 팀 추천 확인. {monthYear} 업데이트.',
  'page.equipments.title': '아우터플레인 장비 데이터베이스',
  'page.equipments.meta_title': '아우터플레인 장비 데이터베이스 – {monthYear}',
  'page.equipments.description':
    '아우터플레인의 모든 장비를 탐색하세요. 무기, 아뮬렛, 탈리스만, 세트 효과 비교. {monthYear} 업데이트.',
  'page.tierlist.title': '아우터플레인 티어 리스트',
  'page.tierlist.meta_title': '아우터플레인 티어 리스트 – {monthYear}',
  'page.tierlist.description':
    '아우터플레인 티어 리스트. 역할 및 콘텐츠별 캐릭터 순위. {monthYear} 업데이트.',
  'page.tools.title': '아우터플레인 도구 & 유틸리티',
  'page.tools.description':
    '아우터플레인 도구: 장비 솔버, 팀 플래너, 뽑기 시뮬레이터, 진행 트래커 등.',
  'page.guides.title': '아우터플레인 공략 가이드',
  'page.guides.description':
    '아우터플레인 공략 가이드. 모험 스테이지, 보스전, 길드 레이드, 월드 보스, 초보자 팁.',
  'page.contributors.title': '프로젝트 기여자',
  'page.legal.title': '법적 고지 & 면책 조항',
  'page.legal.description':
    'Outerpedia의 법적 고지, 면책 조항, 콘텐츠 사용 정책 — 비공식 아우터플레인 팬 프로젝트.',
  'page.promo_codes.title': '아우터플레인 유효한 프로모 코드',
  'page.promo_codes.description':
    '아우터플레인 유효한 프로모 코드 목록. 게임 내에서 교환하여 무료 보상 획득: 에테르, 모집 티켓 등.',
  'promo_codes.expired': '만료된 코드',
  'promo_codes.active': '유효',
  'promo_codes.upcoming': '예정',
  'promo_codes.validity': '{start} — {end}',
  'promo_codes.redeem_android': 'Android: 메뉴 → 설정 → 쿠폰',
  'promo_codes.redeem_ios': 'iOS: <a href="https://coupon.outerplane.vagames.co.kr:39009/coupon" target="_blank" rel="noopener noreferrer" class="underline text-cyan-400">공식 웹사이트에서 교환</a>',

  // Homepage sections
  'home.cta.characters': '캐릭터 보기',
  'home.section.banners': '현재 픽업 중',
  'home.section.codes': '유효한 프로모 코드',
  'home.section.beginner': '아우터플레인이 처음이신가요?',
  'home.beginner.desc': '초보자 가이드로 모험을 시작하세요:',
  'home.beginner.faq': '초보자 FAQ',
  'home.beginner.faq.desc': '신규 플레이어를 위한 자주 묻는 질문과 답변.',
  'home.beginner.freeheroes': '무료 캐릭터 & 초기 배너',
  'home.beginner.freeheroes.desc': '누구를 뽑아야 하는지, 효율적인 시작 방법.',
  'home.beginner.stats': '스탯 & 전투 기초',
  'home.beginner.stats.desc': '스탯과 전투 시스템 이해하기.',
  'home.beginner.gear': '장비',
  'home.beginner.gear.desc': '장비 시스템과 강화 방법.',
  'home.beginner.growth': '캐릭터 육성',
  'home.beginner.growth.desc': '레벨링, 초월, 호감도 등.',
  'home.beginner.footer': '처음 시작하는 플레이어에게 추천',
  'home.section.updates': '최근 업데이트',
  'home.codes.copy': '복사',
  'home.codes.copied': '복사됨!',
  'home.codes.empty': '현재 유효한 코드가 없습니다.',
  'home.codes.view_all': '유효한 코드 {count}개 모두 보기',
  'home.discord.title': 'Discord에 참여하세요',
  'home.discord.description':
    '팀 편성 공유, 질문, 공략 토론을 커뮤니티와 함께하세요.',
  'home.discord.join': '참여',
  'home.discord.members': '{count}명의 멤버',
  'home.discord.online': '{count}명 온라인',
  'home.banner.ends_in': '남은 시간',
  'home.banner.ended': '종료',
  'home.resets.title': '서버 초기화',
  'home.resets.daily': '일일',
  'home.resets.weekly': '주간',
  'home.resets.monthly': '월간',

  // Search
  'search.placeholder': '캐릭터, 페이지 검색...',
  'search.no_results': '결과 없음',
  'search.pages': '페이지',
  'search.characters': '캐릭터',

  // Navigation (short labels for md-xl breakpoint)
  'nav.characters.short': '캐릭터',
  'nav.equipment.short': '장비',
  'nav.tierlist.short': '티어',
  'nav.utilities.short': '도구',
  'nav.guides.short': '가이드',

  // Footer
  'footer.tagline': '아우터플레인 팬메이드 데이터베이스.',
  'footer.legal_notice': '법적 고지',
  'footer.official_website': '공식 웹사이트',
  'footer.social.github': 'GitHub',
  'footer.social.evamains_discord': 'EvaMains Discord',
  'footer.social.official_discord': '공식 Discord',
  'footer.social.reddit': 'Reddit',
  'footer.social.youtube': 'YouTube',
  'footer.social.official_x': '공식 X (Twitter)',
  'footer.social.publisher_x': '퍼블리셔 X (Twitter)',
  'footer.disclaimer':
    'Outerpedia는 비공식 팬메이드 프로젝트입니다. 캐릭터, 이미지 및 기타 게임 에셋을 포함한 아우터플레인 관련 모든 콘텐츠는 VAGAMES CORP의 재산입니다. 이 웹사이트는 VAGAMES CORP와 어떠한 제휴, 보증 또는 후원 관계도 없습니다.',

  // Legal page content
  'legal.heading': '법적 고지 & 면책 조항 | Outerpedia',
  'legal.p1': '이 고지는 Outerpedia(게임 Outerplane 전용 비공식 팬메이드 프로젝트)의 법적 면책 조항입니다. 본 사이트에서 사용된 모든 이름, 이미지 및 기타 자산은 VAGAMES CORP 또는 각 소유자의 재산입니다. 본 사이트는 VAGAMES CORP와 어떠한 제휴, 보증 또는 후원 관계도 없습니다.',
  'legal.p2': '이 웹사이트는 비영리, 교육 및 정보 제공 목적으로만 제작되었습니다. 광고, 기부, 추적 도구 또는 수익화 메커니즘은 사용되지 않습니다.',
  'legal.p3': 'Outerpedia는 게임 파일을 호스팅하거나 재배포하지 않습니다. 모든 시각적 자산은 해설 및 문서화 목적으로만 표시됩니다. 콘텐츠의 다운로드나 재사용은 불가합니다.',
  'legal.p4': '본 사이트에 게시된 콘텐츠의 정당한 소유자이며 삭제를 원하시는 경우, 당사 또는 호스팅 제공업체에 직접 연락해 주시기 바랍니다. 삭제 요청에 신속히 대응하겠습니다.',
  'legal.hosting': '호스팅 제공업체',
  'legal.p5': '본 사이트는 개인이 운영합니다. 프랑스 법(LCEN)에 따라 호스팅 제공업체를 통해 법적 요청 시 사법 당국에 신원 정보를 공개할 수 있습니다.',

  // Errors
  'error.404': '페이지를 찾을 수 없습니다',
  'error.500': '문제가 발생했습니다',
  'error.back_home': '홈으로 돌아가기',
  'error.try_again': '다시 시도',

  // Elements
  'sys.element.fire': '화',
  'sys.element.water': '수',
  'sys.element.earth': '지',
  'sys.element.light': '명',
  'sys.element.dark': '암',

  // Classes
  'sys.class.defender': '방어형',
  'sys.class.striker': '공격형',
  'sys.class.ranger': '속도형',
  'sys.class.mage': '마법형',
  'sys.class.healer': '회복형',

  // Class passives (AP generation & bonus)
  'sys.class.passive.striker': '턴 시작 시 AP 5 회복. 공격 시 AP 20 회복. 치명 확률 5% 증가.',
  'sys.class.passive.defender': '턴 시작 시 AP 5 회복. 피격 시 AP 35 회복. 방어력 15% 증가.',
  'sys.class.passive.ranger': '턴 시작 시 AP 20 회복.',
  'sys.class.passive.healer': '턴 시작 시 AP 5 회복. 아군 피격 시 AP 25 획득. 체력 10% 증가.',
  'sys.class.passive.mage': '턴 시작 시 AP 5 회복. 스킬 사용 시 개별 AP 획득. 공격력 10% 증가.',

  // Subclasses
  'sys.subclass.attacker': '어태커',
  'sys.subclass.bruiser': '브루저',
  'sys.subclass.wizard': '위저드',
  'sys.subclass.enchanter': '인챈터',
  'sys.subclass.vanguard': '뱅가드',
  'sys.subclass.tactician': '택티션',
  'sys.subclass.sweeper': '스위퍼',
  'sys.subclass.phalanx': '팔랑크스',
  'sys.subclass.reliever': '릴리버',
  'sys.subclass.sage': '세이지',

  // Subclass descriptions
  'sys.subclass.info.attacker': '높은 공격력으로 적을 분쇄하는 용맹한 전사.',
  'sys.subclass.info.bruiser': '공방의 균형이 잘 잡혀 있어, 장기전에 특화된 싸움꾼.',
  'sys.subclass.info.wizard': '강력한 스킬로 전장을 휩쓸어버리는 마법의 대가.',
  'sys.subclass.info.enchanter': '다양한 부가 효과로 적의 약체화를 노리는 전장의 조율사.',
  'sys.subclass.info.vanguard': '빠른 스피드로 적을 순식간에 제압하는 선봉장.',
  'sys.subclass.info.tactician': '아군에게 이로운 효과를 부여해 우위를 점하는 전략가.',
  'sys.subclass.info.sweeper': '침착하게 공격을 견디며 기회를 엿보는 전투의 프로.',
  'sys.subclass.info.phalanx': '아군 보호에 특화된 방어의 스페셜리스트.',
  'sys.subclass.info.reliever': '위기 상황에서 아군을 회복시키는 구원자.',
  'sys.subclass.info.sage': '다양한 효과를 부여해 적의 방해를 끊어내는 지원가.',

  // Stats
  'sys.stat.atk': '공격력',
  'sys.stat.def': '방어력',
  'sys.stat.hp': '체력',
  'sys.stat.atk_percent': '공격력%',
  'sys.stat.def_percent': '방어력%',
  'sys.stat.hp_percent': '체력%',
  'sys.stat.eff': '효과 적중',
  'sys.stat.res': '효과 저항',
  'sys.stat.spd': '속도',
  'sys.stat.chc': '치명 확률',
  'sys.stat.chd': '치명 피해',
  'sys.stat.pen': '관통력',
  'sys.stat.pen_percent': '관통력%',
  'sys.stat.ls': '흡혈',
  'sys.stat.dmg_percentup': '피해 증가 %',
  'sys.stat.dmg_up': '피해 증가',
  'sys.stat.dmg_red': '받는 피해 감소',
  'sys.stat.cdmg_red': '받는 치명 피해 감소',
  'sys.stat.dmg_percentred': '받는 피해 감소 %',
  'sys.stat.cdmg_percentred': '받는 치명 피해 감소 %',

  // Filters
  'filters.rarity': '희귀도',
  'filters.elements': '속성',
  'filters.classes': '클래스',
  'filters.roles.dps': 'DPS',
  'filters.roles.support': '서포트',
  'filters.roles.sustain': '탱커',

  // Characters filters
  'characters.filters.chains': '체인',
  'characters.filters.roles': '역할',
  'characters.filters.gifts': '선물',
  'characters.filters.showBuffs': '버프/디버프 필터 보기',
  'characters.filters.hideBuffs': '버프/디버프 필터 숨기기',
  'characters.filters.showTags': '태그 보기',
  'characters.filters.hideTags': '태그 숨기기',
  'characters.filters.reset': '필터 초기화',
  'characters.filters.copy': '공유 링크 복사',
  'characters.filters.copied': '복사됨!',
  'characters.filters.unique': '고유 효과 보기',
  'characters.filters.and': '그리고',
  'characters.filters.or': '또는',
  'characters.filters.buffs': '버프',
  'characters.filters.debuffs': '디버프',
  'characters.filters.sources.filterBySource': '소스별 필터',
  'characters.filters.sources.skill1': '스킬 1',
  'characters.filters.sources.skill2': '스킬 2',
  'characters.filters.sources.skill3': '스킬 3',
  'characters.filters.sources.chainPassive': '체인 패시브',
  'characters.filters.sources.dualAttack': '듀얼 어택',
  'characters.filters.sources.exclusiveEquip': '전용 장비',

  // Characters common
  'characters.loading': '캐릭터 불러오는 중...',
  'characters.common.matches': '{count, plural, one {#개 일치} other {#개 일치}}',

  // Characters chains
  'characters.chains.starter': '시작',
  'characters.chains.companion': '연계',
  'characters.chains.finisher': '마무리',

  // Characters gifts
  'characters.gifts.science': '과학',
  'characters.gifts.luxury': '사치품',
  'characters.gifts.magicTool': '마도구',
  'characters.gifts.craftwork': '공예품',
  'characters.gifts.naturalObject': '자연물',

  // Characters effects groups
  'characters.effectsGroups.buff.statBoosts': '스탯 상승',
  'characters.effectsGroups.buff.supporting': '지원',
  'characters.effectsGroups.buff.utility': '유틸리티',
  'characters.effectsGroups.buff.unique': '고유',
  'characters.effectsGroups.buff.hidden': '숨겨진 효과',
  'characters.effectsGroups.debuff.statReduction': '스탯 감소',
  'characters.effectsGroups.debuff.cc': '군중 제어 (CC)',
  'characters.effectsGroups.debuff.dot': '지속 피해 (DoT)',
  'characters.effectsGroups.debuff.utility': '유틸 디버프',
  'characters.effectsGroups.debuff.unique': '고유',
  'characters.effectsGroups.debuff.hidden': '숨겨진 효과',

  // Characters tags
  'characters.tags.types.mechanic': '메카닉',
  'characters.tags.types.unit-type': '유닛 타입',

  // Character detail page
  'page.character.meta_title': '{name} — 스킬, 빌드 & 티어',
  'page.character.meta_description': '{name} ({element} {classType}) — 스킬 분석, 전용 장비, 추천 장비 빌드, 티어 랭킹.',
  'page.character.toc.overview': '개요',
  'page.character.toc.ee': '전용 장비',
  'page.character.toc.ranking': '랭킹',
  'page.character.toc.transcend': '초월',
  'page.character.toc.skills': '스킬',
  'page.character.toc.chain_dual': '체인 & 협공',
  'page.character.toc.stats_ranking': '스탯 & 랭킹',
  'page.character.toc.burst': '버스트',
  'page.character.toc.gear': '추천 장비',
  'page.character.toc.video': '영상',
  'page.character.toc.pros_cons': '장단점',
  'page.character.pros': '장점',
  'page.character.cons': '단점',
  'page.character.skill.cooldown': 'CT',
  'page.character.skill.wgr': 'WG',
  'page.character.skill.target_mono': '단일 대상',
  'page.character.skill.target_multi': '전체 대상',
  'page.character.skill.target_duo': '2체 대상',
  'page.character.skill.target_mono_ally': '아군 단일',
  'page.character.skill.target_multi_ally': '아군 전체',
  'page.character.skill.target_duo_ally': '아군 2체',
  'page.character.skill.enhancement': '강화',
  'page.character.skill.burn_cards': '버스트 스킬',
  'page.character.skill.burn_cost': '비용',
  'page.character.skill.level': 'Lv.',
  'page.character.skill.type.s1': '스킬 1',
  'page.character.skill.type.s2': '스킬 2',
  'page.character.skill.type.ultimate': '궁극기',
  'page.character.skill.type.passive': '패시브',
  'page.character.skill.type.chain': '체인',
  'page.character.ee.effect': '효과',
  'page.character.ee.effect_max': '효과 (Lv.10)',
  'page.character.ee.main_stat': '메인 스탯',
  'page.character.ee.rank': '전용 장비 랭크',
  'page.character.ee.title': '전용 장비',
  'page.character.ee.badge': '{name} 전용 장비',
  'page.character.transcend.title': '초월',
  'page.character.tier.pve': 'PvE 티어',
  'page.character.tier.pvp': 'PvP 티어',
  'page.character.gear.title': '추천 장비',
  'page.character.gear.substat_prio': '서브 스탯 우선순위',
  'page.character.gear.note': '비고',
  'page.character.gear.weapon': '무기',
  'page.character.gear.amulet': '아뮬렛',
  'page.character.gear.set': '방어구 세트',
  'page.character.gear.talisman': '탈리스만',
  'page.character.voice_actor': '성우',
  'page.character.birthday': '생일',
  'page.character.height': '키',
  'page.character.weight': '체중',
  'page.character.story': '스토리',
  'page.character.chain_effect': '체인 효과',
  'page.character.dual_effect': '협공 효과',
  'page.character.stats.title': '기본 스탯',
  'page.character.stats.class_passive': '클래스 패시브',
  'page.character.no_reco': '아직 추천 장비가 없습니다.',
};

export default kr;
