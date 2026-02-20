# i18n Review Procedure — Outerpedia V2

## Goal

Compare a V2 locale file (`src/i18n/locales/{lang}.ts`) with the V1 reference (`outerpedia-clean/src/i18n/locales/{lang}.ts`) and fix translation strings that were worse in V2.

## Rules

- **Do NOT add or remove keys** in V2 — only correct existing string values.
- **Do NOT change key names** — only the string after the colon.
- **Preserve line alignment** across all 4 locale files (en, jp, kr, zh).
- The V1 file uses different key names (legacy format). You must map V2 keys to their V1 equivalents by meaning/context, not by key name.

## Key mapping reference (V2 key → V1 equivalent key)

Below is the mapping between V2 and V1 key names for sections that differ. Use this to find the correct V1 translation to compare against.

### Navigation
| V2 Key | V1 Key |
|--------|--------|
| `nav.home` | `nav.home` |
| `nav.characters` | `nav.characters` |
| `nav.equipment` | `nav.equipment` |
| `nav.guides` | `nav.guides` |
| `nav.utilities` | `nav.utilities` |
| `nav.tierlist` | `nav.tierlist` |
| `nav.characters.short` | `nav.characters_short` |
| `nav.equipment.short` | `nav.equipment_short` |
| `nav.tierlist.short` | `nav.tierlist_short` |
| `nav.utilities.short` | `nav.utilities_short` |
| `nav.guides.short` | `nav.guides_short` |

### Homepage
| V2 Key | V1 Key |
|--------|--------|
| `home.section.banners` | `titles.main.pull` |
| `home.section.codes` | `titles.main.coupon` |
| `home.section.updates` | `titles.main.changetitle` |
| `home.section.beginner` | `home.newTo` |
| `home.beginner.desc` | `home.newTo.desc` |
| `home.beginner.faq` | `home.newTo.links.faq` |
| `home.beginner.faq.desc` | `home.newTo.links.faq.desc` |
| `home.beginner.freeheroes` | `home.newTo.links.freeHeroes` |
| `home.beginner.freeheroes.desc` | `home.newTo.links.freeHeroes.desc` |
| `home.beginner.stats` | `home.newTo.links.stats` |
| `home.beginner.stats.desc` | `home.newTo.links.stats.desc` |
| `home.beginner.gear` | `home.newTo.links.gear` |
| `home.beginner.gear.desc` | `home.newTo.links.gear.desc` |
| `home.beginner.growth` | `home.newTo.links.growth` |
| `home.beginner.growth.desc` | `home.newTo.links.growth.desc` |
| `home.beginner.footer` | `home.newTo.footer` |
| `home.banner.ends_in` | `general.endsin` |
| `home.codes.copy` | `coupon.copy` |
| `home.discord.title` | `home.discord.joinUs` |
| `home.discord.join` | `home.discord.joinUs` |

### Changelog
| V2 Key | V1 Key |
|--------|--------|
| `changelog.title` | `changelog.meta.title` (extract title part) |
| `changelog.description` | `changelog.meta.desc` |
| `changelog.view_full` | `titles.main.tochangelog` |

### Character detail
| V2 Key | V1 Key |
|--------|--------|
| `page.character.pros` | `pros.label` |
| `page.character.cons` | `cons.label` |
| `page.character.voice_actor` | `characters.profile.voice_actor` |
| `page.character.birthday` | `characters.profile.birthday` |
| `page.character.height` | `characters.profile.height` |
| `page.character.weight` | `characters.profile.weight` |
| `page.character.ee.badge` | `exclusive_equipment_title` |
| `page.character.tier.pve` | `pve_tier` |
| `page.character.tier.pvp` | `pvp_tier` |
| `page.character.gear.substat_prio` | `substat_priority` |
| `page.character.gear.note` | `notes` |
| `page.character.gear.weapon` | `weapons` |
| `page.character.gear.amulet` | `accessories` |
| `page.character.gear.set` | `sets` |
| `page.character.gear.talisman` | `talisman` |
| `page.character.skill.enhancement` | `enhancements_label` |
| `page.character.no_reco` | `no_reco_gear` |

### Game system (same keys in both versions, different prefix format)
| V2 Key | V1 Key |
|--------|--------|
| `sys.element.fire` | `SYS_ELEMENT_NAME_FIRE` |
| `sys.class.striker` | `SYS_CLASS_STRIKER` |
| `sys.class.passive.striker` | `SYS_CLASS_PASSIVE_STRIKER` |
| `sys.subclass.attacker` | `SYS_CLASS_NAME_ATTACKER` |
| `sys.subclass.info.attacker` | `SYS_CLASS_INFO_ATTACKER` |
| `sys.stat.atk` | `SYS_STAT_ATK` |
| *(same pattern for all elements, classes, subclasses, stats)* | |

### Characters list / filters (same keys in both versions)
| V2 Key | V1 Key |
|--------|--------|
| `characters.filters.*` | `characters.filters.*` (identical) |
| `characters.chains.*` | `characters.chains.*` (identical) |
| `characters.gifts.*` | `characters.gifts.*` (identical) |
| `characters.effectsGroups.*` | `characters.effectsGroups.*` (identical) |
| `characters.tags.*` | `characters.tags.*` (identical) |
| `filters.rarity` | `filters.rarity` |
| `filters.elements` | `filters.elements` |
| `filters.classes` | `filters.classes` |
| `filters.roles.*` | `filters.roles.*` |

### Keys with NO V1 equivalent (V2-only, skip comparison)
These keys are new in V2 and have no V1 counterpart. Do not touch them unless the translation is obviously wrong on its own:
- `common.search`, `common.filter`, `common.none`, `common.back_to_top`, `common.language`
- `contributors.*`
- `changelog.type.*`
- `page.*.title`, `page.*.description`, `page.*.meta_title` (SEO metadata, restructured in V2)
- `promo_codes.*`
- `home.cta.*`, `home.codes.empty`, `home.codes.view_all`
- `home.discord.description`, `home.discord.members`, `home.discord.online`
- `home.banner.ended`, `home.resets.*`
- `search.*`
- `footer.*`
- `legal.*`
- `error.*`
- `page.character.toc.*`, `page.character.meta_*`
- `page.character.skill.type.*`, `page.character.skill.priority_*`, `page.character.skill.burn_*`
- `page.character.skill.target_*`, `page.character.skill.cooldown`, `page.character.skill.wgr`
- `page.character.ee.effect`, `page.character.ee.effect_max`, `page.character.ee.main_stat`, `page.character.ee.rank`
- `page.character.stats.*`, `page.character.story`, `page.character.chain_effect`, `page.character.dual_effect`
- `page.character.core_fusion.*`

## What to look for

When comparing V2 strings against V1:

1. **Wrong game terminology** — V1 used established in-game terms (e.g. '同伴' for heroes, '护身符' for talisman, '声优' for voice actor, '饰品' for accessory/amulet). V2 may have used generic Chinese instead.
2. **Missing emphasis** — English "Perfect for" should have '非常' (very), not just '适合'.
3. **Unnecessary English** — Using 'FAQ' in Chinese text when a native term ('疑难解答') existed in V1.
4. **Incomplete translations** — '剩余' (remaining) vs '剩余时间' (remaining time).
5. **Short labels not short enough** — `.short` keys should be as brief as possible.
6. **Accuracy** — '宝物' (treasure) is wrong for Talisman, should be '护身符'.

## Procedure

1. Read V2 file: `src/i18n/locales/{lang}.ts`
2. Read V1 file: `outerpedia-clean/src/i18n/locales/{lang}.ts` (may need multiple reads if large)
3. For each V2 key that has a V1 equivalent (use mapping above), compare the strings
4. If V1 has a better translation (more natural, correct game terms, more accurate), update the V2 string
5. Do NOT touch keys that have no V1 equivalent
6. Do NOT add or remove keys
7. Report all changes in a summary table

### jp.ts — Changes applied

| V2 Key | Before | After | Reason |
|--------|--------|-------|--------|
| `home.section.banners` | 現在ピックアップ中 | 現在入手可能 | V1 term, EN "Currently Pullable" |
| `home.beginner.desc` | 初心者向けガイドで | 初心者向けのガイドで | V1, の particle more natural |
| `home.beginner.faq` | 初心者FAQ | 初心者向けFAQ | V1, 向け (for) |
| `home.beginner.faq.desc` | 新規プレイヤー向けのよくある質問と回答。 | 新規プレイヤーのよくある質問と回答。 | V1, more natural |
| `home.beginner.freeheroes` | 無料キャラ & 初期バナー | 無料ヒーロー & スタートバナー | V1, in-game terms |
| `home.beginner.stats.desc` | ステータスと戦闘の仕組みを理解する。 | ステータスの理解と戦闘の仕組み。 | V1, more concise |
| `home.beginner.growth` | キャラ育成 | ヒーロー育成 | V1, EN "Hero Growth" |
| `home.beginner.growth.desc` | レベリング、超越、親密度など。 | レベル上げ、超越、親密度など。 | V1, more natural JP |
| `home.beginner.footer` | 初めてのプレイヤーに最適 | 初心者プレイヤーに最適 | V1 |
| `home.banner.ends_in` | 残り | 終了まで | V1, EN "Ends in" |
| `characters.filters.sources.chainPassive` | チェーンパッシブ | チェインパッシブ | Consistency with チェイン elsewhere |
| `page.character.toc.chain_dual` | チェーン & 連携 | チェイン & デュアル | V1, in-game terms |
| `page.character.skill.burn_cards` | バーストスキル | バーストカード | V1, EN "Burn Cards" |
| `page.character.tier.pve` | PvEティア | PvE 評価 | V1, in-game term 評価 |
| `page.character.tier.pvp` | PvPティア | PvP 評価 | V1, in-game term 評価 |
| `page.character.gear.substat_prio` | サブステータス優先度 | サブステ優先度 | V1, common abbreviation |
| `page.character.gear.amulet` | アミュレット | アクセサリー | V1, in-game JP term |
| `page.character.gear.set` | 防具セット | セット装備 | V1, in-game JP term |
| `page.character.chain_effect` | チェーン効果 | チェイン効果 | Consistency with チェイン |
| `page.character.dual_effect` | 連携攻撃効果 | デュアルアタック効果 | V1, in-game term |
| `page.character.no_reco` | 推奨装備はまだありません。 | このキャラクターのおすすめ装備情報はまだありません。 | V1, more descriptive |

### kr.ts — Changes applied

| V2 Key | Before | After | Reason |
|--------|--------|-------|--------|
| `nav.characters.short` | 캐릭터 | 캐릭 | Short label must be short |
| `home.section.banners` | 현재 픽업 중 | 현재 픽업 가능 | EN "Currently Pullable" |
| `home.beginner.desc` | 초보자 가이드로 모험을 시작하세요: | 초보자를 위한 가이드로 여정을 시작하세요: | EN "journey" = 여정 |
| `home.beginner.freeheroes` | 무료 캐릭터 & 초기 배너 | 무료 영웅 & 시작 배너 | In-game term: 영웅 |
| `home.beginner.freeheroes.desc` | 누구를 뽑아야 하는지, 효율적인 시작 방법. | 누구를 뽑을지와 효율적으로 시작하는 방법. | More natural phrasing |
| `home.beginner.stats` | 스탯 & 전투 기초 | 스탯 & 전투 기본 | 기본 more common in gaming |
| `home.beginner.stats.desc` | 스탯과 전투 시스템 이해하기. | 스탯 이해와 전투 방식. | More concise |
| `home.beginner.gear.desc` | 장비 시스템과 강화 방법. | 장비의 작동 원리와 강화 방법. | Matches EN "how equipment works" |
| `home.beginner.growth` | 캐릭터 육성 | 영웅 성장 | EN "Hero Growth" |
| `home.beginner.growth.desc` | 레벨링, 초월, 호감도 등. | 레벨업, 초월, 애정도 등. | In-game term: 애정도 |
| `home.beginner.footer` | 처음 시작하는 플레이어에게 추천 | 처음 플레이하는 유저에게 적합 | EN "Perfect" = 적합 |
| `home.banner.ends_in` | 남은 시간 | 종료까지 | EN "Ends in" |
| `page.character.toc.chain_dual` | 체인 & 협공 | 체인 & 듀얼 | In-game term: 듀얼 |
| `page.character.toc.video` | 영상 | 공식 영상 | More specific (official video) |
| `page.character.toc.pros_cons` | 장단점 | 장점과 단점 | More explicit |
| `page.character.ee.badge` | {name} 전용 장비 | {name}의 전용 장비 | Possessive 의 |
| `page.character.gear.substat_prio` | 서브 스탯 우선순위 | 부옵 우선순위 | Common KR gaming abbreviation |
| `page.character.gear.note` | 비고 | 노트 | Matches V1 |
| `page.character.gear.amulet` | 아뮬렛 | 장신구 | In-game KR term |
| `page.character.gear.set` | 방어구 세트 | 세트 | In-game KR term |
| `page.character.dual_effect` | 협공 효과 | 듀얼 공격 효과 | In-game term: 듀얼 |
| `page.character.no_reco` | 아직 추천 장비가 없습니다. | 이 캐릭터의 추천 장비 정보가 아직 없습니다. | More complete message |

## Completed reviews

- [x] `zh.ts` — 16 strings corrected (2025-02-20)
- [x] `jp.ts` — 21 strings corrected (2025-02-20)
- [x] `kr.ts` — 22 strings corrected (2025-02-20)
