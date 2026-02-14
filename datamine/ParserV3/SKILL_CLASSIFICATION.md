# Skill Classification: Offensive/Target Type

## Objective

Create a temporary function to determine for each character skill:
1. **Offensive or not** (deals damage vs utility/heal/buff)
2. **Target count**: single (mono), dual (duo), or multi (AoE)

## Data Source

All data comes from **`CharacterSkillTemplet.bytes`** (cached as `cache/CharacterSkillTemplet.json`).

Three key fields per skill:

| Field | Description |
|-------|-------------|
| `TargetTeamType` | Who is targeted |
| `RangeType` | How many targets |
| `ApproachType` | Nature of the skill (unreliable, often empty) |

## Classification Logic

### Offensive vs Non-Offensive

`ApproachType` is **NOT reliable** - coverage is very low:
- SKT_ULTIMATE: **0/119** have it
- SKT_FIRST: 39/116
- SKT_SECOND: 55/120
- Bursts: mostly missing

**Use `TargetTeamType` instead** (always populated for non-passive skills):

| TargetTeamType | Count | Classification |
|----------------|-------|----------------|
| `ENEMY` | 1113 | **Offensive** |
| `TEAM` | 58 | Non-offensive |
| `ME` | 21 | Non-offensive |
| `TEAM_WITH_DEAD` | 2 | Non-offensive (resurrection) |
| `NONE` | 252 | Passive (chain/unique passive) |
| `ENEMY,ENEMY` | 1 | Offensive (edge case) |

> **Note on `ME`**: Does NOT mean "self only". Example: Astei S2 has `TargetTeamType=ME` + `RangeType=ALL` but heals "all allies except the caster". `ME` means the caster is the reference point.

### Target Count

Use `RangeType`:

| RangeType | Count | Classification |
|-----------|-------|----------------|
| `SINGLE` | 666 | **Mono-cible** |
| `DOUBLE` | 15 | **Duo-cible** |
| `DOUBLE_SPEED` | 1 | **Duo-cible** (by speed) |
| `ALL` | 513 | **Multi-cible** (AoE) |
| `NONE` | 252 | N/A (passive) |

### Special Cases

- **Chain attack** (`SKT_CHAIN_PASSIVE`): Always `NONE/NONE` in SkillTemplet because it's a passive description. In-game, chain attacks are always **offensive + AoE (multi)**.
- **Dual attack**: Also derived from `SKT_CHAIN_PASSIVE`. In-game, dual attacks are always **offensive + single target (mono)**.
- **Unique passive** (`SKT_UNIQUE_PASSIVE`): Always `NONE/NONE`, excluded from extraction.
- **Burst skills** (`SKT_BURST_1/2/3`): Have valid `TargetTeamType` and `RangeType`, classify normally.

## Skill Mapping Flow

1. `CharacterTemplet.bytes` → `Skill_1` to `Skill_23` fields → gives `NameIDSymbol` values
2. `CharacterSkillTemplet.bytes` → match by `NameIDSymbol` → get `SkillType` field
3. `SkillType` maps to:
   - `SKT_FIRST` → Skill 1 (basic)
   - `SKT_SECOND` → Skill 2
   - `SKT_ULTIMATE` → Skill 3
   - `SKT_CHAIN_PASSIVE` → Chain passive
   - `SKT_BURST_1/2/3` → Burst skills
   - `SKT_UNIQUE_PASSIVE` → Excluded

This mapping is already implemented in `character_extractor.py` lines 607-651.

## Existing Code References

- **Skill extraction**: `character_extractor.py:607-651` (`_extract_skills()`)
- **Skill processing**: `character_extractor.py:656-752` (`_process_skill()`)
- **CD/WGR + ApproachType check**: `character_extractor.py:818-876` (`_get_cd_wgr()`)
- **Boss skill index with all fields**: `boss_finder_v2.py:537-547`
- **Ignored keys in comparator**: `json_comparator.py:28-44`

## ApproachType Values (for reference, unreliable)

| Value | Count | Meaning |
|-------|-------|---------|
| `ATTACK` | 137 | Damage |
| `NONE` | 25 | Passive |
| `HEAL` | 13 | Heal |
| `CAST_BUFF` | 13 | Buff |
| `CAST_DEBUFF` | 3 | Debuff |
| Various garbage | ~5 | Data alignment issues in bytes parser |

Non-damaging types used in `_get_cd_wgr()`: `CAST_BUFF`, `HEAL`, `GUARD`, `NONE`, `CAST_DEBUFF`

## Example: Viella (2000108, Healer)

| Skill | SkillType | TargetTeam | Range | Result |
|-------|-----------|------------|-------|--------|
| S1 (10801) | SKT_FIRST | ENEMY | SINGLE | Offensive, mono |
| S2 (10802) | SKT_SECOND | ENEMY | ALL | Offensive, multi |
| S3 (10803) | SKT_ULTIMATE | TEAM | ALL | Non-offensive, multi |
| Chain (10804) | SKT_CHAIN_PASSIVE | NONE | NONE | Passive |
| Burst1 (10819) | SKT_BURST_1 | ENEMY | SINGLE | Offensive, mono |
| Burst2 (10820) | SKT_BURST_2 | ENEMY | SINGLE | Offensive, mono |
| Burst3 (10821) | SKT_BURST_3 | ENEMY | SINGLE | Offensive, mono |

## Example: Astei (2000058, Healer)

| Skill | SkillType | TargetTeam | Range | Result |
|-------|-----------|------------|-------|--------|
| S1 (5801) | SKT_FIRST | ENEMY | SINGLE | Offensive, mono |
| S2 (5802) | SKT_SECOND | ME | ALL | Non-offensive, multi |
| S3 (5803) | SKT_ULTIMATE | TEAM | ALL | Non-offensive, multi |
| Chain (5804) | SKT_CHAIN_PASSIVE | NONE | NONE | Passive |
| Burst1 (5819) | SKT_BURST_1 | ME | ALL | Non-offensive, multi |
| Burst2 (5820) | SKT_BURST_2 | ME | ALL | Non-offensive, multi |
| Burst3 (5821) | SKT_BURST_3 | ME | ALL | Non-offensive, multi |

## TODO: Function Implementation

Standalone script (not integrated into GUI). For each character:
1. Load CharacterTemplet → get Skill_N IDs
2. Load CharacterSkillTemplet → match by NameIDSymbol
3. For each relevant SkillType (FIRST, SECOND, ULTIMATE, BURST_1/2/3):
   - `offensive = TargetTeamType == "ENEMY"`
   - `target = SINGLE|DOUBLE|ALL` from RangeType
4. Chain: hardcode as offensive + multi (AoE)
5. Dual: hardcode as offensive + single (mono)
5. Output result per skill
