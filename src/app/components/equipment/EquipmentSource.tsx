'use client';

import Link from 'next/link';
import type { BossDisplayMap, BossDisplayInfo } from '@/types/equipment';
import type { Lang } from '@/lib/i18n/config';
import { lRec } from '@/lib/i18n/localize';
import { useI18n } from '@/lib/contexts/I18nContext';
import BossPortrait from '@/app/components/guides/BossPortrait';

// Static source labels (no boss association)
const SOURCE_LABELS: Record<string, Partial<Record<string, string>>> = {
  'Event Shop': { en: 'Event Shop', jp: 'イベントショップ', kr: '이벤트 상점', zh: '活动商店' },
  'Adventure License': { en: 'Adventure License', jp: '冒険者ライセンス', kr: '모험 라이선스', zh: '冒险许可证' },
};

type Props = {
  source?: string;
  boss?: string | string[];
  bossMap: BossDisplayMap;
  lang: Lang;
  /** When true, boss names link to their guide page. False by default (safe inside <a> cards). */
  linkable?: boolean;
};

/** Render a single boss entry: portrait + name, optionally wrapped in a link */
function BossEntry({ info, name, href, large }: { info: BossDisplayInfo; name: string; href?: ReturnType<ReturnType<typeof useI18n>['href']>; large?: boolean }) {
  const inner = large ? (
    <span className="inline-flex items-center gap-2">
      <span className="md:hidden"><BossPortrait icons={info.icons} name={name} size="sm" /></span>
      <span className="hidden md:block"><BossPortrait icons={info.icons} name={name} size="md" /></span>
      <span>{name}</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5">
      <BossPortrait icons={info.icons} name={name} size="xxs" />
      <span>{name}</span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="text-sky-400 hover:text-sky-300 transition-colors">
        {inner}
      </Link>
    );
  }

  return inner;
}

export default function EquipmentSource({ source, boss, bossMap, lang, linkable = false }: Props) {
  const { t, href: localHref } = useI18n();

  if (!source && !boss) return null;

  function bossHref(info: BossDisplayInfo) {
    return linkable && info.guidePath ? localHref(info.guidePath) : undefined;
  }

  const bossIds = boss ? (Array.isArray(boss) ? boss : [boss]) : [];

  // Boss(es): resolve from bossMap
  if (bossIds.length > 0) {
    const firstBoss = bossMap[bossIds[0]];
    const sourceLabel = firstBoss ? lRec(firstBoss.source, lang) : null;

    return (
      <div>
        <p className="font-semibold text-[#fbbf24] mb-1 text-sm">{t('equip.detail.source')}</p>
        <div className="text-xs text-zinc-300">
          {sourceLabel && <p>{sourceLabel}</p>}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {bossIds.map(id => {
              const info = bossMap[id];
              const bName = info ? lRec(info.name, lang) || id : id;
              return info
                ? <BossEntry key={id} info={info} name={bName} href={bossHref(info)} large={linkable} />
                : <span key={id}>{bName}</span>;
            })}
          </div>
        </div>
      </div>
    );
  }

  // Source-only (shop etc.)
  const sourceLabel = (source && SOURCE_LABELS[source]) ? lRec(SOURCE_LABELS[source], lang) : source;

  return (
    <div>
      <p className="font-semibold text-[#fbbf24] mb-1 text-sm">{t('equip.detail.source')}</p>
      <div className="text-xs text-zinc-300">
        {sourceLabel && <p>{sourceLabel}</p>}
      </div>
    </div>
  );
}
