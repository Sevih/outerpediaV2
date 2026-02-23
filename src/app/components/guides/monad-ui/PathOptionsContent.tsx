'use client';

import React from 'react';
import type { MonadEdge, MonadNode } from '@/types/monad';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';

interface PathOptionsContentProps {
  node: MonadNode;
  edges: MonadEdge[];
  getNodeById: (id: string) => MonadNode;
  showTruePath?: boolean;
}

export const PathOptionsContent: React.FC<PathOptionsContentProps> = ({
  node,
  edges,
  getNodeById,
  showTruePath,
}) => {
  const { t, lang } = useI18n();

  const outgoing = edges
    .filter((e) => e.from === node.id)
    .sort((a, b) => {
      const nodeA = getNodeById(a.to);
      const nodeB = getNodeById(b.to);
      return nodeB.y - nodeA.y;
    });

  if (outgoing.length === 0)
    return <div className="text-sm">{t('monad.ui.noOptions')}</div>;

  return (
    <>
      {outgoing.map((edge, i) => {
        const toNode = getNodeById(edge.to);
        const isTrue = edge.truePath === true;
        const shouldDim = showTruePath && !isTrue;
        const highlight = showTruePath && isTrue;

        const labelText = lRec(edge.label, lang) || t('monad.ui.unnamedPath');
        const needText = lRec(edge.need, lang);

        return (
          <div
            key={i}
            className={`rounded px-3 py-2 border text-sm
              ${shouldDim ? 'bg-zinc-800 text-zinc-500 border-zinc-700' : ''}
              ${highlight ? 'bg-green-700 text-white border-green-500' : 'bg-zinc-800 text-white border-zinc-700'}`}
          >
            <div className="italic">{labelText}</div>
            {needText && (
              <div className="text-xs text-yellow-400 mt-1 italic">
                {t('monad.ui.required')} : {needText}
              </div>
            )}
            <div className="text-xs text-gray-400 mt-1">
              {'-> '}{toNode.label ?? t(`monad.node.${toNode.type}`) ?? toNode.id}
            </div>
          </div>
        );
      })}
    </>
  );
};
