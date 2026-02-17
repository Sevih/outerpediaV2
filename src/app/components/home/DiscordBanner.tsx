import Image from 'next/image';
import Link from 'next/link';
import { FaDiscord } from 'react-icons/fa';
import type { Messages } from '@/i18n';

const INVITE_URL = 'https://discord.com/invite/keGhVQWsHv';
const INVITE_CODE = 'keGhVQWsHv';

type Props = {
  t: Messages;
};

async function fetchDiscordCounts() {
  try {
    const res = await fetch(
      `https://discord.com/api/v9/invites/${INVITE_CODE}?with_counts=true`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      members: data.approximate_member_count as number,
      online: data.approximate_presence_count as number,
    };
  } catch {
    return null;
  }
}

function formatCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(count);
}

export default async function DiscordBanner({ t }: Props) {
  const counts = await fetchDiscordCounts();

  return (
    <section>
      <Link
        href={INVITE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="card-interactive group flex items-center gap-4 p-4 transition-colors hover:border-[#5865F2]/50"
      >
        {/* Server icon */}
        <div className="relative size-12 shrink-0 overflow-hidden rounded-xl transition-transform group-hover:scale-110">
          <Image
            src="/images/discord.webp"
            alt="EvaMains Discord"
            fill
            sizes="48px"
            className="object-cover"
          />
        </div>

        {/* Text + stats */}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white">
            {t['home.discord.title']}
          </p>
          <p className="text-sm text-zinc-400">
            {t['home.discord.description']}
          </p>
          {counts && (
            <div className="mt-1.5 flex items-center gap-3 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <span className="inline-block size-2 rounded-full bg-green-500" />
                {t['home.discord.online'].replace('{count}', formatCount(counts.online))}
              </span>
              <span>
                {t['home.discord.members'].replace('{count}', formatCount(counts.members))}
              </span>
            </div>
          )}
        </div>

        {/* Join button */}
        <span className="flex shrink-0 items-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white transition-colors group-hover:bg-[#4752C4]">
          <FaDiscord className="text-base" />
          {t['home.discord.join']}
        </span>
      </Link>
    </section>
  );
}
