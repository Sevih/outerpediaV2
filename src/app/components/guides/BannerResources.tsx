'use client';

import ItemInline from '@/app/components/inline/ItemInline';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { LangMap } from '@/types/common';

type ResourceEntry = {
  items: string | string[];
  cost: number;
  mileageItem: string | null;
  note?: string;
};

type Props = {
  resources: ResourceEntry[];
  title?: string;
  warning?: string;
};

const LABELS = {
  title: { en: 'Resources', jp: '使用できるリソース', kr: '사용 가능한 재화', zh: '可使用资源' } satisfies LangMap,
  perRecruit: { en: 'per recruit', jp: '1回募集あたり', kr: '1회 모집당', zh: '每次招募' } satisfies LangMap,
  grants: { en: 'Grants', jp: '獲得', kr: '획득', zh: '获得' } satisfies LangMap,
  noMileage: { en: 'No mileage', jp: 'マイレージ加算なし', kr: '마일리지 미적용', zh: '不计入点数' } satisfies LangMap,
};

export default function BannerResources({ resources, title, warning }: Props) {
  const { lang } = useI18n();
  const displayTitle = title || lRec(LABELS.title, lang);

  return (
    <div className="mx-auto max-w-2xl space-y-2">
      <p className="text-sm font-semibold text-gray-200">{displayTitle}:</p>
      <div className="space-y-2">
        {resources.map((resource, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-neutral-700/50 bg-neutral-800/30 p-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-2">
                {Array.isArray(resource.items) ? (
                  <>
                    <ItemInline name={resource.items[0]} />
                    {resource.items.length > 1 && (
                      <>
                        <span className="text-gray-400">&</span>
                        <ItemInline name={resource.items[1]} />
                      </>
                    )}
                  </>
                ) : (
                  <ItemInline name={resource.items} />
                )}
              </div>
              <div className="flex flex-col gap-1 sm:items-end">
                <div className="text-sm text-gray-200">
                  <span className="font-semibold text-yellow-400">{resource.cost}</span>{' '}
                  {lRec(LABELS.perRecruit, lang)}
                </div>
                {resource.mileageItem ? (
                  <div className="flex items-center gap-1 text-xs text-green-400">
                    {lRec(LABELS.grants, lang)} 1 <ItemInline name={resource.mileageItem} />
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">{lRec(LABELS.noMileage, lang)}</div>
                )}
              </div>
            </div>
            {resource.note && (
              <p className="mt-2 border-t border-neutral-700/30 pt-2 text-xs text-gray-400">
                {resource.note}
              </p>
            )}
          </div>
        ))}
      </div>
      {warning && (
        <div className="mt-3 rounded-lg border border-orange-700/50 bg-orange-900/20 p-2.5">
          <p className="text-sm text-orange-200">{warning}</p>
        </div>
      )}
    </div>
  );
}
