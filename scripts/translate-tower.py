"""Fill missing jp/kr/zh translations in data/tower/very-hard.json.

Walks every LangText node (has en/jp/kr/zh keys) and, when a translation is
missing, looks it up in the TRANSLATIONS dict below. Leaves already-translated
entries untouched. Preserves file EOL and trailing newline.
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILE = os.path.join(ROOT, 'data', 'tower', 'very-hard.json')

TRANSLATIONS: dict[str, dict[str, str]] = {
    "100% {D/BT_STUN} options": {
        "jp": "100% {D/BT_STUN}オプション",
        "kr": "100% {D/BT_STUN} 옵션",
        "zh": "100% {D/BT_STUN}选项",
    },
    "100% {D/BT_STUN} source": {
        "jp": "100% {D/BT_STUN}発生源",
        "kr": "100% {D/BT_STUN} 출처",
        "zh": "100% {D/BT_STUN}来源",
    },
    "1\u2605 with {B/BT_REMOVE_DEBUFF}.": {
        "jp": "{B/BT_REMOVE_DEBUFF}を持つ1\u2605キャラ。",
        "kr": "{B/BT_REMOVE_DEBUFF}을 가진 1\u2605 캐릭터.",
        "zh": "拥有{B/BT_REMOVE_DEBUFF}的1\u2605角色。",
    },
    "2 ways to handle the fight :": {
        "jp": "この戦闘を攻略する2つの方法：",
        "kr": "이 전투를 공략하는 2가지 방법:",
        "zh": "应对此战斗的 2 种方法：",
    },
    "Another way to counter it is by using {P/Ember} with enough {S/EFF} to inflict {D/BT_DOT_BURN}.": {
        "jp": "もう一つの対策は、{S/EFF}を十分に積んだ{P/Ember}で{D/BT_DOT_BURN}を付与することです。",
        "kr": "또 다른 대처법은 충분한 {S/EFF}를 갖춘 {P/Ember}로 {D/BT_DOT_BURN}을 부여하는 것입니다.",
        "zh": "另一种应对方式是使用携带足够{S/EFF}的{P/Ember}来施加{D/BT_DOT_BURN}。",
    },
    "Best way is by using {B/BT_ACTION_GAUGE}, {D/BT_ACTION_GAUGE} and hard CC like {D/BT_STUN}, {D/BT_FREEZE} and {D/BT_GOLDEN_CURSE}.": {
        "jp": "最善策は{B/BT_ACTION_GAUGE}、{D/BT_ACTION_GAUGE}、そして{D/BT_STUN}、{D/BT_FREEZE}、{D/BT_GOLDEN_CURSE}のような強力なCCを活用することです。",
        "kr": "가장 좋은 방법은 {B/BT_ACTION_GAUGE}, {D/BT_ACTION_GAUGE}, 그리고 {D/BT_STUN}, {D/BT_FREEZE}, {D/BT_GOLDEN_CURSE} 같은 강력한 CC를 활용하는 것입니다.",
        "zh": "最佳方式是使用{B/BT_ACTION_GAUGE}、{D/BT_ACTION_GAUGE}以及{D/BT_STUN}、{D/BT_FREEZE}和{D/BT_GOLDEN_CURSE}等强控。",
    },
    "Bring {B/BT_REMOVE_DEBUFF} and you'll be fine.": {
        "jp": "{B/BT_REMOVE_DEBUFF}を編成すれば問題ありません。",
        "kr": "{B/BT_REMOVE_DEBUFF}을 데려가면 괜찮습니다.",
        "zh": "带上{B/BT_REMOVE_DEBUFF}就没问题。",
    },
    "Consistently inflict {D/BT_DOT_LIGHTNING} to deal damage, as she cleanses herself with {B/BT_REMOVE_DEBUFF} at the start of her turn.": {
        "jp": "ターン開始時に{B/BT_REMOVE_DEBUFF}で自身を浄化するため、継続的に{D/BT_DOT_LIGHTNING}を付与してダメージを与えましょう。",
        "kr": "턴 시작 시 {B/BT_REMOVE_DEBUFF}로 자신을 정화하므로, 지속적으로 {D/BT_DOT_LIGHTNING}을 부여해 피해를 줘야 합니다.",
        "zh": "她会在回合开始时用{B/BT_REMOVE_DEBUFF}自净,所以需要持续施加{D/BT_DOT_LIGHTNING}造成伤害。",
    },
    "Control and focus the core to prevent {P/Poolside Trickster Regina} to play. Both priority reductions and stun.": {
        "jp": "{P/Poolside Trickster Regina}に行動させないよう、コアを制圧・集中攻撃しましょう。行動順低下と{D/BT_STUN}の両方を使います。",
        "kr": "{P/Poolside Trickster Regina}이(가) 행동하지 못하도록 코어를 제압하고 집중 공격하세요. 행동 순서 감소와 스턴 모두 활용합니다.",
        "zh": "控制并集火核心,避免{P/Poolside Trickster Regina}行动。行动顺序降低和{D/BT_STUN}都要使用。",
    },
    "Control since she lack of immunity towards any stun.": {
        "jp": "{D/BT_STUN}に対する耐性がないので、行動制御しましょう。",
        "kr": "어떤 스턴에도 면역이 없으므로 행동을 제어하세요.",
        "zh": "她对任何{D/BT_STUN}都没有免疫,进行控制即可。",
    },
    "DPS with {B/BT_REMOVE_DEBUFF} on {B/BT_REVENGE}.": {
        "jp": "{B/BT_REVENGE}時に{B/BT_REMOVE_DEBUFF}を持つDPS。",
        "kr": "{B/BT_REVENGE} 시 {B/BT_REMOVE_DEBUFF}를 가진 DPS.",
        "zh": "具有{B/BT_REVENGE}时触发{B/BT_REMOVE_DEBUFF}的 DPS。",
    },
    "DPS with {B/BT_REVENGE}.": {
        "jp": "{B/BT_REVENGE}を持つDPS。",
        "kr": "{B/BT_REVENGE}를 가진 DPS.",
        "zh": "拥有{B/BT_REVENGE}的 DPS。",
    },
    "Damage mitigation options": {
        "jp": "被ダメージ軽減オプション",
        "kr": "피해 감소 옵션",
        "zh": "减伤选项",
    },
    "Either brute force with your strongest DPS units": {
        "jp": "あるいは最強のDPSユニットで力押しする方法",
        "kr": "또는 가장 강력한 DPS 유닛으로 힘으로 밀어붙이기",
        "zh": "或者用你最强的 DPS 角色强行击破",
    },
    "Hard CC lock.": {
        "jp": "強力なCCでロック。",
        "kr": "강력한 CC 락.",
        "zh": "强控锁定。",
    },
    "Hard CC options.": {
        "jp": "強力なCCオプション。",
        "kr": "강력한 CC 옵션.",
        "zh": "强控选项。",
    },
    "Have both 1 hard CC and {D/BT_ACTION_GAUGE}.": {
        "jp": "強力なCCを1つと{D/BT_ACTION_GAUGE}の両方を持つこと。",
        "kr": "강력한 CC 1개와 {D/BT_ACTION_GAUGE}를 모두 보유.",
        "zh": "同时拥有 1 个强控和{D/BT_ACTION_GAUGE}。",
    },
    "High survivability units is recommended.": {
        "jp": "生存力の高いユニットが推奨されます。",
        "kr": "생존력이 높은 유닛을 추천합니다.",
        "zh": "推荐使用高生存力角色。",
    },
    "If she manages to heal herself too much you can utilize {D/BT_DOT_BLEED}.": {
        "jp": "彼女の自己回復が多すぎる場合は、{D/BT_DOT_BLEED}を活用できます。",
        "kr": "그녀가 자가 회복을 너무 많이 하면 {D/BT_DOT_BLEED}를 활용할 수 있습니다.",
        "zh": "如果她自我治疗过多,可以使用{D/BT_DOT_BLEED}。",
    },
    "Inflicts {D/BT_DOT_BURN} when taking a hit.": {
        "jp": "被弾時に{D/BT_DOT_BURN}を付与します。",
        "kr": "피격 시 {D/BT_DOT_BURN}을 부여합니다.",
        "zh": "受击时施加{D/BT_DOT_BURN}。",
    },
    "Just focus main {P/Maxwell} with single target.": {
        "jp": "単体攻撃で本体の{P/Maxwell}を集中攻撃するだけです。",
        "kr": "단일 공격으로 본체 {P/Maxwell}만 집중 공격하세요.",
        "zh": "用单体攻击集火本体{P/Maxwell}即可。",
    },
    "Just focus {P/Mero}.": {
        "jp": "{P/Mero}を集中攻撃するだけです。",
        "kr": "{P/Mero}만 집중 공격하세요.",
        "zh": "集火{P/Mero}即可。",
    },
    "Just go nuclear on her and bring your strongest DPS units.": {
        "jp": "最強のDPSユニットで一気に叩きましょう。",
        "kr": "가장 강력한 DPS 유닛으로 한 번에 폭딜하세요.",
        "zh": "带上最强的 DPS 角色全力轰杀她。",
    },
    "Max speed {C/Ranger} to {D/BT_SILENCE} or {D/BT_SEALED}.": {
        "jp": "最大速度の{C/Ranger}で{D/BT_SILENCE}または{D/BT_SEALED}を付与。",
        "kr": "최대 속도의 {C/Ranger}로 {D/BT_SILENCE} 또는 {D/BT_SEALED}를 부여.",
        "zh": "最大速度的{C/Ranger}施加{D/BT_SILENCE}或{D/BT_SEALED}。",
    },
    "MvP on this boss fight.": {
        "jp": "このボス戦のMVPです。",
        "kr": "이 보스전의 MVP입니다.",
        "zh": "本场 Boss 战的 MVP。",
    },
    "No crit builds or {B/HEAVY_STRIKE} unless you can endure the passive and brute force it.": {
        "jp": "パッシブに耐えて力押しできない限り、クリティカルビルドや{B/HEAVY_STRIKE}は避けましょう。",
        "kr": "패시브를 견디고 힘으로 밀어붙일 수 있는 게 아니라면 치명타 빌드나 {B/HEAVY_STRIKE}는 피하세요.",
        "zh": "除非你能扛住被动并强行通关,否则不要使用暴击流或{B/HEAVY_STRIKE}。",
    },
    "One of the best ways to counter it is to utilize {B/BT_STAT|ST_COUNTER_RATE} to accumulate chain points faster.": {
        "jp": "最善の対策の一つは、{B/BT_STAT|ST_COUNTER_RATE}を活用してチェインポイントを早く貯めることです。",
        "kr": "가장 좋은 대처법 중 하나는 {B/BT_STAT|ST_COUNTER_RATE}를 활용해 체인 포인트를 빠르게 쌓는 것입니다.",
        "zh": "应对此 Boss 的最佳方式之一是利用{B/BT_STAT|ST_COUNTER_RATE}更快地累积连锁点数。",
    },
    "Other hard CC options": {
        "jp": "その他の強力なCCオプション",
        "kr": "기타 강력한 CC 옵션",
        "zh": "其他强控选项",
    },
    "Priority war machines.": {
        "jp": "行動順操作の要となるキャラ。",
        "kr": "행동 우선도 조작 핵심 유닛.",
        "zh": "行动顺序操控核心角色。",
    },
    "Single target {P/Edelweiss} then {P/Fatal}.": {
        "jp": "単体攻撃で{P/Edelweiss}を倒してから{P/Fatal}を狙いましょう。",
        "kr": "단일 공격으로 {P/Edelweiss}를 먼저 처치한 후 {P/Fatal}을 공격하세요.",
        "zh": "用单体攻击先击杀{P/Edelweiss},然后击杀{P/Fatal}。",
    },
    "Sturdy DPS units": {
        "jp": "耐久力のあるDPSユニット",
        "kr": "내구성 있는 DPS 유닛",
        "zh": "坚韧的 DPS 角色",
    },
    "Sturdy DPS units are recommended.": {
        "jp": "耐久力のあるDPSユニットが推奨されます。",
        "kr": "내구성 있는 DPS 유닛을 추천합니다.",
        "zh": "推荐使用坚韧的 DPS 角色。",
    },
    "Sturdy DPS units.": {
        "jp": "耐久力のあるDPSユニット。",
        "kr": "내구성 있는 DPS 유닛.",
        "zh": "坚韧的 DPS 角色。",
    },
    "Support Unit to provide chain points, WG damage and healing.": {
        "jp": "チェインポイント、WGダメージ、回復を提供するサポートユニット。",
        "kr": "체인 포인트, WG 피해, 회복을 제공하는 서포트 유닛.",
        "zh": "提供连锁点数、WG 伤害和治疗的辅助角色。",
    },
    "Tank that can protect allies.": {
        "jp": "味方を守れるタンク。",
        "kr": "아군을 보호할 수 있는 탱커.",
        "zh": "能够保护队友的坦克。",
    },
    "Team wide {B/BT_STAT|ST_BUFF_CHANCE} buff": {
        "jp": "全体への{B/BT_STAT|ST_BUFF_CHANCE}バフ",
        "kr": "전체 {B/BT_STAT|ST_BUFF_CHANCE} 버프",
        "zh": "全队{B/BT_STAT|ST_BUFF_CHANCE}增益",
    },
    "Two way to handle the fight :": {
        "jp": "この戦闘を攻略する2つの方法：",
        "kr": "이 전투를 공략하는 2가지 방법:",
        "zh": "应对此战斗的 2 种方法：",
    },
    "Units that will help your team to survive": {
        "jp": "チームの生存に役立つユニット",
        "kr": "팀의 생존에 도움이 되는 유닛",
        "zh": "有助于队伍生存的角色",
    },
    "Units with {B/BT_STAT|ST_COUNTER_RATE} in their kits": {
        "jp": "スキルに{B/BT_STAT|ST_COUNTER_RATE}を持つユニット",
        "kr": "스킬에 {B/BT_STAT|ST_COUNTER_RATE}를 가진 유닛",
        "zh": "技能组中带有{B/BT_STAT|ST_COUNTER_RATE}的角色",
    },
    "Validate restriction and have a hard CC": {
        "jp": "制限を満たし、強力なCCを持つこと",
        "kr": "제한을 충족하고 강력한 CC를 보유",
        "zh": "满足限制并拥有强控",
    },
    "Validate restriction and have either hard CC or good priority manipulation.": {
        "jp": "制限を満たし、強力なCCか優れた行動順操作のいずれかを持つこと。",
        "kr": "제한을 충족하고 강력한 CC 또는 뛰어난 행동 우선도 조작 중 하나를 보유.",
        "zh": "满足限制,并拥有强控或出色的行动顺序操控。",
    },
    "Validate restriction and have either {D/BT_ACTION_GAUGE} or {B/BT_ACTION_GAUGE}.": {
        "jp": "制限を満たし、{D/BT_ACTION_GAUGE}か{B/BT_ACTION_GAUGE}のいずれかを持つこと。",
        "kr": "제한을 충족하고 {D/BT_ACTION_GAUGE} 또는 {B/BT_ACTION_GAUGE} 중 하나를 보유.",
        "zh": "满足限制,并拥有{D/BT_ACTION_GAUGE}或{B/BT_ACTION_GAUGE}。",
    },
    "Validate restriction and have either {D/BT_SILENCE} or {D/BT_SEALED_RESURRECTION}": {
        "jp": "制限を満たし、{D/BT_SILENCE}か{D/BT_SEALED_RESURRECTION}のいずれかを持つこと",
        "kr": "제한을 충족하고 {D/BT_SILENCE} 또는 {D/BT_SEALED_RESURRECTION} 중 하나를 보유",
        "zh": "满足限制,并拥有{D/BT_SILENCE}或{D/BT_SEALED_RESURRECTION}",
    },
    "Validate restriction and have {B/BT_CALL_BACKUP}.": {
        "jp": "制限を満たし、{B/BT_CALL_BACKUP}を持つこと。",
        "kr": "제한을 충족하고 {B/BT_CALL_BACKUP}을 보유.",
        "zh": "满足限制并拥有{B/BT_CALL_BACKUP}。",
    },
    "Validate restriction and have {B/BT_REMOVE_DEBUFF} and {B/BT_IMMUNE}.": {
        "jp": "制限を満たし、{B/BT_REMOVE_DEBUFF}と{B/BT_IMMUNE}を持つこと。",
        "kr": "제한을 충족하고 {B/BT_REMOVE_DEBUFF}와 {B/BT_IMMUNE}을 보유.",
        "zh": "满足限制并拥有{B/BT_REMOVE_DEBUFF}和{B/BT_IMMUNE}。",
    },
    "Validate restriction and have {B/BT_REMOVE_DEBUFF} and/or {B/BT_IMMUNE}.": {
        "jp": "制限を満たし、{B/BT_REMOVE_DEBUFF}および/または{B/BT_IMMUNE}を持つこと。",
        "kr": "제한을 충족하고 {B/BT_REMOVE_DEBUFF} 또는 {B/BT_IMMUNE}(또는 둘 다)을 보유.",
        "zh": "满足限制并拥有{B/BT_REMOVE_DEBUFF}和/或{B/BT_IMMUNE}。",
    },
    "Validate restriction and have {B/BT_REMOVE_DEBUFF} or {B/BT_IMMUNE}.": {
        "jp": "制限を満たし、{B/BT_REMOVE_DEBUFF}か{B/BT_IMMUNE}を持つこと。",
        "kr": "제한을 충족하고 {B/BT_REMOVE_DEBUFF} 또는 {B/BT_IMMUNE}을 보유.",
        "zh": "满足限制并拥有{B/BT_REMOVE_DEBUFF}或{B/BT_IMMUNE}。",
    },
    "Validate restriction and have {B/BT_REMOVE_DEBUFF}.": {
        "jp": "制限を満たし、{B/BT_REMOVE_DEBUFF}を持つこと。",
        "kr": "제한을 충족하고 {B/BT_REMOVE_DEBUFF}을 보유.",
        "zh": "满足限制并拥有{B/BT_REMOVE_DEBUFF}。",
    },
    "Validate restriction and have {B/BT_STAT|ST_COUNTER_RATE} in her kit.": {
        "jp": "制限を満たし、スキルに{B/BT_STAT|ST_COUNTER_RATE}を持つこと。",
        "kr": "제한을 충족하고 스킬에 {B/BT_STAT|ST_COUNTER_RATE}를 보유.",
        "zh": "满足限制,且技能组中带有{B/BT_STAT|ST_COUNTER_RATE}。",
    },
    "Validate restriction and have {B/BT_STAT|ST_COUNTER_RATE} in their kits": {
        "jp": "制限を満たし、スキルに{B/BT_STAT|ST_COUNTER_RATE}を持つこと",
        "kr": "제한을 충족하고 스킬에 {B/BT_STAT|ST_COUNTER_RATE}를 보유",
        "zh": "满足限制,且技能组中带有{B/BT_STAT|ST_COUNTER_RATE}",
    },
    "Validate restriction and have {D/BT_DOT_BLEED}.": {
        "jp": "制限を満たし、{D/BT_DOT_BLEED}を持つこと。",
        "kr": "제한을 충족하고 {D/BT_DOT_BLEED}을 보유.",
        "zh": "满足限制并拥有{D/BT_DOT_BLEED}。",
    },
    "Validate restriction and have {D/BT_SEALED_RECEIVE_HEAL}.": {
        "jp": "制限を満たし、{D/BT_SEALED_RECEIVE_HEAL}を持つこと。",
        "kr": "제한을 충족하고 {D/BT_SEALED_RECEIVE_HEAL}을 보유.",
        "zh": "满足限制并拥有{D/BT_SEALED_RECEIVE_HEAL}。",
    },
    "Validate restriction and have {D/BT_SEALED_RESURRECTION}": {
        "jp": "制限を満たし、{D/BT_SEALED_RESURRECTION}を持つこと",
        "kr": "제한을 충족하고 {D/BT_SEALED_RESURRECTION}을 보유",
        "zh": "满足限制并拥有{D/BT_SEALED_RESURRECTION}",
    },
    "Validate restriction and hit hard.": {
        "jp": "制限を満たし、強力な火力で殴ること。",
        "kr": "제한을 충족하고 강력한 화력으로 공격.",
        "zh": "满足限制并全力输出。",
    },
    "Validate restriction and team wide {B/BT_STAT|ST_BUFF_CHANCE} buff": {
        "jp": "制限を満たし、全体への{B/BT_STAT|ST_BUFF_CHANCE}バフを持つこと",
        "kr": "제한을 충족하고 전체 {B/BT_STAT|ST_BUFF_CHANCE} 버프 보유",
        "zh": "满足限制并拥有全队{B/BT_STAT|ST_BUFF_CHANCE}增益",
    },
    "Validate restriction and will help your team to survive": {
        "jp": "制限を満たし、チームの生存に役立つこと",
        "kr": "제한을 충족하고 팀의 생존에 도움이 되는 유닛",
        "zh": "满足限制,且有助于队伍生存",
    },
    "Validate restriction and {B/BT_STAT|ST_COUNTER_RATE} in their kits": {
        "jp": "制限を満たし、スキルに{B/BT_STAT|ST_COUNTER_RATE}を持つこと",
        "kr": "제한을 충족하고 스킬에 {B/BT_STAT|ST_COUNTER_RATE}를 보유",
        "zh": "满足限制,且技能组中带有{B/BT_STAT|ST_COUNTER_RATE}",
    },
    "Validate restriction and {SK/Caren|S2} will automatically target {P/Fatal} and {SK/Caren|S1} will hit both target.": {
        "jp": "制限を満たせば、{SK/Caren|S2}は自動で{P/Fatal}を狙い、{SK/Caren|S1}は両方の敵にヒットします。",
        "kr": "제한을 충족하면 {SK/Caren|S2}는 자동으로 {P/Fatal}을 노리고, {SK/Caren|S1}은 두 대상 모두에게 명중합니다.",
        "zh": "满足限制后,{SK/Caren|S2}会自动锁定{P/Fatal},{SK/Caren|S1}会同时命中两个目标。",
    },
    "Validate restriction plus she has both {B/BT_REMOVE_DEBUFF} and {B/BT_IMMUNE}.": {
        "jp": "制限を満たし、さらに{B/BT_REMOVE_DEBUFF}と{B/BT_IMMUNE}の両方を持っています。",
        "kr": "제한을 충족하며, {B/BT_REMOVE_DEBUFF}와 {B/BT_IMMUNE}을 모두 보유.",
        "zh": "满足限制,并同时拥有{B/BT_REMOVE_DEBUFF}和{B/BT_IMMUNE}。",
    },
    "Validate restriction.": {
        "jp": "制限を満たすこと。",
        "kr": "제한 충족.",
        "zh": "满足限制。",
    },
    "Will help your team to survive.": {
        "jp": "チームの生存に役立ちます。",
        "kr": "팀의 생존에 도움이 됩니다.",
        "zh": "有助于队伍生存。",
    },
    "You need to {D/BT_STUN} both and keep the stun up in order to remove and prevent Iota from regaining her {B/BT_INVINCIBLE}.": {
        "jp": "イオタが{B/BT_INVINCIBLE}を再取得するのを防ぐために、両方に{D/BT_STUN}をかけ続ける必要があります。",
        "kr": "이오타가 {B/BT_INVINCIBLE}을 재획득하지 못하도록 양쪽 모두에 {D/BT_STUN}을 지속적으로 유지해야 합니다.",
        "zh": "你需要对两者都施加{D/BT_STUN}并持续维持,以防止 Iota 重新获得{B/BT_INVINCIBLE}。",
    },
    "{B/BT_CALL_BACKUP} support options.": {
        "jp": "{B/BT_CALL_BACKUP}サポートオプション。",
        "kr": "{B/BT_CALL_BACKUP} 서포트 옵션.",
        "zh": "{B/BT_CALL_BACKUP}辅助选项。",
    },
    "{B/BT_IMMUNE} options": {
        "jp": "{B/BT_IMMUNE}オプション",
        "kr": "{B/BT_IMMUNE} 옵션",
        "zh": "{B/BT_IMMUNE}选项",
    },
    "{B/BT_REMOVE_DEBUFF} and {B/BT_IMMUNE} options": {
        "jp": "{B/BT_REMOVE_DEBUFF}と{B/BT_IMMUNE}のオプション",
        "kr": "{B/BT_REMOVE_DEBUFF}와 {B/BT_IMMUNE} 옵션",
        "zh": "{B/BT_REMOVE_DEBUFF}与{B/BT_IMMUNE}选项",
    },
    "{B/BT_REMOVE_DEBUFF} and {B/BT_IMMUNE}.": {
        "jp": "{B/BT_REMOVE_DEBUFF}と{B/BT_IMMUNE}。",
        "kr": "{B/BT_REMOVE_DEBUFF}와 {B/BT_IMMUNE}.",
        "zh": "{B/BT_REMOVE_DEBUFF}与{B/BT_IMMUNE}。",
    },
    "{B/BT_REMOVE_DEBUFF} options": {
        "jp": "{B/BT_REMOVE_DEBUFF}オプション",
        "kr": "{B/BT_REMOVE_DEBUFF} 옵션",
        "zh": "{B/BT_REMOVE_DEBUFF}选项",
    },
    "{B/BT_REMOVE_DEBUFF}, {B/BT_IMMUNE} and {B/BT_REVENGE} will do the job.": {
        "jp": "{B/BT_REMOVE_DEBUFF}、{B/BT_IMMUNE}、{B/BT_REVENGE}で対処できます。",
        "kr": "{B/BT_REMOVE_DEBUFF}, {B/BT_IMMUNE}, {B/BT_REVENGE}로 충분합니다.",
        "zh": "{B/BT_REMOVE_DEBUFF}、{B/BT_IMMUNE}和{B/BT_REVENGE}就足够应对。",
    },
    "{B/BT_STAT|ST_BUFF_CHANCE} buffer is recommended.": {
        "jp": "{B/BT_STAT|ST_BUFF_CHANCE}バッファーが推奨されます。",
        "kr": "{B/BT_STAT|ST_BUFF_CHANCE} 버퍼를 추천합니다.",
        "zh": "推荐使用{B/BT_STAT|ST_BUFF_CHANCE}辅助。",
    },
    "{B/BT_STAT|ST_COUNTER_RATE} in her kit.": {
        "jp": "スキルに{B/BT_STAT|ST_COUNTER_RATE}を持っています。",
        "kr": "스킬에 {B/BT_STAT|ST_COUNTER_RATE}를 보유.",
        "zh": "技能组中带有{B/BT_STAT|ST_COUNTER_RATE}。",
    },
    "{B/BT_STAT|ST_COUNTER_RATE} units are very useful here.": {
        "jp": "{B/BT_STAT|ST_COUNTER_RATE}ユニットが非常に有効です。",
        "kr": "{B/BT_STAT|ST_COUNTER_RATE} 유닛이 매우 유용합니다.",
        "zh": "{B/BT_STAT|ST_COUNTER_RATE}角色在此非常有用。",
    },
    "{B/HEAVY_STRIKE} unit and validate restriction.": {
        "jp": "{B/HEAVY_STRIKE}ユニットで制限を満たすこと。",
        "kr": "{B/HEAVY_STRIKE} 유닛으로 제한 충족.",
        "zh": "{B/HEAVY_STRIKE}角色并满足限制。",
    },
    "{B/HEAVY_STRIKE} units.": {
        "jp": "{B/HEAVY_STRIKE}ユニット。",
        "kr": "{B/HEAVY_STRIKE} 유닛.",
        "zh": "{B/HEAVY_STRIKE}角色。",
    },
    "{C/Healer} options with {B/BT_REVIVAL} or {B/BT_RESURRECTION}.": {
        "jp": "{B/BT_REVIVAL}または{B/BT_RESURRECTION}を持つ{C/Healer}オプション。",
        "kr": "{B/BT_REVIVAL} 또는 {B/BT_RESURRECTION}을 가진 {C/Healer} 옵션.",
        "zh": "带有{B/BT_REVIVAL}或{B/BT_RESURRECTION}的{C/Healer}选项。",
    },
    "{C/Healer} options.": {
        "jp": "{C/Healer}オプション。",
        "kr": "{C/Healer} 옵션.",
        "zh": "{C/Healer}选项。",
    },
    "{C/Ranger} with {D/BT_SEALED} or {D/BT_SILENCE}.": {
        "jp": "{D/BT_SEALED}または{D/BT_SILENCE}を持つ{C/Ranger}。",
        "kr": "{D/BT_SEALED} 또는 {D/BT_SILENCE}을 가진 {C/Ranger}.",
        "zh": "拥有{D/BT_SEALED}或{D/BT_SILENCE}的{C/Ranger}。",
    },
    "{D/BT_DOT_BLEED} options.": {
        "jp": "{D/BT_DOT_BLEED}オプション。",
        "kr": "{D/BT_DOT_BLEED} 옵션.",
        "zh": "{D/BT_DOT_BLEED}选项。",
    },
    "{D/BT_DOT_LIGHTNING} source": {
        "jp": "{D/BT_DOT_LIGHTNING}発生源",
        "kr": "{D/BT_DOT_LIGHTNING} 출처",
        "zh": "{D/BT_DOT_LIGHTNING}来源",
    },
    "{D/BT_FREEZE} options": {
        "jp": "{D/BT_FREEZE}オプション",
        "kr": "{D/BT_FREEZE} 옵션",
        "zh": "{D/BT_FREEZE}选项",
    },
    "{D/BT_GOLDEN_CURSE} options": {
        "jp": "{D/BT_GOLDEN_CURSE}オプション",
        "kr": "{D/BT_GOLDEN_CURSE} 옵션",
        "zh": "{D/BT_GOLDEN_CURSE}选项",
    },
    "{D/BT_REDISTRIBUTE_BUFF} options": {
        "jp": "{D/BT_REDISTRIBUTE_BUFF}オプション",
        "kr": "{D/BT_REDISTRIBUTE_BUFF} 옵션",
        "zh": "{D/BT_REDISTRIBUTE_BUFF}选项",
    },
    "{D/BT_SEALED_RECEIVE_HEAL} is your friend.": {
        "jp": "{D/BT_SEALED_RECEIVE_HEAL}が頼りになります。",
        "kr": "{D/BT_SEALED_RECEIVE_HEAL}이 큰 도움이 됩니다.",
        "zh": "{D/BT_SEALED_RECEIVE_HEAL}是你的好帮手。",
    },
    "{D/BT_SEALED_RECEIVE_HEAL} options.": {
        "jp": "{D/BT_SEALED_RECEIVE_HEAL}オプション。",
        "kr": "{D/BT_SEALED_RECEIVE_HEAL} 옵션.",
        "zh": "{D/BT_SEALED_RECEIVE_HEAL}选项。",
    },
    "{D/BT_SEALED_RESURRECTION} options.": {
        "jp": "{D/BT_SEALED_RESURRECTION}オプション。",
        "kr": "{D/BT_SEALED_RESURRECTION} 옵션.",
        "zh": "{D/BT_SEALED_RESURRECTION}选项。",
    },
    "{D/BT_SEALED_RESURRECTION} sources": {
        "jp": "{D/BT_SEALED_RESURRECTION}発生源",
        "kr": "{D/BT_SEALED_RESURRECTION} 출처",
        "zh": "{D/BT_SEALED_RESURRECTION}来源",
    },
    "{D/BT_SILENCE} options.": {
        "jp": "{D/BT_SILENCE}オプション。",
        "kr": "{D/BT_SILENCE} 옵션.",
        "zh": "{D/BT_SILENCE}选项。",
    },
    "{D/BT_SILENCE} or {D/BT_SEALED_RESURRECTION} {P/Demiurge Astei} in order to disable her revival.": {
        "jp": "{P/Demiurge Astei}の復活を無効化するため、{D/BT_SILENCE}または{D/BT_SEALED_RESURRECTION}を付与しましょう。",
        "kr": "{P/Demiurge Astei}의 부활을 차단하기 위해 {D/BT_SILENCE} 또는 {D/BT_SEALED_RESURRECTION}을 부여하세요.",
        "zh": "对{P/Demiurge Astei}施加{D/BT_SILENCE}或{D/BT_SEALED_RESURRECTION}以阻止其复活。",
    },
    "{D/BT_SILENCE} or {D/BT_SEALED_RESURRECTION} {P/Kuro} in order to prevent her from reviving.": {
        "jp": "{P/Kuro}の復活を防ぐため、{D/BT_SILENCE}または{D/BT_SEALED_RESURRECTION}を付与しましょう。",
        "kr": "{P/Kuro}의 부활을 막기 위해 {D/BT_SILENCE} 또는 {D/BT_SEALED_RESURRECTION}을 부여하세요.",
        "zh": "对{P/Kuro}施加{D/BT_SILENCE}或{D/BT_SEALED_RESURRECTION}以阻止其复活。",
    },
    "{D/BT_SILENCE} sources": {
        "jp": "{D/BT_SILENCE}発生源",
        "kr": "{D/BT_SILENCE} 출처",
        "zh": "{D/BT_SILENCE}来源",
    },
    "{D/BT_STEAL_BUFF} and {D/BT_REDISTRIBUTE_BUFF} is the key here.": {
        "jp": "ここでは{D/BT_STEAL_BUFF}と{D/BT_REDISTRIBUTE_BUFF}が鍵となります。",
        "kr": "여기서는 {D/BT_STEAL_BUFF}와 {D/BT_REDISTRIBUTE_BUFF}가 핵심입니다.",
        "zh": "此处的关键是{D/BT_STEAL_BUFF}和{D/BT_REDISTRIBUTE_BUFF}。",
    },
    "{D/BT_STEAL_BUFF} options": {
        "jp": "{D/BT_STEAL_BUFF}オプション",
        "kr": "{D/BT_STEAL_BUFF} 옵션",
        "zh": "{D/BT_STEAL_BUFF}选项",
    },
    "{D/BT_STEAL_BUFF} options and validate the restriction.": {
        "jp": "{D/BT_STEAL_BUFF}オプションで制限を満たすこと。",
        "kr": "{D/BT_STEAL_BUFF} 옵션으로 제한 충족.",
        "zh": "{D/BT_STEAL_BUFF}选项并满足限制。",
    },
    "{D/BT_STUN} options": {
        "jp": "{D/BT_STUN}オプション",
        "kr": "{D/BT_STUN} 옵션",
        "zh": "{D/BT_STUN}选项",
    },
    "{P/Delta} can go in tandem with {P/Cindy}, {P/Dianne} and/or {P/Fran} (EE+10).": {
        "jp": "{P/Delta}は{P/Cindy}、{P/Dianne}、{P/Fran}（EE+10）と連携できます。",
        "kr": "{P/Delta}는 {P/Cindy}, {P/Dianne}, {P/Fran}(EE+10)과 연계할 수 있습니다.",
        "zh": "{P/Delta}可以与{P/Cindy}、{P/Dianne}和/或{P/Fran}(EE+10) 协同。",
    },
    "{P/Sterope} is recommended because {P/Demiurge Drakhan}'s counter is triggered by critical hits, she will reduce counter damage by 30% and will reduce all enemies buff duration by 1 turn.": {
        "jp": "{P/Demiurge Drakhan}のカウンターはクリティカルヒットで発動するため、カウンターダメージを30%減少させ、敵全員のバフ持続時間を1ターン短縮する{P/Sterope}が推奨されます。",
        "kr": "{P/Demiurge Drakhan}의 반격은 치명타로 발동되므로, 반격 피해를 30% 감소시키고 모든 적의 버프 지속 시간을 1턴 감소시키는 {P/Sterope}를 추천합니다.",
        "zh": "推荐使用{P/Sterope},因为{P/Demiurge Drakhan}的反击由暴击触发,她可减少 30% 反击伤害并将所有敌人的增益持续时间缩短 1 回合。",
    },
    "{SK/Caren|S2} will automatically target {P/Fatal} and {SK/Caren|S1} will hit both target.": {
        "jp": "{SK/Caren|S2}は自動で{P/Fatal}を狙い、{SK/Caren|S1}は両方の敵にヒットします。",
        "kr": "{SK/Caren|S2}는 자동으로 {P/Fatal}을 노리고, {SK/Caren|S1}은 두 대상 모두에게 명중합니다.",
        "zh": "{SK/Caren|S2}会自动锁定{P/Fatal},{SK/Caren|S1}会同时命中两个目标。",
    },
}


def main() -> int:
    with open(FILE, 'r', encoding='utf-8', newline='') as f:
        raw = f.read()
    data = json.loads(raw)

    # Detect EOL and trailing newline for round-trip preservation
    eol = '\r\n' if '\r\n' in raw else '\n'
    trailing_nl = raw.endswith('\n') or raw.endswith('\r\n')

    missing: set[str] = set()
    filled = 0

    def walk(node):
        nonlocal filled
        if isinstance(node, dict):
            if {'en', 'jp', 'kr', 'zh'}.issubset(node.keys()):
                en = node.get('en') or ''
                if en and (not node['jp'] or not node['kr'] or not node['zh']):
                    t = TRANSLATIONS.get(en)
                    if not t:
                        missing.add(en)
                        return
                    if not node['jp']:
                        node['jp'] = t['jp']; filled += 1
                    if not node['kr']:
                        node['kr'] = t['kr']; filled += 1
                    if not node['zh']:
                        node['zh'] = t['zh']; filled += 1
                return
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    walk(data)

    if missing:
        print(f'Missing translations for {len(missing)} EN strings:', file=sys.stderr)
        for s in sorted(missing):
            print(f'  - {s}', file=sys.stderr)
        return 1

    output = json.dumps(data, ensure_ascii=False, indent=2)
    if trailing_nl:
        output += '\n'
    if eol == '\r\n':
        output = output.replace('\n', '\r\n')

    with open(FILE, 'w', encoding='utf-8', newline='') as f:
        f.write(output)

    print(f'Filled {filled} translation fields.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
