import Image from 'next/image';
import itemsData from '@data/items.json';
import weaponsData from '@data/equipment/weapon.json';
import amuletsData from '@data/equipment/accessory.json';
import { l } from '@/lib/i18n/localize';
import { getRarityBgPath } from '@/lib/format-text';
import type { Item } from '@/types/item';
import type { Weapon, Amulet } from '@/types/equipment';
import type { Lang } from '@/lib/i18n/config';

const items = itemsData as Item[];
const weapons = weaponsData as unknown as Weapon[];
const amulets = amuletsData as Amulet[];

function Badge({ icon, bg, label }: { icon: string; bg: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 align-middle text-equipment">
      <span className="relative inline-block h-4.5 w-4.5 shrink-0">
        <Image src={bg} alt="Rarity" fill sizes="18px" className="object-contain" />
        <Image src={icon} alt={label} fill sizes="18px" className="object-contain" />
      </span>
      <span className="underline">{label}</span>
    </span>
  );
}

export function ItemInlineServer({ name, lang }: { name: string; lang: Lang }) {
  const item = items.find((i) => i.name === name);
  if (!item) return <span className="text-red-500">{name}</span>;
  return <Badge icon={`/images/items/${item.icon}.webp`} bg={getRarityBgPath(item.rarity)} label={l(item, 'name', lang)} />;
}

export function WeaponInlineServer({ name, lang }: { name: string; lang: Lang }) {
  const weapon = weapons.find((w) => w.name === name);
  if (!weapon) return <span className="text-red-500">{name}</span>;
  return <Badge icon={`/images/equipment/${weapon.image}.webp`} bg={getRarityBgPath(weapon.rarity)} label={l(weapon, 'name', lang)} />;
}

export function AmuletInlineServer({ name, lang }: { name: string; lang: Lang }) {
  const amulet = amulets.find((a) => a.name === name);
  if (!amulet) return <span className="text-red-500">{name}</span>;
  return <Badge icon={`/images/equipment/${amulet.image}.webp`} bg={getRarityBgPath(amulet.rarity)} label={l(amulet, 'name', lang)} />;
}
