'use client';

import { useState } from 'react';
import type { Lang } from '@/lib/i18n/config';
import type { TranslationKey } from '@/i18n';
import Tabs from '@/app/components/ui/Tabs';
import ToolCard from './ToolCard';

type ToolData = {
  slug: string;
  icon: string;
  status: 'available' | 'coming-soon' | 'hidden';
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

export default function ToolsPageContent({ groups, lang, t, devMode }: Props) {
  const [active, setActive] = useState(ALL);

  const tabItems = [ALL, ...groups.map((g) => g.category.slug)];
  const tabLabels = [
    t['common.all'],
    ...groups.map((g) => {
      const catKey = `tools.category.${g.category.slug}` as TranslationKey;
      return t[catKey] ?? g.category.slug;
    }),
  ];

  const visibleGroups = active === ALL
    ? groups
    : groups.filter((g) => g.category.slug === active);

  return (
    <>
      <Tabs
        items={tabItems}
        labels={tabLabels}
        value={active}
        onChange={setActive}
        hashPrefix="cat"
        className="justify-center mt-6"
      />

      {visibleGroups.map(({ category, tools }) => {
        const catKey = `tools.category.${category.slug}` as TranslationKey;
        return (
          <section key={category.slug} className="mt-8">
            <h2 className="mb-3 text-lg font-semibold text-zinc-200">
              {t[catKey] ?? category.slug}
            </h2>
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
                />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
