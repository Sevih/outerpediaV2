import { readFile } from 'fs/promises';
import { join } from 'path';
import type { Weapon, Amulet, Talisman, ArmorSet, ExclusiveEquipment } from '@/types/equipment';

const EQUIP_DIR = join(process.cwd(), 'data/equipment');

export async function getWeapons(): Promise<Weapon[]> {
  const raw = await readFile(join(EQUIP_DIR, 'weapon.json'), 'utf-8');
  return JSON.parse(raw) as Weapon[];
}

export async function getAmulets(): Promise<Amulet[]> {
  const raw = await readFile(join(EQUIP_DIR, 'accessory.json'), 'utf-8');
  return JSON.parse(raw) as Amulet[];
}

export async function getTalismans(): Promise<Talisman[]> {
  const raw = await readFile(join(EQUIP_DIR, 'talisman.json'), 'utf-8');
  return JSON.parse(raw) as Talisman[];
}

export async function getArmorSets(): Promise<ArmorSet[]> {
  const raw = await readFile(join(EQUIP_DIR, 'sets.json'), 'utf-8');
  return JSON.parse(raw) as ArmorSet[];
}

export async function getExclusiveEquipment(): Promise<Record<string, ExclusiveEquipment>> {
  const raw = await readFile(join(EQUIP_DIR, 'ee.json'), 'utf-8');
  return JSON.parse(raw) as Record<string, ExclusiveEquipment>;
}
