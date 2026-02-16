import type { WithLocalizedFields } from './common';
import type { ItemRarity } from '@/lib/theme';

export type { ItemRarity } from '@/lib/theme';

export type ItemType = 'material' | 'present' | 'box' | 'gem';

export type ItemSubType =
  // Materials - character
  | 'char_level'
  | 'char_level_special'
  | 'char_evo'
  | 'char_evo_special'
  | 'char_class'
  | 'char_recall'
  | 'core_fusion'
  // Materials - craft
  | 'craft'
  | 'craft_gift'
  // Materials - equipment
  | 'equip_breaklimit'
  | 'equip_changer'
  | 'equip_enchant'
  | 'equip_transcend'
  | 'gear_recall'
  | 'armor_breaklimit'
  | 'add_manufact'
  // Presents
  | 'present'
  | 'present_max'
  // Boxes
  | 'box_random'
  | 'box_choice_item'
  | 'box_choice_char'
  | 'box_choice_char_max'
  // Gems
  | 'gem'
  // Tickets
  | 'recruit_ticket'
  | 'sweep_ticket';

type BaseItem = {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: ItemRarity;
  type: ItemType;
  subtype: ItemSubType;
};

export type Item = WithLocalizedFields<
  WithLocalizedFields<BaseItem, 'name'>,
  'description'
>;
