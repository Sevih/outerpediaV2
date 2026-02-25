/** Shared helpers for geas components */

export function formatRatio(ratio: string): string {
  const n = parseFloat(ratio);
  return n > 0 ? `+${ratio}` : ratio;
}

export function parseRatio(ratio: string): number {
  return parseFloat(ratio) / 100;
}
