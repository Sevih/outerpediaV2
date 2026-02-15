import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LANGUAGES, isValidLang, LANGS } from '@/lib/i18n/config';
import { loadMessages } from '@/i18n';
import { I18nProvider } from '@/lib/contexts/I18nContext';
import Header from '@/app/components/layout/Header';
import Footer from '@/app/components/layout/Footer';

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

  const config = LANGUAGES[lang];

  return {
    title: {
      default: 'Outerpedia',
      template: '%s | Outerpedia',
    },
    description: 'Outerplane wiki and database',
    alternates: {
      languages: Object.fromEntries(
        LANGS.map((l) => {
          const sub = LANGUAGES[l].subdomain;
          const prefix = sub ? `${sub}.` : '';
          return [LANGUAGES[l].htmlLang, `https://${prefix}outerpedia.com`];
        })
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

  const messages = await loadMessages(lang);

  return (
    <I18nProvider lang={lang} messages={messages}>
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.lang="${LANGUAGES[lang].htmlLang}"`,
        }}
      />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </I18nProvider>
  );
}
