'use client'

import { useI18n } from '@/lib/contexts/I18nContext'
import { lRec } from '@/lib/i18n/localize'
import parseText from '@/lib/parse-text'
import type { LangMap } from '@/types/common'
import GuideSectionHeading from '@/app/components/guides/GuideSectionHeading'
import ContentCard from '@/app/components/guides/ContentCard'
import Callout from '@/app/components/guides/Callout'
import StatCard, { StatGroup } from '@/app/components/guides/StatCard'
import Accordion from '@/app/components/ui/Accordion'
import type { AccordionItem } from '@/app/components/ui/Accordion'
import InlineIcon from '@/app/components/inline/InlineIcon'
import { LABELS } from './labels'

export type TabKey = 'stats' | 'combat' | 'faq'

/* ════════════════════════════════════════════════════════════════════════════
   STATS CONTENT
   ════════════════════════════════════════════════════════════════════════════ */

export function StatsContent() {
    const { lang } = useI18n()
    return (
        <div className="space-y-8">
            <GuideSectionHeading>{lRec(LABELS.statsHeading, lang)}</GuideSectionHeading>

            {/* Offensive Stats */}
            <StatGroup title={lRec(LABELS.groups.offensive, lang)} color="red">
                <StatCard
                    abbr="ATK"
                    desc={lRec(LABELS.statDesc.ATK, lang)}
                    effect={{ buff: ['BT_STAT|ST_ATK'], debuff: ['BT_STAT|ST_ATK'] }}
                    details={
                        <>
                            <p>{lRec({ en: 'Attack directly increases the raw damage dealt by your skills. However, some skills scale with other stats or ignore Attack entirely.', jp: '攻撃力はスキルの基本ダメージを直接増加させます。ただし、一部のスキルは他のステータスに依存するか、攻撃力を完全に無視します。', kr: '공격력은 스킬의 기본 데미지를 직접 증가시킵니다. 단, 일부 스킬은 다른 스탯에 의존하거나 공격력을 완전히 무시합니다.', zh: '攻击力直接增加技能造成的基础伤害。但部分技能依赖其他属性或完全忽略攻击力。' } satisfies LangMap, lang)}</p>
                            <p className="mt-2">{lRec({ en: 'Some DoTs (damage over time) are impacted by attack:', jp: '一部のDoT（継続ダメージ）は攻撃力の影響を受けます：', kr: '일부 DoT(지속 데미지)는 공격력의 영향을 받습니다:', zh: '部分DoT（持续伤害）受攻击力影响：' } satisfies LangMap, lang)}</p>
                            <ul className="list-disc list-inside ml-4 mt-2">
                                <li>{parseText('{D/BT_DOT_BURN}')}</li>
                                <li>{parseText('{D/BT_DOT_BLEED}')}</li>
                                <li>{parseText('{D/BT_DOT_POISON}')}</li>
                                <li>{parseText('{D/BT_DOT_LIGHTNING}')}</li>
                            </ul>
                        </>
                    }
                />

                <StatCard
                    abbr="CHC"
                    desc={lRec(LABELS.statDesc.CHC, lang)}
                    effect={{ buff: ['BT_STAT|ST_CRITICAL_RATE'], debuff: ['BT_STAT|ST_CRITICAL_RATE'] }}
                    details={
                        <>
                            <p>{lRec({ en: 'By default, most characters start with a low base Crit Chance and must build it through gear, buffs, quirks, or passives. Reaching 100% Crit Chance guarantees that every eligible attack will crit.', jp: 'デフォルトでは、ほとんどのキャラクターは低い基本クリ率から始まり、装備、バフ、特性、パッシブで上げる必要があります。クリ率100%で、対象となる全ての攻撃がクリティカルになります。', kr: '기본적으로 대부분의 캐릭터는 낮은 기본 치명타 확률로 시작하며, 장비, 버프, 특성, 패시브로 올려야 합니다. 치명타 확률 100%에 도달하면 모든 대상 공격이 치명타가 됩니다.', zh: '默认情况下，大多数角色初始暴击率较低，需要通过装备、增益、特性或被动来提升。暴击率达到100%可保证每次符合条件的攻击都暴击。' } satisfies LangMap, lang)}</p>
                            <p className="mt-3 font-semibold">{lRec({ en: 'Important notes:', jp: '重要な注意点：', kr: '중요 참고:', zh: '重要说明：' } satisfies LangMap, lang)}</p>
                            <ul className="list-disc list-inside ml-4 mt-2">
                                <li>{lRec({ en: 'Crit Chance is capped at 100% — any excess is wasted.', jp: 'クリ率は100%が上限で、超過分は無駄になります。', kr: '치명타 확률은 100%가 상한이며, 초과분은 낭비됩니다.', zh: '暴击率上限为100%——超出部分无效。' } satisfies LangMap, lang)}</li>
                                <li>{lRec({ en: 'Healing and Shielding cannot crit.', jp: '回復とシールドはクリティカルしません。', kr: '힐과 보호막은 치명타가 되지 않습니다.', zh: '治疗和护盾不会暴击。' } satisfies LangMap, lang)}</li>
                                <li>{lRec({ en: 'Skills with', jp: '', kr: '', zh: '带有' } satisfies LangMap, lang)} {parseText('{B/HEAVY_STRIKE}')} {lRec({ en: 'effect cannot crit like', jp: '効果を持つスキルはクリティカルしません（', kr: '효과가 있는 스킬은 치명타가 되지 않습니다(', zh: '效果的技能不会暴击，例如' } satisfies LangMap, lang)} {parseText('{SK/Kitsune of Eternity Tamamo-no-Mae|S1}')}{lRec({ en: '.', jp: 'など）。', kr: ' 등).', zh: '。' } satisfies LangMap, lang)}</li>
                                <li>{lRec({ en: 'Damage over Time effects cannot crit.', jp: '継続ダメージ効果はクリティカルしません。', kr: '지속 데미지 효과는 치명타가 되지 않습니다.', zh: '持续伤害效果不会暴击。' } satisfies LangMap, lang)}</li>
                            </ul>
                        </>
                    }
                />

                <StatCard
                    abbr="CHD"
                    desc={lRec(LABELS.statDesc.CHD, lang)}
                    effect={{ buff: ['BT_STAT|ST_CRITICAL_DMG_RATE'], debuff: ['BT_STAT|ST_CRITICAL_DMG_RATE'] }}
                    details={
                        <>
                            <p>{lRec({ en: 'Crit Damage determines how much bonus damage is applied when you land a critical hit. The formula typically multiplies your base damage by a percentage defined by your Crit Dmg stat.', jp: 'クリダメはクリティカルヒット時に適用されるボーナスダメージを決定します。計算式は通常、基本ダメージにクリダメ%を乗算します。', kr: '치명타 데미지는 치명타 적중 시 적용되는 보너스 데미지를 결정합니다. 계산식은 보통 기본 데미지에 치명타 데미지%를 곱합니다.', zh: '暴击伤害决定暴击命中时施加的额外伤害。公式通常将基础伤害乘以暴击伤害百分比。' } satisfies LangMap, lang)}</p>
                            <p className="mt-2">{lRec({ en: 'All units start with a base Crit Damage of', jp: '全てのユニットは基本クリダメ', kr: '모든 유닛은 기본 치명타 데미지', zh: '所有单位初始暴击伤害为' } satisfies LangMap, lang)} <strong>150%</strong>{lRec({ en: '.', jp: 'から始まります。', kr: '로 시작합니다.', zh: '。' } satisfies LangMap, lang)}</p>
                            <p className="mt-2 text-yellow-400">{lRec({ en: "Investing in Crit Damage isn't worthwhile if your Crit Chance is low.", jp: 'クリ率が低い場合、クリダメに投資する価値はありません。', kr: '치명타 확률이 낮으면 치명타 데미지에 투자할 가치가 없습니다.', zh: '如果暴击率低，投资暴击伤害不划算。' } satisfies LangMap, lang)}</p>
                        </>
                    }
                />

                <StatCard
                    abbr="PEN%"
                    desc={lRec(LABELS.statDesc.PEN, lang)}
                    effect={{ buff: ['BT_STAT|ST_PIERCE_POWER_RATE'], debuff: ['BT_STAT|ST_PIERCE_POWER_RATE'] }}
                    details={
                        <>
                            <p>{lRec({ en: "Penetration ignores a percentage of the enemy's Defense (DEF) when calculating how much damage your attacks deal. The higher your PEN, the less DEF is counted in the damage reduction formula.", jp: '貫通は、ダメージ計算時に敵の防御力（DEF）の一定割合を無視します。貫通が高いほど、ダメージ軽減計算でのDEFの影響が小さくなります。', kr: '관통은 데미지 계산 시 적의 방어력(DEF)의 일정 비율을 무시합니다. 관통이 높을수록 데미지 감소 계산에서 DEF의 영향이 줄어듭니다.', zh: '穿透在计算攻击伤害时忽略敌人部分防御力（DEF）。穿透越高，伤害减免公式中计入的DEF越少。' } satisfies LangMap, lang)}</p>
                            <p className="mt-2">{lRec({ en: 'For example, if your target has', jp: '例えば、対象が', kr: '예를 들어, 대상이', zh: '例如，目标有' } satisfies LangMap, lang)} <strong>2000 DEF</strong> {lRec({ en: 'and you have', jp: 'で、あなたが', kr: '이고, 당신이', zh: '而你有' } satisfies LangMap, lang)} <strong>20% PEN</strong>{lRec({ en: ', it will behave as if they only had', jp: 'を持っている場合、対象は', kr: '을 가지고 있으면, 대상은', zh: '时，效果等同于目标只有' } satisfies LangMap, lang)} <strong>1600 DEF</strong>{lRec({ en: '.', jp: 'しか持っていないかのように扱われます。', kr: '만 가진 것처럼 처리됩니다.', zh: '。' } satisfies LangMap, lang)}</p>
                            <p className="mt-2">{lRec({ en: 'Penetration becomes more valuable against tanky enemies with high DEF.', jp: '貫通は高DEFの耐久型の敵に対してより効果的です。', kr: '관통은 높은 DEF의 탱커형 적에게 더 효과적입니다.', zh: '穿透对高防御的肉盾型敌人更有价值。' } satisfies LangMap, lang)}</p>
                            <p className="mt-3 text-sm text-yellow-400">
                                <strong>{lRec({ en: 'Note:', jp: '注意：', kr: '참고:', zh: '注意：' } satisfies LangMap, lang)}</strong> {lRec({ en: 'If the enemy has 0 defense (like in joint battle), penetration becomes useless.', jp: '敵の防御力が0の場合（共同戦闘など）、貫通は無意味になります。', kr: '적의 방어력이 0이면(합동 전투 등) 관통은 무의미해집니다.', zh: '如果敌人防御为0（如联合战斗），穿透将毫无用处。' } satisfies LangMap, lang)}
                            </p>
                        </>
                    }
                />
            </StatGroup>

            {/* Defensive Stats */}
            <StatGroup title={lRec(LABELS.groups.defensive, lang)} color="blue">
                <StatCard
                    abbr="HP"
                    desc={lRec(LABELS.statDesc.HP, lang)}
                    details={
                        <>
                            <p>{lRec({ en: 'Health represents the total amount of damage a unit can take before being defeated. Once HP reaches 0, the unit is immediately removed from combat.', jp: '体力は、ユニットが倒されるまでに受けられるダメージの総量を表します。HPが0になると、そのユニットは即座に戦闘から除外されます。', kr: '체력은 유닛이 쓰러지기 전 받을 수 있는 총 데미지량입니다. HP가 0이 되면 즉시 전투에서 제외됩니다.', zh: '生命值代表单位被击败前可承受的总伤害量。HP归零时立即退出战斗。' } satisfies LangMap, lang)}</p>
                            <p className="mt-2">{lRec({ en: 'Like Attack, some skills scale with HP, such as', jp: '攻撃力と同様に、一部のスキルはHPに依存します（', kr: '공격력처럼 일부 스킬은 HP에 의존합니다(', zh: '与攻击力类似，部分技能依赖HP，例如' } satisfies LangMap, lang)} {parseText('{SK/Demiurge Drakhan|S1}')}{lRec({ en: '.', jp: 'など）。', kr: ' 등).', zh: '。' } satisfies LangMap, lang)}</p>
                            <p className="mt-3">{lRec({ en: 'You can replenish HP with healing skills, and protect it with buffs like:', jp: '回復スキルでHPを補充し、以下のようなバフで保護できます：', kr: '힐 스킬로 HP를 회복하고, 다음 버프로 보호할 수 있습니다:', zh: '可以用治疗技能补充HP，并用以下增益保护：' } satisfies LangMap, lang)}</p>
                            <ul className="list-disc list-inside ml-4 mt-2">
                                <li>{parseText('{B/BT_SHIELD_BASED_CASTER}')}</li>
                                <li>{parseText('{B/BT_INVINCIBLE}')}</li>
                                <li>{parseText('{B/BT_UNDEAD}')}</li>
                            </ul>
                        </>
                    }
                />

                <StatCard
                    abbr="DEF"
                    desc={lRec(LABELS.statDesc.DEF, lang)}
                    effect={{ buff: ['BT_STAT|ST_DEF'], debuff: ['BT_STAT|ST_DEF'] }}
                    details={
                        <>
                            <p>{lRec({ en: 'Defense reduces the amount of damage taken from most sources. Some skills scale with defense like', jp: '防御力はほとんどのソースから受けるダメージを軽減します。一部のスキルは防御力に依存します（', kr: '방어력은 대부분의 소스에서 받는 데미지를 줄입니다. 일부 스킬은 방어력에 의존합니다(', zh: '防御力减少大部分来源的受到伤害。部分技能依赖防御力，例如' } satisfies LangMap, lang)} {parseText('{SK/Caren|S3}')}{lRec({ en: '.', jp: 'など）。', kr: ' 등).', zh: '。' } satisfies LangMap, lang)}</p>
                            <p className="mt-3">{lRec({ en: 'However, some in-game mechanics can partially or completely ignore DEF, such as:', jp: 'ただし、一部のゲーム内メカニクスはDEFを部分的または完全に無視できます：', kr: '하지만 일부 게임 메카닉은 DEF를 부분적 또는 완전히 무시할 수 있습니다:', zh: '但部分游戏机制可以部分或完全忽略DEF，例如：' } satisfies LangMap, lang)}</p>
                            <ul className="list-disc list-inside ml-4 mt-2">
                                <li>{parseText('{D/BT_DOT_BURN}')}</li>
                                <li>{parseText('{B/BT_STAT|ST_PIERCE_POWER_RATE}')}</li>
                                <li>{parseText('{D/BT_FIXED_DAMAGE}')}</li>
                            </ul>
                        </>
                    }
                />
            </StatGroup>

            {/* Utility Stats */}
            <StatGroup title={lRec(LABELS.groups.utility, lang)} color="green">
                <StatCard
                    abbr="SPD"
                    desc={lRec(LABELS.statDesc.SPD, lang)}
                    effect={{ buff: ['BT_STAT|ST_SPEED'], debuff: ['BT_STAT|ST_SPEED'] }}
                    details={
                        <>
                            <p>{lRec({ en: "Speed determines how quickly a unit's turn comes. The higher the SPD, the more frequently a unit can act during combat.", jp: '速度は、ユニットのターンがどれだけ早く来るかを決定します。SPDが高いほど、戦闘中により頻繁に行動できます。', kr: '속도는 유닛의 턴이 얼마나 빨리 오는지 결정합니다. SPD가 높을수록 전투 중 더 자주 행동할 수 있습니다.', zh: '速度决定单位多快轮到行动。SPD越高，战斗中行动越频繁。' } satisfies LangMap, lang)}</p>
                            <p className="mt-2">{lRec({ en: 'Like Attack, some skills scale with SPD, such as', jp: '攻撃力と同様に、一部のスキルはSPDに依存します（', kr: '공격력처럼 일부 스킬은 SPD에 의존합니다(', zh: '与攻击力类似，部分技能依赖SPD，例如' } satisfies LangMap, lang)} {parseText('{SK/Stella|S2}')}{lRec({ en: '.', jp: 'など）。', kr: ' 등).', zh: '。' } satisfies LangMap, lang)}</p>
                            <p className="mt-3 text-yellow-400">{lRec({ en: 'Further details are provided in the', jp: '速度は「優先度」の概念と直接関連しているため、詳細は', kr: '속도는 "우선도" 개념과 직접 연결되어 있으므로, 자세한 내용은 ', zh: '速度与"行动值"概念直接相关，详见' } satisfies LangMap, lang)} <strong>{lRec({ en: 'Combat Basics', jp: '戦闘の基本', kr: '전투 기초', zh: '战斗基础' } satisfies LangMap, lang)}</strong> {lRec({ en: 'section, since Speed is directly linked to the concept of \u201cPriority\u201d.', jp: 'セクションで説明します。', kr: '섹션에서 설명합니다.', zh: '部分。' } satisfies LangMap, lang)}</p>
                        </>
                    }
                />
            </StatGroup>

            {/* Damage Modifiers */}
            <StatGroup title={lRec(LABELS.groups.damageModifiers, lang)} color="purple">
                <StatCard
                    abbr="DMG UP%"
                    desc={lRec(LABELS.statDesc['DMG UP'], lang)}
                    details={
                        <>
                            {lang === 'en' ? (
                                <>
                                    <p>Damage Increase boosts the damage you deal when attacking. It is part of an <strong>additive system</strong> where all increase-type and reduction-type effects are summed, then subtracted from each other — not multiplied independently.</p>
                                    <p className="mt-3 font-semibold">Additive formula:</p>
                                    <p className="text-sm font-mono bg-black/40 p-2 rounded border border-white/10 w-fit mt-2">
                                        (CHD + DMG UP + Skill/Equip DMG UP) − (CDMG RED + DMG RED + Skill/Equip DMG RED) = Final modifier
                                    </p>
                                    <p className="mt-3 font-semibold">How it works:</p>
                                    <ul className="list-disc list-inside ml-4 mt-2">
                                        <li>On a non-crit hit: {parseText('{S/DMG UP}')} (+ any skill/equip bonuses) is opposed by the enemy&apos;s {parseText('{S/DMG RED}')} (+ their skill/equip reductions).</li>
                                        <li>On a crit hit: {parseText('{S/DMG UP}')} is added to your {parseText('{S/CHD}')}, and the enemy adds their {parseText('{S/CDMG RED}')} to their {parseText('{S/DMG RED}')}. Both totals are then compared.</li>
                                    </ul>
                                    <p className="mt-3 text-sm text-yellow-400"><strong>Note:</strong> Damage Increase from quirks, skills, and equipment effects are all part of this same additive pool.</p>
                                </>
                            ) : (
                                <>
                                    <p>{lRec({ en: '', jp: 'ダメージ増加は攻撃時に与えるダメージを上昇させます。このステータスは自身の会心ダメージ（会心発生時）と', kr: '피해 증가는 공격 시 주는 데미지를 높입니다. 이 스탯은 자신의 치명타 데미지(치명 발생 시)와 ', zh: '伤害增加提升攻击时造成的伤害。该属性与自身的暴击伤害（发生暴击时）' } satisfies LangMap, lang)}<strong>{lRec({ en: '', jp: '加算', kr: '합산', zh: '相加' } satisfies LangMap, lang)}</strong>{lRec({ en: '', jp: 'され、敵の会心ダメージ減少および被ダメージ減少と共に計算されます。', kr: '되어, 적의 치명 피해 감소 및 받는 피해 감소와 함께 계산됩니다.', zh: '，并与敌方的暴击伤害减免及受到伤害减少一起计算。' } satisfies LangMap, lang)}</p>
                                    <p className="mt-3 font-semibold">{lRec({ en: '', jp: '仕組み：', kr: '작동 방식:', zh: '运作方式：' } satisfies LangMap, lang)}</p>
                                    <ul className="list-disc list-inside ml-4 mt-2">
                                        <li>{lRec({ en: '', jp: '非クリティカル時：DMG UPがこの層の唯一のボーナス。', kr: '비치명 시: DMG UP이 이 층의 유일한 보너스.', zh: '非暴击时：DMG UP是该层唯一的加成。' } satisfies LangMap, lang)}</li>
                                        <li>{lRec({ en: '', jp: 'クリティカル時：DMG UPが', kr: '치명 시: DMG UP이 ', zh: '暴击时：DMG UP与' } satisfies LangMap, lang)}{parseText('{S/CHD}')}{lRec({ en: '', jp: 'に加算され、敵の', kr: '에 합산되어 적의 ', zh: '相加后，与敌方的' } satisfies LangMap, lang)}{parseText('{S/DMG RED}')}{lRec({ en: '', jp: 'と', kr: '와 ', zh: '和' } satisfies LangMap, lang)}{parseText('{S/CDMG RED}')}{lRec({ en: '', jp: 'と比較されます。', kr: '와 비교됩니다.', zh: '比较。' } satisfies LangMap, lang)}</li>
                                    </ul>
                                </>
                            )}
                        </>
                    }
                />

                <StatCard
                    abbr="DMG RED%"
                    desc={lRec(LABELS.statDesc['DMG RED'], lang)}
                    details={
                        <>
                            {lang === 'en' ? (
                                <>
                                    <p>Damage Reduction is <strong>not</strong> a standalone flat percentage reduction. It is part of the same additive system as {parseText('{S/DMG UP}')} — it is subtracted from the attacker&apos;s total Damage Increase group. This layer is calculated <strong>before</strong> Defense.</p>
                                    <p className="mt-3 font-semibold">Example (non-crit):</p>
                                    <p className="mt-1">If the attacker has <strong>50% DMG UP</strong> and you have <strong>30% DMG RED</strong>, the net modifier is <strong>+20%</strong> damage increase (not a flat 30% reduction).</p>
                                    <p className="mt-3 font-semibold">On a crit hit:</p>
                                    <p className="mt-1">{parseText('{S/DMG RED}')} is added to your {parseText('{S/CDMG RED}')} to oppose the enemy&apos;s {parseText('{S/CHD}')} + {parseText('{S/DMG UP}')}.</p>
                                    <p className="mt-3 text-sm text-yellow-400"><strong>Note:</strong> This is not the same as Final Damage Reduction, which is applied separately after Defense.</p>
                                </>
                            ) : (
                                <>
                                    <p>{lRec({ en: '', jp: '被ダメージ減少は受けるダメージを割合で軽減します。この軽減はダメージ計算において防御力（DEF）', kr: '받는 피해 감소는 받는 데미지를 비율로 줄입니다. 이 감소는 데미지 계산에서 방어력(DEF) ', zh: '受到伤害减少按比例降低所有受到的伤害。该减免在伤害计算中于防御力（DEF）' } satisfies LangMap, lang)}<strong>{lRec({ en: '', jp: 'より前', kr: '이전에', zh: '之前' } satisfies LangMap, lang)}</strong>{lRec({ en: '', jp: 'に適用されます。', kr: ' 적용됩니다.', zh: '生效。' } satisfies LangMap, lang)}</p>
                                    <p className="mt-3 font-semibold">{lRec({ en: '', jp: '例：', kr: '예시:', zh: '示例：' } satisfies LangMap, lang)}</p>
                                    <p className="mt-1"><strong>{lRec({ en: '', jp: 'DMG RED 30%', kr: 'DMG RED 30%', zh: 'DMG RED 30%' } satisfies LangMap, lang)}</strong>{lRec({ en: '', jp: 'で1000ダメージを受けた場合、DEF計算前に', kr: '일 때 1000 데미지를 받으면, DEF 계산 전에 ', zh: '时受到1000伤害，在DEF计算前减少至' } satisfies LangMap, lang)}<strong>{lRec({ en: '', jp: '700', kr: '700', zh: '700' } satisfies LangMap, lang)}</strong>{lRec({ en: '', jp: 'に軽減されます。', kr: '으로 감소됩니다.', zh: '。' } satisfies LangMap, lang)}</p>
                                    <p className="mt-3 font-semibold">{lRec({ en: '', jp: 'クリティカル被弾時：', kr: '치명 피격 시:', zh: '被暴击时：' } satisfies LangMap, lang)}</p>
                                    <p className="mt-1">{lRec({ en: '', jp: 'DMG REDは', kr: 'DMG RED가 ', zh: 'DMG RED与' } satisfies LangMap, lang)}{parseText('{S/CDMG RED}')}{lRec({ en: '', jp: 'に加算され、敵の', kr: '에 합산되어 적의 ', zh: '相加，形成对敌方' } satisfies LangMap, lang)}{parseText('{S/CHD}')} + {parseText('{S/DMG UP}')}{lRec({ en: '', jp: 'に対する総防御修正値を形成します。', kr: '에 대한 총 방어 보정치를 형성합니다.', zh: '的总防御修正。' } satisfies LangMap, lang)}</p>
                                    <p className="mt-3 text-sm text-yellow-400"><strong>{lRec({ en: '', jp: '注意：', kr: '참고:', zh: '注意：' } satisfies LangMap, lang)}</strong> {lRec({ en: '', jp: 'これは最終ダメージ軽減とは異なります。計算方法が違います。', kr: '이것은 최종 데미지 감소와는 다릅니다. 계산 방식이 다릅니다.', zh: '这与最终伤害减免不同，两者的计算方式有区别。' } satisfies LangMap, lang)}</p>
                                </>
                            )}
                        </>
                    }
                />

                <StatCard
                    abbr="CDMG RED%"
                    desc={lRec(LABELS.statDesc['CDMG RED'], lang)}
                    details={
                        <>
                            {lang === 'en' ? (
                                <>
                                    <p>Critical Damage Reduction only activates when you are critically hit. It is added to your {parseText('{S/DMG RED}')} to form the total defensive pool, which is subtracted from the attacker&apos;s offensive pool ({parseText('{S/CHD}')} + {parseText('{S/DMG UP}')}).</p>
                                    <p className="mt-3 font-semibold">Example:</p>
                                    <p className="mt-1">If the enemy has <strong>300% CHD</strong> + <strong>30% DMG UP</strong> and you have <strong>150% CDMG RED</strong> + <strong>20% DMG RED</strong>:</p>
                                    <p className="mt-1">(300 + 30) − (150 + 20) = <strong>+160%</strong> effective damage modifier.</p>
                                    <p className="mt-3 text-sm text-yellow-400"><strong>Note:</strong> CDMG RED has no effect on non-crit hits.</p>
                                </>
                            ) : (
                                <>
                                    <p>{lRec({ en: '', jp: '会心ダメージ減少は、会心被弾時に敵の有効', kr: '치명 피해 감소는 치명 피격 시 적의 유효 ', zh: '暴击伤害减免在被暴击时直接降低敌方的有效' } satisfies LangMap, lang)}{parseText('{S/CHD}')}{lRec({ en: '', jp: 'を直接減少させます。', kr: '를 직접 감소시킵니다.', zh: '。' } satisfies LangMap, lang)}</p>
                                    <p className="mt-3 font-semibold">{lRec({ en: '', jp: '例：', kr: '예시:', zh: '示例：' } satisfies LangMap, lang)}</p>
                                    <p className="mt-1">{lRec({ en: '', jp: '敵の', kr: '적의 ', zh: '敌方' } satisfies LangMap, lang)}<strong>{lRec({ en: '', jp: 'CHD 300%', kr: 'CHD 300%', zh: 'CHD 300%' } satisfies LangMap, lang)}</strong>{lRec({ en: '', jp: 'に対して', kr: '에 대해 ', zh: '，你拥有' } satisfies LangMap, lang)}<strong>{lRec({ en: '', jp: 'CDMG RED 150%', kr: 'CDMG RED 150%', zh: 'CDMG RED 150%' } satisfies LangMap, lang)}</strong>{lRec({ en: '', jp: 'を持つ場合、受ける会心ダメージは300%ではなく', kr: '를 가지고 있으면, 받는 치명 데미지가 300%가 아닌 ', zh: '时，受到的暴击伤害从300%降至' } satisfies LangMap, lang)}<strong>{lRec({ en: '', jp: '150%', kr: '150%', zh: '150%' } satisfies LangMap, lang)}</strong>{lRec({ en: '', jp: 'に減少します。', kr: '로 감소합니다.', zh: '。' } satisfies LangMap, lang)}</p>
                                    <p className="mt-3 font-semibold">{lRec({ en: '', jp: 'クリティカル被弾時：', kr: '치명 피격 시:', zh: '被暴击时：' } satisfies LangMap, lang)}</p>
                                    <p className="mt-1">{lRec({ en: '', jp: 'CDMG REDは', kr: 'CDMG RED가 ', zh: 'CDMG RED与' } satisfies LangMap, lang)}{parseText('{S/DMG RED}')}{lRec({ en: '', jp: 'に加算され、敵の', kr: '에 합산되어 적의 ', zh: '相加，形成对敌方' } satisfies LangMap, lang)}{parseText('{S/CHD}')} + {parseText('{S/DMG UP}')}{lRec({ en: '', jp: 'に対する総防御修正値を形成します。', kr: '에 대한 총 방어 보정치를 형성합니다.', zh: '的总防御修正。' } satisfies LangMap, lang)}</p>
                                </>
                            )}
                        </>
                    }
                />
            </StatGroup>

            {/* Effectiveness & Resilience */}
            <StatGroup title={lRec(LABELS.groups.effectivenessResilience, lang)} color="amber">
                <StatCard
                    abbr="EFF"
                    desc={lRec(LABELS.statDesc.EFF, lang)}
                    effect={{ buff: ['BT_STAT|ST_BUFF_CHANCE'], debuff: ['BT_STAT|ST_BUFF_CHANCE'] }}
                    details={
                        <>
                            <p>{lRec({ en: 'Effectiveness increases the chance of successfully applying debuffs and is countered by', jp: '効果命中はデバフ付与の成功確率を上げ、', kr: '효과 적중은 디버프 부여 성공 확률을 높이며, ', zh: '效果命中增加成功施加减益的概率，被' } satisfies LangMap, lang)} {parseText('{S/RES}')}{lRec({ en: '.', jp: 'で対抗されます。', kr: '로 대응됩니다.', zh: '对抗。' } satisfies LangMap, lang)}</p>
                            <p className="mt-2">{lRec({ en: "If your Effectiveness is equal to or higher than the enemy's Resilience, the base chance to apply a debuff is 100%.", jp: '効果命中が敵の効果抵抗以上の場合、デバフ付与の基本確率は100%です。', kr: '효과 적중이 적의 효과 저항 이상이면 디버프 부여 기본 확률은 100%입니다.', zh: '当效果命中大于等于敌人效果抵抗时，减益施加基础概率为100%。' } satisfies LangMap, lang)}</p>
                            <p className="mt-2">{lRec({ en: "Some skills can scale with Effectiveness, such as", jp: '一部のスキルは効果命中に依存します（', kr: '일부 스킬은 효과 적중에 의존합니다(', zh: '部分技能依赖效果命中，例如' } satisfies LangMap, lang)} {parseText('{P/Gnosis Beth}')}{lRec({ en: "'s", jp: 'の', kr: '의 ', zh: '的' } satisfies LangMap, lang)} {parseText('{D/BT_DOT_2000092}')}{lRec({ en: '.', jp: 'など）。', kr: ' 등).', zh: '。' } satisfies LangMap, lang)}</p>
                        </>
                    }
                />

                <StatCard
                    abbr="RES"
                    desc={lRec(LABELS.statDesc.RES, lang)}
                    effect={{ buff: ['BT_STAT|ST_BUFF_RESIST'], debuff: ['BT_STAT|ST_BUFF_RESIST'] }}
                    details={
                        <>
                            <p>{lRec({ en: 'Resilience reduces the chance of receiving debuffs and is countered by', jp: '効果抵抗はデバフを受ける確率を下げ、', kr: '효과 저항은 디버프를 받을 확률을 낮추며, ', zh: '效果抵抗降低被施加减益的概率，被' } satisfies LangMap, lang)} {parseText('{S/EFF}')}{lRec({ en: '. You can be immune to debuff with the', jp: 'で対抗されます。', kr: '로 대응됩니다. ', zh: '对抗。' } satisfies LangMap, lang)} {parseText('{B/BT_IMMUNE}')}{lRec({ en: ' buff.', jp: 'バフでデバフ無効になれます。', kr: '버프로 디버프 면역이 됩니다.', zh: '增益可使你免疫减益。' } satisfies LangMap, lang)}</p>
                            <p className="mt-3">{lRec({ en: "When your RES is higher than the enemy's EFF:", jp: '効果抵抗が敵の効果命中より高い場合：', kr: '효과 저항이 적의 효과 적중보다 높을 때:', zh: '当效果抵抗高于敌人效果命中时：' } satisfies LangMap, lang)}</p>
                            <ul className="list-disc list-inside ml-4 mt-2">
                                <li>RES − EFF = 0 → 100%{lRec({ en: ' chance', jp: '確率', kr: ' 확률', zh: '概率' } satisfies LangMap, lang)}</li>
                                <li>RES − EFF = 100 → 50%</li>
                                <li>RES − EFF = 300 → 25%</li>
                                <li>RES − EFF = 900 → 10%</li>
                            </ul>
                            <p className="mt-3 text-yellow-400">{lRec({ en: 'Note: Some skills bypass the resilience check like', jp: '注意：一部のスキルは効果抵抗チェックを回避します（', kr: '참고: 일부 스킬은 효과 저항 체크를 우회합니다(', zh: '注意：部分技能绕过效果抵抗检定，例如' } satisfies LangMap, lang)} {parseText('{SK/Drakhan|S2}')}{lRec({ en: '.', jp: 'など）。', kr: ' 등).', zh: '。' } satisfies LangMap, lang)}</p>
                        </>
                    }
                />
            </StatGroup>
        </div>
    )
}

/* ════════════════════════════════════════════════════════════════════════════
   FAQ CONTENT
   ════════════════════════════════════════════════════════════════════════════ */

export function FAQContent() {
    const { lang } = useI18n()

    const critDotsItems: AccordionItem[] = [
        { key: 'crit-cap', title: lRec(LABELS.faqTitles.critCap, lang), content: lRec(LABELS.faqContent.critCap, lang) },
        { key: 'crit-on-heal', title: lRec(LABELS.faqTitles.critOnHeal, lang), content: lRec(LABELS.faqContent.critOnHeal, lang) },
        { key: 'dot-crit', title: lRec(LABELS.faqTitles.dotCrit, lang), content: lRec(LABELS.faqContent.dotCrit, lang) },
        { key: 'dot-scaling', title: lRec(LABELS.faqTitles.dotScaling, lang), content: lRec(LABELS.faqContent.dotScaling, lang) },
        {
            key: 'pen-vs-dots',
            title: lRec(LABELS.faqTitles.penVsDots, lang),
            content: (
                <>
                    <p>{lRec({ en: 'It depends on the DoT type. Some DoTs are reduced by DEF and therefore benefit from Penetration:', jp: 'DoTの種類によります。DEFで軽減されるDoTは貫通の恩恵を受けます：', kr: 'DoT 종류에 따라 다릅니다. DEF로 감소되는 DoT는 관통의 혜택을 받습니다:', zh: '取决于DoT类型。被DEF减免的DoT受穿透加成：' } satisfies LangMap, lang)}</p>
                    <ul className="list-disc list-inside ml-4 mt-2">
                        <li>{parseText('{D/BT_DOT_BLEED}')}</li>
                        <li>{parseText('{D/BT_DOT_POISON}')}</li>
                        <li>{parseText('{D/BT_DOT_LIGHTNING}')}</li>
                    </ul>
                    <p className="mt-3">{lRec({ en: 'However, some DoTs ignore DEF entirely and are unaffected by Penetration:', jp: 'ただし、DEFを完全に無視し、貫通の影響を受けないDoTもあります：', kr: '하지만 DEF를 완전히 무시하고 관통의 영향을 받지 않는 DoT도 있습니다:', zh: '但部分DoT完全忽略DEF，不受穿透影响：' } satisfies LangMap, lang)}</p>
                    <ul className="list-disc list-inside ml-4 mt-2">
                        <li>{parseText('{D/BT_DOT_BURN}')}</li>
                        <li>{parseText('{D/BT_DOT_CURSE}')}</li>
                        <li>{parseText('{D/BT_DOT_2000092}')}</li>
                    </ul>
                    <p className="mt-3">{lRec({ en: 'Fixed damage always ignores DEF and is unaffected by Penetration.', jp: '固定ダメージは常にDEFを無視し、貫通の影響を受けません。', kr: '고정 데미지는 항상 DEF를 무시하며 관통의 영향을 받지 않습니다.', zh: '固定伤害始终忽略DEF，不受穿透影响。' } satisfies LangMap, lang)}</p>
                </>
            ),
        },
    ]

    const dmgModItems: AccordionItem[] = [
        { key: 'dmg-up-vs-chd', title: lRec(LABELS.faqTitles.dmgUpVsChd, lang), content: lRec(LABELS.faqContent.dmgUpVsChd, lang) },
        { key: 'dmg-red-vs-cdmg-red', title: lRec(LABELS.faqTitles.dmgRedVsCdmgRed, lang), content: lRec(LABELS.faqContent.dmgRedVsCdmgRed, lang) },
        { key: 'dmg-additive', title: lRec(LABELS.faqTitles.dmgAdditive, lang), content: lRec(LABELS.faqContent.dmgAdditive, lang) },
        ...(lang === 'en' ? [{
            key: 'dmg-red-cap',
            title: lRec(LABELS.faqTitles.dmgRedCap, lang),
            content: lRec(LABELS.faqContent.dmgRedCap, lang),
        }] : []),
        {
            key: 'debuff-on-miss',
            title: lRec(LABELS.faqTitles.debuffOnMiss, lang),
            content: (
                <>
                    <p>{lRec({ en: 'When a miss occurs, the attack deals', jp: 'ミス発生時、攻撃のダメージが', kr: '미스 발생 시 공격 데미지가 ', zh: '未命中时，攻击伤害' } satisfies LangMap, lang)} <strong>{lRec({ en: '50% reduced damage', jp: '50%減少', kr: '50% 감소', zh: '减少50%' } satisfies LangMap, lang)}</strong>{lRec({ en: ', and neither debuffs nor critical hits can occur.', jp: 'し、デバフもクリティカルも発生しません。', kr: '하며, 디버프와 치명타 모두 발생하지 않습니다.', zh: '，且不会触发减益和暴击。' } satisfies LangMap, lang)}</p>
                    <p className="mt-2">{lRec({ en: 'A miss can occur when the attacker is affected by effects like', jp: '', kr: '', zh: '通过' } satisfies LangMap, lang)} {parseText('{B/SYS_BUFF_AVOID_UP}')}{lRec({ en: ', which increases the miss rate by 15%.', jp: 'などの効果により、ミス率が15%上昇することでミスが発生します。', kr: ' 등의 효과로 빗나감 확률이 15% 증가하여 미스가 발생할 수 있습니다.', zh: '等效果使未命中率提升15%，可导致未命中发生。' } satisfies LangMap, lang)}</p>
                </>
            ),
        },
        { key: 'eff-res-formula', title: lRec(LABELS.faqTitles.effResFormula, lang), content: lRec(LABELS.faqContent.effResFormula, lang) },
    ]

    const defPenItems: AccordionItem[] = [
        { key: 'pen-vs-high-def', title: lRec(LABELS.faqTitles.penVsHighDef, lang), content: lRec(LABELS.faqContent.penVsHighDef, lang) },
        { key: 'fixed-damage-mitigation', title: lRec(LABELS.faqTitles.fixedDamageMitigation, lang), content: lRec(LABELS.faqContent.fixedDamageMitigation, lang) },
    ]

    const statScalingItems: AccordionItem[] = [
        {
            key: 'dual-scaling',
            title: lRec(LABELS.faqTitles.dualScaling, lang),
            content: (
                <>
                    <p>{lRec({ en: 'Not exactly. Outerplane does not currently feature skills that use two stats evenly (e.g., 50% ATK + 50% HP). What is often referred to as \u201cdual-scaling\u201d is actually', jp: '正確には違います。Outerplaneには現在、2つのステータスを均等に使うスキル（例：50% ATK + 50% HP）はありません。「デュアルスケーリング」と呼ばれるものは実際には', kr: '정확히는 아닙니다. Outerplane에는 현재 두 스탯을 균등하게 사용하는 스킬(예: 50% ATK + 50% HP)이 없습니다. "듀얼 스케일링"이라고 불리는 것은 실제로 ', zh: '严格来说不能。Outerplane目前没有均匀使用两个属性的技能（如50% ATK + 50% HP）。所谓的"双重依赖"实际上是' } satisfies LangMap, lang)} <strong>{lRec({ en: 'secondary scaling', jp: '副次依存', kr: '부차 의존', zh: '次要依赖' } satisfies LangMap, lang)}</strong>{lRec({ en: ' — a main stat (usually ATK), with a minor bonus from another stat like HP or SPD.', jp: 'です — メインステータス（通常ATK）に、HPやSPDなどの副次ボーナスが加わります。', kr: '입니다 — 메인 스탯(보통 ATK)에 HP나 SPD 등의 부차 보너스가 추가됩니다.', zh: '——主属性（通常是ATK）加上HP或SPD等的次要加成。' } satisfies LangMap, lang)}</p>
                    <p className="mt-2">{lRec({ en: "For example, some skills primarily scale with ATK but gain a bonus from the caster's Max HP or Speed.", jp: '例えば、一部のスキルはATKをメインに、術者の最大HPや速度からボーナスを得ます。', kr: '예를 들어, 일부 스킬은 ATK를 메인으로 시전자의 최대 HP나 속도에서 보너스를 얻습니다.', zh: '例如，部分技能以ATK为主，并从施放者的最大HP或速度获得加成。' } satisfies LangMap, lang)} {parseText('{P/Demiurge Stella}')}{lRec({ en: ' has partial scaling from HP.', jp: 'はHPからの部分依存を持ちます。', kr: '는 HP에서 부분 의존을 가집니다.', zh: '有HP的部分依赖。' } satisfies LangMap, lang)}</p>
                    <p className="mt-2">{lRec({ en: 'These secondary scalings are usually small and should not be the focus of gear building. There are also skills that use a stat other than ATK entirely — such as HP-based or DEF-based damage.', jp: 'これらの副次依存は通常小さく、装備構築の焦点にすべきではありません。ATK以外のステータスに完全に依存するスキル（HP依存やDEF依存ダメージなど）もあります。', kr: '이러한 부차 의존은 보통 작으며 장비 구성의 초점이 되어서는 안 됩니다. ATK 외의 스탯에 완전히 의존하는 스킬(HP 기반이나 DEF 기반 데미지 등)도 있습니다.', zh: '这些次要依赖通常较小，不应成为装备配置的重点。也有技能完全依赖ATK以外的属性（如基于HP或DEF的伤害）。' } satisfies LangMap, lang)}</p>
                </>
            ),
        },
        {
            key: 'stat-scaling',
            title: lRec(LABELS.faqTitles.statScaling, lang),
            content: (
                <>
                    <p>{lRec({ en: 'If nothing is mentioned, the skill usually scales with ATK by default.', jp: '何も記載がなければ、通常はデフォルトでATK依存です。', kr: '아무것도 언급되지 않으면 보통 기본적으로 ATK 의존입니다.', zh: '如果没有提及，通常默认依赖ATK。' } satisfies LangMap, lang)}</p>
                    <p className="mt-2">{lRec({ en: "If it uses a different stat, you'll see one of these:", jp: '異なるステータスを使う場合、以下のような記述があります：', kr: '다른 스탯을 사용하면 다음과 같은 문구가 있습니다:', zh: '如果使用其他属性，会有类似描述：' } satisfies LangMap, lang)}</p>
                    <ul className="list-disc list-inside ml-4 mt-2">
                        <li>{lRec({ en: '\u201cDamage dealt increases proportional to Max Health', jp: '「与えるダメージは攻撃力', kr: '"주는 데미지는 공격력 ', zh: '"造成的伤害根据最大生命值' } satisfies LangMap, lang)} <strong>{lRec({ en: 'instead of', jp: 'ではなく', kr: '대신', zh: '而非' } satisfies LangMap, lang)}</strong> {lRec({ en: 'Attack.\u201d', jp: '最大体力に比例して増加します。」', kr: '최대 체력에 비례하여 증가합니다."', zh: '攻击力增加。"' } satisfies LangMap, lang)}</li>
                        <li>{lRec({ en: '\u201cDamage dealt increases proportional to Max Health.\u201d (in addition to ATK)', jp: '「与えるダメージは最大体力に比例して増加します。」（ATKに加えて）', kr: '"주는 데미지는 최대 체력에 비례하여 증가합니다." (ATK에 추가로)', zh: '"造成的伤害根据最大生命值增加。"（在ATK基础上）' } satisfies LangMap, lang)}</li>
                    </ul>
                    <p className="mt-2">{lRec({ en: 'The wording is important: \u201cinstead of\u201d replaces ATK scaling, while without it means additional scaling.', jp: '表現が重要です：「ではなく」はATK依存を置き換え、それがない場合は追加依存を意味します。', kr: '문구가 중요합니다: "대신"은 ATK 의존을 대체하고, 없으면 추가 의존을 의미합니다.', zh: '措辞很重要："而非"表示替代ATK依赖，没有则表示额外依赖。' } satisfies LangMap, lang)}</p>
                </>
            ),
        },
    ]

    const speedPriorityItems: AccordionItem[] = [
        {
            key: 'speed-formula',
            title: lRec(LABELS.faqTitles.speedFormula, lang),
            content: (
                <>
                    <p>{lRec({ en: 'The base formula used to calculate speed in', jp: '', kr: '', zh: '' } satisfies LangMap, lang)} <strong>Outerplane</strong>{lRec({ en: ' is:', jp: 'での速度計算の基本式：', kr: '에서 속도 계산의 기본 공식:', zh: '速度计算基础公式：' } satisfies LangMap, lang)}</p>
                    <p className="text-sm font-mono bg-black/40 p-2 rounded border border-white/10 w-fit mt-2">
                        {lRec({ en: 'SPD = Base SPD + Gear SPD + (Base SPD × Set Effect %)', jp: 'SPD = 基本SPD + 装備SPD + (基本SPD × セット効果%)', kr: 'SPD = 기본 SPD + 장비 SPD + (기본 SPD × 세트 효과%)', zh: 'SPD = 基础SPD + 装备SPD + (基础SPD × 套装效果%)' } satisfies LangMap, lang)}
                    </p>
                    <ul className="list-disc list-inside mt-3">
                        <li><strong>{lRec({ en: 'Base SPD:', jp: '基本SPD：', kr: '기본 SPD:', zh: '基础SPD：' } satisfies LangMap, lang)}</strong> {lRec({ en: "The character's innate, unmodified speed.", jp: 'キャラクターの固有の未修正速度。', kr: '캐릭터의 고유 미수정 속도.', zh: '角色固有的未修正速度。' } satisfies LangMap, lang)}</li>
                        <li><strong>{lRec({ en: 'Gear SPD:', jp: '装備SPD：', kr: '장비 SPD:', zh: '装备SPD：' } satisfies LangMap, lang)}</strong> {lRec({ en: 'Flat speed gained from equipped gear.', jp: '装備から得た固定速度。', kr: '장비에서 얻은 고정 속도.', zh: '装备提供的固定速度。' } satisfies LangMap, lang)}</li>
                        <li>
                            <strong>{lRec({ en: 'Set Effect:', jp: 'セット効果：', kr: '세트 효과:', zh: '套装效果：' } satisfies LangMap, lang)}</strong>
                            <ul className="list-disc list-inside ml-4 mt-1">
                                <li>{lRec({ en: '0 if no Speed set equipped', jp: '速度セットなし = 0', kr: '속도 세트 없음 = 0', zh: '无速度套装 = 0' } satisfies LangMap, lang)}</li>
                                <li>{lRec({ en: '0.12 (12%) if 2-piece Speed set', jp: '2セット速度 = 0.12 (12%)', kr: '2세트 속도 = 0.12 (12%)', zh: '2件速度套装 = 0.12 (12%)' } satisfies LangMap, lang)}</li>
                                <li>{lRec({ en: '0.25 (25%) if 4-piece Speed set', jp: '4セット速度 = 0.25 (25%)', kr: '4세트 속도 = 0.25 (25%)', zh: '4件速度套装 = 0.25 (25%)' } satisfies LangMap, lang)}</li>
                            </ul>
                        </li>
                    </ul>
                </>
            ),
        },
        {
            key: 'priority-formula',
            title: lRec(LABELS.faqTitles.priorityFormula, lang),
            content: (
                <>
                    <p>{lRec({ en: 'The formula used to calculate initial priority at the start of battle:', jp: '戦闘開始時の初期優先度計算式：', kr: '전투 시작 시 초기 우선도 계산 공식:', zh: '战斗开始时的初始行动值计算公式：' } satisfies LangMap, lang)}</p>
                    <p className="text-sm font-mono bg-black/40 p-2 rounded border border-white/10 w-fit mt-2">
                        {lRec({ en: 'Priority = (SPD + Ally Speed transcend bonus + (SPD × Buff %)) × 100 / (Top SPD + Top SPD team Ally Speed transcend bonus + (Top SPD × Buff %))', jp: '優先度 = (SPD + 味方速度超越ボーナス + (SPD × バフ%)) × 100 / (最高SPD + 最高SPDチーム味方速度超越ボーナス + (最高SPD × バフ%))', kr: '우선도 = (SPD + 아군 속도 초월 보너스 + (SPD × 버프%)) × 100 / (최고 SPD + 최고 SPD 팀 아군 속도 초월 보너스 + (최고 SPD × 버프%))', zh: '行动值 = (SPD + 友方速度超越加成 + (SPD × 增益%)) × 100 / (最高SPD + 最高SPD队友方速度超越加成 + (最高SPD × 增益%))' } satisfies LangMap, lang)}
                    </p>
                    <ul className="list-disc list-inside mt-3">
                        <li><strong>SPD:</strong> {lRec({ en: 'Total speed of the unit, as calculated above.', jp: '上記で計算されたユニットの総速度。', kr: '위에서 계산된 유닛의 총 속도.', zh: '单位的总速度（如上计算）。' } satisfies LangMap, lang)}</li>
                        <li><strong>{lRec({ en: 'Top SPD:', jp: '最高SPD：', kr: '최고 SPD:', zh: '最高SPD：' } satisfies LangMap, lang)}</strong> {lRec({ en: 'Highest SPD among all units (used as divisor).', jp: '全ユニット中の最高SPD（除数として使用）。', kr: '모든 유닛 중 최고 SPD (제수로 사용).', zh: '所有单位中最高的SPD（作为除数）。' } satisfies LangMap, lang)}</li>
                        <li><strong>{lRec({ en: 'Ally Speed transcend bonus:', jp: '味方速度超越ボーナス：', kr: '아군 속도 초월 보너스:', zh: '友方速度超越加成：' } satisfies LangMap, lang)}</strong> {lRec({ en: 'Speed from transcendence.', jp: '超越からの速度。', kr: '초월에서 얻은 속도.', zh: '从超越获得的速度。' } satisfies LangMap, lang)}</li>
                        <li>
                            <strong>{lRec({ en: 'Buff:', jp: 'バフ：', kr: '버프:', zh: '增益：' } satisfies LangMap, lang)}</strong>
                            <ul className="list-disc list-inside ml-4 mt-1">
                                <li>{lRec({ en: '0 if no buff speed', jp: '速度バフなし = 0', kr: '속도 버프 없음 = 0', zh: '无速度增益 = 0' } satisfies LangMap, lang)}</li>
                                <li>{lRec({ en: '0.3 (30%) if buff speed', jp: '速度バフ = 0.3 (30%)', kr: '속도 버프 = 0.3 (30%)', zh: '速度增益 = 0.3 (30%)' } satisfies LangMap, lang)}</li>
                                <li>{lRec({ en: '-0.3 (-30%) if malus speed', jp: '速度デバフ = -0.3 (-30%)', kr: '속도 디버프 = -0.3 (-30%)', zh: '速度减益 = -0.3 (-30%)' } satisfies LangMap, lang)}</li>
                            </ul>
                        </li>
                    </ul>
                </>
            ),
        },
        {
            key: 'max-speed',
            title: lRec(LABELS.faqTitles.maxSpeed, lang),
            content: (
                <>
                    <p>{lRec({ en: 'The maximum theoretical speed is:', jp: '理論上の最大速度：', kr: '이론상 최대 속도:', zh: '理论最大速度：' } satisfies LangMap, lang)}</p>
                    <ul className="list-disc list-inside mt-2">
                        <li><strong>{lRec({ en: 'Base speed:', jp: '基本速度：', kr: '기본 속도:', zh: '基础速度：' } satisfies LangMap, lang)}</strong> {lang === 'en' ? <>154 hit by {parseText('{C/Ranger}')}</> : <>{parseText('{C/Ranger}')}{lRec({ en: '', jp: 'の154', kr: '의 154', zh: '的154' } satisfies LangMap, lang)}</>}</li>
                        <li><strong>{lRec({ en: 'Gear SPD:', jp: '装備SPD：', kr: '장비 SPD:', zh: '装备SPD：' } satisfies LangMap, lang)}</strong> 138 {lRec({ en: '(18 per piece + 48 from Accessory)', jp: '（各部位18 + アクセサリー48）', kr: '(각 부위 18 + 악세사리 48)', zh: '（每部位18 + 饰品48）' } satisfies LangMap, lang)}</li>
                        <li><strong>{lRec({ en: 'Set SPD:', jp: 'セットSPD：', kr: '세트 SPD:', zh: '套装SPD：' } satisfies LangMap, lang)}</strong> 38 {lRec({ en: '(on a 154 character)', jp: '（154キャラで）', kr: '(154 캐릭터 기준)', zh: '（基于154角色）' } satisfies LangMap, lang)}</li>
                        <li><strong>{lRec({ en: 'Ally Speed transcend bonus:', jp: '味方速度超越ボーナス：', kr: '아군 속도 초월 보너스:', zh: '友方速度超越加成：' } satisfies LangMap, lang)}</strong> 30 ({parseText('{P/Dianne}')} + {parseText('{P/Mene}')} + {parseText('{P/Demiurge Delta}')})</li>
                    </ul>
                    <p className="mt-3">{lRec({ en: 'Leading to a grand total of:', jp: '合計：', kr: '합계:', zh: '总计：' } satisfies LangMap, lang)} <strong>360</strong> {lRec({ en: '(468 including the speed buff)', jp: '（速度バフ込みで468）', kr: '(속도 버프 포함 시 468)', zh: '（带速度增益时468）' } satisfies LangMap, lang)}</p>
                    <p className="mt-2">{parseText('{P/Ryu Lion}')} {lRec({ en: 'can go further with her 4 star transcend bonus:', jp: 'は4つ星超越ボーナスでさらに上げられます：', kr: '은 4성 초월 보너스로 더 올릴 수 있습니다:', zh: '的4星超越加成可进一步提升：' } satisfies LangMap, lang)} <strong>370</strong> {lRec({ en: '(481 with speed buff)', jp: '（速度バフ込みで481）', kr: '(속도 버프 포함 시 481)', zh: '（带速度增益时481）' } satisfies LangMap, lang)}</p>
                </>
            ),
        },
    ]

    const formulaItems: AccordionItem[] = [
        {
            key: 'formula',
            title: lRec(LABELS.faqTitles.formula, lang),
            content: (
                <>
                    <p>{lRec({ en: 'The following formulas and explanations were gathered and tested by', jp: '以下の計算式と説明は', kr: '다음 공식과 설명은 ', zh: '以下公式和说明由' } satisfies LangMap, lang)} <strong>Enebe-NB</strong>{lRec({ en: ', who did an amazing job analyzing combat formulas in Outerplane.', jp: 'によって収集・検証されました。Outerplaneの戦闘計算式を分析した素晴らしい仕事です。', kr: '가 수집하고 테스트했습니다. Outerplane의 전투 공식을 분석한 훌륭한 작업입니다.', zh: '收集和测试。这是对Outerplane战斗公式的出色分析工作。' } satisfies LangMap, lang)}</p>
                    <p className="mt-2">
                        {lRec({ en: 'For full reference, the data is available here:', jp: '完全な参照はこちら：', kr: '전체 참조는 여기:', zh: '完整参考：' } satisfies LangMap, lang)}{' '}
                        <a href="https://docs.google.com/spreadsheets/d/10Sl_b7n7_j-PxkNxYGZEvu7HvrJNyRYDSyyYLcUwDOU/edit?gid=938189457#gid=938189457" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">
                            [Google Sheet - Outerplane Analysis by Enebe-NB]
                        </a>
                    </p>

                    <h4 className="font-semibold mt-4">{lRec({ en: 'Defense Mitigation', jp: '防御軽減', kr: '방어 감소', zh: '防御减免' } satisfies LangMap, lang)}</h4>
                    <p><strong>{lRec({ en: 'Formula:', jp: '計算式：', kr: '공식:', zh: '公式：' } satisfies LangMap, lang)}</strong> <code>f(DEF) = 1000 / (1000 + DEF)</code></p>
                    <p className="mt-2">{lRec({ en: 'This formula determines how much damage is reduced by defense. As DEF increases, the effect of each additional point diminishes (diminishing returns).', jp: 'この式は防御力によるダメージ軽減量を決定します。DEFが増えるほど、追加ポイントの効果は減少します（収穫逓減）。', kr: '이 공식은 방어력에 의한 데미지 감소량을 결정합니다. DEF가 증가할수록 추가 포인트의 효과가 감소합니다(수확 체감).', zh: '此公式决定防御力的伤害减免量。DEF增加时，额外点数的效果递减（收益递减）。' } satisfies LangMap, lang)}</p>
                    <p className="mt-2">{lRec({ en: 'Effective Health (EHP) can be derived from it:', jp: '有効HP（EHP）はここから導出できます：', kr: '유효 HP(EHP)는 여기서 도출할 수 있습니다:', zh: '有效生命值(EHP)可由此推导：' } satisfies LangMap, lang)}</p>
                    <p className="mt-1"><strong>{lRec({ en: 'Effective HP:', jp: '有効HP：', kr: '유효 HP:', zh: '有效HP：' } satisfies LangMap, lang)}</strong> <code>EHP = HP + (HP × DEF / 1000)</code></p>

                    <h4 className="font-semibold mt-4">{lRec({ en: 'Effectiveness vs Resilience', jp: '効果命中vs効果抵抗', kr: '효과 적중 vs 효과 저항', zh: '效果命中 vs 效果抵抗' } satisfies LangMap, lang)}</h4>
                    <p>{lRec({ en: 'If', jp: '', kr: '', zh: '如果' } satisfies LangMap, lang)} <code>EFF ≥ RES</code>{lRec({ en: ', the debuff success chance is 100%.', jp: 'の場合、デバフ成功確率は100%。', kr: '면 디버프 성공 확률은 100%.', zh: '，减益成功概率为100%。' } satisfies LangMap, lang)}</p>
                    <p className="mt-2">{lRec({ en: 'Otherwise, the chance to apply a debuff is calculated using:', jp: 'それ以外、デバフ付与確率は以下で計算：', kr: '그 외, 디버프 부여 확률은 다음으로 계산:', zh: '否则，减益施加概率计算如下：' } satisfies LangMap, lang)}</p>
                    <p className="text-sm font-mono bg-black/40 p-2 rounded border border-white/10 w-fit mt-2">
                        {lRec({ en: 'Success Chance = 100 / (100 + (RES − EFF))', jp: '成功確率 = 100 / (100 + (RES − EFF))', kr: '성공 확률 = 100 / (100 + (RES − EFF))', zh: '成功概率 = 100 / (100 + (RES − EFF))' } satisfies LangMap, lang)}
                    </p>
                </>
            ),
        },
        {
            key: 'damage-formula',
            title: lRec(LABELS.faqTitles.damageFormula, lang),
            content: (
                <>
                    <p>{lRec({ en: 'The base formula used to calculate skill damage in Outerplane is:', jp: 'Outerplaneでスキルダメージを計算する基本式：', kr: 'Outerplane에서 스킬 데미지를 계산하는 기본 공식:', zh: 'Outerplane中计算技能伤害的基础公式：' } satisfies LangMap, lang)}</p>
                    <p className="text-sm font-mono bg-black/40 p-2 rounded border border-white/10 w-fit mt-2">
                        {lRec({ en: 'Dmg = Elemental × Skill × ATK × Modifiers × (1000 / (1000 + (1 − PEN%) × DEF))', jp: 'Dmg = 属性 × スキル × ATK × 修正値 × (1000 / (1000 + (1 − PEN%) × DEF))', kr: 'Dmg = 속성 × 스킬 × ATK × 수정치 × (1000 / (1000 + (1 − PEN%) × DEF))', zh: '伤害 = 属性 × 技能 × ATK × 修正 × (1000 / (1000 + (1 − PEN%) × DEF))' } satisfies LangMap, lang)}
                    </p>
                    <ul className="list-disc list-inside mt-3">
                        <li><strong>{lRec({ en: 'Elemental', jp: '属性', kr: '속성', zh: '属性' } satisfies LangMap, lang)}</strong>: {lRec({ en: '0.8 (disadvantage), 1 (neutral), or 1.2 (advantage)', jp: '0.8（不利）、1（中立）、1.2（有利）', kr: '0.8 (불리), 1 (중립), 1.2 (유리)', zh: '0.8（被克制）、1（中立）、1.2（克制）' } satisfies LangMap, lang)}</li>
                        <li><strong>{lRec({ en: 'Skill', jp: 'スキル', kr: '스킬', zh: '技能' } satisfies LangMap, lang)}</strong>: {lRec({ en: 'Skill multiplier', jp: 'スキル倍率', kr: '스킬 배율', zh: '技能倍率' } satisfies LangMap, lang)}</li>
                        <li><strong>ATK</strong>: {lRec({ en: "Your unit's main scaling stat (can also be HP, DEF, etc. depending on the skill/character)", jp: 'ユニットのメイン依存ステータス（スキル/キャラによってHP、DEFなども可）', kr: '유닛의 메인 의존 스탯 (스킬/캐릭터에 따라 HP, DEF 등도 가능)', zh: '单位的主要依赖属性（根据技能/角色可能是HP、DEF等）' } satisfies LangMap, lang)}</li>
                        <li><strong>{lRec({ en: 'Modifiers', jp: '修正値', kr: '수정치', zh: '修正' } satisfies LangMap, lang)}</strong>: {lRec({ en: 'Additive pool of (CHD on crit + DMG UP + skill/equip DMG UP) minus (CDMG RED on crit + DMG RED + skill/equip DMG RED). May also include secondary scalings (like HP) and burst damage effects', jp: 'DMG UP、クリダメ（クリティカル時）、副次依存（HPなど）、バーストダメージ効果を含む — 敵のDMG REDおよびCDMG RED（クリティカル時）で軽減', kr: 'DMG UP, 치명타 데미지(치명 시), 부차 의존(HP 등), 버스트 데미지 효과 포함 — 적의 DMG RED 및 CDMG RED(치명 시)로 감소', zh: '包括DMG UP、暴击伤害（暴击时）、次要依赖（HP等）、爆发伤害效果 — 被敌方DMG RED及CDMG RED（暴击时）减免' } satisfies LangMap, lang)}</li>
                        <li><strong>PEN%</strong>: {lRec({ en: 'Penetration', jp: '貫通', kr: '관통', zh: '穿透' } satisfies LangMap, lang)}</li>
                    </ul>
                    <p className="text-sm text-gray-500 mt-4">
                        {lRec({ en: 'Source:', jp: '出典：', kr: '출처:', zh: '来源：' } satisfies LangMap, lang)}{' '}
                        <a href="https://discord.com/channels/1264787916660670605/1264811556059873312/1265103204128133191" target="_blank" rel="noopener noreferrer" className="underline text-blue-400">
                            {lRec({ en: 'Fabool on EvaMains Discord (July 23, 2024)', jp: 'Fabool on EvaMains Discord (2024年7月23日)', kr: 'Fabool on EvaMains Discord (2024년 7월 23일)', zh: 'Fabool on EvaMains Discord（2024年7月23日）' } satisfies LangMap, lang)}
                        </a>
                    </p>
                </>
            ),
        },
    ]

    return (
        <div className="space-y-8">
            <div className="space-y-4">
                <h4 className="text-lg font-semibold text-red-400">{lRec(LABELS.faqSections.critDots, lang)}</h4>
                <Accordion items={critDotsItems} />
            </div>

            <div className="space-y-4">
                <h4 className="text-lg font-semibold text-purple-400">{lRec(LABELS.faqSections.damageModifiers, lang)}</h4>
                <Accordion items={dmgModItems} />
            </div>

            <div className="space-y-4">
                <h4 className="text-lg font-semibold text-blue-400">{lRec(LABELS.faqSections.defensePenetration, lang)}</h4>
                <Accordion items={defPenItems} />
            </div>

            <div className="space-y-4">
                <h4 className="text-lg font-semibold text-green-400">{lRec(LABELS.faqSections.statScaling, lang)}</h4>
                <Accordion items={statScalingItems} />
            </div>

            <div className="space-y-4">
                <h4 className="text-lg font-semibold text-cyan-400">{lRec(LABELS.faqSections.speedPriority, lang)}</h4>
                <Accordion items={speedPriorityItems} />
            </div>

            <div className="space-y-4">
                <h4 className="text-lg font-semibold text-amber-400">{lRec(LABELS.faqSections.formulas, lang)}</h4>
                <Accordion items={formulaItems} />
            </div>
        </div>
    )
}

/* ════════════════════════════════════════════════════════════════════════════
   COMBAT BASICS CONTENT
   ════════════════════════════════════════════════════════════════════════════ */

const GUIDE_IMG = '/images/guides/general-guides/'

export function CombatBasicsContent() {
    const { lang } = useI18n()

    const priorityAccordionItems: AccordionItem[] = [
        {
            key: 'speed',
            title: parseText('{S/SPD}'),
            content: (
                <>
                    <p>{lRec({ en: "You can imagine that", jp: '', kr: '', zh: '把' } satisfies LangMap, lang)} {parseText('{S/SPD}')} {lRec({ en: "is your character's running speed — it's the stat that determines how fast they advance on the track.", jp: 'はキャラクターの走る速さ — トラック上でどれだけ早く進むかを決定するステータスと想像できます。', kr: '는 캐릭터의 달리기 속도 — 트랙에서 얼마나 빨리 전진하는지 결정하는 스탯이라고 상상할 수 있습니다.', zh: '想象成角色的奔跑速度——决定在跑道上前进多快的属性。' } satisfies LangMap, lang)}</p>
                    <ul className="list-disc list-inside ml-4 mt-3">
                        <li>{lRec({ en: 'Higher', jp: '', kr: '', zh: '' } satisfies LangMap, lang)} {parseText('{S/SPD}')} {lRec({ en: 'means you reach 100% faster.', jp: 'が高いほど、100%に早く到達。', kr: '가 높을수록 100%에 더 빨리 도달.', zh: '越高，越快到达100%。' } satisfies LangMap, lang)}</li>
                        <li>{lRec({ en: 'A character with 200', jp: '200 ', kr: '200 ', zh: '200 ' } satisfies LangMap, lang)} {parseText('{S/SPD}')} {lRec({ en: 'moves twice as fast as one with 100.', jp: 'のキャラクターは100のキャラクターの2倍速く動きます。', kr: '캐릭터는 100인 캐릭터보다 2배 빠르게 움직입니다.', zh: '的角色移动速度是100的两倍。' } satisfies LangMap, lang)}</li>
                        <li>{lRec({ en: 'This means they can act twice while the other acts only once.', jp: 'つまり、一方が1回行動する間に2回行動できます。', kr: '즉, 한쪽이 1번 행동하는 동안 2번 행동할 수 있습니다.', zh: '这意味着一方行动1次时，另一方可以行动2次。' } satisfies LangMap, lang)}</li>
                    </ul>
                    <p className="mt-3">{lRec({ en: "This isn't a fixed turn-order system — it's a continuous flow. Characters act as soon as they reach 100%.", jp: 'これは固定ターン順システムではなく、連続的な流れです。キャラクターは100%に達した瞬間に行動します。', kr: '이것은 고정 턴 순서 시스템이 아닙니다 — 연속적인 흐름입니다. 캐릭터는 100%에 도달하자마자 행동합니다.', zh: '这不是固定回合顺序系统——而是连续流动。角色一到达100%就立即行动。' } satisfies LangMap, lang)}</p>
                </>
            ),
        },
        {
            key: 'priority',
            title: <span className="text-amber-400">{lRec({ en: 'Priority', jp: '優先度', kr: '우선도', zh: '行动值' } satisfies LangMap, lang)}</span>,
            content: (
                <>
                    <p>{lRec({ en: 'Some skills or effects alter your current position on the track, regardless of your speed. You can imagine this as your character teleporting forward or backward on the track.', jp: '一部のスキルや効果は、速度に関係なく、トラック上の現在位置を変更します。キャラクターがトラック上を前方または後方にテレポートすると想像できます。', kr: '일부 스킬이나 효과는 속도와 관계없이 트랙에서의 현재 위치를 변경합니다. 캐릭터가 트랙에서 앞이나 뒤로 텔레포트한다고 상상할 수 있습니다.', zh: '部分技能或效果可以改变你在跑道上的当前位置，与速度无关。想象角色在跑道上向前或向后瞬移。' } satisfies LangMap, lang)}</p>
                    <p className="mt-2">{lRec({ en: 'This is known as', jp: 'これは', kr: '이것을 ', zh: '这称为' } satisfies LangMap, lang)} <strong>{lRec({ en: 'increasing or reducing', jp: '', kr: '', zh: '' } satisfies LangMap, lang)} <span className="text-amber-400">{lRec({ en: 'priority', jp: '優先度', kr: '우선도', zh: '行动值' } satisfies LangMap, lang)}</span>{lRec({ en: '', jp: 'を増加または減少させる', kr: '를 증가 또는 감소시킨다', zh: '增加或减少' } satisfies LangMap, lang)}</strong>{lRec({ en: '.', jp: 'として知られています。', kr: '고 합니다.', zh: '。' } satisfies LangMap, lang)}</p>
                    <p className="mt-2">{lRec({ en: "In other games, similar systems exist — such as Combat Readiness in Epic Seven or the ATB gauge in Summoner's War.", jp: '他のゲームでも同様のシステムがあります — Epic Sevenの戦闘準備やSummoner\'s WarのATBゲージなど。', kr: '다른 게임에도 비슷한 시스템이 있습니다 — Epic Seven의 전투 준비나 Summoner\'s War의 ATB 게이지 등.', zh: '其他游戏也有类似系统——Epic Seven的战斗准备或Summoner\'s War的ATB槽等。' } satisfies LangMap, lang)}</p>

                    <p className="text-sm text-yellow-400 mt-4">
                        {lRec({ en: 'Priority has no official in-game icon. However, this website uses the following icon to represent it:', jp: '優先度にはゲーム内の公式アイコンがありません。ただし、このウェブサイトでは以下のアイコンを使用しています：', kr: '우선도에는 공식 게임 내 아이콘이 없습니다. 하지만 이 웹사이트에서는 다음 아이콘을 사용합니다:', zh: '行动值没有官方游戏内图标。但本网站使用此图标：' } satisfies LangMap, lang)} <span style={{ filter: 'grayscale(1)' }}><InlineIcon icon={GUIDE_IMG + 'SC_Buff_Effect_Increase_Priority.webp'} label="" /></span>{lRec({ en: '.', jp: '。', kr: '.', zh: '。' } satisfies LangMap, lang)}
                    </p>

                    <p className="mt-4">{lRec({ en: 'Here are the directly associated effects:', jp: '直接関連する効果：', kr: '직접 관련된 효과:', zh: '直接相关的效果：' } satisfies LangMap, lang)}</p>
                    <p className="mt-2"><span className="text-sky-400">{lRec({ en: 'Beneficial', jp: '有益', kr: '유익', zh: '有益' } satisfies LangMap, lang)}</span>: {parseText('{B/BT_ACTION_GAUGE}')} — {lRec({ en: 'pushes the character forward.', jp: 'キャラクターを前方に押す。', kr: '캐릭터를 앞으로 밀음.', zh: '将角色向前推。' } satisfies LangMap, lang)}</p>
                    <p className="mt-1"><span className="text-red-400">{lRec({ en: 'Detrimental', jp: '有害', kr: '해로움', zh: '有害' } satisfies LangMap, lang)}</span>: {parseText('{D/BT_ACTION_GAUGE}')} — {lRec({ en: 'pushes the character backward.', jp: 'キャラクターを後方に押す。', kr: '캐릭터를 뒤로 밀음.', zh: '将角色向后推。' } satisfies LangMap, lang)}</p>

                    <Callout variant="warning" className="mt-4">
                        <p className="font-semibold text-yellow-400">{lRec({ en: 'Important Notes:', jp: '重要な注意事項：', kr: '중요 사항:', zh: '重要事项：' } satisfies LangMap, lang)}</p>
                        <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
                            <li>{lRec({ en: 'Priority can never exceed 100% or drop below 0%.', jp: '優先度は100%を超えたり0%を下回ったりしません。', kr: '우선도는 100%를 초과하거나 0% 아래로 떨어지지 않습니다.', zh: '行动值不会超过100%或低于0%。' } satisfies LangMap, lang)}</li>
                            <li>{lRec({ en: 'When multiple characters reach 100% at different times, the one who gets there first will act first. This is the most common case.', jp: '複数のキャラクターが異なるタイミングで100%に達した場合、最初に到達した者が先に行動します。これが最も一般的なケースです。', kr: '여러 캐릭터가 다른 시점에 100%에 도달하면, 먼저 도달한 자가 먼저 행동합니다. 이것이 가장 일반적인 경우입니다.', zh: '多个角色在不同时间到达100%时，先到的先行动。这是最常见的情况。' } satisfies LangMap, lang)}</li>
                            <li>{lRec({ en: 'However, if multiple characters reach 100%', jp: 'ただし、複数のキャラクターが', kr: '하지만 여러 캐릭터가 ', zh: '但多个角色在' } satisfies LangMap, lang)} <strong>{lRec({ en: 'within the same action', jp: '同じアクション内で', kr: '같은 액션 내에서', zh: '同一行动内' } satisfies LangMap, lang)}</strong> {lRec({ en: '(e.g. due to a mass +Priority boost), then the acting order is based on a fixed positional priority:', jp: '100%に達した場合（例：大量の+優先度ブーストにより）、行動順序は固定の位置優先度に基づきます：', kr: '100%에 도달하면(예: 대량 +우선도 부스트로), 행동 순서는 고정 위치 우선도를 기반으로 합니다:', zh: '到达100%时（如通过大量+行动值提升），行动顺序基于固定位置优先级：' } satisfies LangMap, lang)} <strong>{lRec({ en: 'Front-right → Top → Bottom → Back-left', jp: '右前→上→下→左後', kr: '오른쪽 앞 → 위 → 아래 → 왼쪽 뒤', zh: '右前 → 上 → 下 → 左后' } satisfies LangMap, lang)}</strong></li>
                            <li>{lRec({ en: 'This positional rule is only used when multiple characters are pushed to 100% at the exact same time.', jp: 'この位置ルールは、複数のキャラクターが同時に100%に押し上げられた場合にのみ使用されます。', kr: '이 위치 규칙은 여러 캐릭터가 정확히 같은 시간에 100%로 밀려날 때만 사용됩니다.', zh: '此位置规则仅在多个角色被同时推到100%时使用。' } satisfies LangMap, lang)}</li>
                            <li>⚠️ {lRec({ en: 'Additional Priority boosts applied', jp: '', kr: '', zh: '' } satisfies LangMap, lang)} <strong>{lRec({ en: 'after', jp: '100%以降', kr: '100% 이후', zh: '100%之后' } satisfies LangMap, lang)}</strong>{lRec({ en: ' 100% are ignored and have no effect on the turn order.', jp: 'に適用された追加の優先度ブーストは無視され、ターン順序に影響しません。', kr: '에 적용된 추가 우선도 부스트는 무시되며 턴 순서에 영향을 주지 않습니다.', zh: '施加的额外行动值提升被忽略，不影响回合顺序。' } satisfies LangMap, lang)}</li>
                            <li>{lRec({ en: 'In such cases, the acting team always goes first, followed by the enemy team — each resolving ties based on the positional rule above.', jp: 'そのような場合、行動チームが常に先に行動し、その後敵チーム — それぞれ上記の位置ルールに基づいてタイを解決します。', kr: '그런 경우, 행동 팀이 항상 먼저 행동하고, 그 다음 적 팀 — 각각 위의 위치 규칙에 따라 타이를 해결합니다.', zh: '在这种情况下，行动方总是先行动，然后是敌方——各自按上述位置规则解决平局。' } satisfies LangMap, lang)}</li>
                        </ul>
                    </Callout>
                </>
            ),
        },
    ]

    return (
        <div className="space-y-12">
            {/* Priority System */}
            <section className="space-y-6">
                <GuideSectionHeading>{lRec(LABELS.combatHeadings.priority, lang)}</GuideSectionHeading>

                <ContentCard>
                    <p>{lRec({ en: 'Imagine every battle in', jp: '', kr: '', zh: '把' } satisfies LangMap, lang)} <strong>Outerplane</strong> {lRec({ en: 'as a 100-meter circular racetrack. Each character — ally or enemy — runs along this track. The first to complete a full lap (100%) reaches the action line and gets to', jp: 'の全ての戦闘を100メートルの円形トラックとして想像してください。各キャラクター（味方も敵も）がこのトラックを走ります。最初に1周（100%）を完了した者がアクションラインに到達し、', kr: '의 모든 전투를 100미터 원형 트랙으로 상상해 보세요. 각 캐릭터(아군과 적 모두)가 이 트랙을 달립니다. 가장 먼저 한 바퀴(100%)를 완주한 자가 액션 라인에 도달하여', zh: '的每场战斗想象成100米环形跑道。每个角色（友方和敌方）都在这条跑道上奔跑。第一个跑完一圈（100%）到达行动线的人' } satisfies LangMap, lang)} <strong>{lRec({ en: 'take their turn', jp: 'ターンを取ります', kr: '턴을 가집니다', zh: '获得回合' } satisfies LangMap, lang)}</strong>{lRec({ en: '.', jp: '。', kr: '.', zh: '。' } satisfies LangMap, lang)}</p>
                    <p>{lRec({ en: 'In-game, this progress is displayed as a', jp: 'ゲーム内では、ターン順アイコン', kr: '게임 내에서 턴 순서 아이콘 ', zh: '在游戏中，点击回合顺序图标' } satisfies LangMap, lang)} {lang !== 'en' && <InlineIcon icon={GUIDE_IMG + 'IG_Menu_Btn_Action.webp'} label="" />}{lang !== 'en' && lRec({ en: '', jp: 'をクリックすると、この進行状況が', kr: '을 클릭하면 이 진행 상황이 ', zh: '可以看到这个进度以' } satisfies LangMap, lang)} <strong>{lRec({ en: 'percentage', jp: 'パーセンテージ', kr: '퍼센티지', zh: '百分比' } satisfies LangMap, lang)}</strong> {lRec({ en: 'when you click the turn order icon', jp: 'で表示されます：', kr: '로 표시됩니다:', zh: '显示：' } satisfies LangMap, lang)} {lang === 'en' && <InlineIcon icon={GUIDE_IMG + 'IG_Menu_Btn_Action.webp'} label="" />}{lang === 'en' && ':'}</p>
                    <ul className="list-disc list-inside ml-4">
                        <li><strong>0%</strong> = {lRec({ en: 'starting line', jp: 'スタートライン', kr: '출발선', zh: '起跑线' } satisfies LangMap, lang)}</li>
                        <li><strong>100%</strong> = {lRec({ en: 'action line — you take your turn', jp: 'アクションライン — ターンを取る', kr: '액션 라인 — 턴을 가짐', zh: '行动线 — 获得回合' } satisfies LangMap, lang)}</li>
                    </ul>
                </ContentCard>

                <Accordion items={priorityAccordionItems} />
            </section>

            {/* Turn Flow */}
            <section className="space-y-6">
                <GuideSectionHeading>{lRec(LABELS.combatHeadings.turnFlow, lang)}</GuideSectionHeading>

                <ContentCard>
                    <p>{lRec({ en: 'When a character reaches 100% priority, their turn proceeds in several phases. Each phase triggers specific events:', jp: 'キャラクターが100%優先度に達すると、ターンは複数のフェーズで進行します。各フェーズで特定のイベントが発生します：', kr: '캐릭터가 100% 우선도에 도달하면 턴은 여러 단계로 진행됩니다. 각 단계에서 특정 이벤트가 발생합니다:', zh: '角色到达100%行动值时，回合分为多个阶段进行。每个阶段发生特定事件：' } satisfies LangMap, lang)}</p>

                    <div className="space-y-6 mt-6">
                        {/* Starting Phase */}
                        <div className="border-l-4 border-green-500 pl-4">
                            <h4 className="text-lg font-bold text-green-400">{lRec({ en: '1. Starting Phase', jp: '1. 開始フェーズ', kr: '1. 시작 단계', zh: '1. 开始阶段' } satisfies LangMap, lang)}</h4>
                            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                                <li>{lRec({ en: 'All skill cooldowns are reduced by 1.', jp: '全てのスキルクールダウンが1減少。', kr: '모든 스킬 쿨다운이 1 감소.', zh: '所有技能冷却减少1。' } satisfies LangMap, lang)}</li>
                                <li>{lRec({ en: 'Healing-over-time (HoT) effects are applied, such as', jp: '継続回復（HoT）効果が適用（', kr: '지속 회복(HoT) 효과 적용(', zh: '持续治疗(HoT)效果生效（如' } satisfies LangMap, lang)} {parseText('{B/BT_CONTINU_HEAL}')}{lRec({ en: '', jp: 'など）', kr: ' 등)', zh: '）' } satisfies LangMap, lang)}</li>
                                <li>{lRec({ en: 'Damage-over-time (DoT) effects are applied, such as', jp: '継続ダメージ（DoT）効果が適用（', kr: '지속 데미지(DoT) 효과 적용(', zh: '持续伤害(DoT)效果生效（如' } satisfies LangMap, lang)} {parseText('{D/BT_DOT_BLEED}')}{lRec({ en: '', jp: 'など）', kr: ' 등)', zh: '）' } satisfies LangMap, lang)}</li>
                            </ul>
                        </div>

                        {/* Action Phase */}
                        <div className="border-l-4 border-blue-500 pl-4">
                            <h4 className="text-lg font-bold text-blue-400">{lRec({ en: '2. Action Phase', jp: '2. アクションフェーズ', kr: '2. 행동 단계', zh: '2. 行动阶段' } satisfies LangMap, lang)}</h4>
                            <p className="mt-2 text-yellow-400">{lRec({ en: 'If the unit is under crowd control effects like', jp: '', kr: '', zh: '如果受到' } satisfies LangMap, lang)} {parseText('{D/BT_STUN}')}{lRec({ en: ', this phase is skipped and the turn proceeds directly to the Ending Phase.', jp: 'などの行動不能効果を受けている場合、このフェーズはスキップされ、ターンは直接終了フェーズに進みます。', kr: ' 같은 행동 불가 효과를 받고 있으면, 이 단계는 건너뛰고 턴은 바로 종료 단계로 진행합니다.', zh: '等行动阻止效果，此阶段跳过，回合直接进入结束阶段。' } satisfies LangMap, lang)}</p>

                            <div className="mt-4 space-y-4">
                                <div>
                                    <h5 className="font-semibold text-blue-300">{lRec({ en: '2-1: Choice Phase', jp: '2-1: 選択フェーズ', kr: '2-1: 선택 단계', zh: '2-1：选择阶段' } satisfies LangMap, lang)}</h5>
                                    <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                                        <li>{lRec({ en: 'Forced actions are resolved first, such as', jp: '強制行動が最初に解決されます（', kr: '강제 행동이 먼저 해결됩니다(', zh: '强制行动优先解决（如' } satisfies LangMap, lang)} {parseText('{D/BT_AGGRO}')}{lRec({ en: ', which immediately starts the Hit Phase.', jp: 'など）、即座にヒットフェーズを開始。', kr: ' 등), 즉시 히트 단계를 시작.', zh: '），立即开始命中阶段。' } satisfies LangMap, lang)}</li>
                                        <li>{lRec({ en: 'Then, the player selects a skill and a target.', jp: 'その後、プレイヤーがスキルとターゲットを選択。', kr: '그 후, 플레이어가 스킬과 타겟을 선택.', zh: '之后，玩家选择技能和目标。' } satisfies LangMap, lang)}</li>
                                    </ul>
                                </div>

                                <div>
                                    <h5 className="font-semibold text-blue-300">{lRec({ en: '2-2: Hit Phase', jp: '2-2: ヒットフェーズ', kr: '2-2: 히트 단계', zh: '2-2：命中阶段' } satisfies LangMap, lang)}</h5>
                                    <div className="ml-4 mt-2 space-y-3">
                                        <div>
                                            <p className="font-medium">{lRec({ en: 'The skill executes in three stages:', jp: 'スキルは3段階で実行されます：', kr: '스킬은 세 단계로 실행됩니다:', zh: '技能分三个阶段执行：' } satisfies LangMap, lang)}</p>
                                            <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
                                                <li>
                                                    <strong>{lRec({ en: 'Pre-Hit:', jp: 'プレヒット：', kr: '프리히트:', zh: '命中前：' } satisfies LangMap, lang)}</strong> {lRec({ en: 'Happens before the skill hits. For example,', jp: 'スキルがヒットする前に発生。例えば、', kr: '스킬이 히트하기 전에 발생. 예를 들어, ', zh: '技能命中前发生。例如，' } satisfies LangMap, lang)} {parseText('{SK/Drakhan|S3}')} {lRec({ en: 'with EE+10 applies a', jp: 'のEE+10はヒット前に', kr: '의 EE+10은 히트 전에 ', zh: '的EE+10在命中前施加' } satisfies LangMap, lang)} {parseText('{D/BT_DOT_CURSE}')} {lRec({ en: "before it hits — important, as the skill's damage scales with the number of debuffs.", jp: 'を付与 — スキルのダメージがデバフ数に依存するため重要。', kr: '를 부여 — 스킬의 데미지가 디버프 수에 의존하므로 중요.', zh: '——这很重要，因为技能伤害取决于减益数量。' } satisfies LangMap, lang)}
                                                </li>
                                                <li>
                                                    <strong>{lRec({ en: 'Hit:', jp: 'ヒット：', kr: '히트:', zh: '命中：' } satisfies LangMap, lang)}</strong> {lRec({ en: 'The skill connects — direct damage and healing are applied.', jp: 'スキルが接続 — 直接ダメージと回復が適用。', kr: '스킬이 연결 — 직접 데미지와 힐이 적용.', zh: '技能连接——直接伤害和治疗生效。' } satisfies LangMap, lang)}
                                                </li>
                                                <li>
                                                    <strong>{lRec({ en: 'Post-Hit:', jp: 'ポストヒット：', kr: '포스트히트:', zh: '命中后：' } satisfies LangMap, lang)}</strong> {lRec({ en: 'Triggers after the skill hits — for example,', jp: 'スキルがヒットした後に発生 — 例えば、', kr: '스킬이 히트한 후 발생 — 예를 들어, ', zh: '技能命中后发生——例如，' } satisfies LangMap, lang)} {parseText('{SK/Demiurge Vlada|S3}')} {lRec({ en: 'inflicts', jp: 'はポストヒットで', kr: '는 포스트히트에 ', zh: '在命中后施加' } satisfies LangMap, lang)} {parseText('{D/BT_SEALED_RECEIVE_HEAL}')}{lRec({ en: ' post-hit.', jp: 'を付与。', kr: '를 부여.', zh: '。' } satisfies LangMap, lang)}
                                                </li>
                                            </ul>
                                        </div>
                                        <p>{lRec({ en: 'Extra hits are triggered, such as', jp: '追加ヒットが発動（', kr: '추가 히트가 발동(', zh: '追加攻击触发（如' } satisfies LangMap, lang)} {parseText('{SK/Ryu Lion|S2}')}{lRec({ en: '.', jp: 'など）。', kr: ' 등).', zh: '）。' } satisfies LangMap, lang)}</p>
                                        <p>{lRec({ en: 'Ally reactions, like', jp: '味方の反応（', kr: '아군 반응(', zh: '友方反应（如' } satisfies LangMap, lang)} {parseText('{SK/Caren|S2}')}{lRec({ en: ', may also trigger. These follow-up effects are resolved in positional order:', jp: 'など）も発動可能。これらのフォローアップ効果は位置順で解決：', kr: ' 등)도 발동 가능. 이러한 후속 효과는 위치 순서로 해결:', zh: '）也可能触发。这些后续效果按位置顺序解决：' } satisfies LangMap, lang)} <strong>{lRec({ en: 'Front-right → Top → Bottom → Back-left', jp: '右前→上→下→左後', kr: '오른쪽 앞 → 위 → 아래 → 왼쪽 뒤', zh: '右前 → 上 → 下 → 左后' } satisfies LangMap, lang)}</strong>{lRec({ en: '.', jp: '。', kr: '.', zh: '。' } satisfies LangMap, lang)}</p>
                                        <p>{lRec({ en: 'Enemy reactions such as', jp: '敵の反応（', kr: '적 반응(', zh: '敌方反应（' } satisfies LangMap, lang)} {parseText('{B/BT_STAT|ST_COUNTER_RATE}')}, {parseText('{B/BT_RUN_PASSIVE_SKILL_ON_TURN_END_DEFENDER_NO_CHECK}')}{lRec({ en: ' or', jp: '、', kr: ', ', zh: '、' } satisfies LangMap, lang)} {parseText('{B/SYS_BUFF_REVENGE}')}{lRec({ en: ' may occur, and also follow this positional order.', jp: 'など）も発生可能で、同じ位置順に従います。', kr: ' 등)도 발생 가능하며, 같은 위치 순서를 따릅니다.', zh: '等）也可能发生，遵循相同位置顺序。' } satisfies LangMap, lang)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Ending Phase */}
                        <div className="border-l-4 border-purple-500 pl-4">
                            <h4 className="text-lg font-bold text-purple-400">{lRec({ en: '3. Ending Phase', jp: '3. 終了フェーズ', kr: '3. 종료 단계', zh: '3. 结束阶段' } satisfies LangMap, lang)}</h4>
                            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                                <li>{lRec({ en: 'Revive effects are resolved, such as', jp: '復活効果が解決（', kr: '부활 효과 해결(', zh: '复活效果解决（如' } satisfies LangMap, lang)} {parseText('{B/BT_REVIVAL}')} {lRec({ en: 'or', jp: 'や', kr: '나 ', zh: '或' } satisfies LangMap, lang)} {parseText('{SK/Demiurge Astei|S2}')}{lRec({ en: '.', jp: 'など）。', kr: ' 등).', zh: '）。' } satisfies LangMap, lang)}</li>
                                <li>{lRec({ en: 'All remaining buffs and debuffs decrease their duration by 1 turn — except those already processed during the Starting Phase.', jp: '残りの全てのバフとデバフの持続時間が1ターン減少 — 開始フェーズで既に処理されたものを除く。', kr: '남은 모든 버프와 디버프의 지속 시간이 1턴 감소 — 시작 단계에서 이미 처리된 것 제외.', zh: '所有剩余增益和减益的持续时间减少1回合——开始阶段已处理的除外。' } satisfies LangMap, lang)}</li>
                                <li>{lRec({ en: 'Any remaining priority gains or losses are now applied.', jp: '残りの優先度増減が適用。', kr: '남은 우선도 증감이 적용.', zh: '剩余行动值增减生效。' } satisfies LangMap, lang)}</li>
                            </ul>
                        </div>
                    </div>
                </ContentCard>
            </section>

            {/* First Turn Calculation */}
            <section className="space-y-6">
                <GuideSectionHeading>{lRec(LABELS.combatHeadings.firstTurn, lang)}</GuideSectionHeading>

                <ContentCard>
                    <p>{lRec({ en: 'At the start of battle, the unit with the highest', jp: '戦闘開始時、最も高い', kr: '전투 시작 시, 가장 높은 ', zh: '战斗开始时，' } satisfies LangMap, lang)} {parseText('{S/SPD}')} {lRec({ en: 'will act first. All other units begin with a priority value proportional to their SPD compared to the fastest unit.', jp: 'を持つユニットが最初に行動します。他の全てのユニットは、最速ユニットと比較したSPDに比例した優先度値から開始します。', kr: '를 가진 유닛이 먼저 행동합니다. 다른 모든 유닛은 가장 빠른 유닛과 비교한 SPD에 비례한 우선도 값으로 시작합니다.', zh: '最高的单位先行动。所有其他单位的初始行动值与最快单位的SPD成比例。' } satisfies LangMap, lang)}</p>

                    <Callout variant="info" className="mt-4">
                        <p className="font-semibold text-blue-300">{lRec({ en: 'Example:', jp: '例：', kr: '예시:', zh: '示例：' } satisfies LangMap, lang)}</p>
                        <ul className="list-disc list-inside ml-4 mt-2">
                            <li>{lRec({ en: 'If the fastest unit has', jp: '最速ユニットが', kr: '가장 빠른 유닛이 ', zh: '最快单位' } satisfies LangMap, lang)} <strong>300 SPD</strong>{lRec({ en: ', she starts at', jp: 'の場合、', kr: '면 ', zh: '以' } satisfies LangMap, lang)} <strong>100%</strong> {lRec({ en: 'priority.', jp: '優先度から開始。', kr: '우선도로 시작.', zh: '行动值开始。' } satisfies LangMap, lang)}</li>
                            <li>{lRec({ en: 'A unit with', jp: '', kr: '', zh: '' } satisfies LangMap, lang)} <strong>200 SPD</strong> {lRec({ en: 'starts at', jp: 'のユニットは', kr: ' 유닛은 ', zh: '单位以' } satisfies LangMap, lang)} <strong>66%</strong> (200 × 100 / 300){lRec({ en: '.', jp: 'から開始。', kr: '로 시작.', zh: '开始。' } satisfies LangMap, lang)}</li>
                            <li>{lRec({ en: 'A unit with', jp: '', kr: '', zh: '' } satisfies LangMap, lang)} <strong>150 SPD</strong> {lRec({ en: 'starts at', jp: 'のユニットは', kr: ' 유닛은 ', zh: '单位以' } satisfies LangMap, lang)} <strong>50%</strong> (150 × 100 / 300){lRec({ en: '.', jp: 'から開始。', kr: '로 시작.', zh: '开始。' } satisfies LangMap, lang)}</li>
                        </ul>
                    </Callout>

                    <p className="mt-4">{lRec({ en: "However, the game includes a hidden random variation of", jp: 'ただし、ゲームには各ユニットの開始優先度に適用される', kr: '하지만 게임에는 각 유닛의 시작 우선도에 적용되는 ', zh: '但游戏有一个隐藏的' } satisfies LangMap, lang)} <strong>0-5%</strong> {lRec({ en: "applied to each unit's starting priority. As a result, a slightly slower unit may still act first.", jp: 'の隠れたランダム変動があります。その結果、わずかに遅いユニットでも先に行動する可能性があります。', kr: '의 숨겨진 랜덤 변동이 있습니다. 결과적으로, 약간 느린 유닛이 먼저 행동할 수도 있습니다.', zh: '随机波动应用于每个单位的初始行动值。因此，稍慢的单位可能先行动。' } satisfies LangMap, lang)}</p>

                    <Callout variant="warning" className="mt-4">
                        <p className="font-semibold text-yellow-400">{lRec({ en: 'Example with RNG:', jp: 'RNGを含む例：', kr: 'RNG 포함 예시:', zh: '带RNG的示例：' } satisfies LangMap, lang)}</p>
                        <p className="mt-2">{lRec({ en: 'Unit A:', jp: 'ユニットA：', kr: '유닛 A:', zh: '单位A：' } satisfies LangMap, lang)} 300 SPD → 100% +0% = 100%</p>
                        <p>{lRec({ en: 'Unit B:', jp: 'ユニットB：', kr: '유닛 B:', zh: '单位B：' } satisfies LangMap, lang)} 290 SPD → 96% + 5% = 101%</p>
                        <p className="mt-2">→ <strong>{lRec({ en: 'Unit B will act first.', jp: 'ユニットBが先に行動します。', kr: '유닛 B가 먼저 행동합니다.', zh: '单位B先行动。' } satisfies LangMap, lang)}</strong></p>
                    </Callout>

                    <p className="mt-4">{lRec({ en: 'This mechanic is especially important in', jp: 'このメカニクスは', kr: '이 메카닉은 ', zh: '此机制在' } satisfies LangMap, lang)} <strong>PvP</strong>{lRec({ en: ', where the first turn can greatly influence the outcome of a match.', jp: 'で特に重要で、1ターン目が試合の結果に大きく影響する可能性があります。', kr: '에서 특히 중요하며, 1턴이 경기 결과에 큰 영향을 미칠 수 있습니다.', zh: '中特别重要，第1回合可能决定比赛结果。' } satisfies LangMap, lang)}</p>
                </ContentCard>

                <ContentCard>
                    <h4 className="text-lg font-semibold text-sky-300">{lRec({ en: 'Speed Buffs at Battle Start', jp: '戦闘開始時の速度バフ', kr: '전투 시작 시 속도 버프', zh: '战斗开始时的速度增益' } satisfies LangMap, lang)}</h4>
                    <p>{lRec({ en: 'Some units may start the battle with a', jp: '一部のユニットは', kr: '일부 유닛은 ', zh: '部分单位带' } satisfies LangMap, lang)} {parseText('{B/BT_STAT|ST_SPEED}')}{lRec({ en: ', significantly altering turn order.', jp: 'を持って戦闘を開始し、ターン順序を大きく変更する可能性があります。', kr: '를 가지고 전투를 시작하여 턴 순서를 크게 바꿀 수 있습니다.', zh: '开始战斗，可以显著改变回合顺序。' } satisfies LangMap, lang)}</p>

                    <Callout variant="info" className="mt-4">
                        <p className="font-semibold text-purple-300">{lRec({ en: 'Example:', jp: '例：', kr: '예시:', zh: '示例：' } satisfies LangMap, lang)}</p>
                        <p className="mt-2">{parseText('{P/Tamara}')}: 300 SPD → 100% {lRec({ en: 'priority', jp: '優先度', kr: '우선도', zh: '行动值' } satisfies LangMap, lang)}</p>
                        <p>{parseText('{P/Dahlia}')}: 280 SPD → 93% (280 × 100 / 300)</p>
                        <p className="mt-2">{lRec({ en: 'Normally,', jp: '通常、', kr: '일반적으로 ', zh: '通常' } satisfies LangMap, lang)} {parseText('{P/Tamara}')} {lRec({ en: 'would go first.', jp: 'が先に行動します。', kr: '가 먼저 행동합니다.', zh: '先行动。' } satisfies LangMap, lang)}</p>
                        <p className="mt-2">{lRec({ en: 'But if', jp: 'しかし、', kr: '하지만 ', zh: '但如果' } satisfies LangMap, lang)} {parseText('{P/Dahlia}')} {lRec({ en: 'starts with a', jp: 'が', kr: '가 ', zh: '带' } satisfies LangMap, lang)} {parseText('{B/BT_STAT|ST_SPEED}')}{lRec({ en: ' (e.g., from her EE), her effective SPD becomes:', jp: 'を持って開始すると（例：EEから）、有効SPDは：', kr: '로 시작하면(예: EE에서), 유효 SPD는:', zh: '开始（如从EE），有效SPD为：' } satisfies LangMap, lang)}</p>
                        <p>280 × 1.3 = 364 → 100% {lRec({ en: 'priority', jp: '優先度', kr: '우선도', zh: '行动值' } satisfies LangMap, lang)}</p>
                        <p>{parseText('{P/Tamara}')}: 300 SPD → <strong>82%</strong> (300 × 100 / 364)</p>
                        <p className="mt-2">→ <strong>{parseText('{P/Dahlia}')} {lRec({ en: 'will act first.', jp: 'が先に行動します。', kr: '가 먼저 행동합니다.', zh: '先行动。' } satisfies LangMap, lang)}</strong></p>
                    </Callout>

                    <p className="mt-4">{lRec({ en: 'Some transcendence perks also grant', jp: '一部の超越特典はチーム全体に', kr: '일부 초월 특전은 팀 전체에 ', zh: '部分超越特权为全队提供' } satisfies LangMap, lang)} {parseText('{S/SPD}')} {lRec({ en: 'bonuses to the entire team, such as with', jp: 'ボーナスを付与します（', kr: ' 보너스를 부여합니다(', zh: '加成（如' } satisfies LangMap, lang)} {parseText('{P/Mene}')} {lRec({ en: 'or', jp: 'や', kr: '나 ', zh: '或' } satisfies LangMap, lang)} {parseText('{P/Demiurge Delta}')}{lRec({ en: '.', jp: 'など）。', kr: ' 등).', zh: '）。' } satisfies LangMap, lang)}</p>
                </ContentCard>
            </section>

            {/* Special Mechanics */}
            <section className="space-y-6">
                <GuideSectionHeading>{lRec(LABELS.combatHeadings.specialMechanics, lang)}</GuideSectionHeading>

                <div className="space-y-4">
                    <ContentCard>
                        <h4 className="text-lg font-semibold text-amber-300">{lRec({ en: 'Extra Turns', jp: '追加ターン', kr: '추가 턴', zh: '额外回合' } satisfies LangMap, lang)}</h4>
                        <p>{lRec({ en: 'If a skill applies', jp: 'スキルが', kr: '스킬이 ', zh: '当技能施加' } satisfies LangMap, lang)} {parseText('{B/BT_ADDITIVE_TURN}')}{lRec({ en: ', the character will immediately take another full turn (including all phases) before resetting to 0% priority.', jp: 'を適用すると、キャラクターは0%優先度にリセットされる前に、即座に完全なターン（全てのフェーズを含む）を取ります。', kr: '를 적용하면, 캐릭터는 0% 우선도로 리셋되기 전에 즉시 완전한 턴(모든 단계 포함)을 가집니다.', zh: '时，角色在行动值重置为0%前立即获得完整回合（包括所有阶段）。' } satisfies LangMap, lang)}</p>
                    </ContentCard>

                    <ContentCard>
                        <h4 className="text-lg font-semibold text-amber-300">{lRec({ en: "Demiurge Vlada's Passive", jp: 'デミウルゴスヴラダのパッシブ', kr: '데미우르고스 블라다의 패시브', zh: '造物主弗拉达的被动' } satisfies LangMap, lang)}</h4>
                        <p>{lRec({ en: 'If a 5★', jp: '5★ ', kr: '5★ ', zh: '当5★' } satisfies LangMap, lang)} {parseText('{P/Demiurge Vlada}')} {lRec({ en: 'is in battle, all', jp: 'が戦闘にいる場合、敵チームの全ての', kr: '가 전투에 있으면, 적 팀의 모든 ', zh: '在战斗中时，敌方队伍所有' } satisfies LangMap, lang)} <strong>{lRec({ en: 'priority gain effects', jp: '優先度増加効果', kr: '우선도 증가 효과', zh: '行动值增加效果' } satisfies LangMap, lang)}</strong> {lRec({ en: 'on the enemy team are reduced by', jp: 'が', kr: '가 ', zh: '减少' } satisfies LangMap, lang)} <strong>50%</strong>{lRec({ en: '.', jp: '減少します。', kr: ' 감소합니다.', zh: '。' } satisfies LangMap, lang)}</p>
                    </ContentCard>

                    <ContentCard>
                        <h4 className="text-lg font-semibold text-amber-300">{lRec({ en: 'Arena Field Skills', jp: 'アリーナフィールドスキル', kr: '아레나 필드 스킬', zh: '竞技场场地技能' } satisfies LangMap, lang)}</h4>
                        <p>{lRec({ en: 'In arena, field skills are applied. These change every season — here is an example:', jp: 'アリーナではフィールドスキルが適用されます。これらはシーズンごとに変わります — 以下は一例です：', kr: '아레나에서는 필드 스킬이 적용됩니다. 이것들은 시즌마다 바뀝니다 — 다음은 예시입니다:', zh: '竞技场有场地技能生效。这些每赛季更换——以下为示例：' } satisfies LangMap, lang)}</p>
                        <ul className="list-disc list-inside ml-4 mt-3 space-y-2">
                            <li>
                                <InlineIcon icon={GUIDE_IMG + 'Skill_PVP_LeagueBuff_01.webp'} label={lRec({ en: 'Pulse of the mighty', jp: '強者の鼓動', kr: '강자의 고동', zh: '强者的心跳' } satisfies LangMap, lang)} /> <strong>{lRec({ en: 'Pulse of the mighty', jp: '強者の鼓動', kr: '강자의 고동', zh: '强者的心跳' } satisfies LangMap, lang)}</strong>: {lRec({ en: 'increase all heroes', jp: 'ゴールドIII以降、全てのヒーローの', kr: '골드 III 이후, 모든 영웅의 ', zh: '黄金III以上，所有英雄' } satisfies LangMap, lang)} {parseText('{S/RES}')} {lRec({ en: 'by 50 after Gold III', jp: 'を50増加', kr: '를 50 증가', zh: '增加50' } satisfies LangMap, lang)}
                            </li>
                            <li>
                                <InlineIcon icon={GUIDE_IMG + 'Skill_PVP_Penalty.webp'} label={lRec({ en: "Duelist's Pledge", jp: '決闘者の誓い', kr: '결투자의 맹세', zh: '决斗者的誓言' } satisfies LangMap, lang)} /> <strong>{lRec({ en: "Duelist's Pledge", jp: '決闘者の誓い', kr: '결투자의 맹세', zh: '决斗者的誓言' } satisfies LangMap, lang)}</strong>: {lRec({ en: 'decrease priority by 50% after resurrection. Every 10 turn, deals 10% of max HP to all heroes as true damage (bypassing', jp: '復活後、優先度を50%減少。10ターンごとに、全てのヒーローに最大HPの10%を固定ダメージとして与える（', kr: '부활 후 우선도 50% 감소. 10턴마다 모든 영웅에게 최대 HP의 10%를 고정 데미지로 줌 (', zh: '复活后行动值减少50%。每10回合对所有英雄造成最大HP 10%的固定伤害（无视' } satisfies LangMap, lang)} {parseText('{B/BT_INVINCIBLE}')}, {parseText('{B/BT_UNDEAD}')}{lRec({ en: ')', jp: 'を貫通）', kr: ' 관통)', zh: '）' } satisfies LangMap, lang)}
                            </li>
                        </ul>
                    </ContentCard>
                </div>
            </section>
        </div>
    )
}
