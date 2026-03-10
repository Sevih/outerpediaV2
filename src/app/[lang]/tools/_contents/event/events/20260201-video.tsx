import Image from 'next/image';
import ItemInline from '@/app/components/inline/ItemInline';
import type { EventDef } from '../types';

const Page = () => (
  <div className="space-y-10 text-zinc-200">
    <header className="space-y-4 text-center">
      <h1 className="text-4xl font-extrabold tracking-tight text-rose-500">
        Hero Video Event 2026
      </h1>
      <div className="mt-4 flex justify-center">
        <Image
          src="/images/events/default.webp"
          alt="Hero Video Event"
          width={400}
          height={150}
        />
      </div>
      <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-zinc-300">
        Calling all creators new and seasoned! Outerpedia is hosting a gallery for fan-made content —
        hero introductions, showcases, guides, and entertainment! Send us your videos to help us add
        more flair to the space!
      </p>
      <p className="text-zinc-400">
        The EvaMains team has received gifts to share with the community from OUTERPLANE&apos;s new
        publisher, <strong className="text-white">Major9</strong>!
      </p>
    </header>

    <section>
      <h2 className="mb-3 text-2xl font-bold text-rose-400">The Prizes</h2>
      <ul className="list-disc space-y-1 pl-6 text-zinc-300">
        <li>All players: <strong>Coupon Code</strong></li>
        <li>1st place: <strong>10 000 <ItemInline name="Free Ether" /></strong></li>
        <li>2nd–3rd place: <strong>6 000 <ItemInline name="Free Ether" /></strong></li>
        <li>4th–10th place: <strong>3 000 <ItemInline name="Free Ether" /></strong></li>
        <li>8 lucky participants will receive <strong>3 000 <ItemInline name="Free Ether" /></strong></li>
        <li>All creators: A place to share your content on Outerpedia</li>
      </ul>
    </section>

    <section>
      <h2 className="mb-3 text-2xl font-bold text-rose-400">The Theme</h2>
      <div className="space-y-4 text-zinc-300">
        <div>
          <p className="font-semibold text-white">Complete Introduction!</p>
          <p>
            Outerplane&apos;s official channel already has skill introduction videos for many 3-star
            heroes, but there&apos;s more to them than that. Show off their lobby poses, expressions,
            costumes, best voice lines, and more!
          </p>
        </div>
        <div>
          <p className="font-semibold text-white">Showcase!</p>
          <p>
            How do we build our heroes? What can they really accomplish? Special Request, Irregulars,
            Adventurer License, Arena — anything goes!
          </p>
        </div>
        <div>
          <p className="font-semibold text-white">Lights, Camera, Action!</p>
          <p>
            Funny lobby compositions, meme teams, fanfiction — it&apos;s a game, have fun with it!
          </p>
        </div>
      </div>
    </section>

    <section>
      <h2 className="mb-3 text-2xl font-bold text-rose-400">Timeline</h2>
      <ul className="list-disc space-y-1 pl-6 text-zinc-300">
        <li>Submission deadline: <strong>February 01 (00:00 UTC)</strong></li>
        <li>Community vote &amp; final tally: <strong>February 14 (00:00 UTC)</strong></li>
        <li>Prize distribution (target): <strong>February 28 (UTC)</strong></li>
      </ul>
      <p className="mt-2 text-zinc-400">
        Submissions will remain open after the deadline to be featured in Outerpedia&apos;s upcoming
        Gallery.
      </p>
    </section>

    <section>
      <h2 className="mb-3 text-2xl font-bold text-rose-400">Rules</h2>
      <ul className="list-disc space-y-2 pl-6 leading-relaxed text-zinc-300">
        <li>Only use <strong>in-game footage</strong> in the video.</li>
        <li>Face cam is allowed for guide content.</li>
        <li>Any hero voice-over language is allowed.</li>
        <li>Video length between <strong>50 and 600 seconds</strong>.</li>
        <li>
          Videos must be hosted on <strong>YouTube</strong>, <strong>Twitch</strong>, or{' '}
          <strong>Bilibili</strong>. Direct file uploads are not accepted.
        </li>
        <li>
          Add &ldquo;<strong>Outerpedia video event 2026 – &lt;Your Nickname&gt;</strong>&rdquo; to the
          description or pinned comment to verify your submission.
        </li>
        <li>Existing videos are accepted too!</li>
        <li>
          Prizes will be distributed as a <strong>Coupon Code</strong> (provided by Major9), so
          please ensure we can contact you.
        </li>
        <li>
          Videos (prize-winning or not) may be linked in Outerpedia&apos;s gallery, with creator consent.
        </li>
        <li>
          Videos can remain hosted on your own channel. YouTube videos can optionally be mirrored
          on Outerpedia&apos;s YouTube channel — your choice.
        </li>
        <li>
          The OUTERPLANE team is watching! Major9 may contact participants to feature their videos on
          the official OUTERPLANE YouTube channel, or use them in future promotions.
        </li>
        <li>
          Submissions may be disqualified if not submitted by the original creator, or if they
          include content not suitable for OUTERPLANE&apos;s age rating. Contact the EvaMains Discord
          admins for disputes.
        </li>
      </ul>
    </section>

    <section className="space-y-3 text-center">
      <h2 className="text-2xl font-bold text-rose-400">Event Entries</h2>
      <p className="text-zinc-300">
        Please tell us where to find your submission using the form below:
      </p>
      <a
        href="https://forms.gle/your-form-link"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block rounded-lg bg-rose-600 px-6 py-3 font-semibold text-white transition hover:bg-rose-500"
      >
        Submit your Entry
      </a>
    </section>
  </div>
);

export default {
  meta: {
    slug: '20260201-video',
    title: 'Hero Video Event - Feb. 2026',
    cover: '/images/events/default.webp',
    type: 'contest',
    organizer: 'Outerpedia / EvaMains',
    start: '2026-02-01T00:00:00Z',
    end: '2026-02-14T00:00:00Z',
  },
  Page,
} satisfies EventDef;
