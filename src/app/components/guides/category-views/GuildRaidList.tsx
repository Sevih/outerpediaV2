import Image from 'next/image';
import Link from 'next/link';
import type { CategoryViewProps } from './types';
import { lRec } from '@/lib/i18n/localize';
import { localePath } from '@/lib/navigation';

export default function GuildRaidList({ guides, lang, t }: CategoryViewProps) {
  const sorted = [...guides].sort((a, b) =>
    (a.title.en ?? '').localeCompare(b.title.en ?? '')
  );

  return (
    <div className="mt-6 flex flex-wrap justify-center gap-4">
      {sorted.map((meta) => {
        const name = lRec(meta.title, lang);
        return (
          <Link
            key={meta.slug}
            href={localePath(lang, `/guides/${meta.category}/${meta.slug}`)}
            className="group relative overflow-hidden rounded-lg w-75 h-32
                       ring-1 ring-white/10 hover:ring-yellow-400/50 transition-all"
          >
            <Image
              src={`/images/guides/${meta.icon}.webp`}
              alt={name}
              fill
              sizes="(max-width: 640px) 50vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
            <span className="absolute top-1.5 left-2 text-xs text-zinc-100 drop-shadow-lg">{t['page.guide.updated'].replace('{date}', meta.last_updated)}</span>
            <div className="absolute inset-0 flex items-center p-3">
              <p className="text-sm font-medium text-zinc-100 drop-shadow-lg">{name}</p>
            </div>
            <div className="absolute inset-x-0 bottom-0 px-3 pb-1.5">
              <p className="text-[10px] text-zinc-400 drop-shadow-lg line-clamp-2">{lRec(meta.description, lang)}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
