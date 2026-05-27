import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import {
  FaGithub,
  FaDiscord,
  FaReddit,
  FaYoutube,
  FaTwitter,
  FaRss,
} from 'react-icons/fa';
import { getRequestLang } from '@/lib/i18n/server';
import { getT, type TranslationKey } from '@/i18n';
import { localePath } from '@/lib/navigation';
import { LANGUAGES, LANGS, type Lang } from '@/lib/i18n/config';
import { getAllTools } from '@/lib/data/tools';
import { getGuideCategories } from '@/lib/data/guides';

type Column = {
  title: TranslationKey;
  links: { label: string; href: string }[];
};

export default async function Footer() {
  const lang = getRequestLang();
  const t = await getT(lang);
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || 'dev';

  // Load dynamic lists used in the columns
  const [tools, guideCategories] = await Promise.all([
    getAllTools(),
    getGuideCategories(),
  ]);

  // 4 internal columns
  const columns: Column[] = [
    {
      title: 'footer.col.database',
      links: [
        { label: t('nav.characters'), href: localePath(lang, '/characters') },
        { label: t('nav.equipment'), href: localePath(lang, '/equipment') },
        { label: t('nav.tierlist'), href: localePath(lang, '/tierlist') },
        { label: t('page.coupons.title'), href: localePath(lang, '/coupons') },
      ],
    },
    {
      title: 'footer.col.tools',
      links: tools.slice(0, 6).map((tool) => ({
        label:
          (t as unknown as (k: string) => string)(`tools.${tool.slug}`) ||
          tool.slug,
        href: localePath(lang, `/tools#${tool.slug}`),
      })),
    },
    {
      title: 'footer.col.guides',
      links: guideCategories.slice(0, 6).map((cat) => ({
        label: t(`guides.category.${cat.slug}` as TranslationKey),
        href: localePath(lang, `/guides/${cat.slug}`),
      })),
    },
    {
      title: 'footer.col.community',
      links: [
        { label: t('footer.social.evamains_discord'), href: 'https://discord.com/invite/PNMd5mkAV8' },
        { label: t('footer.social.github'), href: 'https://github.com/Sevih/outerpediaV2' },
        { label: t('contributors.title'), href: localePath(lang, '/contributors') },
        { label: t('changelog.title'), href: localePath(lang, '/changelog') },
        { label: t('footer.social.rss'), href: '/feed' },
      ],
    },
  ];

  const officialLinks = [
    { label: t('footer.official_website'), href: t('link.officialwebsite'), icon: null },
    { label: t('footer.social.official_discord'), href: 'https://discord.com/invite/77mVJcJByq', icon: FaDiscord },
    { label: t('footer.social.reddit'), href: 'https://www.reddit.com/r/OUTERPLANE_Publisher/', icon: FaReddit },
    { label: t('footer.social.youtube'), href: 'https://www.youtube.com/@OUTERPLANE_OFFICIAL', icon: FaYoutube },
    { label: t('footer.social.official_x'), href: 'https://x.com/outerplane', icon: FaTwitter },
    { label: t('footer.social.publisher_x'), href: 'https://x.com/M9_outerplane', icon: FaTwitter },
  ];

  const isExternal = (href: string) => /^https?:\/\//.test(href);

  const renderLink = (href: string, label: string, className: string) =>
    isExternal(href) ? (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {label}
      </a>
    ) : (
      <Link href={href as Route} className={className}>
        {label}
      </Link>
    );

  return (
    <footer className="mt-12 border-t border-zinc-800 bg-black/60">
      <div className="mx-auto max-w-7xl px-4 pt-12 md:px-8 md:pt-14">
        {/* Top: brand + 4 columns (desktop) | brand + collapsibles (mobile) */}
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.5fr_repeat(4,1fr)] md:gap-8">
          {/* Brand block */}
          <div>
            <div className="mb-4 flex items-center gap-3">
              <span className="relative inline-block size-9 shrink-0">
                <Image
                  src="/favicon.ico"
                  alt="Outerpedia"
                  fill
                  sizes="36px"
                  className="object-contain"
                  unoptimized
                />
              </span>
              <div>
                <p className="font-semibold tracking-wide text-zinc-100">Outerpedia</p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                  v{appVersion}
                </p>
              </div>
            </div>
            <p className="mb-5 max-w-sm text-sm leading-relaxed text-zinc-400">
              {t('footer.tagline')}
            </p>
            {/* Quick social row */}
            <div className="mb-6 flex gap-2">
              <a
                href="https://discord.com/invite/PNMd5mkAV8"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('footer.social.evamains_discord')}
                className="inline-flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-indigo-500/50 hover:bg-zinc-800"
              >
                <FaDiscord className="text-indigo-400" />
                Discord
              </a>
              <a
                href="https://github.com/Sevih/outerpediaV2"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('footer.social.github')}
                className="inline-flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800"
              >
                <FaGithub />
                GitHub
              </a>
              <a
                href="/feed"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('footer.social.rss')}
                className="inline-flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-amber-500/50 hover:bg-zinc-800"
              >
                <FaRss className="text-amber-400" />
                RSS
              </a>
            </div>
            {/* Language switcher (chips) */}
            <FooterLanguages lang={lang} t={t} />
          </div>

          {/* 4 columns — desktop grid, mobile collapsibles */}
          {columns.map((col) => (
            <FooterColumn key={col.title} title={t(col.title)} renderLink={renderLink} links={col.links} />
          ))}
        </div>

        {/* Official Outerplane links — distinct strip */}
        <div className="mt-10 border-t border-zinc-800 pt-6">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            {t('footer.col.official')} · Outerplane
          </p>
          <div className="flex flex-wrap gap-2">
            {officialLinks.map((l) => {
              const Icon = l.icon;
              return (
                <a
                  key={l.label}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/50 px-2.5 py-1 text-xs text-zinc-400 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-200"
                >
                  {Icon ? <Icon className="text-[13px]" /> : null}
                  <span>{l.label}</span>
                </a>
              );
            })}
          </div>
        </div>

        {/* Disclaimer */}
        <p className="mt-8 border-t border-zinc-800 pt-6 text-xs leading-relaxed text-zinc-500">
          {t('footer.disclaimer')}
        </p>

        {/* Bottom bar */}
        <div className="mt-6 flex flex-col gap-3 border-t border-zinc-800 py-5 font-mono text-[11px] text-zinc-500 sm:flex-row sm:items-center sm:gap-5">
          <span>© {new Date().getFullYear()} Outerpedia</span>
          <Link href={localePath(lang, '/legal')} className="transition hover:text-zinc-300">
            {t('footer.legal_notice')}
          </Link>
          <Link href={localePath(lang, '/changelog')} className="transition hover:text-zinc-300">
            {t('changelog.title')}
          </Link>
          <div className="flex-1" />
          <span className="inline-flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
            v{appVersion}
          </span>
        </div>
      </div>
    </footer>
  );
}

/** A footer column. On mobile, renders as a collapsible <details>;
 *  on desktop, always-open list. Uses Tailwind responsive utilities so
 *  no client JS is needed. */
function FooterColumn({
  title,
  links,
  renderLink,
}: {
  title: string;
  links: { label: string; href: string }[];
  renderLink: (href: string, label: string, className: string) => React.ReactNode;
}) {
  const linkClass =
    'block py-1 text-sm text-zinc-400 transition hover:text-zinc-100';
  return (
    <div>
      {/* Mobile: collapsible */}
      <details className="group border-b border-zinc-800 md:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between py-3 font-mono text-[11px] uppercase tracking-widest text-zinc-300">
          {title}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden className="text-zinc-500 transition-transform group-open:rotate-180">
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <ul className="pb-3 pt-1">
          {links.map((l) => (
            <li key={`${l.label}-${l.href}`}>{renderLink(l.href, l.label, linkClass)}</li>
          ))}
        </ul>
      </details>
      {/* Desktop: always-visible column */}
      <div className="hidden md:block">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          {title}
        </p>
        <ul className="flex flex-col gap-1">
          {links.map((l) => (
            <li key={`${l.label}-${l.href}`}>{renderLink(l.href, l.label, linkClass)}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Language chip row — uses the same flag SVGs as the header. */
function FooterLanguages({ lang, t }: { lang: Lang; t: (key: TranslationKey) => string }) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {t('common.language')}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {LANGS.map((l) => {
          const cfg = LANGUAGES[l];
          const isCurrent = l === lang;
          return (
            <Link
              key={l}
              href={
                cfg.subdomain
                  ? `https://${cfg.subdomain}.outerpedia.com/`
                  : 'https://outerpedia.com/'
              }
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition ${
                isCurrent
                  ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-300'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
              aria-current={isCurrent ? 'true' : undefined}
              hrefLang={cfg.htmlLang}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/images/ui/flags/${cfg.flag}.svg`}
                alt=""
                aria-hidden
                width={18}
                height={13}
                className="h-3 w-4.5 shrink-0 rounded-xs object-cover"
              />
              <span className="font-mono">{cfg.abbrev}</span>
              {!cfg.isOfficial && (
                <span className="size-1 rounded-full bg-amber-400" aria-hidden />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
