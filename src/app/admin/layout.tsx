import Link from 'next/link';
import { redirect } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV !== 'development') {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <Link href="/admin" className="text-lg font-bold">Outerpedia Admin</Link>
          <nav className="flex gap-4 text-sm text-zinc-400">
            <Link href="/admin/characters" className="hover:text-zinc-100">Characters</Link>
            <Link href="/admin/extractor" className="hover:text-zinc-100">Extractor</Link>
            <Link href="/admin/parser" className="hover:text-zinc-100">Parser</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-6">
        {children}
      </main>
    </div>
  );
}
