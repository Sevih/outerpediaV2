'use client';

import GuideTemplate from '@/app/components/guides/GuideTemplate';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { LangMap } from '@/types/common';

import strings from './strings.json';

/* ── Typed helpers ─────────────────────────────────────── */

const s = strings as {
  hero: { title: LangMap; subtitle: LangMap };
  about: { title: LangMap; desc: LangMap };
  mobile: {
    title: LangMap;
    android: { title: LangMap; desc: LangMap; btn: LangMap };
    ios: { title: LangMap; desc: LangMap; btn: LangMap };
  };
  pc: {
    title: LangMap;
    gpg: { title: LangMap; desc: LangMap; btn: LangMap; note: LangMap };
    warning: LangMap;
  };
  start: { title: LangMap; step1: LangMap; step2: LangMap; step3: LangMap; step4: LangMap };
  sysreq: {
    title: LangMap;
    android: { title: LangMap; os: LangMap };
    ios: { title: LangMap; os: LangMap };
  };
  support: { title: LangMap; desc: LangMap; help: LangMap };
  sidebar: {
    quicklinks: LangMap;
    mobile: LangMap;
    pc: LangMap;
    start: LangMap;
    official: LangMap;
    officialBtn: LangMap;
    community: LangMap;
    discord: LangMap;
    reddit: LangMap;
    twitter: LangMap;
  };
  links: {
    playstore: string;
    appstore: string;
    googleplaygames: string;
    helpshift: LangMap;
    officialwebsite: LangMap;
    discord: string;
    reddit: string;
    twitter: string;
  };
};

/* ── Component ─────────────────────────────────────────── */

export default function HowToPlayGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate title={lRec(s.hero.title, lang)}>
      {/* Hero */}
      <section className="relative overflow-hidden rounded-xl border border-zinc-800 bg-linear-to-br from-zinc-900/60 via-zinc-900 to-zinc-900/60 p-6 md:p-8 mb-8">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="relative">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight after:hidden">
            {lRec(s.hero.title, lang)} <span className="text-blue-400">OUTERPLANE</span>
          </h2>
          <p className="text-sm text-zinc-300 mt-2">{lRec(s.hero.subtitle, lang)}</p>
        </div>
      </section>

      {/* Grid content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-8">
          {/* About */}
          <section>
            <h2 className="text-xl font-semibold mb-3">{lRec(s.about.title, lang)}</h2>
            <div className="prose prose-invert max-w-none">
              <p>{lRec(s.about.desc, lang)}</p>
            </div>
          </section>

          {/* Download for Mobile */}
          <section id="mobile-download">
            <h2 className="text-xl font-semibold mb-3 after:hidden">{lRec(s.mobile.title, lang)}</h2>
            <div className="space-y-4">
              {/* Android */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-green-600/20 text-green-400">
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.523 15.34l-.758-.758-4.243 4.243-9.9-9.9L1.208 10.34l11.314 11.315L17.523 15.34zM3.172 10.34L1.758 8.926 12.522 0l10.764 8.926-1.414 1.414-9.35-7.752-9.35 7.752z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg mb-2 after:hidden">{lRec(s.mobile.android.title, lang)}</h4>
                    <p className="text-sm text-zinc-300 mb-3">{lRec(s.mobile.android.desc, lang)}</p>
                    <a
                      href={s.links.playstore}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 transition"
                    >
                      {lRec(s.mobile.android.btn, lang)}
                    </a>
                  </div>
                </div>
              </div>

              {/* iOS */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-600/20 text-gray-400">
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg mb-2 after:hidden">{lRec(s.mobile.ios.title, lang)}</h4>
                    <p className="text-sm text-zinc-300 mb-3">{lRec(s.mobile.ios.desc, lang)}</p>
                    <a
                      href={s.links.appstore}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-md bg-gray-600 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-500 transition"
                    >
                      {lRec(s.mobile.ios.btn, lang)}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* PC Platform */}
          <section id="pc-play">
            <h2 className="text-xl font-semibold mb-3 after:hidden">{lRec(s.pc.title, lang)}</h2>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-lg mb-2 after:hidden">{lRec(s.pc.gpg.title, lang)}</h4>
                  <p
                    className="text-sm text-zinc-300 mb-3"
                    dangerouslySetInnerHTML={{ __html: lRec(s.pc.gpg.desc, lang) }}
                  />
                  <a
                    href={s.links.googleplaygames}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition"
                  >
                    {lRec(s.pc.gpg.btn, lang)}
                  </a>
                  <p className="text-xs text-zinc-400 mt-2">{lRec(s.pc.gpg.note, lang)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 mt-4">
              <p
                className="text-sm text-amber-100"
                dangerouslySetInnerHTML={{ __html: lRec(s.pc.warning, lang) }}
              />
            </div>
          </section>

          {/* Getting Started */}
          <section id="getting-started">
            <h2 className="text-xl font-semibold mb-3 after:hidden">{lRec(s.start.title, lang)}</h2>
            <div className="prose prose-invert max-w-none">
              <ol className="list-decimal pl-5 space-y-2">
                <li>{lRec(s.start.step1, lang)}</li>
                <li>{lRec(s.start.step2, lang)}</li>
                <li>{lRec(s.start.step3, lang)}</li>
                <li>{lRec(s.start.step4, lang)}</li>
              </ol>
            </div>
          </section>

          {/* System Requirements */}
          <section>
            <h2 className="text-xl font-semibold mb-3 after:hidden">{lRec(s.sysreq.title, lang)}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
                <h4 className="font-semibold mb-2 after:hidden">{lRec(s.sysreq.android.title, lang)}</h4>
                <ul className="text-sm text-zinc-300 space-y-1">
                  <li>{lRec(s.sysreq.android.os, lang)}</li>
                </ul>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
                <h4 className="font-semibold mb-2 after:hidden">{lRec(s.sysreq.ios.title, lang)}</h4>
                <ul className="text-sm text-zinc-300 space-y-1">
                  <li>{lRec(s.sysreq.ios.os, lang)}</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Support */}
          <section>
            <h2 className="text-xl font-semibold mb-3 after:hidden">{lRec(s.support.title, lang)}</h2>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
              <p className="text-sm text-zinc-300 mb-3">{lRec(s.support.desc, lang)}</p>
              <div className="space-y-2 text-sm">
                <div>
                  {lRec(s.support.help, lang)}{' '}
                  <a
                    href={lRec(s.links.helpshift, lang)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-blue-400"
                  >
                    {lRec(s.links.helpshift, lang)}
                  </a>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="lg:sticky lg:top-24 space-y-4 h-max">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
            <h4 className="font-semibold mb-2 after:hidden">{lRec(s.sidebar.quicklinks, lang)}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#mobile-download" className="text-blue-400 hover:underline">
                  {lRec(s.sidebar.mobile, lang)}
                </a>
              </li>
              <li>
                <a href="#pc-play" className="text-blue-400 hover:underline">
                  {lRec(s.sidebar.pc, lang)}
                </a>
              </li>
              <li>
                <a href="#getting-started" className="text-blue-400 hover:underline">
                  {lRec(s.sidebar.start, lang)}
                </a>
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-blue-600/40 bg-blue-600/10 p-4">
            <h4 className="font-semibold mb-2 after:hidden">{lRec(s.sidebar.official, lang)}</h4>
            <a
              href={lRec(s.links.officialwebsite, lang)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition"
            >
              {lRec(s.sidebar.officialBtn, lang)}
            </a>
          </div>

          <div className="rounded-lg border border-purple-600/40 bg-purple-600/10 p-4">
            <h4 className="font-semibold mb-2 after:hidden">{lRec(s.sidebar.community, lang)}</h4>
            <div className="space-y-2">
              <a
                href={s.links.discord}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center rounded-md bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-500 transition"
              >
                {lRec(s.sidebar.discord, lang)}
              </a>
              <a
                href={s.links.reddit}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center rounded-md bg-zinc-700 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-600 transition"
              >
                {lRec(s.sidebar.reddit, lang)}
              </a>
              <a
                href={s.links.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center rounded-md bg-zinc-700 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-600 transition"
              >
                {lRec(s.sidebar.twitter, lang)}
              </a>
            </div>
          </div>
        </aside>
      </div>
    </GuideTemplate>
  );
}
