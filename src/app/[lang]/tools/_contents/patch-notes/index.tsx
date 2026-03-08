'use client';

import { useState, useMemo } from 'react';
import { useI18n } from '@/lib/contexts/I18nContext';
import { TextFilterGroup } from '@/app/components/ui/FilterPills';
import major9Data from '@data/patch-notes/posts.json';
import legacyData from '@data/patch-notes/legacy-posts.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Era = 'major9' | 'smilegate';

type Major9Type = 'update' | 'notice' | 'event' | 'devnote' | 'known-issue';
type LegacyType = 'patchnotes' | 'event' | 'developer-notes' | 'compendium' | 'media-archives' | 'official-4-cut-cartoon' | 'probabilities' | 'world-introduction';

type Post = {
  id: number | string;
  date: string;
  slug: string;
  lang: string;
  type: string;
  title: string;
  content: string;
};

const MAJOR9_TYPES: Major9Type[] = ['update', 'notice', 'event', 'devnote', 'known-issue'];
const LEGACY_TYPES: LegacyType[] = ['patchnotes', 'event', 'developer-notes', 'compendium', 'media-archives', 'official-4-cut-cartoon', 'probabilities', 'world-introduction'];

const TYPE_COLORS: Record<string, string> = {
  // Major9
  update: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  notice: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  event: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  devnote: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'known-issue': 'bg-red-500/20 text-red-300 border-red-500/30',
  // Legacy
  patchnotes: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'developer-notes': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  compendium: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  'media-archives': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  'official-4-cut-cartoon': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  probabilities: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  'world-introduction': 'bg-teal-500/20 text-teal-300 border-teal-500/30',
};

const TYPE_I18N_KEYS: Record<string, 'tools.patch-notes.type.update' | 'tools.patch-notes.type.notice' | 'tools.patch-notes.type.event' | 'tools.patch-notes.type.devnote' | 'tools.patch-notes.type.known-issue' | 'tools.patch-notes.type.patchnotes' | 'tools.patch-notes.type.compendium' | 'tools.patch-notes.type.media-archives' | 'tools.patch-notes.type.official-4-cut-cartoon' | 'tools.patch-notes.type.probabilities' | 'tools.patch-notes.type.world-introduction' | 'tools.patch-notes.type.developer-notes'> = {
  update: 'tools.patch-notes.type.update',
  notice: 'tools.patch-notes.type.notice',
  event: 'tools.patch-notes.type.event',
  devnote: 'tools.patch-notes.type.devnote',
  'known-issue': 'tools.patch-notes.type.known-issue',
  patchnotes: 'tools.patch-notes.type.patchnotes',
  compendium: 'tools.patch-notes.type.compendium',
  'media-archives': 'tools.patch-notes.type.media-archives',
  'official-4-cut-cartoon': 'tools.patch-notes.type.official-4-cut-cartoon',
  probabilities: 'tools.patch-notes.type.probabilities',
  'world-introduction': 'tools.patch-notes.type.world-introduction',
  'developer-notes': 'tools.patch-notes.type.developer-notes',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const POSTS_PER_PAGE = 10;

export default function PatchNotesTool() {
  const { lang, t } = useI18n();
  const [era, setEra] = useState<Era>('major9');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<number | string | null>(null);
  const [page, setPage] = useState(1);

  // Resolve language: zh falls back to en
  const effectiveLang = lang === 'zh' ? 'en' : lang;

  const currentTypes = era === 'major9' ? MAJOR9_TYPES : LEGACY_TYPES;

  const posts = useMemo(() => {
    let source = era === 'major9'
      ? (major9Data.posts as Post[]).filter(p => p.lang === effectiveLang)
      : (legacyData.posts as Post[]); // Legacy is EN only
    if (typeFilter.length > 0) {
      source = source.filter(p => typeFilter.includes(p.type));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      source = source.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.content.replace(/<[^>]*>/g, '').toLowerCase().includes(q),
      );
    }
    return source;
  }, [era, effectiveLang, typeFilter, search]);

  const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE);
  const paginatedPosts = posts.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);

  function handleToggleType(type: string) {
    setTypeFilter(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type],
    );
    setPage(1);
  }

  function handleResetType() {
    setTypeFilter([]);
    setPage(1);
  }

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function switchEra(newEra: Era) {
    setEra(newEra);
    setTypeFilter([]);
    setSearch('');
    setExpandedId(null);
    setPage(1);
  }

  function toggleExpand(id: number | string) {
    setExpandedId(prev => (prev === id ? null : id));
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Era tabs */}
      <div className="flex gap-2">
        {(['major9', 'smilegate'] as const).map(e => (
          <button
            key={e}
            type="button"
            onClick={() => switchEra(e)}
            className={`relative rounded-lg border px-4 py-2 text-sm font-medium transition ${
              era === e
                ? 'border-amber-500/50 bg-amber-500/15 text-amber-300 tab-game-active'
                : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'
            }`}
          >
            {t(e === 'major9' ? 'tools.patch-notes.era.major9' : 'tools.patch-notes.era.smilegate')}
          </button>
        ))}
      </div>

      {/* Banners */}
      {lang === 'zh' && era === 'major9' && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-300">
          {t('tools.patch-notes.zh_fallback')}
        </div>
      )}
      {era === 'smilegate' && lang !== 'en' && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-300">
          {t('tools.patch-notes.legacy_en_only')}
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => handleSearch(e.target.value)}
        placeholder={t('common.search')}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-zinc-500"
      />

      {/* Filters */}
      <TextFilterGroup
        label={t('common.filter')}
        items={[
          { name: t('common.all'), value: null },
          ...currentTypes.map(type => ({
            name: t(TYPE_I18N_KEYS[type]),
            value: type,
          })),
        ]}
        filter={typeFilter}
        onToggle={handleToggleType}
        onReset={handleResetType}
      />

      {/* Post list */}
      <div className="space-y-3">
        {paginatedPosts.map(post => (
          <article key={post.id} className="rounded-lg border border-zinc-700/50 bg-zinc-800/50">
            {/* Header — always visible */}
            <button
              type="button"
              onClick={() => toggleExpand(post.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-700/30"
            >
              {/* Type badge */}
              <span
                className={`shrink-0 rounded border px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[post.type] || 'bg-zinc-600/20 text-zinc-400 border-zinc-600/30'}`}
              >
                {t(TYPE_I18N_KEYS[post.type])}
              </span>

              {/* Title */}
              <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">
                {post.title}
              </span>

              {/* Date */}
              <time className="shrink-0 text-xs text-zinc-500">{post.date}</time>

              {/* Expand icon */}
              <svg
                className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${expandedId === post.id ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Expanded content */}
            {expandedId === post.id && (
              <div className="border-t border-zinc-700/50 px-4 py-4">
                <div
                  className="patch-note-content"
                  dangerouslySetInnerHTML={{ __html: post.content }}
                />
              </div>
            )}
          </article>
        ))}

        {posts.length === 0 && (
          <p className="py-12 text-center text-zinc-500">No patch notes available.</p>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="rounded border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-30"
          >
            &laquo;
          </button>
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
            // Show pages around current page
            let start = Math.max(1, page - 4);
            const end = Math.min(totalPages, start + 9);
            if (end - start < 9) start = Math.max(1, end - 9);
            return start + i;
          }).filter(p => p <= totalPages).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              className={`rounded border px-3 py-1.5 text-sm transition ${
                p === page
                  ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
                  : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
            className="rounded border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-30"
          >
            &raquo;
          </button>
        </div>
      )}
    </div>
  );
}
