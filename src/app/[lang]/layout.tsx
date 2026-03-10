import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LANGUAGES, isValidLang, LANGS } from '@/lib/i18n/config';
import { loadMessages } from '@/i18n';
import { I18nProvider } from '@/lib/contexts/I18nContext';
import { buildUrl } from '@/lib/seo';
import type { Lang } from '@/lib/i18n/config';
import { setRequestLang } from '@/lib/i18n/server';
import Header from '@/app/components/layout/Header';
import Footer from '@/app/components/layout/Footer';
import BackToTop from '@/app/components/ui/BackToTop';
import Breadcrumbs from '@/app/components/ui/Breadcrumbs';
import EventBanner from '@/app/components/layout/EventBanner';
import { BreadcrumbProvider } from '@/lib/contexts/BreadcrumbContext';

/** Pre-generate all language variants at build time */
export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isValidLang(lang)) return {};

  const t = await loadMessages(lang);
  const config = LANGUAGES[lang];

  return {
    title: {
      default: 'Outerpedia',
      template: '%s | Outerpedia',
    },
    description: t['page.home.description'],
    alternates: {
      languages: Object.fromEntries(
        LANGS.map((l) => [LANGUAGES[l].htmlLang, buildUrl(l as Lang, '/')])
      ),
    },
    openGraph: {
      locale: config.label,
    },
  };
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  if (!isValidLang(lang)) {
    notFound();
  }

  setRequestLang(lang);
  const messages = await loadMessages(lang);

  return (
    <I18nProvider lang={lang} messages={messages}>
      <BreadcrumbProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.lang="${LANGUAGES[lang].htmlLang}"`,
          }}
        />
        <Header />
        <EventBanner />
        <Breadcrumbs />
        <main className="flex-1">{children}</main>
        <Footer />
        <BackToTop />
      </BreadcrumbProvider>
    </I18nProvider>
  );
}
