'use client';

import { useEffect, useState } from 'react';
import { FaArrowUp } from 'react-icons/fa';
import { useI18n } from '@/lib/contexts/I18nContext';

export default function BackToTop() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label={t('common.back_to_top')}
      className="fixed bottom-6 right-6 z-50 flex size-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800/90 text-zinc-300 shadow-lg backdrop-blur transition-all hover:border-zinc-600 hover:text-white"
    >
      <FaArrowUp className="text-sm" />
    </button>
  );
}
