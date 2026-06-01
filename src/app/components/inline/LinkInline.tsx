'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/contexts/I18nContext';

type Props = {
  /** Visible link text. */
  label: string;
  /** Internal, locale-agnostic path (e.g. "/guides/general-guides/premium-limited"). */
  href: string;
};

/**
 * Base inline component: a locale-aware internal hyperlink rendered inside
 * parseText() content via the {L/label|/path} tag.
 */
export default function LinkInline({ label, href }: Props) {
  const { href: localize } = useI18n();
  return (
    <Link href={localize(href)} style={{ color: '#38bdf8', textDecoration: 'underline', textUnderlineOffset: 2 }}>
      {label}
    </Link>
  );
}
