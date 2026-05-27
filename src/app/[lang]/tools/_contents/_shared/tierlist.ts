const RANK_WEIGHT: Record<string, number> = { S: 0, A: 1, B: 2, C: 3, D: 4, E: 5 };

/**
 * Build a `sort()` comparator that orders entries by their tier-list rank
 * (S→E). Entries whose rank is missing or unrecognized go to the end.
 */
export function tierListRankOrder<T>(getRank: (entry: T) => string | undefined) {
  return (a: T, b: T) => {
    const wa = RANK_WEIGHT[getRank(a) ?? ''] ?? 99;
    const wb = RANK_WEIGHT[getRank(b) ?? ''] ?? 99;
    return wa - wb;
  };
}
