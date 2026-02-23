import type { nodeTypes } from '@/lib/monad/nodeTypes';
import type { LangMap } from '@/types/common';

export type NodeType = keyof typeof nodeTypes;

export interface MonadNode {
  id: string;
  x: number;
  y: number;
  type: NodeType;
  label?: string;
  popupText?: string;
  truePath?: boolean;
}

export interface MonadEdge {
  from: string;
  to: string;
  label?: LangMap;
  need?: LangMap;
  truePath?: boolean;
}
