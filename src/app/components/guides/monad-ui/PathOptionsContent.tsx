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

  // Multiple highlighted choices = the player can pick either, surface the disclaimer so users
  // don't waste time second-guessing which option is "the right one".
  const highlightedCount = outgoing.filter(
    (e) => e.truePath === true || e.altPath === true,
  ).length;
  const showEquivalentNotice = !!showTruePath && highlightedCount > 1;

  return (
    <>
      {showEquivalentNotice && (
        <div className="rounded px-3 py-2 mb-2 border border-red-500/60 bg-red-900/30 text-red-200 text-xs font-semibold text-center">
          {t('monad.ui.choiceDoesntMatter')}
        </div>
      )}
      {outgoing.map((edge, i) => {
        const toNode = getNodeById(edge.to);
        const isTrue = edge.truePath === true;
        const isAlt = edge.altPath === true;
        const shouldDim = showTruePath && !isTrue && !isAlt;
        // truePath and altPath both reach a True Ending — render them with the same green
        // highlight. The BFS-picked vs. equivalent-fork distinction confused players (cf.
        // D3 Expected Ambush: both choices lead to true end, only one was highlighted).
        const highlight = showTruePath && (isTrue || isAlt);

        const labelText = lRec(edge.label, lang) || t('monad.ui.unnamedPath');
        const needText = lRec(edge.need, lang);
        const givesText = lRec(edge.gives, lang);

        return (
          <div
            key={i}
            className={`rounded px-3 py-2 border text-sm
              ${shouldDim ? 'bg-zinc-800 text-zinc-500 border-zinc-700' : ''}
              ${highlight
                ? 'bg-green-700 text-white border-green-500'
                : 'bg-zinc-800 text-white border-zinc-700'}`}
          >
            <div className="italic">{labelText}</div>
            {needText && (
              <div className="text-xs text-yellow-400 mt-1 italic">
                {t('monad.ui.required')} : {needText}
              </div>
            )}
            {givesText && (
              <div className="text-xs text-emerald-400 mt-1 italic">
                🔑 {t('monad.ui.grants')} : {givesText}
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
