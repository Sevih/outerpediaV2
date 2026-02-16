import type { TranslationKey } from './en';

const kr: Record<TranslationKey, string> = {
  'nav.home': '홈',
  'nav.characters': '캐릭터',
  'nav.equipment': '장비',
  'nav.guides': '가이드',
  'nav.utilities': '유틸리티',
  'nav.tierlist': '티어 리스트',

  'link.officialwebsite': 'https://outerplane.vagames.kr/index.html',

  'common.search': '검색',
  'common.filter': '필터',
  'common.all': '전체',
  'common.none': '없음',
  'common.back': '뒤로',
  'common.loading': '로딩 중...',
  'common.coming_soon': '곧 공개 예정.',

  'contributors.title': '기여자',
  'contributors.description':
    'Outerpedia를 Outerplane 커뮤니티를 위한 가치 있는 리소스로 만드는 데 기여해 주신 모든 분들께 감사드립니다.',
  'contributors.favorite_character': '최애 캐릭터:',

  'changelog.title': '변경 로그',
  'changelog.description':
    'Outerpedia의 모든 업데이트(가이드, 캐릭터, 도구 등)를 확인하세요.',
  'changelog.view_full': '전체 변경 로그 보기',

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

  'footer.tagline': '아우터플레인 팬메이드 데이터베이스.',
  'footer.legal_notice': '법적 고지',
  'footer.official_website': '공식 웹사이트',
  'footer.disclaimer':
    'Outerpedia는 비공식 팬메이드 프로젝트입니다. 캐릭터, 이미지 및 기타 게임 에셋을 포함한 아우터플레인 관련 모든 콘텐츠는 VAGAMES CORP의 재산입니다. 이 웹사이트는 VAGAMES CORP와 어떠한 제휴, 보증 또는 후원 관계도 없습니다.',

  'error.404': '페이지를 찾을 수 없습니다',
  'error.500': '문제가 발생했습니다',
  'error.back_home': '홈으로 돌아가기',
  'error.try_again': '다시 시도',

  'sys.element.fire': '화',
  'sys.element.water': '수',
  'sys.element.earth': '지',
  'sys.element.light': '명',
  'sys.element.dark': '암',

  'sys.class.defender': '방어형',
  'sys.class.striker': '공격형',
  'sys.class.ranger': '속도형',
  'sys.class.mage': '마법형',
  'sys.class.healer': '회복형',

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
};

export default kr;
