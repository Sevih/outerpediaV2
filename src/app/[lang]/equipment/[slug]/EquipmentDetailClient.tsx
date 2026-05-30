'use client';

import type { BossDisplayMap } from '@/types/equipment';
import type { EquipmentLookup, ArmorSetStatRanges, TalismanStatRanges, EEStatRange } from '@/lib/data/equipment';
import type { ArmorPiece } from '@/lib/data/stat-ranges-v2';
import type { Effect } from '@/types/effect';
import type { Lang } from '@/lib/i18n/config';
import type { Messages } from '@/i18n';
import type { ItemLiveBundle } from '@/lib/equipment-formula';
import { I18nProvider } from '@/lib/contexts/I18nContext';
import { EffectsProvider } from '@/app/components/character/BuffDebuffDisplay';
import type { CharacterRef } from './equipment-console-shared';
import { EquipmentInteractiveInner } from './EquipmentDetailInteractive';

type Props = {
  equipment: EquipmentLookup;
  recoCharacters: CharacterRef[];
  totalRecoCount: number;
  eeOwner: CharacterRef | null;
  eeCfCompanion: CharacterRef | null;
  bossMap: BossDisplayMap;
  buffMap: Record<string, Effect>;
  debuffMap: Record<string, Effect>;
  weaponStatRanges: Record<string, [number, number]> | null;
  accessoryStatRanges: Record<string, [number, number]> | null;
  armorSetStatRanges: ArmorSetStatRanges | null;
  weaponAscendedRanges: Record<string, number> | null;
  accessoryAscendedRanges: Record<string, number> | null;
  armorSetAscendedRanges: Record<ArmorPiece, Record<string, number>> | null;
  talismanStatRanges: TalismanStatRanges | null;
  eeStatRange: EEStatRange | null;
  liveDetail: ItemLiveBundle | null;
  messages: Messages;
  lang: Lang;
};

export type EquipmentViewProps = Props;

export default function EquipmentDetailClient(props: Props) {
  return (
    <I18nProvider lang={props.lang} messages={props.messages}>
      <EffectsProvider buffMap={props.buffMap} debuffMap={props.debuffMap}>
        <EquipmentInteractiveInner {...props} />
      </EffectsProvider>
    </I18nProvider>
  );
}
