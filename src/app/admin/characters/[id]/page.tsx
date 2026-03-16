'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function CharacterEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [raw, setRaw] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetch(`/api/admin/characters/${id}`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        setRaw(JSON.stringify(d, null, 2));
      });
  }, [id]);

  async function handleSave() {
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const parsed = JSON.parse(raw);
      const res = await fetch('/api/admin/characters', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || 'Save failed');
      } else {
        setSuccess('Saved!');
        setData(parsed);
        setTimeout(() => setSuccess(''), 2000);
      }
    } catch (e) {
      setError(e instanceof SyntaxError ? 'Invalid JSON' : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (!data) {
    return <p className="text-zinc-400">Loading...</p>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <button onClick={() => router.push('/admin/characters')} className="text-sm text-zinc-400 hover:text-zinc-100">
          ← Back
        </button>
        <h1 className="text-2xl font-bold">{data.Fullname as string}</h1>
        <span className="font-mono text-sm text-zinc-500">{id}</span>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        {error && <span className="self-center text-sm text-red-400">{error}</span>}
        {success && <span className="self-center text-sm text-green-400">{success}</span>}
      </div>

      <textarea
        value={raw}
        onChange={e => setRaw(e.target.value)}
        spellCheck={false}
        className="h-[70vh] w-full rounded border border-zinc-700 bg-zinc-900 p-4 font-mono text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
      />
    </div>
  );
}
