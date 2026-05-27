'use client'

import GuideTemplate from '@/app/components/guides/GuideTemplate'
import { useI18n } from '@/lib/contexts/I18nContext'
import { lRec } from '@/lib/i18n/localize'
import parseText from '@/lib/parse-text'
import type { Lang, LangMap } from '@/types/common'

import {
  ENTRIES,
  CATEGORIES,
  CATEGORY_LABELS,
  type Category,
  type GuideEntry,
} from './notes'
import unlockData from '@data/generated/unlock-content.json'

// ── Localised strings ──

const LABELS = {
  title: {
    en: 'Story Progression Unlock Table',
    jp: 'ストーリー進行解放一覧',
    kr: '스토리 진행 해금 일람',
    zh: '故事进度解锁一览',
    fr: 'Tableau de Déblocage de la Progression Story',
  } satisfies LangMap,
  intro: {
    en: 'Many features in OUTERPLANE are not available right away. Below is a categorized overview of when each mode unlocks during the story. Conditions are sourced from the game data and update automatically.',
    jp: 'OUTERPLANEの多くの機能は最初から利用できるわけではありません。以下は各モードがストーリー進行中にいつ解放されるかをカテゴリー別にまとめた一覧です。解放条件はゲームデータから取得され、自動更新されます。',
    kr: 'OUTERPLANE의 많은 기능은 처음부터 사용할 수 없습니다. 아래는 각 모드가 스토리 진행 중 언제 해금되는지 카테고리별로 정리한 표입니다. 해금 조건은 게임 데이터에서 가져오며 자동으로 갱신됩니다.',
    zh: 'OUTERPLANE的许多功能并非一开始就可用。下方按类别概览各模式在故事进程中的解锁时间。解锁条件来自游戏数据并自动更新。',
    fr: 'De nombreuses fonctionnalités d\'OUTERPLANE ne sont pas disponibles d\'emblée. Voici un aperçu par catégorie du moment où chaque mode se débloque pendant la Story. Les conditions proviennent des data du jeu et se mettent à jour automatiquement.',
  } satisfies LangMap,
  headerMode: {
    en: 'Game Mode',
    jp: 'ゲームモード',
    kr: '게임 모드',
    zh: '游戏模式',
    fr: 'Mode de Jeu',
  } satisfies LangMap,
  headerCondition: {
    en: 'Unlock Condition',
    jp: '解放条件',
    kr: '해금 조건',
    zh: '解锁条件',
    fr: 'Condition de Déblocage',
  } satisfies LangMap,
  headerDescription: {
    en: 'Description',
    jp: '説明',
    kr: '설명',
    zh: '描述',
    fr: 'Description',
  } satisfies LangMap,
  orSeparator: {
    en: 'or',
    jp: 'または',
    kr: '또는',
    zh: '或',
    fr: 'ou',
  } satisfies LangMap,
}

// ── Auto-layer lookup ──

type Requirement = {
  stage: string | null
  dungeonName: LangMap | null
  areaName: LangMap | null
}
type AutoJsonEntry = {
  contentType: string
  requirements: Requirement[]
  lockScreenName: LangMap | null
  officialName: LangMap | null
}

type AutoLookup = {
  requirements: Requirement[]
  lockScreenName: LangMap | null
  officialName: LangMap | null
}

const AUTO_BY_CONTENT_TYPE: Record<string, AutoLookup> = {}
for (const e of (unlockData as { entries: AutoJsonEntry[] }).entries) {
  AUTO_BY_CONTENT_TYPE[e.contentType] = {
    requirements: e.requirements || [],
    lockScreenName: e.lockScreenName ?? null,
    officialName: e.officialName ?? null,
  }
}

type ResolvedReq = { stage: string; dungeonName: LangMap; areaName: LangMap | null }

function getRequirements(entry: GuideEntry): ResolvedReq[] {
  if (entry.source === 'manual') {
    return [{ stage: entry.stage, dungeonName: entry.dungeonName, areaName: null }]
  }
  const auto = AUTO_BY_CONTENT_TYPE[entry.contentType]
  if (!auto || auto.requirements.length === 0) {
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
      console.warn(`[unlock-content] No data for ContentType "${entry.contentType}"`)
    }
    return [{ stage: '?', dungeonName: { en: '?' }, areaName: null }]
  }
  return auto.requirements.map(r => ({
    stage: r.stage ?? '?',
    dungeonName: r.dungeonName ?? { en: '?' },
    areaName: r.areaName ?? null,
  }))
}

function modeNameOf(entry: GuideEntry): LangMap {
  if (entry.source === 'manual') return entry.modeName
  // Auto entry fallback chain: editorial → lockScreenName → officialName → contentType
  if (entry.modeName) return entry.modeName
  const auto = AUTO_BY_CONTENT_TYPE[entry.contentType]
  return auto?.lockScreenName ?? auto?.officialName ?? { en: entry.contentType }
}

// ── Sorting ──

function parseStage(stage: string): [number, number, number, number] {
  // Format: "S<season>[H]-<episode>-<stage>"
  const match = stage.match(/^S(\d+)(H?)-(\d+)-(\d+)/)
  if (!match) return [999, 999, 999, 999]
  return [
    parseInt(match[1], 10),
    match[2] === 'H' ? 1 : 0,
    parseInt(match[3], 10),
    parseInt(match[4], 10),
  ]
}

function firstStage(entry: GuideEntry): string {
  return getRequirements(entry)[0]?.stage ?? '?'
}

function compareEntries(a: GuideEntry, b: GuideEntry): number {
  const [a1, a2, a3, a4] = parseStage(firstStage(a))
  const [b1, b2, b3, b4] = parseStage(firstStage(b))
  if (a1 !== b1) return a1 - b1
  if (a2 !== b2) return a2 - b2
  if (a3 !== b3) return a3 - b3
  return a4 - b4
}

function entryKey(entry: GuideEntry): string {
  return entry.source === 'auto' ? `auto:${entry.contentType}` : `manual:${entry.slug}`
}

// ── Category section ──

function CategoryTable({ category, entries, lang }: { category: Category; entries: GuideEntry[]; lang: Lang }) {
  const sorted = [...entries].sort(compareEntries)
  return (
    <section className="mb-8">
      <h2
        id={`cat-${category}`}
        className="text-xl font-semibold mb-3 text-amber-200 border-b border-neutral-700 pb-1"
      >
        {lRec(CATEGORY_LABELS[category], lang)}
      </h2>
      <div className="w-full overflow-x-auto">
        <table className="w-full border border-neutral-700 rounded-md text-sm text-center">
          <thead className="bg-neutral-800">
            <tr>
              <th className="border border-neutral-700 px-3 py-2 w-1/4">{lRec(LABELS.headerMode, lang)}</th>
              <th className="border border-neutral-700 px-3 py-2 w-1/3">{lRec(LABELS.headerCondition, lang)}</th>
              <th className="border border-neutral-700 px-3 py-2">{lRec(LABELS.headerDescription, lang)}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(entry => (
              <ConditionRow key={entryKey(entry)} entry={entry} lang={lang} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ConditionRow({ entry, lang }: { entry: GuideEntry; lang: Lang }) {
  const reqs = getRequirements(entry)
  const or = lRec(LABELS.orSeparator, lang)
  // Skip unresolved "? : ?" rows when the editorial customNote already conveys the condition
  const resolvedReqs = entry.customNote
    ? reqs.filter(r => r.stage !== '?')
    : reqs
  return (
    <tr>
      <td className="border border-neutral-700 px-3 py-2 text-left align-top">
        {lRec(modeNameOf(entry), lang)}
      </td>
      <td className="border border-neutral-700 px-3 py-2 align-top">
        {resolvedReqs.map((r, i) => (
          <div key={i} className={i > 0 ? 'mt-1' : ''}>
            {i > 0 && <span className="text-neutral-400 text-xs mr-1">{or}</span>}
            <span className="font-mono">{r.stage}</span> : {lRec(r.dungeonName, lang)}
          </div>
        ))}
        {entry.customNote && (
          // When customNote is the only content (no resolvable stages), render
          // it as the primary condition (neutral white). Otherwise it's a side
          // annotation under the stages (amber).
          <div className={resolvedReqs.length > 0 ? 'mt-1 text-xs text-amber-300/80' : ''}>
            {parseText(lRec(entry.customNote, lang))}
          </div>
        )}
      </td>
      <td className="border border-neutral-700 px-3 py-2 align-top text-left">
        {parseText(lRec(entry.description, lang))}
      </td>
    </tr>
  )
}

// ── Export ──

export default function UnlockContentGuide() {
  const { lang } = useI18n()

  // Group entries by category, preserving CATEGORIES declaration order
  const grouped: Record<Category, GuideEntry[]> = {
    gamemodes: [], character: [], base: [],
  }
  for (const e of ENTRIES) grouped[e.category].push(e)

  return (
    <GuideTemplate
      title={lRec(LABELS.title, lang)}
      introduction={lRec(LABELS.intro, lang)}
    >
      {CATEGORIES.map(cat =>
        grouped[cat].length > 0 ? (
          <CategoryTable key={cat} category={cat} entries={grouped[cat]} lang={lang} />
        ) : null
      )}
    </GuideTemplate>
  )
}
