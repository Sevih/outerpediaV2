'use client';

import { useCallback, useState, type ReactNode } from 'react';
import VersionSelector from '@/app/components/ui/VersionSelector';
import { useI18n } from '@/lib/contexts/I18nContext';
import parseText from '@/lib/parse-text';

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
  /** Override VersionSelector hash prefix. Pass `undefined` to disable hash sync. */
  hashPrefix?: string;
  onVersionChange?: (key: string) => void;
};

export default function GuideTemplate({
  title,
  introduction,
  disclaimer,
  versions,
  defaultVersion,
  children,
  hashPrefix = 'version',
  onVersionChange,
}: Props) {
  const versionKeys = versions
    ? Object.entries(versions)
        .filter(([, v]) => !v.hidden)
        .map(([k]) => k)
    : [];
  const versionLabels = versions
    ? versionKeys.map((k) => versions[k].label)
    : [];

  const { t } = useI18n();

  const [activeVersion, setActiveVersion] = useState(
    defaultVersion && versionKeys.includes(defaultVersion)
      ? defaultVersion
      : versionKeys[0] ?? ''
  );

  const handleVersionChange = useCallback((key: string) => {
    setActiveVersion(key);
    onVersionChange?.(key);
  }, [onVersionChange]);

  const isOlderVersion =
    versions && versionKeys.length > 1 && activeVersion !== versionKeys[0];

  return (
    <article className="space-y-6">
      <h2 className="mb-4 text-2xl font-bold">{title}</h2>

      {disclaimer && (
        <div className="panel-warning px-4 py-3 text-sm text-yellow-200">
          {disclaimer}
        </div>
      )}

      {introduction && (
        <p className="text-sm leading-relaxed text-zinc-300">{parseText(introduction)}</p>
      )}

      {versionKeys.length > 1 && (
        <VersionSelector
          items={versionKeys}
          labels={versionLabels}
          value={activeVersion}
          onChange={handleVersionChange}
          hashPrefix={hashPrefix}
        />
      )}

      {isOlderVersion && versions && (
        <div className="panel-warning px-4 py-3 text-sm text-yellow-200">
          {t('page.guide.older_version_warning', {
            currentVersion: versions[activeVersion].label,
            newestVersion: versions[versionKeys[0]].label,
          })}
        </div>
      )}

      {versions && activeVersion && versions[activeVersion] ? (
        <div key={activeVersion} className="space-y-6">{versions[activeVersion].content}</div>
      ) : (
        children && <div className="space-y-6">{children}</div>
      )}
    </article>
  );
}
