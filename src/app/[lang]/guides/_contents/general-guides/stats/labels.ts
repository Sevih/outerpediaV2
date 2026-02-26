import type { LangMap } from '@/types/common'

export const LABELS = {
    // ── Main ──
    title: { en: 'Stats & Combat Mechanics', jp: 'ステータス＆戦闘メカニクス', kr: '스탯 & 전투 메카닉', zh: '属性 & 战斗机制' } satisfies LangMap,
    intro: { en: 'A comprehensive guide covering stats and combat mechanics in Outerplane.', jp: 'Outerplaneのステータスと戦闘メカニクスを網羅したガイドです。', kr: 'Outerplane의 스탯과 전투 메카닉을 다루는 종합 가이드입니다.', zh: '这是一份关于Outerplane属性和战斗机制的综合指南。' } satisfies LangMap,

    // ── Tabs ──
    tabs: {
        stats: { en: 'Basic Stats', jp: '基本ステータス', kr: '기본 스탯', zh: '基础属性' } satisfies LangMap,
        combat: { en: 'Combat Basics', jp: '戦闘の基本', kr: '전투 기초', zh: '战斗基础' } satisfies LangMap,
        faq: { en: 'FAQ', jp: 'FAQ', kr: 'FAQ', zh: '常见问题' } satisfies LangMap,
    },

    // ── Stats section ──
    statsHeading: { en: 'Core Stats', jp: 'コアステータス', kr: '핵심 스탯', zh: '核心属性' } satisfies LangMap,
    groups: {
        offensive: { en: 'Offensive Stats', jp: '攻撃系ステータス', kr: '공격 스탯', zh: '攻击属性' } satisfies LangMap,
        defensive: { en: 'Defensive Stats', jp: '防御系ステータス', kr: '방어 스탯', zh: '防御属性' } satisfies LangMap,
        utility: { en: 'Utility Stats', jp: 'ユーティリティステータス', kr: '유틸리티 스탯', zh: '功能属性' } satisfies LangMap,
        damageModifiers: { en: 'Damage Modifiers', jp: 'ダメージ修正', kr: '데미지 보정', zh: '伤害修正' } satisfies LangMap,
        effectivenessResilience: { en: 'Effectiveness & Resilience', jp: '効果命中＆効果抵抗', kr: '효과 적중 & 효과 저항', zh: '效果命中 & 效果抵抗' } satisfies LangMap,
    },

    // ── Stat short descriptions ──
    statDesc: {
        ATK: { en: 'The higher your attack, the more damage you deal to enemies.', jp: '攻撃力が高いほど、敵に与えるダメージが増加します。', kr: '공격력이 높을수록 적에게 더 많은 데미지를 줍니다.', zh: '攻击力越高，对敌人造成的伤害越大。' } satisfies LangMap,
        CHC: { en: 'Chance for a critical hit to occur. When a critical hit occurs, the damage dealt is increased according to critical damage.', jp: 'クリティカルヒットが発生する確率。クリティカルヒット時、クリティカルダメージに応じてダメージが増加します。', kr: '치명타가 발생할 확률. 치명타 발생 시 치명타 데미지에 따라 데미지가 증가합니다.', zh: '触发暴击的概率。暴击时根据暴击伤害增加伤害。' } satisfies LangMap,
        CHD: { en: 'Increase Damage upon scoring a critical hit.', jp: 'クリティカルヒット時のダメージ増加量。', kr: '치명타 적중 시 데미지 증가량.', zh: '暴击命中时的伤害增幅。' } satisfies LangMap,
        PEN: { en: "Penetration lets you ignore a portion of the target's Defense.", jp: '貫通により、対象の防御力の一部を無視できます。', kr: '관통으로 대상 방어력의 일부를 무시할 수 있습니다.', zh: '穿透可以忽略目标部分防御力。' } satisfies LangMap,
        HP: { en: 'You can no longer participate in combat once your Health falls below zero.', jp: '体力が0以下になると、戦闘に参加できなくなります。', kr: '체력이 0 이하로 떨어지면 전투에 참여할 수 없습니다.', zh: '生命值降至0以下时无法继续战斗。' } satisfies LangMap,
        DEF: { en: 'The higher your defense, the less damage you take from enemies.', jp: '防御力が高いほど、敵から受けるダメージが減少します。', kr: '방어력이 높을수록 적에게 받는 데미지가 감소합니다.', zh: '防御力越高，受到的伤害越少。' } satisfies LangMap,
        SPD: { en: 'The higher the speed, the more often you can act.', jp: '速度が高いほど、より頻繁に行動できます。', kr: '속도가 높을수록 더 자주 행동할 수 있습니다.', zh: '速度越高，行动越频繁。' } satisfies LangMap,
        'DMG UP': { en: 'Increases damage dealt when attacking.', jp: '攻撃時に与えるダメージが増加します。', kr: '공격 시 주는 피해량이 증가합니다.', zh: '攻击时造成的伤害增加。' } satisfies LangMap,
        'DMG RED': { en: 'Reduces damage taken when hit.', jp: '被弾時に受けるダメージが減少します。', kr: '피격 시 받는 피해량이 감소합니다.', zh: '受到攻击时承受的伤害减少。' } satisfies LangMap,
        'CDMG RED': { en: 'Reduces damage taken when critically hit.', jp: '会心被弾時に受けるダメージが減少します。', kr: '치명 피격 시 받는 피해가 감소합니다.', zh: '被暴击时受到的伤害减少。' } satisfies LangMap,
        EFF: { en: 'The higher the Effectiveness, the lower the chance the target has to resist debuffs.', jp: '効果命中が高いほど、対象がデバフに抵抗する確率が低下します。', kr: '효과 적중이 높을수록 대상이 디버프에 저항할 확률이 낮아집니다.', zh: '效果命中越高，目标抵抗减益的概率越低。' } satisfies LangMap,
        RES: { en: 'The higher the Resilience, the higher the chance to resist debuffs.', jp: '効果抵抗が高いほど、デバフに抵抗する確率が上昇します。', kr: '효과 저항이 높을수록 디버프에 저항할 확률이 증가합니다.', zh: '效果抵抗越高，抵抗减益的概率越高。' } satisfies LangMap,
    },

    // ── FAQ section titles ──
    faqSections: {
        critDots: { en: 'Critical Hits & DoTs', jp: 'クリティカル＆DoT', kr: '치명타 & DoT', zh: '暴击 & DoT' } satisfies LangMap,
        damageModifiers: { en: 'Damage Modifiers', jp: 'ダメージ修正', kr: '데미지 보정', zh: '伤害修正' } satisfies LangMap,
        defensePenetration: { en: 'Defense & Penetration', jp: '防御＆貫通', kr: '방어 & 관통', zh: '防御 & 穿透' } satisfies LangMap,
        statScaling: { en: 'Stat Scaling', jp: 'ステータス依存', kr: '스탯 의존', zh: '属性依赖' } satisfies LangMap,
        speedPriority: { en: 'Speed & Priority', jp: '速度＆優先度', kr: '속도 & 우선도', zh: '速度 & 行动值' } satisfies LangMap,
        formulas: { en: 'Formulas & Calculations', jp: '計算式', kr: '공식 & 계산', zh: '公式 & 计算' } satisfies LangMap,
    },

    // ── FAQ item titles ──
    faqTitles: {
        critCap: { en: 'Can Crit Rate exceed 100%?', jp: 'クリ率は100%を超えられますか？', kr: '치명타 확률이 100%를 초과할 수 있나요?', zh: '暴击率可以超过100%吗？' } satisfies LangMap,
        critOnHeal: { en: 'Can healing or shielding crit?', jp: '回復やシールドはクリティカルしますか？', kr: '힐이나 보호막이 치명타가 되나요?', zh: '治疗或护盾可以暴击吗？' } satisfies LangMap,
        dotCrit: { en: 'Do DoTs scale with Crit or Crit Damage?', jp: 'DoTはクリ率やクリダメに影響されますか？', kr: 'DoT는 치명타 확률이나 치명타 데미지의 영향을 받나요?', zh: 'DoT受暴击率或暴击伤害影响吗？' } satisfies LangMap,
        dotScaling: { en: 'Do DoTs scale with Attack?', jp: 'DoTは攻撃力に影響されますか？', kr: 'DoT는 공격력의 영향을 받나요?', zh: 'DoT受攻击力影响吗？' } satisfies LangMap,
        penVsDots: { en: 'Does Penetration affect DoT or true damage?', jp: '貫通はDoTや固定ダメージに影響しますか？', kr: '관통이 DoT나 고정 데미지에 영향을 주나요?', zh: '穿透影响DoT或固定伤害吗？' } satisfies LangMap,
        dmgUpVsChd: { en: "What's the difference between DMG UP and Crit Damage?", jp: 'DMG UPとクリダメの違いは？', kr: 'DMG UP과 치명타 데미지의 차이는?', zh: 'DMG UP和暴击伤害有什么区别？' } satisfies LangMap,
        dmgRedVsCdmgRed: { en: "What's the difference between DMG RED and CDMG RED?", jp: 'DMG REDとCDMG REDの違いは？', kr: 'DMG RED와 CDMG RED의 차이는?', zh: 'DMG RED和CDMG RED有什么区别？' } satisfies LangMap,
        dmgAdditive: { en: 'How does the additive calculation work?', jp: '加算計算はどう機能しますか？', kr: '합산 계산은 어떻게 작동하나요?', zh: '加算计算如何运作？' } satisfies LangMap,
        dmgRedCap: { en: 'Is there a cap on Damage Reduction?', jp: '', kr: '', zh: '' } satisfies LangMap,
        debuffOnMiss: { en: 'What happens when an attack misses?', jp: '攻撃がミスした場合どうなりますか？', kr: '공격이 미스하면 어떻게 되나요?', zh: '攻击未命中会怎样？' } satisfies LangMap,
        effResFormula: { en: 'Is there a minimum debuff success chance?', jp: 'デバフ成功確率の最低値はありますか？', kr: '디버프 성공 확률의 최솟값이 있나요?', zh: '减益成功率有最低值吗？' } satisfies LangMap,
        penVsHighDef: { en: 'Is Penetration more effective against high DEF?', jp: '貫通は高DEFに対してより効果的ですか？', kr: '관통은 높은 DEF에 더 효과적인가요?', zh: '穿透对高DEF更有效吗？' } satisfies LangMap,
        fixedDamageMitigation: { en: 'Can Defense reduce fixed damage?', jp: '防御力は固定ダメージを軽減できますか？', kr: '방어력이 고정 데미지를 감소시킬 수 있나요?', zh: '防御力能减免固定伤害吗？' } satisfies LangMap,
        dualScaling: { en: 'Can skills scale with more than one stat?', jp: 'スキルは複数のステータスに依存できますか？', kr: '스킬이 여러 스탯에 의존할 수 있나요?', zh: '技能可以依赖多个属性吗？' } satisfies LangMap,
        statScaling: { en: 'How do I know which stats are used for a skill?', jp: 'スキルがどのステータスを使うかはどうやって分かりますか？', kr: '스킬이 어떤 스탯을 사용하는지 어떻게 알 수 있나요?', zh: '如何知道技能使用什么属性？' } satisfies LangMap,
        speedFormula: { en: 'How is speed calculated?', jp: '速度はどう計算されますか？', kr: '속도는 어떻게 계산되나요?', zh: '速度如何计算？' } satisfies LangMap,
        priorityFormula: { en: 'How is turn 1 priority calculated?', jp: '1ターン目の優先度はどう計算されますか？', kr: '1턴 우선도는 어떻게 계산되나요?', zh: '第1回合行动值如何计算？' } satisfies LangMap,
        maxSpeed: { en: 'Max theoretical speed', jp: '理論上の最大速度', kr: '이론상 최대 속도', zh: '理论最大速度' } satisfies LangMap,
        formula: { en: 'How calculations are done', jp: '計算の仕組み', kr: '계산 방식', zh: '计算方法' } satisfies LangMap,
        damageFormula: { en: 'What is the full damage formula in Outerplane?', jp: 'Outerplaneの完全なダメージ計算式は？', kr: 'Outerplane의 전체 데미지 공식은?', zh: 'Outerplane的完整伤害公式是什么？' } satisfies LangMap,
    },

    // ── Simple FAQ answers (string-only, no JSX) ──
    faqContent: {
        critCap: { en: 'No. Crit Rate is capped at 100%. Any excess has no effect.', jp: 'いいえ。クリ率は100%が上限です。超過分は効果がありません。', kr: '아니요. 치명타 확률은 100%가 상한입니다. 초과분은 효과가 없습니다.', zh: '不可以。暴击率上限为100%。超出部分无效。' } satisfies LangMap,
        critOnHeal: { en: 'No. Healing, shielding, and utility skills cannot crit unless explicitly stated. Crit mechanics only apply to damage-dealing skills.', jp: 'いいえ。回復、シールド、ユーティリティスキルは明示されない限りクリティカルしません。クリティカルメカニクスはダメージスキルにのみ適用されます。', kr: '아니요. 힐, 보호막, 유틸리티 스킬은 명시되지 않는 한 치명타가 되지 않습니다. 치명타 메카닉은 데미지 스킬에만 적용됩니다.', zh: '不可以。治疗、护盾和辅助技能除非特别说明，否则不会暴击。暴击机制仅适用于伤害技能。' } satisfies LangMap,
        dotCrit: { en: 'No. Damage over Time effects (burn, bleed, poison, etc.) do not scale with Crit Rate or Crit Damage. They cannot crit.', jp: 'いいえ。継続ダメージ効果（火傷、出血、毒など）はクリ率やクリダメの影響を受けません。クリティカルしません。', kr: '아니요. 지속 데미지 효과(화상, 출혈, 독 등)는 치명타 확률이나 치명타 데미지의 영향을 받지 않습니다. 치명타가 되지 않습니다.', zh: '不受。持续伤害效果（如燃烧、流血、中毒等）不受暴击率或暴击伤害影响。它们不会暴击。' } satisfies LangMap,
        dotScaling: { en: "Yes. Some DoTs scale with the caster's ATK stat, though the scaling ratio is usually lower than for direct damage.", jp: 'はい。一部のDoTは術者の攻撃力に依存しますが、直接ダメージより倍率は低めです。', kr: '네. 일부 DoT는 시전자의 공격력에 의존하지만, 직접 데미지보다 배율이 낮습니다.', zh: '是的。部分DoT依赖施放者的攻击力，但系数比直接伤害低。' } satisfies LangMap,
        dmgUpVsChd: { en: "DMG UP applies on every attack regardless of whether it crits. Crit Damage only applies when a critical hit occurs. On a crit, both are added together (along with any skill/equipment DMG UP bonuses) before being compared to the enemy's defensive pool (DMG RED + CDMG RED + their skill/equipment reductions). All sources are additive within their respective group.", jp: 'DMG UPはクリティカルかどうかに関わらず全ての攻撃に適用されます。クリダメはクリティカルヒット時のみ適用。クリティカル時、両方の値が加算されてから敵の防御修正値（DMG RED + CDMG RED）と比較されます。', kr: 'DMG UP은 치명 여부와 관계없이 모든 공격에 적용됩니다. 치명타 데미지는 치명 발생 시에만 적용. 치명 시 두 값이 합산된 후 적의 방어 보정치(DMG RED + CDMG RED)와 비교됩니다.', zh: 'DMG UP无论是否暴击都适用于所有攻击。暴击伤害仅在暴击时生效。暴击时，两个值相加后与敌方防御修正（DMG RED + CDMG RED）比较。' } satisfies LangMap,
        dmgRedVsCdmgRed: { en: "DMG RED opposes the attacker's DMG UP on every hit — it is subtracted from their Damage Increase total, not applied as a flat percentage. CDMG RED only activates on critical hits. When critically hit, both DMG RED and CDMG RED are summed to counter the attacker's CHD + DMG UP.", jp: 'DMG REDは全ての受けるダメージを軽減し、CDMG REDはクリティカルヒットからのダメージのみ軽減します。クリティカル被弾時、両方の値が加算されて敵のCHD + DMG UPに対抗します。', kr: 'DMG RED는 모든 받는 데미지를 감소시키고, CDMG RED는 치명타 데미지만 감소시킵니다. 치명 피격 시 두 값이 합산되어 적의 CHD + DMG UP에 대항합니다.', zh: 'DMG RED减少所有受到的伤害，CDMG RED仅减少暴击伤害。被暴击时，两个值相加以对抗敌方的CHD + DMG UP。' } satisfies LangMap,
        dmgAdditive: { en: 'All increase-type effects (CHD on crit, DMG UP, skill/equip DMG UP) are summed into one group. All reduction-type effects (CDMG RED on crit, DMG RED, skill/equip DMG RED) are summed into another. The final modifier is: (Total Increase) − (Total Reduction). This result is then applied before Defense and Final Damage modifiers.', jp: '攻撃側：DMG UPがクリダメに加算（クリティカル時）。防御側：DMG REDがCDMG REDに加算（クリティカル時）。攻撃側の合計が防御側の合計と比較され、最終的なダメージ修正が決定されます。', kr: '공격 측: DMG UP이 치명타 데미지에 합산(치명 시). 방어 측: DMG RED가 CDMG RED에 합산(치명 시). 공격 측 합계가 방어 측 합계와 비교되어 최종 데미지 보정이 결정됩니다.', zh: '攻击方：DMG UP与暴击伤害相加（暴击时）。防御方：DMG RED与CDMG RED相加（暴击时）。攻击方总计与防御方总计比较，决定最终伤害修正。' } satisfies LangMap,
        dmgRedCap: { en: 'Currently, there is no cap — meaning extreme DMG RED stacking can reduce boss damage by up to 99% in some cases. However, an upcoming update will introduce a cap of approximately 60–70% on the maximum damage that can be reduced via the DMG RED/CDMG RED system. Defense and Final Damage Reduction will not be affected by this cap.', jp: '', kr: '', zh: '' } satisfies LangMap,
        effResFormula: { en: "No. The success chance depends on the difference between the attacker's Effectiveness (EFF) and the target's Resilience (RES). If EFF ≥ RES, the success chance is 100%. Otherwise, the chance decreases with a lower bound that depends on how much RES exceeds EFF. For example, a RES − EFF difference of 300 leads to a 25% chance, and a difference of 900 leads to only 10%.", jp: 'いいえ。成功確率は攻撃者の効果命中（EFF）と対象の効果抵抗（RES）の差に依存します。EFF ≥ RESなら100%成功。それ以外は、RESがEFFを超える量に応じて確率が下がります。例えば、RES − EFFの差が300なら25%、900なら10%のみです。', kr: '아니요. 성공 확률은 공격자의 효과 적중(EFF)과 대상의 효과 저항(RES) 차이에 의존합니다. EFF ≥ RES면 100% 성공. 그 외에는 RES가 EFF를 초과하는 양에 따라 확률이 감소합니다. 예를 들어, RES − EFF 차이가 300이면 25%, 900이면 10%만 됩니다.', zh: '没有。成功率取决于攻击者的效果命中(EFF)和目标的效果抵抗(RES)之差。EFF ≥ RES时100%成功。否则根据RES超过EFF的量递减。例如，RES − EFF差值为300时只有25%，900时只有10%。' } satisfies LangMap,
        penVsHighDef: { en: "Yes. The more DEF the enemy has, the greater the damage gain from Penetration, since it reduces the effective DEF used in the damage formula.", jp: 'はい。敵のDEFが高いほど、貫通によるダメージ増加が大きくなります。ダメージ計算式で有効DEFを減らすためです。', kr: '네. 적의 DEF가 높을수록 관통으로 인한 데미지 증가가 커집니다. 데미지 공식에서 유효 DEF를 줄이기 때문입니다.', zh: '是的。敌人DEF越高，穿透带来的伤害增幅越大。因为它减少了伤害公式中的有效DEF。' } satisfies LangMap,
        fixedDamageMitigation: { en: 'No. Fixed damage ignores DEF. Only shields or invincibility can prevent it.', jp: 'いいえ。固定ダメージはDEFを無視します。シールドまたは無敵のみで防げます。', kr: '아니요. 고정 데미지는 DEF를 무시합니다. 보호막이나 무적만으로 막을 수 있습니다.', zh: '不能。固定伤害忽略DEF。只能用护盾或无敌来阻挡。' } satisfies LangMap,
    },

    // ── Combat section headings ──
    combatHeadings: {
        priority: { en: 'Turn-Based Priority System', jp: 'ターン制優先度システム', kr: '턴제 우선도 시스템', zh: '回合制行动值系统' } satisfies LangMap,
        turnFlow: { en: 'Turn Flow Breakdown', jp: 'ターンフローの詳細', kr: '턴 흐름 상세', zh: '回合流程详解' } satisfies LangMap,
        firstTurn: { en: 'First Turn Calculation', jp: '1ターン目の計算', kr: '1턴 계산', zh: '第1回合计算' } satisfies LangMap,
        specialMechanics: { en: 'Special Mechanics & Exceptions', jp: '特殊メカニクス＆例外', kr: '특수 메카닉 & 예외', zh: '特殊机制 & 例外' } satisfies LangMap,
    },
} as const
