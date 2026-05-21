import { join } from 'path';
import { readJson } from './_json';
import type { Item } from '@/types/item';

const ITEMS_PATH = join(process.cwd(), 'data/items.json');

export async function getItems(): Promise<Item[]> {
  return readJson<Item[]>(ITEMS_PATH);
}
