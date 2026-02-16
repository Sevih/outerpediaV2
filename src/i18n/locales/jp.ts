import type { TranslationKey } from './en';

const jp: Record<TranslationKey, string> = {
  // Navigation
  'nav.home': 'ホーム',
  'nav.characters': 'キャラクター',
  'nav.equipment': '装備',
  'nav.guides': 'ガイド',
  'nav.utilities': 'ユーティリティ',
  'nav.tierlist': 'ティアリスト',

  // Links
  'link.officialwebsite': 'https://outerplane.vagames.kr/index_ja.html',

  // Common
  'common.search': '検索',
  'common.filter': 'フィルター',
  'common.all': 'すべて',
  'common.none': 'なし',
  'common.back': '戻る',
  'common.loading': '読み込み中...',
  'common.coming_soon': '近日公開',

  // Contributors
  'contributors.title': 'コントリビューター',
  'contributors.description':
    'OuterpediaをOuterplaneコミュニティにとって価値あるリソースにするために貢献してくださったすべての方々に感謝します。',
  'contributors.favorite_character': 'お気に入りキャラクター：',

  // Changelog
  'changelog.title': '更新履歴',
  'changelog.description':
    'Outerpedia の更新情報（ガイド、キャラクター、ツールなど）を確認できます。',
  'changelog.view_full': 'すべての更新履歴を見る',

  // Page metadata
  'page.home.title': 'Outerpedia — アウタープレーン Wiki & データベース',
  'page.home.description':
    'Outerpediaはアウタープレーンのコミュニティ主導のWikiとデータベースです。キャラクタービルド、ティアリスト、攻略ガイド、装備推奨など。',
  'page.characters.title': 'アウタープレーン キャラクターデータベース',
  'page.characters.meta_title': 'アウタープレーン キャラクターデータベース – {monthYear}',
  'page.characters.description':
    'アウタープレーンの全キャラクターを閲覧。属性、クラス、レアリティでフィルター。ビルド、スキル、チーム編成を確認。{monthYear}更新。',
  'page.equipments.title': 'アウタープレーン 装備データベース',
  'page.equipments.meta_title': 'アウタープレーン 装備データベース – {monthYear}',
  'page.equipments.description':
    'アウタープレーンの全装備を探索。武器、アミュレット、タリスマン、セット効果のステータス比較。{monthYear}更新。',
  'page.tierlist.title': 'アウタープレーン ティアリスト',
  'page.tierlist.meta_title': 'アウタープレーン ティアリスト – {monthYear}',
  'page.tierlist.description':
    'アウタープレーンのティアリスト。役割・コンテンツ別にキャラクターをランキング。{monthYear}更新。',
  'page.tools.title': 'アウタープレーン ツール & ユーティリティ',
  'page.tools.description':
    'アウタープレーンのツール：装備ソルバー、チームプランナー、ガチャシミュレーター、進捗トラッカーなど。',
  'page.guides.title': 'アウタープレーン 攻略ガイド',
  'page.guides.description':
    'アウタープレーン攻略ガイド。冒険ステージ、ボス戦、ギルドレイド、ワールドボス、初心者向けのヒント。',
  'page.contributors.title': 'プロジェクト コントリビューター',
  'page.legal.title': '法的通知 & 免責事項',
  'page.legal.description':
    'Outerpediaの法的通知、免責事項、およびコンテンツ使用ポリシー — 非公式アウタープレーンファンプロジェクト。',
  'page.promo_codes.title': 'アウタープレーン 有効なプロモコード',
  'page.promo_codes.description':
    'アウタープレーンの有効なプロモコード一覧。ゲーム内で引き換えて無料報酬を獲得：エーテル、募集チケットなど。',
  'promo_codes.expired': '期限切れコード',

  // Homepage sections
  'home.cta.characters': 'キャラクター一覧',
  'home.section.banners': '現在ピックアップ中',
  'home.section.codes': '有効なプロモコード',
  'home.section.beginner': 'アウタープレーン初心者ですか？',
  'home.beginner.desc': '初心者向けガイドで冒険を始めましょう：',
  'home.beginner.faq': '初心者FAQ',
  'home.beginner.faq.desc': '新規プレイヤー向けのよくある質問と回答。',
  'home.beginner.freeheroes': '無料キャラ & 初期バナー',
  'home.beginner.freeheroes.desc': '誰を引くべきか、効率的な始め方。',
  'home.beginner.stats': 'ステータス & 戦闘の基本',
  'home.beginner.stats.desc': 'ステータスと戦闘の仕組みを理解する。',
  'home.beginner.gear': '装備',
  'home.beginner.gear.desc': '装備の仕組みと強化方法。',
  'home.beginner.growth': 'キャラ育成',
  'home.beginner.growth.desc': 'レベリング、超越、親密度など。',
  'home.beginner.footer': '初めてのプレイヤーに最適',
  'home.section.updates': '最近の更新',
  'home.codes.copy': 'コピー',
  'home.codes.copied': 'コピー済み！',
  'home.codes.empty': '現在有効なコードはありません。',
  'home.codes.view_all': '有効なコード{count}件をすべて見る',
  'home.banner.ends_in': '残り',
  'home.banner.ended': '終了',

  // Navigation (short labels for md-xl breakpoint)
  'nav.characters.short': 'キャラ',
  'nav.equipment.short': '装備',
  'nav.tierlist.short': 'ティア',
  'nav.utilities.short': 'ツール',
  'nav.guides.short': 'ガイド',

  // Footer
  'footer.tagline': 'アウタープレーンのファンメイドデータベース。',
  'footer.legal_notice': '法的通知',
  'footer.official_website': '公式サイト',
  'footer.social.github': 'GitHub',
  'footer.social.evamains_discord': 'EvaMains Discord',
  'footer.social.official_discord': '公式Discord',
  'footer.social.reddit': 'Reddit',
  'footer.social.youtube': 'YouTube',
  'footer.social.official_x': '公式 X (Twitter)',
  'footer.social.publisher_x': 'パブリッシャー X (Twitter)',
  'footer.disclaimer':
    'Outerpediaは非公式のファンメイドプロジェクトです。キャラクター、画像、その他のゲームアセットを含むアウタープレーンに関するすべてのコンテンツはVAGAMES CORPの所有物です。本サイトはVAGAMES CORPとの提携、承認、またはスポンサーシップを受けていません。',

  // Legal page content
  'legal.heading': '法的通知 & 免責事項 | Outerpedia',
  'legal.p1': 'この通知はOuterpedia（ゲーム「Outerplane」専用の非公式ファンメイドプロジェクト）の法的免責事項です。本サイトで使用されているすべての名称、画像、その他のアセットはVAGAMES CORPまたはそれぞれの所有者の財産です。本サイトはVAGAMES CORPとの提携、承認、またはスポンサーシップを受けていません。',
  'legal.p2': 'このウェブサイトは非営利、教育、情報提供のみを目的として作成されました。広告、寄付、トラッキングツール、または収益化の仕組みは一切使用していません。',
  'legal.p3': 'Outerpediaはゲームファイルのホスティングや再配布を行いません。すべてのビジュアルアセットは解説およびドキュメント目的でのみ表示されています。コンテンツのダウンロードや再利用はできません。',
  'legal.p4': '本サイトに掲載されているコンテンツの正当な所有者で削除を希望される場合は、当方またはホスティングプロバイダーに直接ご連絡ください。削除リクエストには速やかに対応いたします。',
  'legal.hosting': 'ホスティングプロバイダー',
  'legal.p5': '本サイトは個人により運営されています。フランス法（LCEN）に基づき、法的要請に応じてホスティングプロバイダーを通じて身元情報を司法当局に開示することがあります。',

  // Errors
  'error.404': 'ページが見つかりません',
  'error.500': 'エラーが発生しました',
  'error.back_home': 'ホームに戻る',
  'error.try_again': 'もう一度試す',

  // Elements
  'sys.element.fire': '火',
  'sys.element.water': '水',
  'sys.element.earth': '地',
  'sys.element.light': '光',
  'sys.element.dark': '闇',

  // Classes
  'sys.class.defender': '防御型',
  'sys.class.striker': '攻撃型',
  'sys.class.ranger': 'スピード型',
  'sys.class.mage': '魔法型',
  'sys.class.healer': '回復型',

  // Class passives (AP generation & bonus)
  'sys.class.passive.striker': 'ターン開始時、APが5回復する。ダメージを受けた時、APが20回復する。会心率が5%UPする。',
  'sys.class.passive.defender': 'ターン開始時、APが5回復する。ダメージを受けた時、APが35回復する。防御力が15%UPする。',
  'sys.class.passive.ranger': 'ターン開始時、APが20回復する。',
  'sys.class.passive.healer': 'ターン開始時、APが5回復する。味方がダメージを受けた時、APが25回復する。HPが10%UPする。',
  'sys.class.passive.mage': 'ターン開始時、APが5回復する。スキル使用時、個別AP獲得する。攻撃力が10%UPする。',

  // Subclasses
  'sys.subclass.attacker': 'アタッカー',
  'sys.subclass.bruiser': 'ブルーザー',
  'sys.subclass.wizard': 'ウィザード',
  'sys.subclass.enchanter': 'エンチャンター',
  'sys.subclass.vanguard': 'ヴァンガード',
  'sys.subclass.tactician': 'タクティシャン',
  'sys.subclass.sweeper': 'スイーパー',
  'sys.subclass.phalanx': 'ファランクス',
  'sys.subclass.reliever': 'リリーバー',
  'sys.subclass.sage': 'セージ',

  // Subclass descriptions
  'sys.subclass.info.attacker': '高い攻撃力で敵を粉砕する勇猛な戦士。',
  'sys.subclass.info.bruiser': '攻防バランスが良く、長期戦に特化した喧嘩師。',
  'sys.subclass.info.wizard': '強力なスキルで戦場を圧倒する魔法使い。',
  'sys.subclass.info.enchanter': '様々なスキル効果で敵を弱体化させる戦場の調律師。',
  'sys.subclass.info.vanguard': '素早いスピードで敵を制圧する先鋒隊。',
  'sys.subclass.info.tactician': '味方を強化し、戦況を有利に進める戦略家。',
  'sys.subclass.info.sweeper': '端然と攻撃に耐えつつ、逆転のチャンスを狙う戦闘のプロ。',
  'sys.subclass.info.phalanx': '味方の保護に特化した防御のスペシャリスト。',
  'sys.subclass.info.reliever': '味方を回復し、危機を覆す救世主。',
  'sys.subclass.info.sage': 'あらゆるスキルで敵を妨害する戦闘のサポーター。',

  // Stats
  'sys.stat.atk': '攻撃力',
  'sys.stat.def': '防御力',
  'sys.stat.hp': '体力',
  'sys.stat.atk_percent': '攻撃力%',
  'sys.stat.def_percent': '防御力%',
  'sys.stat.hp_percent': '体力%',
  'sys.stat.eff': '効果命中',
  'sys.stat.res': '効果抵抗',
  'sys.stat.spd': 'スピード',
  'sys.stat.chc': '会心率',
  'sys.stat.chd': '会心ダメージ',
  'sys.stat.pen': '貫通力',
  'sys.stat.pen_percent': '貫通力%',
  'sys.stat.ls': '吸収',
  'sys.stat.dmg_percentup': '与ダメUP %',
  'sys.stat.dmg_up': '与ダメUP',
  'sys.stat.dmg_red': '被ダメDOWN',
  'sys.stat.cdmg_red': '被会心ダメDOWN',
  'sys.stat.dmg_percentred': '被ダメDOWN %',
  'sys.stat.cdmg_percentred': '被会心ダメDOWN %',
};

export default jp;
