import Image from 'next/image';
import Link from 'next/link';
import type { EventDef } from '../types';

const Page = () => (
  <div className="mx-auto max-w-2xl space-y-6 text-center">
    <header>
      <h1 className="mb-2 text-4xl font-extrabold text-rose-500">Get out of here.</h1>
      <div className="flex justify-center">
        <Image
          src="/images/events/gtfo.webp"
          alt="Suspicious cat"
          width={300}
          height={200}
          className="mx-auto rounded-lg border border-white/10 shadow-md"
        />
      </div>
      <p className="text-zinc-300">
        You weren&apos;t supposed to find this page.
      </p>
    </header>

    <section className="mt-8 space-y-4">
      <p className="text-zinc-400">
        There&apos;s nothing to see here.
        No event. No secret. Definitely not a hidden test for something coming soon.
      </p>
      <p className="italic text-zinc-500">
        (Seriously, go play the game or check the{' '}
        <Link href="/" className="underline hover:text-rose-400">
          homepage
        </Link>
        .)
      </p>
    </section>

    <section className="mt-10">
      <h2 className="mb-2 text-lg font-semibold text-white">Confidential Area</h2>
      <p className="text-zinc-400">
        Access restricted to Outerpedia Admins, Cats, and Possibly Space Jellyfish.
        Unauthorized reading may result in mild disappointment.
      </p>
      <p className="mt-2 text-sm text-zinc-500">
        (A mysterious force prevents you from going further. Maybe it&apos;s the dev&apos;s coffee break.)
      </p>
    </section>

    <footer className="border-t border-white/10 pt-6 text-xs text-zinc-600">
      <p>
        &copy; 2025 Outerpedia — All leaks are imaginary.
        No rewards will be distributed for finding this page. Probably.
      </p>
    </footer>
  </div>
);

export default {
  meta: {
    slug: '_no-peaking',
    title: 'Get out of here',
    cover: '/images/events/gtfo.webp',
    type: 'community',
    organizer: 'Outerpedia',
    start: '2020-10-09T00:00:00Z',
    end: '2120-10-15T23:59:59Z',
  },
  Page,
} satisfies EventDef;
