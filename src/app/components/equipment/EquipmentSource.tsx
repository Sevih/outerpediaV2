import type { BossDisplayMap } from '@/types/equipment';
import { IE_BOSS_MAP } from '@/types/equipment';
import type { Lang } from '@/lib/i18n/config';
import { lRec } from '@/lib/i18n/localize';

// Static source labels (no boss association)
const SOURCE_LABELS: Record<string, Partial<Record<string, string>>> = {
  'Event Shop': { en: 'Event Shop', jp: 'イベントショップ', kr: '이벤트 상점', zh: '活动商店' },
  'Adventure License': { en: 'Adventure License', jp: '冒険者ライセンス', kr: '모험 라이선스', zh: '冒险许可证' },
};

type Props = {
  source?: string;
  boss?: string;
  equipName?: string;
  bossMap: BossDisplayMap;
  lang: Lang;
};

export default function EquipmentSource({ source, boss, equipName, bossMap, lang }: Props) {
  if (!source && !boss) return null;

  // Irregular Extermination: resolve bosses from equipment name
  if (source === 'Irregular Extermination' && equipName) {
    const key = Object.keys(IE_BOSS_MAP).find(k => equipName.includes(k));
    if (key) {
      const bossNames = IE_BOSS_MAP[key];
      const firstBoss = bossMap[bossNames[0]];
      const sourceLabel = firstBoss ? lRec(firstBoss.source, lang) : source;
      return (
        <div className="text-sm text-zinc-300">
          <p>{sourceLabel}</p>
          <p>
            {bossNames.map(n => lRec(bossMap[n]?.name, lang) || n).join(' / ')}
          </p>
        </div>
      );
    }
  }

  // Special Request / other: resolve from boss field
  const bossInfo = boss ? bossMap[boss] : null;
  const bossName = bossInfo ? lRec(bossInfo.name, lang) : boss;
  const rawSource = bossInfo ? lRec(bossInfo.source, lang) || source : source;
  const sourceLabel = (rawSource && SOURCE_LABELS[rawSource]) ? lRec(SOURCE_LABELS[rawSource], lang) : rawSource;

  return (
    <div className="text-sm text-zinc-300">
      {sourceLabel && <p>{sourceLabel}</p>}
      {bossName && <p>{bossName}</p>}
    </div>
  );
}
