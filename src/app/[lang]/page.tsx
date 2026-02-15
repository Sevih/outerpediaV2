import type { Lang } from '@/lib/i18n/config';

export default async function Home({
  params,
}: {
  params: Promise<{ lang: Lang }>;
}) {
  const { lang } = await params;

  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-4xl font-bold">Outerpedia v2 — {lang}</h1>
    </main>
  );
}
