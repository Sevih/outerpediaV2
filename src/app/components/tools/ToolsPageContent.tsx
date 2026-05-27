'use client';

import { useEffect, useRef, useState } from 'react';
import type { Lang } from '@/lib/i18n/config';
import type { TranslationKey } from '@/i18n';
import ToolCard from './ToolCard';
import FeaturedRow from './FeaturedRow';
import {
  CATEGORY_ACCENT,
  type CategoryAccentKey,
} from './toolsTheme';

type ToolData = {
  slug: string;
  icon: string;
  status: 'available' | 'coming-soon' | 'hidden' | 'unlisted';
  href?: string;
  category: string;
};

type GroupData = {
  category: { slug: string };
  tools: ToolData[];
};

type Props = {
  groups: GroupData[];
  lang: Lang;
  t: Record<TranslationKey, string>;
  devMode?: boolean;
};

const ALL = '__all__';
const HASH_PREFIX = 'cat-';

const KNOWN_CATEGORIES: readonly CategoryAccentKey[] = [
  'rankings',
  'equipment',
  'simulators',
  'info',
  'media',
];

function asAccentKey(slug: string): CategoryAccentKey {
  return (KNOWN_CATEGORIES as readonly string[]).includes(slug)
    ? (slug as CategoryAccentKey)
    : 'rankings';
}

export default function ToolsPageContent({ groups, lang, t, devMode }: Props) {
  const [active, setActive] = useState(ALL);
  const didReadHash = useRef(false);

  useEffect(() => {
    if (didReadHash.current) return;
    didReadHash.current = true;
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (hash.startsWith(HASH_PREFIX)) {
      const v = hash.slice(HASH_PREFIX.length);
      if (v === ALL || groups.some((g) => g.category.slug === v)) {
        setActive(v);
      }
    }
  }, [groups]);

  function handleTabClick(v: string) {
    setActive(v);
    history.replaceState(null, '', `#${HASH_PREFIX}${v}`);
  }

  const totalCount = groups.reduce((n, g) => n + g.tools.length, 0);
  const visibleGroups = active === ALL ? groups : groups.filter((g) => g.category.slug === active);

  return (
    <div className="mt-6 flex flex-col gap-8">
      {/* Featured row — only on All */}
      {active === ALL && (
        <FeaturedRow groups={groups} lang={lang} t={t} devMode={devMode} />
      )}

      {/* Category tabs */}
      <div
        className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-slate-800/50 px-3 py-2.5 backdrop-blur-sm"
        role="tablist"
        aria-label={t['page.tools.title']}
      >
        <CategoryTab
          label={t['common.all']}
          count={totalCount}
          active={active === ALL}
          onClick={() => handleTabClick(ALL)}
        />
        {groups.map((g) => {
          const key = asAccentKey(g.category.slug);
          const catLabel = t[`tools.category.${g.category.slug}` as TranslationKey] ?? g.category.slug;
          return (
            <CategoryTab
              key={g.category.slug}
              label={catLabel}
              count={g.tools.length}
              accentKey={key}
              active={active === g.category.slug}
              onClick={() => handleTabClick(g.category.slug)}
            />
          );
        })}
      </div>

      {/* Sections */}
      {visibleGroups.map(({ category, tools }) => {
        const key = asAccentKey(category.slug);
        const accent = CATEGORY_ACCENT[key];
        const catLabel = t[`tools.category.${category.slug}` as TranslationKey] ?? category.slug;
        return (
          <section key={category.slug} className="flex flex-col gap-3">
            <SectionHeader
              label={catLabel}
              count={tools.length}
              accentKey={key}
              countLabel={t['tools.count']?.replace('{count}', String(tools.length))}
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => (
                <ToolCard
                  key={tool.slug}
                  slug={tool.slug}
                  icon={tool.icon}
                  status={tool.status}
                  href={tool.href}
                  lang={lang}
                  t={t}
                  devMode={devMode}
                  category={key}
                />
              ))}
            </div>
            {/* Subtle bottom rule with accent dot */}
            <div className="mt-1 flex items-center gap-2 opacity-50">
              <span className={`size-1 rounded-full ${accent.dot}`} aria-hidden />
              <span className="h-px flex-1 bg-zinc-800" aria-hidden />
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function CategoryTab({
  label, count, active, accentKey, onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  accentKey?: CategoryAccentKey;
  onClick: () => void;
}) {
  const accent = accentKey ? CATEGORY_ACCENT[accentKey] : null;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        'inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm transition',
        active
          ? accent
            ? `${accent.tabActiveBorder} ${accent.tabActiveBg} ${accent.tabActiveText} font-medium`
            : 'border-zinc-600 bg-slate-900/80 font-medium text-zinc-100'
          : 'border-zinc-800 bg-slate-900/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200',
      ].join(' ')}
    >
      {accent && <span className={`size-1.5 rounded-full ${accent.dot}`} aria-hidden />}
      {label}
      <span
        className={[
          'font-mono text-[10px] tracking-wider',
          active
            ? accent
              ? accent.tabActiveCount
              : 'text-zinc-400'
            : 'text-zinc-500',
        ].join(' ')}
      >
        {count}
      </span>
    </button>
  );
}

function SectionHeader({
  label, count, accentKey, countLabel,
}: {
  label: string;
  count: number;
  accentKey: CategoryAccentKey;
  countLabel: string;
}) {
  const accent = CATEGORY_ACCENT[accentKey];
  return (
    <div className="relative flex items-end gap-3 border-b border-zinc-800 pb-2">
      {/* Accent stripe — sits on top of the bottom border */}
      <span
        className={`absolute -bottom-px left-0 h-0.5 w-10 rounded-full ${accent.stripe}`}
        aria-hidden
      />
      <span className={`size-2 rounded-full ${accent.dot}`} aria-hidden />
      <h2 className={`text-base font-semibold tracking-tight ${accent.text} after:hidden`}>
        {label}
      </h2>
      <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
        {countLabel || `${count}`}
      </span>
    </div>
  );
}
