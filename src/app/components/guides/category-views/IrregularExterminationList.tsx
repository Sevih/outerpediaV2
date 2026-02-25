import Image from 'next/image';
import Link from 'next/link';
import type { CategoryViewProps } from './types';
import type { GuideMeta } from '@/types/guide';
import type { Weapon, Amulet } from '@/types/equipment';
import { lRec } from '@/lib/i18n/localize';
import { localePath } from '@/lib/navigation';
import { getRarityBgPath } from '@/lib/format-text';
import { ItemInlineServer } from '@/app/components/inline/server';
import weaponsData from '@data/equipment/weapon.json';
import amuletsData from '@data/equipment/accessory.json';

const weapons = weaponsData as unknown as Weapon[];
const amulets = amuletsData as Amulet[];

const POSITIONS: Record<string, { top: string; left: string; mobileTop?: string }> = {
  'pursuit-queen':           { top: '23%', left: '47%' },
  'pursuit-mutated-wyvre':   { top: '59%', left: '53%', mobileTop: '64%' },
  'pursuit-blockbuster':     { top: '41%', left: '77%' },
  'pursuit-iron-stretcher':  { top: '43%', left: '24%' },
};

import { CLASSES } from '@/types/enums';
const withClasses = (base: string) => CLASSES.map((c) => `${base} [${c}]`);

type LootConfig = {
  item: string;
  label: string;
  weapons: string[];
  amulets: string[];
};

const LOOT: Record<string, LootConfig> = {
  'pursuit-queen': {
    item: 'Irregular Cell Type IV',
    label: 'Gorgon Collection',
    weapons: withClasses("Gorgon's Wrath"),
    amulets: withClasses("Gorgon's Vanity"),
  },
  'pursuit-mutated-wyvre': {
    item: 'Irregular Cell Type III',
    label: 'Gorgon Collection',
    weapons: withClasses("Gorgon's Wrath"),
    amulets: withClasses("Gorgon's Vanity"),
  },
  'pursuit-blockbuster': {
    item: 'Irregular Cell Type II',
    label: 'Briareos Collection',
    weapons: withClasses("Briareos's Recklessness"),
    amulets: withClasses("Briareos's Ambition"),
  },
  'pursuit-iron-stretcher': {
    item: 'Irregular Cell Type I',
    label: 'Briareos Collection',
    weapons: withClasses("Briareos's Recklessness"),
    amulets: withClasses("Briareos's Ambition"),
  },
};

function EquipIcon({ image, rarity }: { image: string; rarity: string }) {
  return (
    <span className="relative inline-block h-4.5 w-4.5 lg:h-6 lg:w-6 shrink-0">
      <Image src={getRarityBgPath(rarity)} alt="" fill sizes="18px" className="object-contain" />
      <Image src={`/images/equipment/${image}.webp`} alt="" fill sizes="18px" className="object-contain" />
    </span>
  );
}

function BossPin({ meta, lang }: { meta: GuideMeta; lang: CategoryViewProps['lang'] }) {
  const pos = POSITIONS[meta.slug];
  if (!pos) return null;

  const name = lRec(meta.title, lang);
  const bossName = name.split(':').pop()?.trim() ?? name;
  const loot = LOOT[meta.slug];

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 boss-pin"
      style={{ '--pin-top': pos.mobileTop ?? pos.top, '--pin-top-lg': pos.top, left: pos.left } as React.CSSProperties}
    >
      <Link
        href={localePath(lang, `/guides/${meta.category}/${meta.slug}`)}
        className="group flex flex-col items-center gap-1"
      >
        <span className={`text-[10px] lg:text-xs font-bold text-zinc-100 drop-shadow-lg bg-black/60 px-2 py-0.5 rounded whitespace-nowrap${meta.slug === 'pursuit-mutated-wyvre' ? ' order-1 lg:-order-1' : ''}`}>
          {bossName}
        </span>
        <span className="relative h-12 w-12 lg:h-16 lg:w-16 shrink-0 border border-red-600 group-hover:border-red-400 rounded-md transition-all overflow-hidden">
          <Image
            src="/images/ui/bg/TI_Slot_Unique.png"
            alt=""
            fill
            sizes="64px"
            className="object-contain"
          />
          <Image
            src={`/images/guides/${meta.icon}.webp`}
            alt={name}
            fill
            sizes="64px"
            className="object-contain relative z-10"
          />
        </span>
      </Link>
      {loot && (
        <div className="hidden lg:flex flex-col items-center gap-0.5 bg-black/70 rounded px-2 py-1 text-[10px]">
          <ItemInlineServer name={loot.item} lang={lang} />
          <span className="text-equipment font-bold">{loot.label}</span>
          <div className="flex gap-0.5">
            {loot.weapons.map((n) => {
              const w = weapons.find((x) => x.name === n);
              return w ? <EquipIcon key={n} image={w.image} rarity={w.rarity} /> : null;
            })}
          </div>
          <div className="flex gap-0.5">
            {loot.amulets.map((n) => {
              const a = amulets.find((x) => x.name === n);
              return a ? <EquipIcon key={n} image={a.image} rarity={a.rarity} /> : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function IrregularExterminationList({ guides, lang }: CategoryViewProps) {
  return (
    <div className="mt-6">
      <div className="relative w-full aspect-1439/719 rounded-lg overflow-hidden ring-1 ring-white/10">
        <Image
          src="/images/guides/T_Irregular_Chase_Bg.webp"
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, 800px"
          className="object-cover"
        />
        {guides.map((meta) => (
          <BossPin key={meta.slug} meta={meta} lang={lang} />
        ))}
      </div>
    </div>
  );
}
