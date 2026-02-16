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
  await params;

  return (
    <main className="mx-auto max-w-3xl p-4">
      <h1 className="mb-6 text-3xl font-bold">
        Legal Notice & Disclaimer | Outerpedia
      </h1>

      <p className="mb-4">
        <strong>Outerpedia</strong> is an unofficial, fan-made project dedicated
        to the game <strong>Outerplane</strong>. All names, images, and other
        assets used on this site are the property of{' '}
        <strong>VAGAMES CORP</strong> or their respective owners. This site is
        not affiliated with, endorsed by, or sponsored by VAGAMES CORP.
      </p>

      <p className="mb-4">
        This website was created strictly for non-commercial, educational, and
        informational purposes. No advertisements, donations, tracking tools, or
        monetization mechanisms are used.
      </p>

      <p className="mb-4">
        <strong>
          Outerpedia does not host or redistribute game files.
        </strong>{' '}
        All visual assets are displayed for commentary and documentation
        purposes only. No content is made available for download or reuse.
      </p>

      <p className="mb-4">
        If you are the rightful owner of any content featured on this site and
        would like it removed, you may contact us or our hosting provider
        directly. We will respond to any takedown request promptly.
      </p>

      <h2 className="mt-8 mb-3 text-xl font-semibold">Hosting Provider</h2>
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
        This site is maintained by a private individual. In accordance with
        French law (LCEN), identification information may be disclosed to
        judicial authorities upon legal request via our hosting provider.
      </p>
    </main>
  );
}
