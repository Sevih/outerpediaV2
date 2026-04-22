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
  /** Names of key item(s) reachable from this node depending on the choice taken. */
  givesItem?: LangMap;
}

export interface MonadEdge {
  from: string;
  to: string;
  label?: LangMap;
  need?: LangMap;
  /** Name(s) of key item(s) granted when the player takes this choice. */
  gives?: LangMap;
  truePath?: boolean;
}
