import { readFile } from 'fs/promises';
import { join } from 'path';
import type { GiftType } from '@/types/enums';
import type { Item } from '@/types/item';

const GIFTS_PATH = join(process.cwd(), 'data/gifts.json');
const ITEMS_PATH = join(process.cwd(), 'data/items.json');

type GiftMap = Record<GiftType, string[]>;

/** Get the gift category → item ID mapping */
export async function getGiftMap(): Promise<GiftMap> {
  const raw = await readFile(GIFTS_PATH, 'utf-8');
  return JSON.parse(raw) as GiftMap;
}

/** Get gift items with full item details, grouped by category */
export async function getGiftItems(): Promise<Record<GiftType, Item[]>> {
  const [giftMap, itemsRaw] = await Promise.all([
    getGiftMap(),
    readFile(ITEMS_PATH, 'utf-8'),
  ]);

  const allItems = JSON.parse(itemsRaw) as Item[];
  const itemById = new Map(allItems.map((i) => [i.id, i]));

  const result = {} as Record<GiftType, Item[]>;
  for (const [category, ids] of Object.entries(giftMap)) {
    result[category as GiftType] = ids
      .map((id) => itemById.get(id))
      .filter((item): item is Item => item !== undefined);
  }

  return result;
}
