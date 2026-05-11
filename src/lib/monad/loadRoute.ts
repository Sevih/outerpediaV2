import type { MonadNode, MonadEdge, NodeType } from '@/types/monad';
import type { LangMap } from '@/types/common';
import type { Lang, GameLang } from '@/lib/i18n/config';
import { GAME_LANGS } from '@/lib/i18n/config';

// ─── JSON shapes (must match the admin generator output) ─────────────────────

export interface ThemeJson {
  themeId: string;
  themeName: LangMap | null;
  gauge: { perMove: number; cap: number };
  items: Record<string, { name: LangMap }>;
  events: Record<
    string,
    {
      titleKey?: string;
      ends: Record<
        string,
        {
          labelKey?: string;
          requireItemId?: string;
          requireGauge?: number;
          givesItemIds?: string[];
          gaugeDelta?: number;
        }
      >;
      kind?: 'service';
    }
  >;
  rewards: Record<string, { gold?: { min: number; max: number }; crystal?: { min: number; max: number }; items: Array<{ type: string; typeId: string; min: number; max: number }> }>;
  labels: Record<string, LangMap>;
  stageLabels: Record<string, LangMap>;
  routes: Array<{ groupId: string; depth: number; routeIndex: number; variant: number; name: LangMap | null }>;
}

export interface RouteJson {
  groupId: string;
  depth: number;
  routeIndex: number;
  variant: number;
  name: LangMap | null;
  nodes: Array<{
    id: string;
    col: number;
    row: number;
    type: string;
    typeNameKey?: string;
    eventGroupId?: string;
    rewardId?: string;
    firstClearRewardId?: string;
    autoItems?: string[];
    truePath?: boolean;
    altPath?: boolean;
  }>;
  edges: Array<{
    from: string;
    to: string;
    eventEndId?: string;
    truePath?: boolean;
    altPath?: boolean;
  }>;
}

// Types whose stage-specific label (typeName) adds information over the generic type key
// (e.g. relic subtype, ending flavour). For others the localised `monad.node.*` key is enough.
const TYPES_WITH_SPECIFIC_LABEL = new Set(['relic', 'tending', 'bending', 'nending']);

function mergeItemNames(ids: string[], theme: ThemeJson): LangMap {
  const buckets: Record<GameLang, string[]> = { en: [], jp: [], kr: [], zh: [] };
  for (const id of ids) {
    const n = theme.items[id]?.name;
    if (!n) continue;
    for (const lang of GAME_LANGS) {
      const v = n[lang];
      if (v) buckets[lang].push(v);
    }
  }
  const out = {} as LangMap;
  for (const lang of GAME_LANGS) out[lang] = buckets[lang].join(' / ');
  return out;
}

/**
 * Split a resolved label into {label, need} by extracting the last parenthesised chunk.
 * Must match the server-side splitter used when writing the data.
 */
function splitLabelAndNeed(full: LangMap): { label: LangMap; need: LangMap } {
  const labelOut = {} as LangMap;
  const needOut = {} as LangMap;
  for (const lang of GAME_LANGS) {
    const text = full[lang] ?? '';
    const m = text.match(/^([\s\S]*?)\s*[\(（]([^\(\)（）]+)[\)）]\s*$/);
    if (m) {
      labelOut[lang] = m[1].trim();
      needOut[lang] = m[2].trim();
    } else {
      labelOut[lang] = text;
      needOut[lang] = '';
    }
  }
  return { label: labelOut, need: needOut };
}

/**
 * Build runtime {nodes, edges} from a generated route JSON + its theme, localised on `lang`.
 * Resolves edge labels/need/gives from the theme's event table and aggregates all items granted
 * by a node (auto + every choice) into node.givesItem so the UI can flag it at a glance.
 */
export function loadRoute(
  route: RouteJson,
  theme: ThemeJson,
  lang: Lang,
): { nodes: MonadNode[]; edges: MonadEdge[] } {
  const nodeIndex = new Map(route.nodes.map((n) => [n.id, n]));

  // Pass 1: edges — resolve label/need/gives through the theme event registry.
  const edges: MonadEdge[] = route.edges.map((e) => {
    const fromNode = nodeIndex.get(e.from);
    const end =
      fromNode?.eventGroupId && e.eventEndId
        ? theme.events[fromNode.eventGroupId]?.ends[e.eventEndId]
        : undefined;
    const rawLabel = end?.labelKey ? theme.labels[end.labelKey] : undefined;
    let label: LangMap | undefined;
    let need: LangMap | undefined;
    if (rawLabel) {
      const hasReq = !!(end?.requireItemId || end?.requireGauge);
      if (hasReq) {
        const split = splitLabelAndNeed(rawLabel);
        label = split.label;
        if (Object.values(split.need).some((v) => v)) need = split.need;
      } else {
        label = rawLabel;
      }
    }
    const gives =
      end?.givesItemIds && end.givesItemIds.length ? mergeItemNames(end.givesItemIds, theme) : undefined;
    const out: MonadEdge = { from: e.from, to: e.to };
    if (label) out.label = label;
    if (need) out.need = need;
    if (gives) out.gives = gives;
    if (e.truePath) out.truePath = true;
    if (e.altPath) out.altPath = true;
    const eventGroupKind = fromNode?.eventGroupId
      ? theme.events[fromNode.eventGroupId]?.kind
      : undefined;
    if (eventGroupKind === 'service') out.service = true;
    return out;
  });

  // Pre-compute per-node aggregated gives (auto items ∪ union of outgoing edge gives)
  // so the map UI shows a single green key on event nodes that can grant a key item.
  const autoByNode = new Map<string, Set<string>>();
  for (const n of route.nodes) {
    for (const id of n.autoItems ?? []) {
      if (!autoByNode.has(n.id)) autoByNode.set(n.id, new Set());
      autoByNode.get(n.id)!.add(id);
    }
  }
  // Merge item *names* collected from edge.gives into their source node.
  const edgeGivesByFrom = new Map<string, LangMap[]>();
  for (const e of edges) {
    if (!e.gives) continue;
    if (!edgeGivesByFrom.has(e.from)) edgeGivesByFrom.set(e.from, []);
    edgeGivesByFrom.get(e.from)!.push(e.gives);
  }

  const nodes: MonadNode[] = route.nodes.map((n) => {
    const typeLabel = n.typeNameKey ? theme.stageLabels[n.typeNameKey] : undefined;
    const label = TYPES_WITH_SPECIFIC_LABEL.has(n.type) ? typeLabel?.[lang] : undefined;
    const buckets: Record<GameLang, Set<string>> = { en: new Set(), jp: new Set(), kr: new Set(), zh: new Set() };
    const autoIds = autoByNode.get(n.id);
    if (autoIds) {
      const merged = mergeItemNames(Array.from(autoIds), theme);
      for (const lg of GAME_LANGS) if (merged[lg]) buckets[lg].add(merged[lg]!);
    }
    for (const g of edgeGivesByFrom.get(n.id) ?? []) {
      for (const lg of GAME_LANGS) if (g[lg]) buckets[lg].add(g[lg]!);
    }
    let givesItem: LangMap | undefined;
    if (Object.values(buckets).some((s) => s.size > 0)) {
      givesItem = {} as LangMap;
      for (const lg of GAME_LANGS) givesItem[lg] = Array.from(buckets[lg]).join(' / ');
    }
    const out: MonadNode = {
      id: n.id,
      x: n.col - 1,
      y: 5 - n.row,
      type: n.type as NodeType,
    };
    if (label) out.label = label;
    if (givesItem) out.givesItem = givesItem;
    if (n.truePath) out.truePath = true;
    if (n.altPath) out.altPath = true;
    return out;
  });

  return { nodes, edges };
}
