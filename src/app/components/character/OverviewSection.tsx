'use client';

import Image from 'next/image';
import type { Character, CharacterProfile } from '@/types/character';
import { l, lRec } from '@/lib/i18n/localize';
import { splitCharacterName } from '@/lib/character-name';
import { formatEffectText } from '@/lib/format-text';
import { ELEMENT_TEXT, ELEMENT_BORDER, ROLE_BG } from '@/lib/theme';
import { useI18n } from '@/lib/contexts/I18nContext';
import type { TranslationKey } from '@/i18n/locales/en';

type TagEntry = {
  label: string;
  image: string;
  desc: string;
  type: string;
  [k: string]: string;
};

type Props = {
  character: Character;
  profile: CharacterProfile | null;
  tags: Record<string, TagEntry>;
};

const UNIT_TYPE_ORDER = ['premium', 'limited', 'seasonal', 'collab', 'free'] as const;

export default function OverviewSection({ character, profile, tags }: Props) {
  const { lang, t } = useI18n();
  const fullname = l(character, 'Fullname', lang);
  const { prefix, name } = splitCharacterName(character.ID, fullname, lang);
  const voiceActor = l(character, 'VoiceActor', lang);
  const story = profile?.story ? lRec(profile.story, lang) : null;

  const elementKey = `sys.element.${character.Element.toLowerCase()}` as TranslationKey;
  const classKey = `sys.class.${character.Class.toLowerCase()}` as TranslationKey;
  const subclassKey = `sys.subclass.${character.SubClass.toLowerCase()}` as TranslationKey;

  const charTags = character.tags ?? [];
  const unitTypeTag = UNIT_TYPE_ORDER.find((k) => charTags.includes(k));

  return (
    <section id="overview">
      <div className="mb-4 flex flex-col items-center text-center">
        <h1 className="font-game text-3xl font-bold">
          {prefix && (
            <span className="block text-lg font-normal tracking-wide">{prefix}</span>
          )}
          {name}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[360px_1fr]">
        <div className="relative mx-auto h-100 w-90 overflow-hidden rounded shadow">
          <Image
            src={`/images/characters/full/IMG_${character.ID}.webp`}
            alt={fullname}
            fill
            sizes="360px"
            priority
            className="object-contain"
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-1">
            {[...Array(character.Rarity)].map((_, i) => (
              <Image key={i} src="/images/ui/star/CM_icon_star_y.webp" alt="star" width={22} height={22} />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <span className={`inline-flex items-center gap-1 ${ELEMENT_TEXT[character.Element]}`}>
              <Image src={`/images/ui/elem/CM_Element_${character.Element}.webp`} alt={character.Element} width={24} height={24} />
              {t(elementKey)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Image src={`/images/ui/class/CM_Class_${character.Class}.webp`} alt={character.Class} width={24} height={24} />
              {t(classKey)}
            </span>
            <span className="inline-flex items-center gap-1 text-zinc-300">
              <Image src={`/images/ui/class/CM_Sub_Class_${character.SubClass}.webp`} alt={character.SubClass} width={24} height={24} />
              {t(subclassKey)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {unitTypeTag && tags[unitTypeTag] && (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ring-1 ring-white/10 ${ELEMENT_BORDER[character.Element]} bg-white/5`}>
                <Image src={tags[unitTypeTag].image} alt={l(tags[unitTypeTag], 'label', lang)} width={16} height={16} />
                {l(tags[unitTypeTag], 'label', lang)}
              </span>
            )}
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm text-white ring-1 ring-white/10 ${ROLE_BG[character.role]}`}>
              {character.role.charAt(0).toUpperCase() + character.role.slice(1)}
            </span>
          </div>

          {voiceActor && (
            <div className="text-sm text-zinc-400">
              <span className="font-semibold text-zinc-300">{t('page.character.voice_actor')}</span>{' '}
              {voiceActor}
            </div>
          )}

          {(profile?.birthday || profile?.height || profile?.weight) && (
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-400">
              {profile.birthday && (
                <span>
                  <span className="font-semibold text-zinc-300">{t('page.character.birthday')}</span>{' '}
                  {profile.birthday}
                </span>
              )}
              {profile.height && (
                <span>
                  <span className="font-semibold text-zinc-300">{t('page.character.height')}</span>{' '}
                  {profile.height}
                </span>
              )}
              {profile.weight && (
                <span>
                  <span className="font-semibold text-zinc-300">{t('page.character.weight')}</span>{' '}
                  {profile.weight}
                </span>
              )}
            </div>
          )}

          {story && (
            <div className="mt-4">
              <h2 className="mb-2 text-sm font-semibold text-zinc-300">{t('page.character.story')}</h2>
              <div className="rounded-lg border border-white/5 bg-zinc-900/50 p-4 text-sm leading-relaxed text-zinc-300">
                {formatEffectText(story)}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
