import { readFile } from 'fs/promises';
import { join } from 'path';
import type { Item } from '@/types/item';

const ITEMS_PATH = join(process.cwd(), 'data/items.json');

export async function getItems(): Promise<Item[]> {
  const raw = await readFile(ITEMS_PATH, 'utf-8');
  return JSON.parse(raw) as Item[];
}
