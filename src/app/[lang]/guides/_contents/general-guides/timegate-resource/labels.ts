import type { Lang } from '@/lib/i18n/config'
import type { LangMap } from '@/types/common'

export type CostFormat = {
    prefix: string
    suffix: string
    amountFirst: boolean
}

export const LABELS = {
    title: { en: 'Weekly & Monthly Reference Tables', jp: '週間・月間リソース一覧表', kr: '주간 & 월간 참고표', zh: '每周与每月参考表' } satisfies LangMap,
    intro: { en: 'This guide lists all regular weekly and monthly sources of timegated resources in Outerplane. Please note that the items shown here can also occasionally be obtained through limited-time events or as part of special cash shop packs, which are not included in the tables below.', jp: 'このガイドでは、アウタープレーンで定期的に入手できる週間・月間の時限リソースをまとめています。なお、ここに記載されているアイテムは、期間限定イベントや特別なキャッシュショップパックでも入手できる場合がありますが、それらは下記の表には含まれていません。', kr: '이 가이드는 아우터플레인에서 정기적으로 획득할 수 있는 주간 및 월간 시간제한 리소스를 정리한 것입니다. 여기에 표시된 아이템은 기간 한정 이벤트나 특별 캐시샵 패키지를 통해서도 획득할 수 있지만, 아래 표에는 포함되어 있지 않습니다.', zh: '本指南列出了《Outerplane》中所有可定期获取的每周和每月限时资源。请注意，这里显示的物品有时也可以通过限时活动或特殊商城礼包获得，但这些不包含在下表中。' } satisfies LangMap,

    tabs: {
        books: { en: 'Skill Manual', jp: 'スキル教本', kr: '스킬 교본', zh: '技能教材' } satisfies LangMap,
        transistones: { en: 'Transistone', jp: 'トランストーン', kr: '트랜스톤', zh: '转换石' } satisfies LangMap,
        special: { en: 'Special Gear', jp: '特殊装備', kr: '특수 장비', zh: '特殊装备' } satisfies LangMap,
        glunite: { en: 'Glunite', jp: 'グルーナイト', kr: '글루나이트', zh: '格鲁矿石' } satisfies LangMap,
    },

    headers: {
        source: { en: 'Source', jp: '獲得先', kr: '획득처', zh: '获取途径' } satisfies LangMap,
        weekly: { en: 'Weekly', jp: 'ウィークリー', kr: '주간', zh: '每周' } satisfies LangMap,
        monthly: { en: 'Monthly', jp: 'マンスリー', kr: '월간', zh: '每月' } satisfies LangMap,
        total: { en: 'Total', jp: '合計', kr: '합계', zh: '总计' } satisfies LangMap,
        grandTotal: { en: 'Grand Total Monthly', jp: '月間合計', kr: '월간 총합', zh: '月度总计' } satisfies LangMap,
    },

    badges: {
        mission: { en: 'Mission', jp: 'ミッション', kr: '미션', zh: '任务' } satisfies LangMap,
        guild: { en: 'Guild', jp: 'ギルド', kr: '길드', zh: '公会' } satisfies LangMap,
        shop: { en: 'Shop', jp: 'ショップ', kr: '상점', zh: '商店' } satisfies LangMap,
        craft: { en: 'Craft', jp: '製作', kr: '제작', zh: '制作' } satisfies LangMap,
    },

    sources: {
        'progress.shop.general': { en: 'Gold/Consumables', jp: 'ゴールド/消耗品', kr: '골드/소모품', zh: '金币/消耗品' },
        'progress.shop.arena-shop': { en: 'Arena Shop', jp: 'アリーナショップ', kr: '결투장 상점', zh: '竞技场' },
        'progress.shop.guild-shop': { en: 'Guild Shop', jp: 'ギルドショップ', kr: '길드 상점', zh: '公会商店' },
        'progress.shop.world-boss': { en: 'World Boss Shop', jp: 'ワールドボスショップ', kr: '월드 보스 상점', zh: '世界首领' },
        'progress.craft.kates-workshop': { en: "Kate's Workshop", jp: 'ケイトの鍛冶工房', kr: '케이트 공방', zh: '凯特工坊' },
        'progress.shop.survey-hub': { en: 'Survey Hub', jp: '調査支援所', kr: '조사 지원소', zh: '调查支援所' },
        'progress.shop.star-memory': { en: "Star's Memory Shop", jp: 'スターピースショップ', kr: '별의 기억 상점', zh: '星之记忆' },
        'progress.shop.joint-challenge': { en: 'Joint Challenge', jp: '合同チャレンジ', kr: '합동 챌린지', zh: '联合挑战' },
        'timegate.source.irregular-infiltration-floor-3': { en: 'Irregular Infiltration Operation Floor 3', jp: 'イレギュラー侵入殲滅戦フロア3', kr: '이레귤러 침투 섬멸전 플로어 3', zh: '异型怪渗透歼灭战第3层' },
        'timegate.source.arena-weekly-reward': { en: 'Weekly Play Reward', jp: 'ウィークリープレイ報酬', kr: '주간 플레이 보상', zh: '每周游戏奖励' },
        'timegate.source.weekly-mission': { en: 'Weekly Mission', jp: 'ウィークリー', kr: '주간 미션', zh: '每周任务' },
        'timegate.source.irregular-extermination-point': { en: 'Irregular Extermination Project - Point Exchange', jp: 'イレギュラー殲滅戦 - ポイント交換所', kr: '이레귤러 섬멸전 - 포인트 교환소', zh: '异型怪歼灭战 - 点数兑换所' },
    } as Record<string, LangMap>,

    cost: {
        en: { prefix: 'cost ', suffix: '', amountFirst: true },
        jp: { prefix: '', suffix: '個消費', amountFirst: false },
        kr: { prefix: '', suffix: '개 소모', amountFirst: false },
        zh: { prefix: '消耗 ', suffix: '', amountFirst: true },
    } satisfies Record<Lang, CostFormat>,
} as const
