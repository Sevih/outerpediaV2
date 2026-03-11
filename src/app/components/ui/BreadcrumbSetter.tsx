'use client';

import { useBreadcrumbOverride } from '@/lib/contexts/BreadcrumbContext';

export default function BreadcrumbSetter({ label }: { label: string }) {
  useBreadcrumbOverride(label);
  return null;
}
