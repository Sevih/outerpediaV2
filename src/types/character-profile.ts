import type { LangMap } from './common';

export type CharacterProfile = {
  fullname: LangMap;
  birthday: string;
  height: string;
  weight: string;
  story: LangMap;
};

export type CharacterProfileMap = Record<string, CharacterProfile>;
