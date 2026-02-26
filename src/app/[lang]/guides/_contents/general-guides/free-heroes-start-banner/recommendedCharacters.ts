import type { LangMap } from '@/types/common';

type FreeHeroEntry = {
  names: string[];
  pickType: 'one' | 'all';
  reason: LangMap;
};

type FreeHeroSource = {
  source: LangMap;
  entries: FreeHeroEntry[];
};

export type CustomBannerPick = {
  names: string[];
  reason: LangMap;
};

// Free Heroes Sources
export const freeHeroesSources: FreeHeroSource[] = [
    {
        source: {
            en: "Start Dash",
            jp: "選抜スカウト",
            kr: "선별 동료 영입",
            zh: "甄选招募"
        },
        entries: [
            {
                names: ["Ame", "Rin", "Rey", "Vlada"],
                pickType: "one",
                reason: {
                    en: "All solid choices, just pick the one you prefer.",
                    jp: "どれも優秀。好きなキャラを選ぼう。",
                    kr: "모두 좋은 선택지. 원하는 캐릭터를 고르세요.",
                    zh: "都是不错的选择，挑你喜欢的就好。"
                }
            }
        ]
    },
    {
        source: {
            en: "New User Mission",
            jp: "新規ミッション",
            kr: "신규 미션",
            zh: "新手任务"
        },
        entries: [
            {
                names: ["Mene"],
                pickType: "all",
                reason: {
                    en: "Guaranteed from missions.",
                    jp: "ミッションで確定入手。",
                    kr: "미션에서 확정 획득.",
                    zh: "任务确定获得。"
                }
            }
        ]
    },
    {
        source: {
            en: "New User Mission \n Cross-Mirsha Adventure I",
            jp: "新規ミッション \n メルシャ大陸冒険 I",
            kr: "신규 미션 \n 메르샤 대륙모험 I",
            zh: "新手任务 \n 弥乐沙大陆冒险I"
        },
        entries: [
            {
                names: ["Alice", "Eliza", "Francesca", "Leo", "Maxwell", "Rhona", "Rin", "Saeran", "Valentine"],
                pickType: "one",
                reason: {
                    en: "{I-I/3★ Hero Selection Ticket}. \n 1 for completing all 30 missions \n 1 for Season 1 Hardmode Adventure 10 clear.",
                    jp: "{I-I/3★ Hero Selection Ticket}。 \n 30ミッション全クリアで1枚 \n シーズン1ハード冒険10クリアで1枚。",
                    kr: "{I-I/3★ Hero Selection Ticket}. \n 30개 미션 전부 완료 시 1장 \n 시즌 1 하드 모험 10 클리어 시 1장.",
                    zh: "{I-I/3★ Hero Selection Ticket}。 \n 完成全部30个任务获得1张 \n 通关第1季困难冒险10获得1张。"
                }
            }
        ]
    },
    {
        source: {
            en: "Cross-Mirsha Adventure I",
            jp: "メルシャ大陸冒険 I",
            kr: "메르샤 대륙모험 I",
            zh: "弥乐沙大陆冒险I"
        },
        entries: [
            {
                names: ["Veronica"],
                pickType: "all",
                reason: {
                    en: "Clear Season 1 Normal Adventure 2-3.",
                    jp: "シーズン1 ノーマル冒険2-3クリア。",
                    kr: "시즌 1 노멀 모험 2-3 클리어.",
                    zh: "通关第1季普通冒险2-3。"
                }
            }
        ]
    },
    {
        source: {
            en: "Story",
            jp: "ストーリー",
            kr: "스토리",
            zh: "故事"
        },
        entries: [
            {
                names: ["Fatal"],
                pickType: "all",
                reason: {
                    en: "Clear Season 3 1-13: The Identity of the Relic.",
                    jp: "シーズン3 1-13クリア：遺物の正体。",
                    kr: "시즌 3 1-13 클리어: 유물의 정체.",
                    zh: "通关第3季1-13：遗物的真面目。"
                }
            }
        ]
    },
    {
        source: {
            en: "Skyward Tower 100F",
            jp: "飛天の塔100階",
            kr: "비천의 탑 100층",
            zh: "飞天之塔100层"
        },
        entries: [
            {
                names: ["Sigma"],
                pickType: "all",
                reason: {
                    en: "Clear Skyward Tower Floor 100.",
                    jp: "飛天の塔100階クリア。",
                    kr: "비천의 탑 100층 클리어.",
                    zh: "通关飞天之塔100层。"
                }
            }
        ]
    },
    {
        source: {
            en: "Friendship Point Shop",
            jp: "フレンドPtショップ",
            kr: "우정 포인트 상점",
            zh: "友情点数商店"
        },
        entries: [
            {
                names: ["Stella"],
                pickType: "all",
                reason: {
                    en: "10 {I-I/Hero Piece} per week for 700 {I-I/Friendship Point}.",
                    jp: "毎週10 {I-I/Hero Piece}、700 {I-I/Friendship Point}で購入可能。",
                    kr: "매주 10 {I-I/Hero Piece}, 700 {I-I/Friendship Point}로 구매 가능.",
                    zh: "每周10个{I-I/Hero Piece}，700 {I-I/Friendship Point}购买。"
                }
            }
        ]
    },
    {
        source: {
            en: "Guild Shop",
            jp: "ギルドショップ",
            kr: "길드 상점",
            zh: "公会商店"
        },
        entries: [
            {
                names: ["Ame", "Dahlia", "Epsilon", "Drakhan"],
                pickType: "all",
                reason: {
                    en: "10 {I-I/Hero Piece} per week for 300 {I-I/Guild Coins}.",
                    jp: "毎週10 {I-I/Hero Piece}、300 {I-I/Guild Coins}で購入可能。",
                    kr: "매주 10 {I-I/Hero Piece}, 300 {I-I/Guild Coins}으로 구매 가능.",
                    zh: "每周10个{I-I/Hero Piece}，300 {I-I/Guild Coins}购买。"
                }
            }
        ]
    },
    {
        source: {
            en: "Mirsha Supporters",
            jp: "メルシャサポーターズ",
            kr: "메르샤 서포터즈",
            zh: "美洛沙支援者"
        },
        entries: [
            {
                names: ["Dianne", "Drakhan", "Akari"],
                pickType: "all",
                reason: {
                    en: "{E/Light} Starter — recommended choice. \n Get all heroes, mutually exclusive with {E/Dark} Starter.",
                    jp: "{E/Light}スターター — おすすめ。 \n 全員入手、{E/Dark}スターターとは排他。",
                    kr: "{E/Light} 스타터 — 추천。 \n 모두 획득、{E/Dark} 스타터와 배타적。",
                    zh: "{E/Light}新手包 - 推荐。 \n 获得全部角色，与{E/Dark}新手包互斥。"
                }
            },
            {
                names: ["Nella", "Hilde", "Iota"],
                pickType: "all",
                reason: {
                    en: "{E/Dark} Starter. \n Get all heroes, mutually exclusive with {E/Light} Starter.",
                    jp: "{E/Dark}スターター。 \n 全員入手、{E/Light}スターターとは排他。",
                    kr: "{E/Dark} 스타터。 \n 모두 획득、{E/Light} 스타터와 배타적。",
                    zh: "{E/Dark}新手包。 \n 获得全部角色，与{E/Light}新手包互斥。"
                }
            }
        ]
    },
    {
        source: {
            en: "Special Request",
            jp: "特別依頼",
            kr: "특별 의뢰",
            zh: "特别委托"
        },
        entries: [
            {
                names: ["Eternal", "Noa", "Laplace"],
                pickType: "all",
                reason: {
                    en: "Challenge! Special Request: Identification.",
                    jp: "挑戦! 特別依頼:識別。",
                    kr: "도전! 특별의뢰 : 식별。",
                    zh: "挑战!特别委托:鉴定。"
                }
            },
            {
                names: ["Aer", "Kappa", "Beth"],
                pickType: "all",
                reason: {
                    en: "Challenge! Special Request: Ecology Study.",
                    jp: "挑戦! 特別依頼:生態調査。",
                    kr: "도전! 특별의뢰 : 생태 조사。",
                    zh: "挑战!特别委托:生态调查。"
                }
            }
        ]
    }
];

// Custom Banner Picks
export const customBannerPicks: CustomBannerPick[] = [
    {
        names: ["Tamara", "Valentine", "Skadi"],
        reason: {
            en: "Crit buffers.",
            jp: "クリティカルバッファー。",
            kr: "치명타 버퍼.",
            zh: "暴击辅助。"
        }
    },
    {
        names: ["Dianne", "Nella"],
        reason: {
            en: "Pick based on your starter selector choice.",
            jp: "スターター選択に合わせて選ぼう。",
            kr: "스타터 선택에 맞춰 고르세요.",
            zh: "根据新手包选择来挑选。"
        }
    },
    {
        names: ["Dahlia", "Iota", "Kanon"],
        reason: {
            en: "Excellent PvP units.",
            jp: "優秀なPvPユニット。",
            kr: "우수한 PvP 유닛.",
            zh: "优秀的PvP角色。"
        }
    },
    {
        names: ["Ame", "Rey", "Roxie", "Maxwell"],
        reason: {
            en: "High damage dealers for general content.",
            jp: "汎用コンテンツ向けの高火力アタッカー。",
            kr: "범용 콘텐츠용 고화력 딜러.",
            zh: "通用内容的高伤害输出。"
        }
    },
    {
        names: ["Akari", "Tamamo-no-Mae", "Kuro"],
        reason: {
            en: "Reliable debuffers.",
            jp: "信頼できるデバッファー。",
            kr: "믿을 수 있는 디버퍼.",
            zh: "可靠的减益角色。"
        }
    },
    {
        names: ["Astei", "Liselotte", "Viella"],
        reason: {
            en: "Healers.",
            jp: "ヒーラー。",
            kr: "힐러.",
            zh: "治疗角色。"
        }
    },
    {
        names: ["Drakhan", "Regina", "Caren", "Vlada", "Maxie", "Fortuna"],
        reason: {
            en: "DPS with special use cases.",
            jp: "特定用途向けDPS。",
            kr: "특수 용도 DPS.",
            zh: "特殊用途的输出角色。"
        }
    },
    {
        names: ["Sterope", "Notia", "Hilde", "Charlotte", "Fran", "Luna", "Ember", "Stella"],
        reason: {
            en: "Niche but useful in specific content.",
            jp: "ニッチだが特定コンテンツで有用。",
            kr: "틈새지만 특정 콘텐츠에서 유용.",
            zh: "小众但在特定内容中有用。"
        }
    },
    {
        names: ["Rin", "Epsilon"],
        reason: {
            en: "Usable as DPS early on, but generally outscaled later.",
            jp: "序盤はDPSとして使えるが、後半は他に劣る。",
            kr: "초반에는 DPS로 사용 가능하지만, 후반에는 밀림.",
            zh: "前期可作为输出使用，但后期会被超越。"
        }
    },
    {
        names: ["Rhona", "Hanbyul Lee", "Alice", "Saeran", "Mero", "Leo", "Christina", "Edelweiss", "Delta", "Bryn", "Francesca", "Eliza", "Mene"],
        reason: {
            en: "Niche usage.",
            jp: "ニッチな用途。",
            kr: "틈새 용도.",
            zh: "小众用途。"
        }
    }
];
