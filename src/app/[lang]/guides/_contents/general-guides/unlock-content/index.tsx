'use client'

import GuideTemplate from '@/app/components/guides/GuideTemplate'
import { useI18n } from '@/lib/contexts/I18nContext'
import { lRec } from '@/lib/i18n/localize'
import parseText from '@/lib/parse-text'
import type { LangMap } from '@/types/common'

import {
  type Entry,
  DATA,
  MODE_NAMES,
  UNLOCK_NAMES,
  DESCRIPTIONS,
} from './data'

// ── Localised strings ──

const LABELS = {
  title: {
    en: 'Story Progression Unlock Table',
    jp: 'ストーリー進行解放一覧',
    kr: '스토리 진행 해금 일람',
    zh: '故事进度解锁一览',
  } satisfies LangMap,
  intro: {
    en: 'Many features in OUTERPLANE are not available right away. Here is a quick overview of when each mode unlocks during the story.',
    jp: 'OUTERPLANEの多くの機能は最初から利用できるわけではありません。ストーリー進行に応じて各モードがいつ解放されるかをまとめました。',
    kr: 'OUTERPLANE의 많은 기능은 처음부터 사용할 수 없습니다. 스토리 진행에 따라 각 모드가 언제 해금되는지 정리했습니다.',
    zh: 'OUTERPLANE的许多功能并非一开始就可用。以下是各模式在故事进程中解锁时间的概览。',
  } satisfies LangMap,
  headerMode: {
    en: 'Game Mode',
    jp: 'ゲームモード',
    kr: '게임 모드',
    zh: '游戏模式',
  } satisfies LangMap,
  headerCondition: {
    en: 'Unlock Condition',
    jp: '解放条件',
    kr: '해금 조건',
    zh: '解锁条件',
  } satisfies LangMap,
  headerDescription: {
    en: 'Description',
    jp: '説明',
    kr: '설명',
    zh: '描述',
  } satisfies LangMap,
}

// ── Sorting ──

function parseStage(stage: string): [number, number, number] {
  const match = stage.match(/^S(\d+)-(\d+)-(\d+)/)
  if (!match) return [999, 999, 999]
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)]
}

function sortData(data: Entry[]): Entry[] {
  return [...data].sort((a, b) => {
    const [ax, ay, az] = parseStage(a.stage)
    const [bx, by, bz] = parseStage(b.stage)
    if (ax !== bx) return ax - bx
    if (ay !== by) return ay - by
    return az - bz
  })
}

const sortedData = sortData(DATA)

// ── Table ──

function UnlockTable() {
  const { lang } = useI18n()

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-4xl overflow-x-auto">
        <table className="w-auto mx-auto border border-neutral-700 rounded-md text-sm text-center">
          <thead className="bg-neutral-800">
            <tr>
              <th className="border border-neutral-700 px-3 py-2">{lRec(LABELS.headerMode, lang)}</th>
              <th className="border border-neutral-700 px-3 py-2">{lRec(LABELS.headerCondition, lang)}</th>
              <th className="border border-neutral-700 px-3 py-2">{lRec(LABELS.headerDescription, lang)}</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((entry, i) => (
              <tr key={i}>
                <td className="border border-neutral-700 px-3 py-2 text-left">
                  {lRec(MODE_NAMES[entry.mode], lang)}
                </td>
                <td className="border border-neutral-700 px-3 py-2">
                  {entry.stage} : {lRec(UNLOCK_NAMES[entry.unlockName], lang)}
                </td>
                <td className="border border-neutral-700 px-3 py-2">
                  {parseText(lRec(DESCRIPTIONS[entry.mode], lang))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Export ──

export default function UnlockContentGuide() {
  const { lang } = useI18n()

  return (
    <GuideTemplate
      title={lRec(LABELS.title, lang)}
      introduction={lRec(LABELS.intro, lang)}
    >
      <UnlockTable />
    </GuideTemplate>
  )
}
