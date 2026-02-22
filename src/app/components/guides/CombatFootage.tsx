'use client';

import { useI18n } from '@/lib/contexts/I18nContext';
import YouTubeEmbed from '@/app/components/ui/YouTubeEmbed';

type Props = {
  videoId: string;
  title: string;
  author?: string;
  date?: string;
};

export default function CombatFootage({ videoId, title, author, date }: Props) {
  const { t } = useI18n();

  return (
    <div className="space-y-3">
      <h3>
        {t('guides.combat_footage')}
      </h3>

      <YouTubeEmbed videoId={videoId} title={title} />

      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
        <span className="font-medium text-zinc-300">{title}</span>
        {author && <span>by {author}</span>}
        {date && <span>{date}</span>}
      </div>
    </div>
  );
}
