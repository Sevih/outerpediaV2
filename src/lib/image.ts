/** Convert any image path to its .webp equivalent */
export function webp(path: string): string {
  return path.replace(/\.(png|jpe?g|gif)$/i, '.webp');
}
