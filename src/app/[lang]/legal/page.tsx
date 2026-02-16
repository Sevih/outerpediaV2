import type { Metadata } from 'next';
import Link from 'next/link';
import type { Lang } from '@/lib/i18n/config';
import { createPageMetadata } from '@/lib/seo';
import { loadMessages } from '@/i18n';

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const t = await loadMessages(lang as Lang);
  return createPageMetadata({
    lang: lang as Lang,
    path: '/legal',
    title: t['page.legal.title'],
    description: t['page.legal.description'],
    keywords: [
      'outerpedia legal notice',
      'terms of service',
      'content usage policy',
      'copyright',
      'disclaimer',
      'outerplane fan project',
    ],
  });
}

export default async function LegalNoticePage({ params }: Props) {
  const { lang } = await params;
  const t = await loadMessages(lang as Lang);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:px-6">
      <h1 className="mb-6 text-3xl font-bold">
        {t['legal.heading']}
      </h1>

      <p className="mb-4">{t['legal.p1']}</p>
      <p className="mb-4">{t['legal.p2']}</p>
      <p className="mb-4">{t['legal.p3']}</p>
      <p className="mb-4">{t['legal.p4']}</p>

      <h2 className="mt-8 mb-3 text-xl font-semibold">{t['legal.hosting']}</h2>
      <p className="mb-2">
        OVH SAS
        <br />
        2 rue Kellermann – 59100 Roubaix – France
        <br />
        <Link
          href="https://www.ovhcloud.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-red-400 underline"
        >
          https://www.ovhcloud.com/
        </Link>
      </p>

      <p className="mt-6 text-sm text-zinc-500">
        {t['legal.p5']}
      </p>
    </main>
  );
}
