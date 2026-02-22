'use client';

import { useState, type ReactNode } from 'react';
import Tabs from '@/app/components/ui/Tabs';

type GuideVersion = {
  label: string;
  content: ReactNode;
  hidden?: boolean;
};

type Props = {
  title: string;
  introduction?: string;
  disclaimer?: string;
  versions?: Record<string, GuideVersion>;
  defaultVersion?: string;
  children?: ReactNode;
};

export default function GuideTemplate({
  title,
  introduction,
  disclaimer,
  versions,
  defaultVersion,
  children,
}: Props) {
  const versionKeys = versions
    ? Object.entries(versions)
        .filter(([, v]) => !v.hidden)
        .map(([k]) => k)
    : [];
  const versionLabels = versions
    ? versionKeys.map((k) => versions[k].label)
    : [];

  const [activeVersion, setActiveVersion] = useState(
    defaultVersion && versionKeys.includes(defaultVersion)
      ? defaultVersion
      : versionKeys[0] ?? ''
  );

  return (
    <article className="space-y-6">
      <h2>{title}</h2>

      {disclaimer && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
          {disclaimer}
        </div>
      )}

      {introduction && (
        <p className="text-sm leading-relaxed text-zinc-300">{introduction}</p>
      )}

      {versionKeys.length > 1 && (
        <Tabs
          items={versionKeys}
          labels={versionLabels}
          value={activeVersion}
          onChange={setActiveVersion}
          hashPrefix="version"
        />
      )}

      {versions && activeVersion && versions[activeVersion] ? (
        <div className="space-y-6">{versions[activeVersion].content}</div>
      ) : (
        children && <div className="space-y-6">{children}</div>
      )}
    </article>
  );
}
