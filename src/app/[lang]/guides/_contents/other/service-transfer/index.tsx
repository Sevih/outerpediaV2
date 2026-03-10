'use client'

import Link from 'next/link'
import ItemInline from '@/app/components/inline/ItemInline'
import Accordion, { type AccordionItem } from '@/app/components/ui/Accordion'
import { useI18n } from '@/lib/contexts/I18nContext'
import { lRec } from '@/lib/i18n/localize'
import type { LangMap } from '@/types/common'

import rawStrings from './strings.json'

/* ── Types ────────────────────────────────────────────────── */

type FaqEntry = { key: string; title: LangMap; content: LangMap }

const s = rawStrings as {
  hero: { title: LangMap; subtitle: LangMap; applyLabel: LangMap; applyDates: LangMap; transferLabel: LangMap; transferDate: LangMap }
  overview: { title: LangMap; text: LangMap; missedWindow: LangMap }
  howto: { title: LangMap; step1: LangMap; step2: LangMap; step3: LangMap; step4: LangMap; step5: LangMap; stepAlt1: LangMap; stepAlt2: LangMap; stepAlt3: LangMap }
  merge: { title: LangMap; line1: LangMap; line2: LangMap; line3: LangMap; line4: LangMap }
  rewards: { title: LangMap; titleDesc1: LangMap; oathDesc: LangMap; bookDesc: LangMap; voucherDesc: LangMap; demiDesc: LangMap }
  important: { title: LangMap; note1: LangMap; note2: LangMap; note2Alt: LangMap; note3: LangMap; note4: LangMap; note5: LangMap }
  recovery: { title: LangMap; step1Title: LangMap; step1Text: LangMap; step1LinkText: LangMap; step1Note: LangMap; step2Title: LangMap; step2Text: LangMap; step2Item1: LangMap; step2Item2: LangMap; step2Item3: LangMap; step2Item4: LangMap; step2Item5: LangMap; step2Item6: LangMap; step2Email: LangMap; step2HelpCenter: LangMap; step2Note: LangMap; guestNote: LangMap }
  refund: { title: LangMap; text: LangMap }
  shop: { title: LangMap; text: LangMap }
  faq: { title: LangMap; items: FaqEntry[] }
  sidebar: {
    checklist: { title: LangMap; item1: LangMap; item2: LangMap; item3: LangMap; item4: LangMap; item5: LangMap }
    official: { title: LangMap; btn1: LangMap; btn2: LangMap; btn3: LangMap }
    recovery: { title: LangMap; link1: LangMap; link3: LangMap }
  }
}

/* ── Component ─────────────────────────────────────────────── */

export default function ServiceTransferGuide() {
  const { lang } = useI18n()

  const steps = [
    { title: lRec(s.howto.step1, lang) },
    { title: lRec(s.howto.step2, lang), image: '/images/guides/service-transfert/1.webp', alt: lRec(s.howto.stepAlt1, lang) },
    { title: lRec(s.howto.step3, lang), image: '/images/guides/service-transfert/2.webp', alt: lRec(s.howto.stepAlt2, lang) },
    { title: lRec(s.howto.step4, lang), image: '/images/guides/service-transfert/3.webp', alt: lRec(s.howto.stepAlt3, lang) },
    { title: lRec(s.howto.step5, lang) },
  ]

  const faqItems: AccordionItem[] = s.faq.items.map(item => ({
    key: item.key,
    title: <>{lRec(item.title, lang)}</>,
    content: <div dangerouslySetInnerHTML={{ __html: lRec(item.content, lang) }} />,
  }))

  return (
    <div className="max-w-5xl mx-auto">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-xl border border-zinc-800 bg-linear-to-br from-zinc-900/60 via-zinc-900 to-zinc-900/60 p-6 md:p-8 mb-8">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="relative">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            {lRec(s.hero.title, lang)}
          </h2>
          <p className="text-zinc-300 mt-2">{lRec(s.hero.subtitle, lang)}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1">
              📅 <strong className="font-semibold">{lRec(s.hero.applyLabel, lang)}</strong>&nbsp;{lRec(s.hero.applyDates, lang)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1">
              ⏳ <strong className="font-semibold">{lRec(s.hero.transferLabel, lang)}</strong>&nbsp;{lRec(s.hero.transferDate, lang)}
            </span>
          </div>
        </div>
      </section>

      {/* Grid content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-3">{lRec(s.overview.title, lang)}</h2>
            <div className="prose prose-invert max-w-none">
              <p dangerouslySetInnerHTML={{ __html: lRec(s.overview.text, lang) }} />
              <p className="mt-2 text-amber-100" dangerouslySetInnerHTML={{ __html: lRec(s.overview.missedWindow, lang) }} />
            </div>
          </section>

          {/* How to */}
          <section id="how-to">
            <h2 className="text-xl font-semibold mb-3">{lRec(s.howto.title, lang)}</h2>
            <ol className="space-y-3">
              {steps.map((step, idx) => (
                <li key={idx} className="group">
                  <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-bold">
                        {idx + 1}
                      </div>
                      <p className="text-zinc-200">{step.title}</p>
                    </div>
                    {step.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={step.image}
                        alt={step.alt ?? `Step ${idx + 1}`}
                        className="rounded-lg border border-zinc-800"
                        loading="lazy"
                      />
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Server merge */}
          <section>
            <h2 className="text-xl font-semibold mb-3">{lRec(s.merge.title, lang)}</h2>
            <ul className="space-y-1 text-zinc-200">
              <li>{lRec(s.merge.line1, lang)}</li>
              <li>{lRec(s.merge.line2, lang)}</li>
              <li>{lRec(s.merge.line3, lang)}</li>
              <li>{lRec(s.merge.line4, lang)}</li>
            </ul>
          </section>

          {/* Rewards */}
          <section>
            <h2 className="text-xl font-semibold mb-3">{lRec(s.rewards.title, lang)}</h2>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 space-y-1 text-amber-100 text-sm">
              <p><strong><ItemInline name='"New Beginning" Title' /></strong> {lRec(s.rewards.titleDesc1, lang)}</p>
              <p><strong><ItemInline name='"New Beginning" Profile Frame' /></strong></p>
              <p><strong>1 <ItemInline name="Oath of Determination" /></strong> {lRec(s.rewards.oathDesc, lang)}</p>
              <p><strong>1 <ItemInline name="Book of Evolution" /></strong> {lRec(s.rewards.bookDesc, lang)}</p>
              <p><strong>1 <ItemInline name="Unlimited Restaurant Voucher" /></strong> {lRec(s.rewards.voucherDesc, lang)}</p>
              <p><strong>1 <ItemInline name="Demiurge Selection Ticket" /></strong> {lRec(s.rewards.demiDesc, lang)}</p>
              <p><strong>1,500 <ItemInline name="Ether" /></strong></p>
            </div>
          </section>

          {/* Important */}
          <section>
            <h2 className="text-xl font-semibold mb-3">{lRec(s.important.title, lang)}</h2>
            <ul className="space-y-2">
              <li>{lRec(s.important.note1, lang)}</li>
              <li className="flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5">✔️</span>
                  <span className="text-zinc-200">{lRec(s.important.note2, lang)}</span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/guides/service-transfert/4.webp"
                  alt={lRec(s.important.note2Alt, lang)}
                  className="rounded-lg border border-zinc-800"
                  loading="lazy"
                />
              </li>
              <li>{lRec(s.important.note3, lang)}</li>
              <li>{lRec(s.important.note4, lang)}</li>
              <li className="text-amber-200">{lRec(s.important.note5, lang)}</li>
            </ul>
          </section>

          {/* Recovery Help */}
          <section id="recovery">
            <h2 className="text-xl font-semibold mb-3">{lRec(s.recovery.title, lang)}</h2>
            <div className="space-y-3 text-sm text-zinc-200">
              <div className="rounded-lg border border-blue-600/40 bg-blue-600/10 p-4">
                <p className="font-semibold">{lRec(s.recovery.step1Title, lang)}</p>
                <p>
                  {lRec(s.recovery.step1Text, lang)}&nbsp;
                  <Link
                    href="https://outerplane.game.onstove.com/transfer"
                    target="_blank"
                    className="underline"
                  >
                    {lRec(s.recovery.step1LinkText, lang)}
                  </Link>
                </p>
                <p className="mt-1 text-zinc-300">{lRec(s.recovery.step1Note, lang)}</p>
              </div>

              <div className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-4">
                <p className="font-semibold">{lRec(s.recovery.step2Title, lang)}</p>
                <p dangerouslySetInnerHTML={{ __html: lRec(s.recovery.step2Text, lang) }} />
                <ol className="list-decimal pl-5 mt-2 space-y-1">
                  <li>{lRec(s.recovery.step2Item1, lang)}</li>
                  <li>{lRec(s.recovery.step2Item2, lang)}</li>
                  <li>{lRec(s.recovery.step2Item3, lang)}</li>
                  <li>{lRec(s.recovery.step2Item4, lang)}</li>
                  <li>{lRec(s.recovery.step2Item5, lang)}</li>
                  <li>{lRec(s.recovery.step2Item6, lang)}</li>
                </ol>
                <div className="mt-2">
                  {lRec(s.recovery.step2Email, lang)}&nbsp;
                  <Link href="mailto:outerplane_contact@vagames.kr" className="underline">
                    outerplane_contact@vagames.kr
                  </Link>
                  <br />
                  {lRec(s.recovery.step2HelpCenter, lang)}&nbsp;
                  <Link
                    href="https://outerplane.helpshift.com/hc/en/4-outerplane/"
                    target="_blank"
                    className="underline"
                  >
                    https://outerplane.helpshift.com/hc/en/4-outerplane/
                  </Link>
                </div>
                <p className="mt-2 text-zinc-300" dangerouslySetInnerHTML={{ __html: lRec(s.recovery.step2Note, lang) }} />
              </div>

              <p className="text-amber-200" dangerouslySetInnerHTML={{ __html: lRec(s.recovery.guestNote, lang) }} />
            </div>
          </section>

          {/* Refunds */}
          <section>
            <h2 className="text-xl font-semibold mb-3">{lRec(s.refund.title, lang)}</h2>
            <p className="text-sm text-zinc-300">{lRec(s.refund.text, lang)}</p>
          </section>

          {/* Shop suspension */}
          <section>
            <h2 className="text-xl font-semibold mb-3">{lRec(s.shop.title, lang)}</h2>
            <p className="text-sm text-zinc-300">{lRec(s.shop.text, lang)}</p>
          </section>

          {/* FAQ */}
          <section id="faq" className="mt-8">
            <h2 className="text-xl font-semibold mb-3">{lRec(s.faq.title, lang)}</h2>
            <Accordion items={faqItems} multiple />
          </section>
        </div>

        {/* Sidebar */}
        <aside className="lg:sticky lg:top-24 space-y-4 h-max">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
            <h4 className="font-semibold mb-2">{lRec(s.sidebar.checklist.title, lang)}</h4>
            <ul className="space-y-2 text-sm">
              <li>{lRec(s.sidebar.checklist.item1, lang)}</li>
              <li>{lRec(s.sidebar.checklist.item2, lang)}</li>
              <li>{lRec(s.sidebar.checklist.item3, lang)}</li>
              <li>{lRec(s.sidebar.checklist.item4, lang)}</li>
              <li>{lRec(s.sidebar.checklist.item5, lang)}</li>
            </ul>
          </div>

          <div id="official" className="rounded-lg border border-blue-600/40 bg-blue-600/10 p-4">
            <h4 className="font-semibold mb-2">{lRec(s.sidebar.official.title, lang)}</h4>
            <Link
              href="https://page.onstove.com/outerplane/en/view/10859677"
              target="_blank"
              className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition"
            >
              {lRec(s.sidebar.official.btn1, lang)}
            </Link>
            <Link
              href="https://page.onstove.com/outerplane/en/view/10965877"
              target="_blank"
              className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition mt-3"
            >
              {lRec(s.sidebar.official.btn2, lang)}
            </Link>
            <Link
              href="https://page.onstove.com/outerplane/en/view/10965889"
              target="_blank"
              className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition mt-3"
            >
              {lRec(s.sidebar.official.btn3, lang)}
            </Link>
          </div>

          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
            <h4 className="font-semibold mb-2">{lRec(s.sidebar.recovery.title, lang)}</h4>
            <ul className="text-sm space-y-2">
              <li>
                🔎{' '}
                <Link href="https://outerplane.game.onstove.com/transfer" target="_blank" className="underline">
                  {lRec(s.sidebar.recovery.link1, lang)}
                </Link>
              </li>
              <li>
                ✉️{' '}
                <Link href="mailto:outerplane_contact@vagames.kr" className="underline">
                  outerplane_contact@vagames.kr
                </Link>
              </li>
              <li>
                🆘{' '}
                <Link
                  href="https://outerplane.helpshift.com/hc/en/4-outerplane/"
                  target="_blank"
                  className="underline"
                >
                  {lRec(s.sidebar.recovery.link3, lang)}
                </Link>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
