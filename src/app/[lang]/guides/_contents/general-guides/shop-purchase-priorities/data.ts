import type { ShopKey, ShopItem } from './helpers'

export const shopData: Record<ShopKey, ShopItem[]> = {
    guild: [
        {
            name: 'Gold',
            priority: 'A',
            gives: { amount: 10000, unit: 'Gold' },
            costs: [{ currency: 'Guild Coins', amount: 20 }],
            limit: { count: 5, period: 'Daily' },
        },
        {
            name: '[Guild] Upgrade Stone Chest',
            priority: 'B',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Guild Coins', amount: 15 }],
            limit: { count: 3, period: 'Daily' },
        },
        {
            name: 'Epic Quality Present Selection Chest',
            priority: 'B',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Guild Coins', amount: 50 }],
            limit: { count: 1, period: 'Daily' },
        },
        {
            name: 'Steak Dish',
            priority: 'C',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Guild Coins', amount: 45 }],
            limit: { count: 1, period: 'Daily' },
        },
        {
            name: 'Sandwich',
            priority: 'C',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Guild Coins', amount: 10 }],
            limit: { count: 5, period: 'Daily' },
        },
        {
            name: 'Cake Slice',
            priority: 'C',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Guild Coins', amount: 15 }],
            limit: { count: 3, period: 'Daily' },
        },
        {
            name: 'Prosciutto',
            priority: 'C',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Guild Coins', amount: 30 }],
            limit: { count: 2, period: 'Daily' },
        },
        {
            name: 'Gold',
            priority: 'A',
            gives: { amount: 50000, unit: 'Gold' },
            costs: [{ currency: 'Guild Coins', amount: 50 }],
            limit: { count: 10, period: 'Weekly' },
        },
        {
            name: 'Basic Skill Manual',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Guild Coins', amount: 100 }],
            limit: { count: 3, period: 'Weekly' },
        },
        {
            name: 'Intermediate Skill Manual',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Guild Coins', amount: 150 }],
            limit: { count: 2, period: 'Weekly' },
        },
        {
            name: 'Professional Skill Manual',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Guild Coins', amount: 300 }],
            limit: { count: 1, period: 'Weekly' },
        },
        {
            name: '[Guild] 3★ Hero Piece Selection Chest',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Guild Coins', amount: 300 }],
            limit: { count: 5, period: 'Weekly' },
        },
        {
            name: 'Stage 3 Gem Chest',
            priority: 'B',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Guild Coins', amount: 150 }],
            limit: { count: 5, period: 'Weekly' },
        },
        {
            name: '[Guild] Epic-Legendary Accessory Chest',
            priority: 'A',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Guild Coins', amount: 100 }],
            limit: { count: 3, period: 'Weekly' },
        },
        {
            name: '[Guild] Enhancement Toolbox',
            priority: 'C',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Guild Coins', amount: 30 }],
            limit: { count: 10, period: 'Weekly' },
        }
    ],
    joint: [
        {
            name: 'Legendary Reforge Catalyst',
            priority: 'C',
            gives: { amount: 20, unit: '' },
            costs: [{ currency: 'Joint Challenge Coin', amount: 30 }],
            limit: { count: 3, period: 'Weekly' },
        },
        {
            name: 'Gold',
            priority: 'A',
            gives: { amount: 20000, unit: '' },
            costs: [{ currency: 'Joint Challenge Coin', amount: 15 }],
            limit: { count: 100, period: 'Weekly' },
        },
        {
            name: 'Stage 5 Random Gem Chest',
            priority: 'B',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Joint Challenge Coin', amount: 2500 }],
            limit: { count: 1, period: 'Weekly' },
        },
        {
            name: 'Stage 3 Gem Chest',
            priority: 'C',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Joint Challenge Coin', amount: 250 }],
            limit: { count: 1, period: 'Weekly' },
        },
        {
            name: 'Legendary Quality Present Chest',
            priority: 'A',
            gives: { amount: 10, unit: '' },
            costs: [{ currency: 'Joint Challenge Coin', amount: 2500 }],
            limit: { count: 1, period: 'Weekly' },
        },
        {
            name: 'Special Recruitment Ticket (Event)',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Joint Challenge Coin', amount: 100 }],
            limit: { count: 1, period: 'Weekly' },
        },
        {
            name: 'Refined Glunite',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Joint Challenge Coin', amount: 5000 }],
            limit: { count: 1, period: 'Monthly' },
        },
        {
            name: 'Armor Glunite',
            priority: 'A',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Joint Challenge Coin', amount: 3000 }],
            limit: { count: 1, period: 'Weekly' },
        },
        {
            name: 'Transistone (Individual)',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Joint Challenge Coin', amount: 8000 }],
            limit: { count: 1, period: 'Monthly' },
        },
        {
            name: 'Transistone (Total)',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Joint Challenge Coin', amount: 8000 }],
            limit: { count: 1, period: 'Monthly' },
        },
        {
            name: 'Stamina',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Joint Challenge Coin', amount: 15 }],
            limit: { count: 1, period: 'Daily' },
        }
    ],
    friend: [
        {
            name: 'Gold',
            priority: 'S',
            gives: { amount: 10000, unit: '' },
            costs: [{ currency: 'Friendship Point', amount: 25 }],
            limit: { count: 1, period: 'Daily' },
        },
        {
            name: 'Apprentice\'s Toolbox',
            priority: 'C',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Friendship Point', amount: 30 }],
            limit: { count: 3, period: 'Daily' },
        },
        {
            name: 'Upgrade Stone Piece Selection Chest',
            priority: 'A',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Friendship Point', amount: 50 }],
            limit: { count: 1, period: 'Daily' },
        },
        {
            name: '1-2★ Hero Piece Random Exchange Ticket',
            priority: 'B',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Friendship Point', amount: 100 }],
            limit: { count: 1, period: 'Weekly' },
        },
        {
            name: 'Arena Ticket',
            priority: 'A',
            gives: { amount: 5, unit: '' },
            costs: [{ currency: 'Friendship Point', amount: 200 }],
            limit: { count: 1, period: 'Daily' },
        },
        {
            name: '3★ Hero Piece Selective Exchange Ticket',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Friendship Point', amount: 700 }],
            limit: { count: 1, period: 'Weekly' },
        },
        {
            name: 'Upgrade Stone Fragment Selection Chest',
            priority: 'C',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Friendship Point', amount: 30 }],
            limit: { count: 3, period: 'Daily' },
        },
        {
            name: 'Upgrade Stone Selection Chest',
            priority: 'A',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Friendship Point', amount: 500 }],
            limit: { count: 1, period: 'Weekly' },
        },
        {
            name: 'Stamina',
            priority: 'S',
            gives: { amount: 30, unit: '' },
            costs: [{ currency: 'Friendship Point', amount: 50 }],
            limit: { count: 2, period: 'Daily' },
        }
    ],
    arena: [
        {
            name: 'Gold',
            priority: 'A',
            gives: { amount: 10000, unit: '' },
            costs: [{ currency: 'Arena Medal', amount: 10 }],
            limit: { count: 1, period: 'Daily' },
        },
        {
            name: 'Professional Skill Manual',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Arena Medal', amount: 350 }],
            limit: { count: 2, period: 'Weekly' },
        },
        {
            name: 'Basic Skill Manual',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Arena Medal', amount: 50 }],
            limit: { count: 5, period: 'Weekly' },
        },
        {
            name: 'Intermediate Skill Manual',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Arena Medal', amount: 60 }],
            limit: { count: 3, period: 'Weekly' },
        },
        {
            name: 'Stamina',
            priority: 'S',
            gives: { amount: 50, unit: '' },
            costs: [{ currency: 'Arena Medal', amount: 15 }],
            limit: { count: 1, period: 'Daily' },
        },
        {
            name: 'Ether Amulet',
            priority: 'B',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Arena Medal', amount: 200 }],
            limit: { count: 5, period: 'One-time' },
            label: { en: 'Ether Amulet', jp: 'エーテルアミュレット', kr: '에테르 아뮬렛', zh: '以太护符' },
        },
        {
            name: 'Ether Blade',
            priority: 'B',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Arena Medal', amount: 200 }],
            limit: { count: 5, period: 'One-time' },
            label: { en: 'Ether Blade', jp: 'エーテルブレード', kr: '에테르 블레이드', zh: '以太之刃' },
        },
        {
            name: '5★ Equipment',
            priority: 'C',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Arena Medal', amount: 300 }],
            limit: { count: 4, period: 'One-time' },
            label: { en: '5★ Equipment', jp: '5★装備', kr: '5★ 장비', zh: '5★装备' },
            notes: 'Etheric Speed Set (Helmet, Gloves, Chest Armor, Boots)',
        }
    ],
    stars: [
        {
            name: 'Arena Ticket',
            priority: 'B',
            gives: { amount: 5, unit: '' },
            costs: [{ currency: 'Star\'s Memory', amount: 3 }],
            limit: { count: 1, period: 'Daily' },
        },
        {
            name: 'Refined Upgrade Stone Selection Chest',
            priority: 'B',
            gives: { amount: 20, unit: '' },
            costs: [{ currency: 'Star\'s Memory', amount: 5 }],
            limit: { count: 1, period: 'Daily' },
        },
        {
            name: 'Glunite',
            priority: 'B',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Star\'s Memory', amount: 25 }],
            limit: { count: 1, period: 'Weekly' },
        },
        {
            name: 'Gold',
            priority: 'A',
            gives: { amount: 200000, unit: '' },
            costs: [{ currency: 'Star\'s Memory', amount: 10 }],
            limit: { count: 3, period: 'Daily' },
        },
        {
            name: "Potentium (Weapon/Accessory)",
            priority: 'A',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Star\'s Memory', amount: 50 }],
            limit: { count: 1, period: 'Monthly' },
        },
        {
            name: 'Transistone (Total)',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Star\'s Memory', amount: 50 }],
            limit: { count: 4, period: 'Weekly' },
        },
        {
            name: 'Stamina',
            priority: 'S',
            gives: { amount: 150, unit: '' },
            costs: [{ currency: 'Star\'s Memory', amount: 5 }],
            limit: { count: 1, period: 'Daily' },
        },
        {
            name: 'Refined Glunite',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Star\'s Memory', amount: 50 }],
            limit: { count: 1, period: 'Monthly' },
        },
        {
            name: 'Time Rewinder',
            priority: 'A',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Star\'s Memory', amount: 100 }],
            limit: { count: 1, period: 'Monthly' },
        },
        {
            name: 'Steak Dish',
            priority: 'C',
            gives: { amount: 10, unit: '' },
            costs: [{ currency: 'Star\'s Memory', amount: 15 }],
            limit: { count: 1, period: 'Daily' },
        },
        {
            name: 'Professional Skill Manual',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Star\'s Memory', amount: 30 }],
            limit: { count: 1, period: 'Weekly' },
        },
        {
            name: 'Epic Quality Present Selection Chest',
            priority: 'B',
            gives: { amount: 3, unit: '' },
            costs: [{ currency: 'Star\'s Memory', amount: 10 }],
            limit: { count: 1, period: 'Daily' },
        },
        {
            name: 'Special Recruitment Ticket',
            priority: 'S',
            gives: { amount: 2, unit: '' },
            costs: [{ currency: 'Star\'s Memory', amount: 10 }],
            limit: { count: 1, period: 'Weekly' },
        },
        {
            name: 'Potentium (Armor)',
            priority: 'A',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Star\'s Memory', amount: 35 }],
            limit: { count: 1, period: 'Monthly' },
        },
        {
            name: 'Special Recruitment Ticket (Event)',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Star\'s Memory', amount: 1 }],
            limit: { count: 1, period: 'Daily' },
        },
        {
            name: 'Intermediate Skill Manual',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Star\'s Memory', amount: 5 }],
            limit: { count: 2, period: 'Weekly' },
        },
        {
            name: 'Transistone (Individual)',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Star\'s Memory', amount: 75 }],
            limit: { count: 4, period: 'Monthly' },
        },
        {
            name: 'Gear Reset Module',
            priority: 'B',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Star\'s Memory', amount: 2000 }],
        },
        {
            name: 'Ultra-Precision Control Chip',
            priority: 'B',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Star\'s Memory', amount: 500 }],
        },
        {
            name: 'Reforge Reset Scroll [Legendary]',
            priority: 'B',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Star\'s Memory', amount: 1000 }],
        },
        {
            name: 'Reforge Reset Scroll [Epic]',
            priority: 'B',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Star\'s Memory', amount: 100 }],
        },
        {
            name: 'Purple Stardust',
            priority: 'B',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Star\'s Memory', amount: 3 }],
            limit: { count: 50, period: 'Monthly' },
        },
        {
            name: 'Purple Memory Stone',
            priority: 'B',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Star\'s Memory', amount: 3 }],
            limit: { count: 50, period: 'Monthly' },
        },
        {
            name: 'Blue Stardust',
            priority: 'A',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Star\'s Memory', amount: 1 }],
            limit: { count: 50, period: 'Monthly' },
        },
        {
            name: 'Blue Memory Stone',
            priority: 'A',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Star\'s Memory', amount: 1 }],
            limit: { count: 50, period: 'Monthly' },
        },
    ],
    worldboss: [
        {
            name: 'Steak Dish',
            priority: 'C',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'World Boss Token', amount: 20 }],
            limit: { count: 30, period: 'Monthly' },
        },
        {
            name: 'Undefeated Leader Nella',
            priority: 'B',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'World Boss Token', amount: 3300 }],
            limit: { count: 1, period: 'One-time' },
        },
        {
            name: 'Indomitable Dragon Drakhan',
            priority: 'B',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'World Boss Token', amount: 3300 }],
            limit: { count: 1, period: 'One-time' },
        },
        {
            name: 'Potentium (Weapon/Accessory)',
            priority: 'A',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'World Boss Token', amount: 125 }],
            limit: { count: 3, period: 'Monthly' },
        },
        {
            name: 'Transistone (Total)',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'World Boss Token', amount: 250 }],
            limit: { count: 2, period: 'Monthly' },
        },
        {
            name: 'Gold',
            priority: 'A',
            gives: { amount: 10000, unit: '' },
            costs: [{ currency: 'World Boss Token', amount: 10 }],
            limit: { count: 100, period: 'Monthly' },
        },
        {
            name: 'Potentium (Armor)',
            priority: 'A',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'World Boss Token', amount: 125 }],
            limit: { count: 3, period: 'Monthly' },
        },
        {
            name: 'Transistone (Individual)',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'World Boss Token', amount: 300 }],
            limit: { count: 2, period: 'Monthly' },
        },
    ],
    al: [
        {
            name: 'Powerful Adventurer\'s Talisman',
            priority: 'B',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'License Point', amount: 3000 }],
            limit: { count: 1, period: 'One-time' },
            inlineType: 'talisman',
        },
        {
            name: 'Sharp Adventurer\'s Talisman',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'License Point', amount: 3000 }],
            limit: { count: 1, period: 'One-time' },
            inlineType: 'talisman',
        },
        {
            name: 'Adventurer\'s Sword',
            priority: 'B',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'License Point', amount: 2500 }],
            limit: { count: 1, period: 'One-time' },
            inlineType: 'weapon',
        },
        {
            name: 'Adventurer\'s Necklace',
            priority: 'B',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'License Point', amount: 2500 }],
            limit: { count: 1, period: 'One-time' },
            inlineType: 'amulet',
        },
        {
            name: 'Refined Glunite',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'License Point', amount: 2500 }],
            limit: { count: 8, period: 'One-time' },
        },
        {
            name: 'Stage 5–6 Gem Chest',
            priority: 'A',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'License Point', amount: 250 }],
            limit: { count: 2, period: 'Weekly' },
        },
        {
            name: '\u201CTycoon\u201D Title',
            priority: 'C',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'License Point', amount: 250 }],
            limit: { count: 1, period: 'One-time' },
        },
        {
            name: 'Proof of Worth',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'License Point', amount: 125 }],
            limit: { count: 25, period: 'Weekly' },
            notes: "Only until you finish Adventure License Quirk then ignore it."
        },
        {
            name: '6★ Legendary Boots [Burst]',
            priority: 'A',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'License Point', amount: 1250 }],
            limit: { count: 1, period: 'One-time' }
        },
        {
            name: '6★ Legendary Armor [Burst]',
            priority: 'A',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'License Point', amount: 1250 }],
            limit: { count: 1, period: 'One-time' }
        },
        {
            name: '6★ Legendary Gloves [Burst]',
            priority: 'A',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'License Point', amount: 1250 }],
            limit: { count: 1, period: 'One-time' }
        },
        {
            name: '6★ Legendary Helmet [Burst]',
            priority: 'A',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'License Point', amount: 1250 }],
            limit: { count: 1, period: 'One-time' }
        }
    ],
    survey: [
        {
            name: 'Free Ether',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Survey Points', amount: 10 }],
            limit: { count: 500, period: 'Monthly' }
        },
        {
            name: 'Special Recruitment Ticket (Event)',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Survey Points', amount: 100 }],
            limit: { count: 30, period: 'Monthly' }
        },
        {
            name: 'Transistone (Individual)',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Survey Points', amount: 500 }],
            limit: { count: 2, period: 'Monthly' }
        },
        {
            name: 'Transistone (Total)',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Survey Points', amount: 400 }],
            limit: { count: 2, period: 'Monthly' }
        },
        {
            name: 'Refined Glunite',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Survey Points', amount: 150 }],
            limit: { count: 5, period: 'Monthly' }
        },
        {
            name: 'Basic Skill Manual',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Survey Points', amount: 5 }],
            limit: { count: 40, period: 'Monthly' }
        },
        {
            name: 'Intermediate Skill Manual',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Survey Points', amount: 20 }],
            limit: { count: 25, period: 'Monthly' }
        },
        {
            name: 'Professional Skill Manual',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Survey Points', amount: 50 }],
            limit: { count: 9, period: 'Monthly' }
        },
        {
            name: 'Stage 4 Gem Chest',
            priority: 'B',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Survey Points', amount: 50 }],
            limit: { count: 5, period: 'Monthly' }
        },
        {
            name: 'Legendary Reforge Catalyst',
            priority: 'C',
            gives: { amount: 10, unit: '' },
            costs: [{ currency: 'Survey Points', amount: 20 }],
            limit: { count: 20, period: 'Monthly' }
        },
        {
            name: 'Superior Quality Present Chest',
            priority: 'C',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Survey Points', amount: 1 }],
            limit: { count: 200, period: 'Monthly' }
        },
        {
            name: 'Artisan\'s Hammer',
            priority: 'C',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Survey Points', amount: 5 }],
            limit: { count: 30, period: 'Monthly' }
        },
        {
            name: 'Steak Dish',
            priority: 'C',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Survey Points', amount: 5 }],
            limit: { count: 100, period: 'Monthly' }
        },
        {
            name: 'Potentium (Weapon/Accessory)',
            priority: 'A',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Survey Points', amount: 15 }],
            limit: { count: 10, period: 'Monthly' }
        },
        {
            name: 'Potentium (Armor)',
            priority: 'A',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Survey Points', amount: 10 }],
            limit: { count: 15, period: 'Monthly' }
        },
        {
            name: '10% Legendary Abrasive',
            priority: 'C',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Survey Points', amount: 20 }],
            limit: { count: 5, period: 'Monthly' }
        },
        {
            name: 'Time Rewinder',
            priority: 'A',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Survey Points', amount: 150 }],
            limit: { count: 1, period: 'Monthly' }
        },
        {
            name: '5★ Random Talisman Chest',
            priority: 'B',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Survey Points', amount: 300 }],
            limit: { count: 4, period: 'Monthly' }
        },
        {
            name: '6★ Talisman Selection Chest',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Survey Points', amount: 1500 }],
            limit: { count: 1, period: 'Monthly' }
        },
        {
            name: '6★ Legendary Weapon Selection Chest',
            priority: 'A',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Survey Points', amount: 750 }],
            limit: { count: 2, period: 'One-time' }
        },
        {
            name: '6★ Legendary Accessory Selection Chest',
            priority: 'A',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Survey Points', amount: 750 }],
            limit: { count: 2, period: 'One-time' }
        },
        {
            name: '6★ Legendary Helmet Selection Chest',
            priority: 'B',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Survey Points', amount: 450 }],
            limit: { count: 2, period: 'One-time' }
        },
        {
            name: '6★ Legendary Armor Selection Chest',
            priority: 'B',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Survey Points', amount: 450 }],
            limit: { count: 2, period: 'One-time' }
        },
        {
            name: '6★ Legendary Gloves Selection Chest',
            priority: 'B',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Survey Points', amount: 450 }],
            limit: { count: 2, period: 'One-time' }
        },
        {
            name: '6★ Legendary Boots Selection Chest',
            priority: 'B',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Survey Points', amount: 450 }],
            limit: { count: 2, period: 'One-time' }
        },
        {
            name: 'Hero Piece',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Survey Points', amount: 1 }],
            limit: { count: 900, period: 'One-time' },
            character: 'Sigma',
        }
    ],
    event: [
        {
            name: 'Cosmetic',
            priority: 'S',
            gives: { amount: 0, unit: '' },
            costs: [{ currency: 'TBD', amount: 0 }],
            label: { en: 'Cosmetic', jp: 'コスメティック', kr: '코스메틱', zh: '外观' },
            limit: { count: 0, period: 'One-time' }
        },
        {
            name: '6★ Equipment',
            priority: 'S',
            gives: { amount: 0, unit: '' },
            costs: [{ currency: 'TBD', amount: 0 }],
            label: { en: '6★ Equipment', jp: '6★装備', kr: '6★ 장비', zh: '6★装备' },
            limit: { count: 0, period: 'One-time' }
        },
        {
            name: 'Intermediate Skill Manual',
            priority: 'S',
            gives: { amount: 0, unit: '' },
            costs: [{ currency: 'TBD', amount: 0 }],
            limit: { count: 0, period: 'One-time' }
        },
        {
            name: 'Transistone (Individual)',
            priority: 'S',
            gives: { amount: 0, unit: '' },
            costs: [{ currency: 'TBD', amount: 0 }],
            limit: { count: 0, period: 'One-time' }
        },
        {
            name: 'Transistone (Total)',
            priority: 'S',
            gives: { amount: 0, unit: '' },
            costs: [{ currency: 'TBD', amount: 0 }],
            limit: { count: 0, period: 'One-time' }
        },
        {
            name: 'Wildcard Pieces',
            priority: 'A',
            gives: { amount: 0, unit: '' },
            costs: [{ currency: 'TBD', amount: 0 }],
            limit: { count: 0, period: 'One-time' }
        },
        {
            name: 'Refined Glunite',
            priority: 'A',
            gives: { amount: 0, unit: '' },
            costs: [{ currency: 'TBD', amount: 0 }],
            limit: { count: 0, period: 'One-time' }
        },
        {
            name: 'Gems',
            priority: 'A',
            gives: { amount: 0, unit: '' },
            costs: [{ currency: 'TBD', amount: 0 }],
            limit: { count: 0, period: 'One-time' }
        },
        {
            name: 'Potentium (Armor)',
            priority: 'B',
            gives: { amount: 0, unit: '' },
            costs: [{ currency: 'TBD', amount: 0 }],
            limit: { count: 0, period: 'One-time' }
        },
        {
            name: 'Potentium (Weapon/Accessory)',
            priority: 'B',
            gives: { amount: 0, unit: '' },
            costs: [{ currency: 'TBD', amount: 0 }],
            limit: { count: 0, period: 'One-time' }
        },
        {
            name: '5★ Equipment',
            priority: 'B',
            gives: { amount: 0, unit: '' },
            costs: [{ currency: 'TBD', amount: 0 }],
            limit: { count: 0, period: 'One-time' },
            label: { en: '5★ Equipment', jp: '5★装備', kr: '5★ 장비', zh: '5★装备' },
            notes: "You can ignore it if it doesn't have a unique passive like Sacreed Edge weapon"
        },
        {
            name: 'Event Glunite',
            priority: 'B',
            gives: { amount: 0, unit: '' },
            costs: [{ currency: 'TBD', amount: 0 }],
            limit: { count: 0, period: 'One-time' },
            notes: "Ignore if you didn't buy any equipment from the shop."
        },
        {
            name: 'Food',
            priority: 'C',
            gives: { amount: 0, unit: '' },
            costs: [{ currency: 'TBD', amount: 0 }],
            limit: { count: 0, period: 'One-time' }
        },
        {
            name: 'Gold',
            priority: 'C',
            gives: { amount: 0, unit: '' },
            costs: [{ currency: 'TBD', amount: 0 }],
            limit: { count: 0, period: 'One-time' }
        }
    ],
    resource: [
        {
            name: 'Basic Skill Manual',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Gold', amount: 50000 }],
            limit: { count: 5, period: 'Weekly' }
        },
        {
            name: 'Intermediate Skill Manual',
            priority: 'S',
            gives: { amount: 1, unit: '' },
            costs: [{ currency: 'Gold', amount: 150000 }],
            limit: { count: 2, period: 'Weekly' }
        },
        {
            name: 'Effectium',
            priority: 'S',
            gives: { amount: 100, unit: '' },
            costs: [{ currency: 'Gold', amount: 50000 }],
            limit: { count: 1, period: 'Daily' }
        },
        {
            name: 'Gold',
            priority: 'C',
            gives: { amount: 50000, unit: '' },
            costs: [{ currency: 'Free Ether', amount: 60 }]
        },
        {
            name: 'Gold',
            priority: 'C',
            gives: { amount: 550000, unit: '' },
            costs: [{ currency: 'Free Ether', amount: 600 }]
        },
        {
            name: 'Gold',
            priority: 'C',
            gives: { amount: 2000000, unit: '' },
            costs: [{ currency: 'Free Ether', amount: 1800 }]
        },
        {
            name: 'Stamina',
            priority: 'C',
            gives: { amount: 60, unit: '' },
            costs: [{ currency: 'Free Ether', amount: 60 }],
            limit: { count: 25, period: 'Daily' }
        },
        {
            name: 'Effectium',
            priority: 'C',
            gives: { amount: 50, unit: '' },
            costs: [{ currency: 'Free Ether', amount: 50 }],
            limit: { count: 10, period: 'Daily' }
        },
        {
            name: 'Arena Ticket',
            priority: 'C',
            gives: { amount: 5, unit: '' },
            costs: [{ currency: 'Free Ether', amount: 50 }],
        }
    ],

    supply: [],
    rico: []
}
