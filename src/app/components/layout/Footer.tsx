import Link from 'next/link';
import { FaGithub, FaDiscord, FaReddit, FaYoutube, FaTwitter } from 'react-icons/fa';
import { getRequestLang } from '@/lib/i18n/server';
import { getT } from '@/i18n';

export default async function Footer() {
  const lang = getRequestLang();
  const t = await getT(lang);
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || 'dev';

  return (
    <footer className="mt-6 border-t border-zinc-800 bg-black/40">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-6 text-sm text-zinc-400 md:flex-row md:flex-wrap md:justify-between">
        {/* Version info */}
        <p className="text-center md:text-left">
          &copy; {new Date().getFullYear()} Outerpedia v{appVersion} &ndash;{' '}
          {t('footer.tagline')}
        </p>

        {/* Outerpedia links */}
        <nav
          aria-label="Outerpedia Links"
          className="flex flex-wrap justify-center gap-4"
        >
          <Link
            href="https://github.com/Sevih/outerpedia"
            aria-label="GitHub repository for Outerpedia"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-zinc-200"
          >
            <FaGithub /> {t('footer.social.github')}
          </Link>
          <Link
            href="https://discord.com/invite/keGhVQWsHv"
            aria-label="EvaMains Discord for Outerpedia community"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-zinc-200"
          >
            <FaDiscord /> {t('footer.social.evamains_discord')}
          </Link>
          <Link
            href={`/${lang}/legal`}
            className="hover:text-zinc-200"
          >
            {t('footer.legal_notice')}
          </Link>
          <Link
            href={`/${lang}/changelog`}
            className="hover:text-zinc-200"
          >
            {t('changelog.title')}
          </Link>
          <Link
            href={`/${lang}/contributors`}
            className="hover:text-zinc-200"
          >
            {t('contributors.title')}
          </Link>
        </nav>

        {/* Official Outerplane links */}
        <nav
          aria-label="Official Outerplane Links"
          className="flex flex-wrap justify-center gap-4"
        >
          <a
            href={t('link.officialwebsite')}
            aria-label="Outerplane Official Homepage"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-200"
          >
            {t('footer.official_website')}
          </a>
          <Link
            href="https://discord.com/invite/77mVJcJByq"
            aria-label="Outerplane Official Discord"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-zinc-200"
          >
            <FaDiscord /> {t('footer.social.official_discord')}
          </Link>
          <Link
            href="https://www.reddit.com/r/OUTERPLANE_Publisher/"
            aria-label="Outerplane Reddit"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-zinc-200"
          >
            <FaReddit /> {t('footer.social.reddit')}
          </Link>
          <Link
            href="https://www.youtube.com/@OUTERPLANE_OFFICIAL"
            aria-label="Outerplane YouTube"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-zinc-200"
          >
            <FaYoutube /> {t('footer.social.youtube')}
          </Link>
          <Link
            href="https://x.com/outerplane"
            aria-label="Outerplane Twitter / X"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-zinc-200"
          >
            <FaTwitter /> {t('footer.social.official_x')}
          </Link>
          <Link
            href="https://x.com/M9_outerplane"
            aria-label="Outerplane Publisher Twitter / X"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-zinc-200"
          >
            <FaTwitter /> {t('footer.social.publisher_x')}
          </Link>
        </nav>
      </div>

      {/* Disclaimer */}
      <p className="mx-auto max-w-4xl px-4 pb-6 text-center text-xs leading-snug text-zinc-500">
        {t('footer.disclaimer')}
      </p>
    </footer>
  );
}
