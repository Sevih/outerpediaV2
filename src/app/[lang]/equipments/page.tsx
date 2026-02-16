import type { Metadata } from 'next';
import type { Lang } from '@/lib/i18n/config';
import { createPageMetadata } from '@/lib/seo';
import { loadMessages } from '@/i18n';

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const t = await loadMessages(lang as Lang);
  return createPageMetadata({
    lang: lang as Lang,
    path: '/equipments',
    title: t['nav.equipment'],
    description: t['page.equipments.description'],
  });
}

export default function EquipmentsPage() {
  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="text-3xl font-bold">Outerplane Equipment Database</h1>
      <p className="mt-2 text-zinc-400">Coming soon.</p>
    </div>
  );
}
