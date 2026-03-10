'use client';

import { nodes, edges, routeTitleKey } from '@data/monad/depth5-route1';
import { nodeTypes } from '@/lib/monad/nodeTypes';
import MonadGateMap from '@/app/components/guides/MonadGateMap';
import ItemInline from '@/app/components/inline/ItemInline';
import { useI18n } from '@/lib/contexts/I18nContext';

export default function Depth5Route1() {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-3">{t('monad.rewards')}</h2>
        <div className="flex items-center gap-2">
          <ItemInline name="Fusion-Type Core" />
          <span className="text-zinc-400">x95</span>
        </div>
      </div>
      <MonadGateMap
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        titleKey={routeTitleKey}
      />
    </div>
  );
}
