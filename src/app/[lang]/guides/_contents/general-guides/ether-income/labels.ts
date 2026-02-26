import type { LangMap } from '@/types/common'

export const LABELS = {
    // Page
    title: { en: 'Daily / Weekly / Monthly Ether income', jp: 'エーテル収入（日/週/月別）', kr: '에테르 수입 (일/주/월별)', zh: '以太收入（日/周/月）' } satisfies LangMap,
    description: { en: 'This guide organizes your income into Daily, Weekly, and Monthly sources. Use the Advanced rank adjustments (Arena, Guild Raid, World Boss) to match your account—totals and the date projection update instantly. Event/seasonal rewards are listed separately and aren\'t counted in the totals.', jp: 'このガイドでは収入を日次、週次、月次に分類しています。詳細設定（アリーナ、ギルドレイド、ワールドボス）でアカウントに合わせると、合計と日付予測が即座に更新されます。イベント/シーズン報酬は別途記載され、合計には含まれません。', kr: '이 가이드는 수입을 일간, 주간, 월간으로 분류합니다. 고급 랭크 설정(아레나, 길드 레이드, 월드 보스)을 조정하면 합계와 날짜 예측이 즉시 업데이트됩니다. 이벤트/시즌 보상은 별도로 표시되며 합계에 포함되지 않습니다.', zh: '本指南将收入分为日常、每周和每月来源。使用高级排名设置（竞技场、公会副本、世界Boss）来匹配您的账号——总计和日期预测会即时更新。活动/季节奖励单独列出，不计入总计。' } satisfies LangMap,

    // Totals
    dailyIncome: { en: 'Daily income', jp: '日次収入', kr: '일간 수입', zh: '日常收入' } satisfies LangMap,
    weeklyIncome: { en: 'Weekly income', jp: '週次収入', kr: '주간 수입', zh: '每周收入' } satisfies LangMap,
    monthlyIncome: { en: 'Monthly income', jp: '月次収入', kr: '월간 수입', zh: '每月收入' } satisfies LangMap,
    weeklyTotal: { en: 'Weekly Total', jp: '週間合計', kr: '주간 총합', zh: '周总计' } satisfies LangMap,
    monthlyTotal: { en: 'Monthly Total', jp: '月間合計', kr: '월간 총합', zh: '月总计' } satisfies LangMap,
    perDay: { en: '/day', jp: '/日', kr: '/일', zh: '/天' } satisfies LangMap,

    // Adjustments
    advancedAdjustments: { en: 'Advanced rank adjustments', jp: '詳細ランク設定', kr: '고급 랭크 설정', zh: '高级排名设置' } satisfies LangMap,
    arena: { en: 'Arena', jp: 'アリーナ', kr: '아레나', zh: '竞技场' } satisfies LangMap,
    guild: { en: 'Guild', jp: 'ギルド', kr: '길드', zh: '公会' } satisfies LangMap,
    worldBoss: { en: 'World Boss', jp: 'ワールドボス', kr: '월드 보스', zh: '世界Boss' } satisfies LangMap,

    // Tables
    tableDaily: { en: 'Daily income', jp: '日次収入', kr: '일간 수입', zh: '日常收入' } satisfies LangMap,
    tableWeekly: { en: 'Weekly income', jp: '週次収入', kr: '주간 수입', zh: '每周收入' } satisfies LangMap,
    tableMonthly: { en: 'Monthly income', jp: '月次収入', kr: '월간 수입', zh: '每月收入' } satisfies LangMap,
    source: { en: 'Source', jp: '取得元', kr: '출처', zh: '来源' } satisfies LangMap,
    daily: { en: 'Daily', jp: '日次', kr: '일간', zh: '日常' } satisfies LangMap,
    weekly: { en: 'Weekly', jp: '週次', kr: '주간', zh: '每周' } satisfies LangMap,
    monthly: { en: 'Monthly', jp: '月次', kr: '월간', zh: '每月' } satisfies LangMap,
    weeklyApprox: { en: 'Weekly ≈×7', jp: '週≈×7', kr: '주≈×7', zh: '周≈×7' } satisfies LangMap,
    monthlyApprox: { en: 'Monthly ≈×30', jp: '月≈×30', kr: '월≈×30', zh: '月≈×30' } satisfies LangMap,
    monthlyApprox4: { en: 'Monthly ≈×4', jp: '月≈×4', kr: '월≈×4', zh: '月≈×4' } satisfies LangMap,
    notes: { en: 'Notes', jp: '備考', kr: '비고', zh: '备注' } satisfies LangMap,
    dailySubtotal: { en: 'Daily subtotal', jp: '日次小計', kr: '일간 소계', zh: '日常小计' } satisfies LangMap,
    weeklySubtotal: { en: 'Weekly subtotal', jp: '週次小計', kr: '주간 소계', zh: '每周小计' } satisfies LangMap,
    monthlySubtotal: { en: 'Monthly subtotal', jp: '月次小計', kr: '월간 소계', zh: '每月小计' } satisfies LangMap,

    // Variable
    variableExcluded: { en: 'Variable / Event-Driven (excluded)', jp: '変動/イベント報酬（除外）', kr: '변동/이벤트 보상 (제외)', zh: '变动/活动奖励（不计入）' } satisfies LangMap,
    variableTitle: { en: 'Extra', jp: 'その他', kr: '기타', zh: '其他' } satisfies LangMap,

    // Projection
    projection: { en: 'Projection until a date', jp: '日付までの予測', kr: '날짜까지 예측', zh: '日期预测' } satisfies LangMap,
    endDate: { en: 'End date', jp: '終了日', kr: '종료일', zh: '结束日期' } satisfies LangMap,
    currentEther: { en: 'Current Ether', jp: '現在のエーテル', kr: '현재 에테르', zh: '当前以太' } satisfies LangMap,
    days: { en: 'Days', jp: '日数', kr: '일수', zh: '天数' } satisfies LangMap,
    weeks: { en: 'Weeks', jp: '週数', kr: '주수', zh: '周数' } satisfies LangMap,
    months: { en: 'Months', jp: '月数', kr: '월수', zh: '月数' } satisfies LangMap,
    fromDaily: { en: 'From Daily', jp: '日次から', kr: '일간에서', zh: '来自日常' } satisfies LangMap,
    fromWeekly: { en: 'From Weekly', jp: '週次から', kr: '주간에서', zh: '来自每周' } satisfies LangMap,
    fromMonthly: { en: 'From Monthly', jp: '月次から', kr: '월간에서', zh: '来自每月' } satisfies LangMap,
    projectedTotal: { en: 'Projected Total', jp: '予測合計', kr: '예상 총합', zh: '预计总计' } satisfies LangMap,

    // Sources
    sources: {
        'daily.missions': { en: 'Daily Missions', jp: 'デイリーミッション', kr: '일일 미션', zh: '每日任务' },
        'daily.arena': { en: 'Daily Arena', jp: 'デイリーアリーナ', kr: '일일 아레나', zh: '每日竞技场' },
        'daily.freePack': { en: 'Daily Free Pack', jp: 'デイリー無料パック', kr: '일일 무료 팩', zh: '每日免费礼包' },
        'daily.missionEvent': { en: 'Daily Mission Event', jp: 'デイリーミッションイベント', kr: '일일 미션 이벤트', zh: '每日任务活动' },
        'daily.antiparticle': { en: 'Antiparticle generator (2×12h)', jp: '反粒子発生器（2×12時間）', kr: '반입자 발생기 (2×12시간)', zh: '反粒子发生器（2×12小时）' },
        'weekly.freePack': { en: 'Weekly Free Pack', jp: 'ウィークリー無料パック', kr: '주간 무료 팩', zh: '每周免费礼包' },
        'weekly.arena': { en: 'Weekly Arena Ranking', jp: 'ウィークリーアリーナランキング', kr: '주간 아레나 랭킹', zh: '每周竞技场排名' },
        'weekly.missions': { en: 'Weekly Missions', jp: 'ウィークリーミッション', kr: '주간 미션', zh: '每周任务' },
        'weekly.guildCheckin': { en: 'Guild Check-in', jp: 'ギルドチェックイン', kr: '길드 체크인', zh: '公会签到' },
        'weekly.monadGate': { en: 'Monad Gate Weekly Missions', jp: 'モナドゲートウィークリーミッション', kr: '모나드 게이트 주간 미션', zh: '莫纳德之门每周任务' },
        'monthly.freePack': { en: 'Monthly Free Pack', jp: 'マンスリー無料パック', kr: '월간 무료 팩', zh: '每月免费礼包' },
        'monthly.skywardTower': { en: 'Skyward Tower', jp: '昇天の塔', kr: '승천의 탑', zh: '升天之塔' },
        'monthly.checkin': { en: 'Check-in', jp: 'チェックイン', kr: '체크인', zh: '签到' },
        'monthly.maintenance': { en: 'Maintenance rewards', jp: 'メンテナンス報酬', kr: '점검 보상', zh: '维护奖励' },
        'monthly.jointMission': { en: 'Joint Mission', jp: '共同ミッション', kr: '합동 미션', zh: '联合任务' },
        'monthly.guildRaid': { en: 'Guild Raid Ranking Reward', jp: 'ギルドレイドランキング報酬', kr: '길드 레이드 랭킹 보상', zh: '公会副本排名奖励' },
        'monthly.worldBoss': { en: 'World Boss Ranking Reward', jp: 'ワールドボスランキング報酬', kr: '월드 보스 랭킹 보상', zh: '世界Boss排名奖励' },
    } as Record<string, LangMap>,
    sourceNotes: {
        'weekly.arena': { en: '35 minimum. Can go up to 1500 for rank 1.', jp: '最低35。1位で最大1500。', kr: '최소 35. 1위 시 최대 1500.', zh: '最低35。第1名最高1500。' },
        'weekly.monadGate': { en: '5×10 + 200 completion bonus', jp: '5×10 + 200完了ボーナス', kr: '5×10 + 200 완료 보너스', zh: '5×10 + 200完成奖励' },
        'monthly.maintenance': { en: '≈200 every 2 weeks (min)', jp: '約200（2週間ごと、最低）', kr: '약 200 (2주마다, 최소)', zh: '约200（每2周，最低）' },
        'monthly.jointMission': { en: '80 from Event Mission, do 10 joint challenge runs', jp: 'イベントミッションから80、共同チャレンジ10回', kr: '이벤트 미션에서 80, 합동 챌린지 10회', zh: '活动任务80，完成10次联合挑战' },
        'monthly.guildRaid': { en: '200 minimum. Can go up to 1500 for rank 1.', jp: '最低200。1位で最大1500。', kr: '최소 200. 1위 시 최대 1500.', zh: '最低200。第1名最高1500。' },
        'monthly.worldBoss': { en: '60 minimum. Can go up to 1500 for rank 1 in extreme.', jp: '最低60。エクストリーム1位で最大1500。', kr: '최소 60. 익스트림 1위 시 최대 1500.', zh: '最低60。极限难度第1名最高1500。' },
    } as Record<string, LangMap>,

    // Arena ranks
    arenaRanks: {
        'arena.bronze3': { en: 'Bronze III', jp: 'ブロンズIII', kr: '브론즈 III', zh: '青铜III' },
        'arena.bronze2': { en: 'Bronze II', jp: 'ブロンズII', kr: '브론즈 II', zh: '青铜II' },
        'arena.bronze1': { en: 'Bronze I', jp: 'ブロンズI', kr: '브론즈 I', zh: '青铜I' },
        'arena.silver3': { en: 'Silver III', jp: 'シルバーIII', kr: '실버 III', zh: '白银III' },
        'arena.silver2': { en: 'Silver II', jp: 'シルバーII', kr: '실버 II', zh: '白银II' },
        'arena.silver1': { en: 'Silver I', jp: 'シルバーI', kr: '실버 I', zh: '白银I' },
        'arena.gold3': { en: 'Gold III', jp: 'ゴールドIII', kr: '골드 III', zh: '黄金III' },
        'arena.gold2': { en: 'Gold II', jp: 'ゴールドII', kr: '골드 II', zh: '黄金II' },
        'arena.gold1': { en: 'Gold I', jp: 'ゴールドI', kr: '골드 I', zh: '黄金I' },
        'arena.platinum3': { en: 'Platinum III', jp: 'プラチナIII', kr: '플래티넘 III', zh: '铂金III' },
        'arena.platinum2': { en: 'Platinum II', jp: 'プラチナII', kr: '플래티넘 II', zh: '铂金II' },
        'arena.platinum1': { en: 'Platinum I', jp: 'プラチナI', kr: '플래티넘 I', zh: '铂金I' },
        'arena.diamond3': { en: 'Diamond III', jp: 'ダイヤモンドIII', kr: '다이아몬드 III', zh: '钻石III' },
        'arena.diamond2': { en: 'Diamond II', jp: 'ダイヤモンドII', kr: '다이아몬드 II', zh: '钻石II' },
        'arena.diamond1': { en: 'Diamond I', jp: 'ダイヤモンドI', kr: '다이아몬드 I', zh: '钻石I' },
        'arena.master3': { en: 'Master III', jp: 'マスターIII', kr: '마스터 III', zh: '大师III' },
        'arena.master2': { en: 'Master II', jp: 'マスターII', kr: '마스터 II', zh: '大师II' },
        'arena.master1': { en: 'Master I', jp: 'マスターI', kr: '마스터 I', zh: '大师I' },
        'arena.top100': { en: 'Top 100', jp: 'Top 100', kr: 'Top 100', zh: 'Top 100' },
        'arena.top50': { en: 'Top 50', jp: 'Top 50', kr: 'Top 50', zh: 'Top 50' },
        'arena.top10': { en: 'Top 10', jp: 'Top 10', kr: 'Top 10', zh: 'Top 10' },
        'arena.top3': { en: 'Top 3', jp: 'Top 3', kr: 'Top 3', zh: 'Top 3' },
        'arena.top2': { en: 'Top 2', jp: 'Top 2', kr: 'Top 2', zh: 'Top 2' },
        'arena.top1': { en: 'Top 1', jp: 'Top 1', kr: 'Top 1', zh: 'Top 1' },
    } as Record<string, LangMap>,

    // Guild ranks
    guildRanks: {
        'guild.top1': { en: 'Top 1', jp: 'Top 1', kr: 'Top 1', zh: 'Top 1' },
        'guild.top2': { en: 'Top 2', jp: 'Top 2', kr: 'Top 2', zh: 'Top 2' },
        'guild.top3': { en: 'Top 3', jp: 'Top 3', kr: 'Top 3', zh: 'Top 3' },
        'guild.top5': { en: 'Top 5', jp: 'Top 5', kr: 'Top 5', zh: 'Top 5' },
        'guild.top10': { en: 'Top 10', jp: 'Top 10', kr: 'Top 10', zh: 'Top 10' },
        'guild.top20': { en: 'Top 20', jp: 'Top 20', kr: 'Top 20', zh: 'Top 20' },
        'guild.top50': { en: 'Top 50', jp: 'Top 50', kr: 'Top 50', zh: 'Top 50' },
        'guild.top100': { en: 'Top 100', jp: 'Top 100', kr: 'Top 100', zh: 'Top 100' },
        'guild.top150': { en: 'Top 150', jp: 'Top 150', kr: 'Top 150', zh: 'Top 150' },
        'guild.top200': { en: 'Top 200', jp: 'Top 200', kr: 'Top 200', zh: 'Top 200' },
        'guild.top300': { en: 'Top 300', jp: 'Top 300', kr: 'Top 300', zh: 'Top 300' },
        'guild.top400': { en: 'Top 400', jp: 'Top 400', kr: 'Top 400', zh: 'Top 400' },
        'guild.top500': { en: 'Top 500', jp: 'Top 500', kr: 'Top 500', zh: 'Top 500' },
        'guild.top1000': { en: 'Top 1000', jp: 'Top 1000', kr: 'Top 1000', zh: 'Top 1000' },
        'guild.top1500': { en: 'Top 1500', jp: 'Top 1500', kr: 'Top 1500', zh: 'Top 1500' },
        'guild.top2000': { en: 'Top 2000', jp: 'Top 2000', kr: 'Top 2000', zh: 'Top 2000' },
        'guild.top3000': { en: 'Top 3000', jp: 'Top 3000', kr: 'Top 3000', zh: 'Top 3000' },
        'guild.below3001': { en: 'Below Top 3001', jp: 'Top 3001以下', kr: 'Top 3001 이하', zh: 'Top 3001以下' },
    } as Record<string, LangMap>,

    // World Boss ranks
    wbRanks: {
        'wb.rank1': { en: 'Rank 1', jp: '1位', kr: '1위', zh: '第1名' },
        'wb.rank2': { en: 'Rank 2', jp: '2位', kr: '2위', zh: '第2名' },
        'wb.rank3': { en: 'Rank 3', jp: '3位', kr: '3위', zh: '第3名' },
        'wb.top10': { en: 'Top 10', jp: 'Top 10', kr: 'Top 10', zh: 'Top 10' },
        'wb.top50': { en: 'Top 50', jp: 'Top 50', kr: 'Top 50', zh: 'Top 50' },
        'wb.top100': { en: 'Top 100', jp: 'Top 100', kr: 'Top 100', zh: 'Top 100' },
        'wb.top1pct': { en: 'Top 1%', jp: 'Top 1%', kr: 'Top 1%', zh: 'Top 1%' },
        'wb.top10pct': { en: 'Top 10%', jp: 'Top 10%', kr: 'Top 10%', zh: 'Top 10%' },
        'wb.top50pct': { en: 'Top 50%', jp: 'Top 50%', kr: 'Top 50%', zh: 'Top 50%' },
        'wb.top100pct': { en: 'Top 100%', jp: 'Top 100%', kr: 'Top 100%', zh: 'Top 100%' },
    } as Record<string, LangMap>,
    wbLeagues: {
        'Normal': { en: 'Normal', jp: 'ノーマル', kr: '노멀', zh: '普通' },
        'Hard': { en: 'Hard', jp: 'ハード', kr: '하드', zh: '困难' },
        'Very Hard': { en: 'Very Hard', jp: 'ベリーハード', kr: '베리 하드', zh: '超难' },
        'Extreme': { en: 'Extreme', jp: 'エクストリーム', kr: '익스트림', zh: '极限' },
    } as Record<string, LangMap>,

    // Variable items
    variableItems: {
        'variable.terminus': { en: 'Terminus Island Ether rewards (22–26 on treasure reward on Terminus 10) (5 chances everyday ×2 w/ terminus pack)', jp: 'ターミナルアイルのエーテル報酬（ターミナル10の宝箱報酬で22〜26）（毎日5回、ターミナルパックで×2）', kr: '터미널 아일 에테르 보상 (터미널 10 보물 보상에서 22~26) (매일 5회, 터미널 팩으로 ×2)', zh: '终点岛以太奖励（终点10的宝箱奖励22~26）（每天5次，终点礼包×2）' },
        'variable.updateEvent': { en: "Every update's event", jp: '各アップデートのイベント', kr: '각 업데이트 이벤트', zh: '每次更新活动' },
        'variable.sideStories': { en: 'New Side Stories every new character (non-premium/limited)', jp: '新キャラクターごとの新サイドストーリー（プレミアム/限定除く）', kr: '새 캐릭터마다 새 사이드 스토리 (프리미엄/한정 제외)', zh: '每个新角色的新外传（精选/限定除外）' },
        'variable.coupons': { en: 'Coupon codes', jp: 'クーポンコード', kr: '쿠폰 코드', zh: '兑换码' },
        'variable.seasonalEvents': { en: 'Seasonal events (story, point shops, login chains)', jp: 'シーズンイベント（ストーリー、ポイントショップ、ログインチェーン）', kr: '시즌 이벤트 (스토리, 포인트 상점, 로그인 체인)', zh: '季节活动（剧情、积分商店、登录链）' },
    } as Record<string, LangMap>,
} as const
