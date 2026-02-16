import type { Lang } from '@/lib/i18n/config';

export default async function Home({
  params,
}: {
  params: Promise<{ lang: Lang }>;
}) {
  const { lang: _lang } = await params;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="h1-page">Heading 1 Page — Outerpedia v2</h1>
      <h1>Heading 1 — Outerpedia v2</h1>
      <h2>Heading 2 — Outerpedia v2</h2>
      <h3>Heading 3 — Outerpedia v2</h3>
      <h4>Heading 4 — Outerpedia v2</h4>
      <h5>Heading 5 — Outerpedia v2</h5>
      <p>Paragraph — Outerpedia v2</p>
    </main>
  );
}
