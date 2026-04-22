'use client';

import route from '@data/monad/generated/routes/128.json';
import MonadRoutePage from '@/app/components/guides/MonadRoutePage';
import type { RouteJson } from '@/lib/monad/loadRoute';

export default function Depth9Route4() {
  return <MonadRoutePage route={route as unknown as RouteJson} titleKey="monad.route.4" />;
}
