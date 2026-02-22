import Link from 'next/link';
import type { Lang } from '@/lib/i18n/config';
import type { GuideMeta } from '@/types/guide';
import type { TranslationKey } from '@/i18n';
import { lRec } from '@/lib/i18n/localize';

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
      href={`/${lang}/guides/${guide.category}/${guide.slug}`}
      className="group flex flex-col rounded-xl bg-zinc-800/60 p-4 ring-1 ring-white/5 transition hover:bg-zinc-700/60 hover:ring-white/10"
    >
      <h3 className="text-sm font-semibold text-zinc-100 after:hidden group-hover:text-yellow-300 transition-colors">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 line-clamp-2 text-xs text-zinc-400">{description}</p>
      )}
      <div className="mt-auto flex items-center gap-3 pt-3 text-xs text-zinc-500">
        <span>{t['page.guide.by'].replace('{author}', guide.author)}</span>
        <span>{guide.last_updated}</span>
      </div>
    </Link>
  );
}
