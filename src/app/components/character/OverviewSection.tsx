'use client';

import Image from 'next/image';
import type { Character, CharacterProfile } from '@/types/character';
import { l, lRec } from '@/lib/i18n/localize';
import { splitCharacterName } from '@/lib/character-name';
import { formatEffectText } from '@/lib/format-text';
import { ELEMENT_TEXT, ROLE_BG } from '@/lib/theme';
import { useI18n } from '@/lib/contexts/I18nContext';
import type { TranslationKey } from '@/i18n/locales/en';
import ShareButtons from '@/app/components/ui/ShareButtons';
import { elementAccent } from './characterDetailTheme';

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
  const { hex } = elementAccent(character.Element);
  const fullname = l(character, 'Fullname', lang);
  const { prefix, name } = splitCharacterName(fullname, lang);
  const voiceActor = l(character, 'VoiceActor', lang);
  const story = profile?.story ? lRec(profile.story, lang) : null;

  const elementKey = `sys.element.${character.Element.toLowerCase()}` as TranslationKey;
  const classKey = `sys.class.${character.Class.toLowerCase()}` as TranslationKey;
  const subclassKey = `sys.subclass.${character.SubClass.toLowerCase()}` as TranslationKey;

  const charTags = character.tags ?? [];
  const unitTypeTag = UNIT_TYPE_ORDER.find((k) => charTags.includes(k));

  const meta: [string, string][] = [];
  if (voiceActor) meta.push([t('page.character.voice_actor'), voiceActor]);
  if (profile?.birthday) meta.push([t('page.character.birthday'), profile.birthday]);
  if (profile?.height) meta.push([t('page.character.height'), profile.height]);
  if (profile?.weight) meta.push([t('page.character.weight'), profile.weight]);

  return (
    <section
      id="overview"
      className="relative scroll-mt-24"
      style={{ background: `radial-gradient(ellipse 60% 70% at 28% 45%, ${hex}16 0%, transparent 68%)` }}
    >
      <div className="mx-auto grid max-w-330 grid-cols-1 gap-8 px-4 py-8 md:px-6 lg:grid-cols-[360px_1fr] lg:gap-14 lg:px-8 lg:py-14">
        {/* Full-body art */}
        <div className="relative mx-auto aspect-6/7 w-full max-w-90 shrink-0 lg:mx-0">
          <Image
            src={`/images/characters/full/IMG_${character.ID}.webp`}
            alt={fullname}
            fill
            sizes="(max-width: 1024px) 90vw, 360px"
            priority
            className="object-contain"
          />
        </div>

        {/* Meta column */}
        <div className="flex min-w-0 flex-col gap-5 lg:pt-3">
          <div className="flex flex-wrap items-center gap-2">
            {unitTypeTag && tags[unitTypeTag] && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-sm ring-1 ring-white/10">
                <Image src={tags[unitTypeTag].image} alt={l(tags[unitTypeTag], 'label', lang)} width={16} height={16} />
                {l(tags[unitTypeTag], 'label', lang)}
              </span>
            )}
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm text-white ring-1 ring-white/10 ${ROLE_BG[character.role]}`}>
              {t(`filters.roles.${character.role}` as TranslationKey)}
            </span>
            <span className="ml-auto">
              <ShareButtons title={fullname} lang={lang} />
            </span>
          </div>

          <div>
            {prefix && (
              <div
                className="mb-2 font-mono text-xs font-medium tracking-[0.28em] uppercase lg:mb-3 lg:text-[13px] lg:tracking-[0.3em]"
                style={{ color: hex }}
              >
                {prefix}
              </div>
            )}
            <h1 className="font-game text-5xl leading-[0.95] font-bold tracking-tight text-zinc-100 lg:text-7xl">
              {name.slice(0, -1)}
              <span style={{ color: hex, textShadow: `0 0 32px ${hex}55` }}>{name.slice(-1)}</span>
              <span className="sr-only">{` — Outerplane ${t(elementKey)} ${t(classKey)} Guide`}</span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex items-center gap-0.5">
              {[...Array(character.Rarity)].map((_, i) => (
                <Image key={i} src="/images/ui/star/CM_icon_star_y.webp" alt="star" width={20} height={20} />
              ))}
            </span>
            <span className="h-4.5 w-px bg-white/15" />
            <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${ELEMENT_TEXT[character.Element]}`}>
              <Image src={`/images/ui/elem/CM_Element_${character.Element}.webp`} alt={character.Element} width={22} height={22} />
              {t(elementKey)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm text-zinc-200">
              <Image src={`/images/ui/class/CM_Class_${character.Class}.webp`} alt={character.Class} width={22} height={22} />
              {t(classKey)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm text-zinc-400">
              <Image src={`/images/ui/class/CM_Sub_Class_${character.SubClass}.webp`} alt={character.SubClass} width={22} height={22} />
              {t(subclassKey)}
            </span>
          </div>

          {meta.length > 0 && (
            <div className="flex flex-wrap gap-x-8 gap-y-3 border-y border-white/6 py-3.5">
              {meta.map(([label, value]) => (
                <div key={label}>
                  <div className="font-mono text-[10px] tracking-[0.14em] text-zinc-500 uppercase">{label}</div>
                  <div className="mt-0.5 text-sm text-zinc-200">{value}</div>
                </div>
              ))}
            </div>
          )}

          {story && (
            <p className="max-w-2xl text-sm leading-relaxed text-zinc-300">{formatEffectText(story)}</p>
          )}
        </div>
      </div>
    </section>
  );
}
