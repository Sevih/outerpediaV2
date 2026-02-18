'use client';

import type { Character } from '@/types/character';
import { useI18n } from '@/lib/contexts/I18nContext';
import TranscendenceSlider from './TranscendenceSlider';

type Props = {
  character: Character;
};

export default function TranscendenceSection({ character }: Props) {
  const { t } = useI18n();

  if (!character.transcend) return null;

  return (
    <section id="transcend">
      <h2 className="mb-4 text-2xl font-bold">{t('page.character.toc.transcend')}</h2>

      <div className="max-w-xl rounded-xl border border-white/10 bg-zinc-900/60 p-4">
        <TranscendenceSlider transcend={character.transcend} rarity={character.Rarity} />
      </div>
    </section>
  );
}
