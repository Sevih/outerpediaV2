'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const BreadcrumbContext = createContext<{ override: string | null; setOverride: (v: string | null) => void }>({
  override: null,
  setOverride: () => {},
});

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [override, setOverride] = useState<string | null>(null);
  return (
    <BreadcrumbContext.Provider value={{ override, setOverride }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

/** Set the last breadcrumb segment label. Call from detail pages. */
export function useBreadcrumbOverride(label: string) {
  const { setOverride } = useContext(BreadcrumbContext);
  useEffect(() => {
    setOverride(label);
    return () => setOverride(null);
  }, [label, setOverride]);
}

export function useBreadcrumbLabel(): string | null {
  return useContext(BreadcrumbContext).override;
}
