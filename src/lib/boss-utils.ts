import type { Lang } from '@/lib/i18n/config';

/* ── Locale-aware element / class token maps ──────────── */

export const ELEMENT_TOKENS: Record<Lang, Record<string, string>> = {
  en: { Fire: 'Fire', Water: 'Water', Earth: 'Earth', Light: 'Light', Dark: 'Dark' },
  jp: { '火': 'Fire', '水': 'Water', '地': 'Earth', '光': 'Light', '闇': 'Dark' },
  kr: { '화속성': 'Fire', '수속성': 'Water', '지속성': 'Earth', '명속성': 'Light', '암속성': 'Dark' },
  zh: { '火属性': 'Fire', '水属性': 'Water', '土属性': 'Earth', '光属性': 'Light', '暗属性': 'Dark' },
};

export const CLASS_TOKENS: Record<Lang, Record<string, string>> = {
  en: { Striker: 'Striker', Defender: 'Defender', Ranger: 'Ranger', Mage: 'Mage', Healer: 'Healer' },
  jp: { '攻撃型': 'Striker', '魔法型': 'Mage', '防御型': 'Defender', 'スピード型': 'Ranger', '回復型': 'Healer' },
  kr: { '공격형': 'Striker', '마법형': 'Mage', '방어형': 'Defender', '속도형': 'Ranger', '회복형': 'Healer' },
  zh: { '攻击型': 'Striker', '魔法型': 'Mage', '防御型': 'Defender', '速度型': 'Ranger', '恢复型': 'Healer' },
};

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeName(name: string): string {
  return name.startsWith('ST_') ? `BT_STAT|${name}` : name;
}

export function getSkillImageSrc(icon: string): string {
  const suffix = icon.split('_').pop() ?? '';
  const folder = suffix.startsWith('2') ? '' : 'boss/';
  return `/images/characters/${folder}skills/${icon}.webp`;
}
