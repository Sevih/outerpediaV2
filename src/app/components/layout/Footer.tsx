'use client';

import Link from 'next/link';
import { FaGithub, FaDiscord, FaReddit, FaYoutube, FaTwitter } from 'react-icons/fa';
import { useI18n } from '@/lib/contexts/I18nContext';

export default function Footer() {
  const { lang, t } = useI18n();
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || 'dev';
  const officialWebsite = t('link.officialwebsite');

  return (
    <footer className="mt-6 border-t border-zinc-800 bg-black/40">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-6 text-sm text-zinc-400 md:flex-row md:flex-wrap md:justify-between">
        {/* Version info */}
        <p className="text-center md:text-left">
          &copy; {new Date().getFullYear()} Outerpedia v{appVersion} &ndash;
          Fanmade Database for Outerplane.
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
            <FaGithub /> GitHub
          </Link>
          <Link
            href="https://discord.com/invite/keGhVQWsHv"
            aria-label="EvaMains Discord for Outerpedia community"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-zinc-200"
          >
            <FaDiscord /> EvaMains Discord
          </Link>
          <Link
            href={`/${lang}/legal`}
            className="hover:text-zinc-200"
          >
            Legal Notice
          </Link>
          <Link
            href={`/${lang}/changelog`}
            className="hover:text-zinc-200"
          >
            Changelog
          </Link>
          <Link
            href={`/${lang}/contributors`}
            className="hover:text-zinc-200"
          >
            Contributors
          </Link>
        </nav>

        {/* Official Outerplane links */}
        <nav
          aria-label="Official Outerplane Links"
          className="flex flex-wrap justify-center gap-4"
        >
          <a
            href={officialWebsite}
            aria-label="Outerplane Official Homepage"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-200"
          >
            Official Website
          </a>
          <Link
            href="https://discord.com/invite/77mVJcJByq"
            aria-label="Outerplane Official Discord"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-zinc-200"
          >
            <FaDiscord /> Official Discord
          </Link>
          <Link
            href="https://www.reddit.com/r/OUTERPLANE_Publisher/"
            aria-label="Outerplane Reddit"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-zinc-200"
          >
            <FaReddit /> Reddit
          </Link>
          <Link
            href="https://www.youtube.com/@OUTERPLANE_OFFICIAL"
            aria-label="Outerplane YouTube"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-zinc-200"
          >
            <FaYoutube /> YouTube
          </Link>
          <Link
            href="https://x.com/outerplane"
            aria-label="Outerplane Twitter / X"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-zinc-200"
          >
            <FaTwitter /> Official X (Twitter)
          </Link>
          <Link
            href="https://x.com/M9_outerplane"
            aria-label="Outerplane Publisher Twitter / X"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-zinc-200"
          >
            <FaTwitter /> Official Publisher X (Twitter)
          </Link>
        </nav>
      </div>

      {/* Disclaimer */}
      <p className="mx-auto max-w-4xl px-4 pb-6 text-center text-xs leading-snug text-zinc-500">
        Outerpedia is an unofficial fan-made project. All content related to{' '}
        <i>Outerplane</i>, including characters, images, and other game assets,
        is the property of VAGAMES CORP. This website is not affiliated with,
        endorsed by, or sponsored by VAGAMES CORP in any way.
      </p>
    </footer>
  );
}
