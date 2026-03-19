'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Redirect to EE by default
export default function EquipmentExtractorPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/admin/extractor/equipment/ee'); }, [router]);
  return null;
}
