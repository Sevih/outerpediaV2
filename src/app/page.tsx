import { redirect } from 'next/navigation';
import { DEFAULT_LANG } from '@/lib/i18n/config';

/** Root page redirects to default language. Middleware handles this too, but this is a safety net. */
export default function RootPage() {
  redirect(`/${DEFAULT_LANG}`);
}
