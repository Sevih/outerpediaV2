import Image from 'next/image';
import Link from 'next/link';
import type { Lang } from '@/lib/i18n/config';
import type { GuideMeta } from '@/types/guide';
import type { TranslationKey } from '@/i18n';
import { lRec } from '@/lib/i18n/localize';
import { localePath } from '@/lib/navigation';

type Props = {
  guide: GuideMeta;
  lang: Lang;
  t: Record<TranslationKey, string>;
};

export default function GuideCard({ guide, lang, t }: Props) {
  const title = lRec(guide.title, lang);
  const description = lRec(guide.description, lang);

  return (
    <Link
      href={localePath(lang, `/guides/${guide.category}/${guide.slug}`)}
      className="card-interactive group flex items-start gap-3 p-4 transition-colors"
    >
      <div className="relative h-10 w-10 shrink-0">
        <Image
          src={`/images/guides/${guide.icon}.webp`}
          alt=""
          fill
          sizes="40px"
          className="object-contain"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="text-sm font-semibold text-zinc-100 after:hidden group-hover:text-yellow-300 transition-colors">
          {title}
        </h3>
        {description && (
          <p className="mt-1.5 text-xs text-zinc-400">{description}</p>
        )}
        <div className="mt-auto flex items-center gap-3 pt-3 text-xs text-zinc-500">
          <span>{t['page.guide.by'].replace('{author}', guide.author)}</span>
          <span>{guide.last_updated}</span>
        </div>
      </div>
    </Link>
  );
}
