'use client';

import type { Character } from '@/types/character';
import TranscendenceSlider from './TranscendenceSlider';

type Props = {
  character: Character;
};

export default function TranscendenceSection({ character }: Props) {
  if (!character.transcend) return null;

  return (
    <div className="max-w-xl">
      <TranscendenceSlider transcend={character.transcend} rarity={character.Rarity} />
    </div>
  );
}
