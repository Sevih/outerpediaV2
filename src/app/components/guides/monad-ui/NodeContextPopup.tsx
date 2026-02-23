'use client';

import React from 'react';
import type { MonadNode } from '@/types/monad';
import { useI18n } from '@/lib/contexts/I18nContext';

interface NodeContextPopupProps {
  node: MonadNode;
  onClose: () => void;
  children: React.ReactNode;
  position?: 'left' | 'right' | 'bottom' | 'top';
}

export const NodeContextPopup: React.FC<NodeContextPopupProps> = ({
  node,
  onClose,
  children,
  position = 'bottom',
}) => {
  const { t } = useI18n();

  const positionClasses = {
    bottom: 'left-4 bottom-4',
    top: 'left-4 top-4',
    right: 'right-4 top-4',
    left: 'left-4 top-4',
  };

  return (
    <div
      className={`absolute z-50 bg-zinc-900 text-white border border-white p-4 rounded w-75 shadow-xl ${positionClasses[position]}`}
    >
      <div className="flex justify-between items-center mb-3">
        <div className="font-semibold text-sm">
          {node.label ?? t(`monad.node.${node.type}`) ?? node.id}
        </div>
        <button
          onClick={onClose}
          className="text-white text-xs hover:text-red-400 transition"
        >
          X
        </button>
      </div>

      {node.popupText && (
        <p className="text-xs text-gray-300 mb-3 whitespace-pre-line">{node.popupText}</p>
      )}

      <div className="space-y-3">{children}</div>
    </div>
  );
};
