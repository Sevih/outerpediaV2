'use client';

import GuideTemplate from '@/app/components/guides/GuideTemplate';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { LangMap } from '@/types/common';
import parseText from '@/lib/parse-text';

const intro: LangMap = {
  en: 'Common questions and answers for new Outerplane players.',
  jp: 'アウタープレーン初心者のよくある質問と回答。',
  kr: '아우터플레인 초보자들이 자주 묻는 질문과 답변.',
  zh: '异域战记新手常见问题与解答。',
};

type QA = { q: LangMap; a: LangMap };

const faqs: QA[] = [
  {
    q: {
      en: 'How important is rerolling?',
      jp: 'リセマラは重要ですか？',
      kr: '리세마라가 중요한가요?',
      zh: '刷初始重要吗？',
    },
    a: {
      en: 'Getting a strong starter character helps a lot early on. Aim for at least one powerful {E/Fire} or {E/Water} DPS.',
      jp: '強力なスタートキャラクターは序盤に非常に役立ちます。最低1体の強い{E/Fire}または{E/Water}DPSを狙いましょう。',
      kr: '강력한 시작 캐릭터가 초반에 큰 도움이 됩니다. 최소 1명의 강한 {E/Fire} 또는 {E/Water} DPS를 목표로 하세요.',
      zh: '一个强力的初始角色对前期帮助很大。至少瞄准一个强力的{E/Fire}或{E/Water}DPS。',
    },
  },
  {
    q: {
      en: 'What stats should I focus on?',
      jp: 'どのステータスに注目すべきですか？',
      kr: '어떤 스탯에 집중해야 하나요?',
      zh: '应该关注哪些属性？',
    },
    a: {
      en: 'For DPS: {S/ATK}, {S/Crit Chance}, {S/Crit Damage}, {S/Speed}. For supports/healers: {S/Speed}, {S/HP}, {S/DEF}.',
      jp: 'DPSの場合: {S/ATK}、{S/Crit Chance}、{S/Crit Damage}、{S/Speed}。サポート/ヒーラーの場合: {S/Speed}、{S/HP}、{S/DEF}。',
      kr: 'DPS: {S/ATK}, {S/Crit Chance}, {S/Crit Damage}, {S/Speed}. 서포터/힐러: {S/Speed}, {S/HP}, {S/DEF}.',
      zh: 'DPS: {S/ATK}、{S/Crit Chance}、{S/Crit Damage}、{S/Speed}。辅助/奶妈: {S/Speed}、{S/HP}、{S/DEF}。',
    },
  },
];

export default function BeginnerFAQGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec({ en: 'Beginner FAQ', jp: '初心者FAQ', kr: '초보자 FAQ', zh: '新手FAQ' }, lang)}
      introduction={lRec(intro, lang)}
    >
      <div className="space-y-6">
        {faqs.map((faq, i) => (
          <div key={i} className="rounded-lg bg-zinc-800/50 p-4 ring-1 ring-white/5">
            <h3 className="text-sm font-semibold text-yellow-300 after:hidden">
              {lRec(faq.q, lang)}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              {parseText(lRec(faq.a, lang))}
            </p>
          </div>
        ))}
      </div>
    </GuideTemplate>
  );
}
