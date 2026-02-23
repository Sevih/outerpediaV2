import * as route11 from "./depth1-route1";
import * as route21 from "./depth2-route1";
import * as route31 from "./depth3-route1";
import * as route41 from "./depth4-route1";
import * as route42 from "./depth4-route2";
import * as route51 from "./depth5-route1";
import * as route61 from "./depth6-route1";
import * as route62 from "./depth6-route2";
import * as route63 from "./depth6-route3";
import * as route64 from "./depth6-route4";
import * as route65 from "./depth6-route5";
import * as defaultRoute from "./defaultRoute";
import type { MonadNode, MonadEdge } from "@/types/monad";

export const routes: Record<string, {
  routeTitleKey: string;
  nodes: MonadNode[];
  edges: MonadEdge[];
}> = {
  "Default": defaultRoute,
  "Deeps 1 – Route 1": route11,
  "Deeps 2 – Route 1": route21,
  "Deeps 3 – Route 1": route31,
  "Deeps 4 – Route 1": route41,
  "Deeps 4 – Route 2": route42,
  "Deeps 5 – Route 1": route51,
  "Deeps 6 – Route 1": route61,
  "Deeps 6 – Route 2": route62,
  "Deeps 6 – Route 3": route63,
  "Deeps 6 – Route 4": route64,
  "Deeps 6 – Route 5": route65,
};

export type RouteKey = keyof typeof routes;
