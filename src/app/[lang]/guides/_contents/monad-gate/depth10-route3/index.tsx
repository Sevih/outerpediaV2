'use client';

import variantA from '@data/monad/generated/routes/123.json';
import variantB from '@data/monad/generated/routes/124.json';
import MonadRoutePage from '@/app/components/guides/MonadRoutePage';
import type { RouteJson } from '@/lib/monad/loadRoute';

export default function Depth10Route3() {
  return (
    <MonadRoutePage
      route={[
        { label: 'Variant A', route: variantA as unknown as RouteJson },
        { label: 'Variant B', route: variantB as unknown as RouteJson },
      ]}
      titleKey="monad.route.3"
    />
  );
}
