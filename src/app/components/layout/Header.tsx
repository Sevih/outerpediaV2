import { getGuideCategories } from '@/lib/data/guides';
import HeaderClient from './HeaderClient';

export default async function Header() {
  const categories = await getGuideCategories();
  const guideCategorySlugs = categories.map((c) => c.slug);
  return <HeaderClient guideCategorySlugs={guideCategorySlugs} />;
}
