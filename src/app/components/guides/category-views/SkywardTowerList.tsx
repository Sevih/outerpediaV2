import Image from 'next/image';
import Link from 'next/link';
import type { CategoryViewProps } from './types';
import type { GuideMeta } from '@/types/guide';
import { lRec } from '@/lib/i18n/localize';
import { localePath } from '@/lib/navigation';

/* ── Constants ──────────────────────────────────────────── */

const DIFFICULTY_SLUGS = ['normal', 'hard', 'very-hard'];

const ELEMENT_RING_COLORS: Record<string, string> = {
  fire: 'hover:ring-[var(--color-fire)]',
  water: 'hover:ring-[var(--color-water)]',
  earth: 'hover:ring-[var(--color-earth)]',
  light: 'hover:ring-[var(--color-light)]',
  dark: 'hover:ring-[var(--color-dark)]',
};

/* ── Helpers ─────────────────────────────────────────────── */

function getElement(slug: string): string | null {
  const match = slug.match(/^(\w+)-tower$/);
  return match ? match[1] : null;
}

function splitGuides(guides: GuideMeta[]) {
  const difficulty: GuideMeta[] = [];
  const elemental: GuideMeta[] = [];

  for (const g of guides) {
    if (DIFFICULTY_SLUGS.includes(g.slug)) {
      difficulty.push(g);
    } else if (getElement(g.slug)) {
      elemental.push(g);
    }
  }

  // Sort difficulty by predefined order
  difficulty.sort(
    (a, b) => DIFFICULTY_SLUGS.indexOf(a.slug) - DIFFICULTY_SLUGS.indexOf(b.slug)
  );

  // Sort elemental: fire, water, earth, light, dark
  const elemOrder = ['fire', 'water', 'earth', 'light', 'dark'];
  elemental.sort(
    (a, b) =>
      elemOrder.indexOf(getElement(a.slug)!) - elemOrder.indexOf(getElement(b.slug)!)
  );

  return { difficulty, elemental };
}

/* ── Cards ───────────────────────────────────────────────── */

function DifficultyCard({
  meta,
  lang,
}: {
  meta: GuideMeta;
  lang: CategoryViewProps['lang'];
}) {
  const name = lRec(meta.title, lang);
  const desc = lRec(meta.description, lang);

  return (
    <Link
      href={localePath(lang, `/guides/${meta.category}/${meta.slug}`)}
      className="group relative overflow-hidden rounded-lg w-full sm:w-75 h-32
                 ring-1 ring-white/10 hover:ring-yellow-400/50 transition-all"
    >
      <Image
        src={`/images/guides/${meta.icon}.webp`}
        alt=""
        fill
        sizes="(max-width: 640px) 100vw, 300px"
        className="object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />

      <div className="absolute inset-0 flex flex-col justify-between p-3">
        <p className="text-lg font-bold text-zinc-100 drop-shadow-lg">{name}</p>
        <p className="text-[10px] sm:text-xs text-zinc-400 drop-shadow-lg line-clamp-3">
          {desc}
        </p>
      </div>
    </Link>
  );
}

function ElementalCard({
  meta,
  lang,
}: {
  meta: GuideMeta;
  lang: CategoryViewProps['lang'];
}) {
  const name = lRec(meta.title, lang);
  const desc = lRec(meta.description, lang);
  const element = getElement(meta.slug)!;
  const ringColor = ELEMENT_RING_COLORS[element] ?? 'hover:ring-yellow-400/50';

  return (
    <Link
      href={localePath(lang, `/guides/${meta.category}/${meta.slug}`)}
      className={`group relative overflow-hidden rounded-lg
                  w-[calc((100%-1.5rem)/3)] h-40 sm:w-36 sm:h-72
                  ring-1 ring-white/10 ${ringColor} transition-all`}
    >
      <Image
        src={`/images/guides/${meta.icon}.webp`}
        alt=""
        fill
        sizes="(max-width: 640px) 80px, 144px"
        className="object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-linear-to-b from-black/60 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />

      {/* Element icon + name */}
      <div className="absolute inset-x-0 top-0 p-2 flex items-center gap-1">
        <Image
          src={`/images/ui/elem/CM_Element_${element.charAt(0).toUpperCase() + element.slice(1)}.webp`}
          alt={element}
          width={16}
          height={16}
          className="drop-shadow-lg"
        />
        <p className="text-xs font-medium text-zinc-200 drop-shadow-lg line-clamp-1">
          {name}
        </p>
      </div>

      {/* Description */}
      <div className="absolute inset-x-0 bottom-0 p-2">
        <p className="text-[10px] sm:text-xs text-zinc-400 drop-shadow-lg">
          {desc}
        </p>
      </div>
    </Link>
  );
}

/* ── Component ───────────────────────────────────────────── */

export default function SkywardTowerList({ guides, lang, t }: CategoryViewProps) {
  const { difficulty, elemental } = splitGuides(guides);

  return (
    <div className="mt-6 space-y-8">
      {/* Difficulty towers */}
      {difficulty.length > 0 && (
        <section>
          <h2 className="mb-4">{t['guides.skyward_tower.difficulty']}</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {difficulty.map((meta) => (
              <DifficultyCard key={meta.slug} meta={meta} lang={lang} />
            ))}
          </div>
        </section>
      )}

      {/* Elemental towers */}
      {elemental.length > 0 && (
        <section>
          <h2 className="mb-4">{t['guides.skyward_tower.elemental']}</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {elemental.map((meta) => (
              <ElementalCard key={meta.slug} meta={meta} lang={lang} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
