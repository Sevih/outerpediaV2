import { redirect } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV !== 'development') {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <a href="/admin" className="text-lg font-bold">Outerpedia Admin</a>
          <nav className="flex gap-4 text-sm text-zinc-400">
            <a href="/admin/characters" className="hover:text-zinc-100">Characters</a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-6">
        {children}
      </main>
    </div>
  );
}
