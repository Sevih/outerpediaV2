'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { CategoryViewProps } from './types';
import type { GuideMeta } from '@/types/guide';
import { lRec } from '@/lib/i18n/localize';
import { localePath } from '@/lib/navigation';
import srData from '@data/guides/special_request.json';
import statsData from '@data/stats.json';

type Tab = 'identification' | 'ecology_study';

const IDENTIFICATION_ORDER = ['Earth', 'Water', 'Fire', 'Light', 'Dark'];
const ECOLOGY_ORDER = ['Fire', 'Water', 'Earth', 'Light', 'Dark'];

const statsMap = statsData as Record<string, { label: string; icon: string }>;
const srMap = srData as Record<string, Record<string, { slug: string; loot: string[] }>>;

function iconElement(icon: string): string {
  return icon.split('_').pop() ?? '';
}

function isIdentification(meta: GuideMeta) {
  return meta.icon.startsWith('CLG_Raid_Weapon');
}

function sortByElement(list: GuideMeta[], order: string[]) {
  return list.sort((a, b) => order.indexOf(iconElement(a.icon)) - order.indexOf(iconElement(b.icon)));
}

function getLoot(meta: GuideMeta, type: Tab): string[] {
  const element = iconElement(meta.icon).toLowerCase();
  return srMap[type]?.[element]?.loot ?? [];
}

function LootIcons({ loot, type }: { loot: string[]; type: Tab }) {
  if (loot.length === 0) return null;
  const half = Math.ceil(loot.length / 2);
  const rows = [loot.slice(0, half), loot.slice(half)];

  return (
    <div className="flex flex-col items-end gap-0.5">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-0.5">
          {row.map((item) => {
            const src = type === 'identification'
              ? `/images/ui/effect/${statsMap[item]?.icon ?? ''}`
              : `/images/ui/effect/TI_Icon_Set_Enchant_${item}.webp`;
            const bg = type === 'identification' ? 'bg-black/70 rounded-full' : '';
            return (
              <span key={item} className={`relative h-5 w-5 lg:h-8 lg:w-8 shrink-0 ${bg}`}>
                <Image src={src} alt="" fill sizes="32px" className="object-contain drop-shadow-lg" />
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function CardList({ items, lang, type }: {
  items: GuideMeta[];
  lang: CategoryViewProps['lang'];
  type: Tab;
}) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((meta) => {
        const name = lRec(meta.title, lang);
        const loot = getLoot(meta, type);
        return (
          <Link
            key={meta.slug}
            href={localePath(lang, `/guides/${meta.category}/${meta.slug}`)}
            className="group relative overflow-hidden rounded-lg w-full max-w-135 mx-auto aspect-27/5
                       ring-1 ring-white/10 hover:ring-yellow-400/50 transition-all"
          >
            <Image
              src={`/images/guides/${meta.icon}.webp`}
              alt={name}
              fill
              sizes="(max-width: 640px) 100vw, 540px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-x-0 bottom-0 px-3 pb-1.5">
              <p className="text-lg font-bold text-zinc-100 drop-shadow-lg bg-black/50 px-3 py-0.5 rounded inline-block">{name}</p>
            </div>
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <LootIcons loot={loot} type={type} />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default function SpecialRequestList({ guides, lang, t }: CategoryViewProps) {
  const [tab, setTab] = useState<Tab>('identification');

  const { identification, ecology_study } = useMemo(() => {
    const id: GuideMeta[] = [];
    const eco: GuideMeta[] = [];
    for (const g of guides) {
      if (isIdentification(g)) id.push(g);
      else eco.push(g);
    }
    sortByElement(id, IDENTIFICATION_ORDER);
    sortByElement(eco, ECOLOGY_ORDER);
    return { identification: id, ecology_study: eco };
  }, [guides]);

  const items = tab === 'identification' ? identification : ecology_study;

  return (
    <div className="mt-6 space-y-6">
      {/* Tabs — mobile only */}
      <div className="flex justify-center gap-2 lg:hidden">
        <button
          onClick={() => setTab('identification')}
          className={`rounded-lg border px-3 py-1.5 text-sm transition-colors
            ${tab === 'identification'
              ? 'border-yellow-400/50 bg-yellow-400/10 text-yellow-300'
              : 'border-white/10 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
        >
          {t['guides.special_request.identification']}
        </button>
        <button
          onClick={() => setTab('ecology_study')}
          className={`rounded-lg border px-3 py-1.5 text-sm transition-colors
            ${tab === 'ecology_study'
              ? 'border-yellow-400/50 bg-yellow-400/10 text-yellow-300'
              : 'border-white/10 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
        >
          {t['guides.special_request.ecology_study']}
        </button>
      </div>

      {/* Mobile: tabbed single column */}
      <div className="lg:hidden">
        <CardList items={items} lang={lang} type={tab} />
      </div>

      {/* Desktop: side by side */}
      <div className="hidden lg:grid lg:grid-cols-2 lg:gap-8">
        <section>
          <h3 className="mb-3">{t['guides.special_request.identification']}</h3>
          <CardList items={identification} lang={lang} type="identification" />
        </section>
        <section>
          <h3 className="mb-3">{t['guides.special_request.ecology_study']}</h3>
          <CardList items={ecology_study} lang={lang} type="ecology_study" />
        </section>
      </div>
    </div>
  );
}
