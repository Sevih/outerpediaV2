'use client';

import Image from 'next/image';
import type { Character } from '@/types/character';
import type { ExclusiveEquipment } from '@/types/equipment';
import { l } from '@/lib/i18n/localize';
import { formatEffectText, getRarityBgPath } from '@/lib/format-text';
import { useI18n } from '@/lib/contexts/I18nContext';
import BuffDebuffDisplay from './BuffDebuffDisplay';
import TranscendenceSlider from './TranscendenceSlider';

type Props = {
  character: Character;
  ee: ExclusiveEquipment;
};

export default function EeSection({ character, ee }: Props) {
  const { lang, t } = useI18n();

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
        {/* EE card */}
        <div>
          <h2 className="mb-4 text-2xl font-bold">{t('page.character.toc.ee')}</h2>
          <div className="card rounded-xl p-4">
          <div className="flex items-start gap-4">
            {/* EE portrait */}
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg">
              <Image
                src={getRarityBgPath('legendary')}
                alt="Legendary rarity"
                fill
                sizes="64px"
                className="object-contain"
              />
              <div className="absolute inset-1.5">
                <Image
                  src={`/images/characters/ee/${character.ID}.webp`}
                  alt={l(ee, 'name', lang)}
                  fill
                  sizes="52px"
                  className="object-contain"
                />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-game text-base font-bold">{l(ee, 'name', lang)}</p>
              <p className="mt-0.5 text-xs text-zinc-400">
                <span className="font-semibold text-zinc-300">{t('page.character.ee.main_stat')}</span>{' '}
                {l(ee, 'mainStat', lang)}
              </p>
              {/* EE badge */}
              {ee.icon_effect && (
                <div className="mt-1.5 flex w-fit items-center gap-1.5 rounded-full bg-zinc-500/50 px-2.5 py-0.5">
                  <div className="relative h-4 w-4 shrink-0">
                    <Image
                      src={`/images/ui/effect/${ee.icon_effect}.webp`}
                      alt={l(ee, 'name', lang)}
                      fill
                      sizes="16px"
                      className="object-contain"
                    />
                  </div>
                  <span className="text-xs font-semibold text-white">
                    {t('page.character.ee.badge', { name: l(character, 'Fullname', lang) })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Effect */}
          <div className="mt-3 space-y-2">
            <div>
              <p className="text-xs font-semibold text-zinc-500">{t('page.character.ee.effect')}</p>
              <div className="text-sm text-zinc-200">
                {formatEffectText(l(ee, 'effect', lang))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500">{t('page.character.ee.effect_max')}</p>
              <div className="text-sm text-zinc-200">
                {formatEffectText(l(ee, 'effect10', lang))}
              </div>
            </div>
          </div>

          {/* Buffs/debuffs */}
          <div className="mt-3">
            <BuffDebuffDisplay buffs={ee.buff} debuffs={ee.debuff} keepInterruptions />
          </div>
          </div>
        </div>

        {/* Transcendence */}
        {character.transcend && (
          <div>
            <h2 className="mb-4 text-2xl font-bold">{t('page.character.toc.transcend')}</h2>
            <div className="card rounded-xl p-4">
              <TranscendenceSlider transcend={character.transcend} rarity={character.Rarity} />
            </div>
          </div>
        )}
      </div>
  );
}
