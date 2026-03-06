export type ToolMeta = {
  slug: string;
  icon: string;
  category: string;
  order: number;
  status: 'available' | 'coming-soon' | 'hidden';
  href?: string;
  keywords?: string[];
};

export type ToolCategory = {
  slug: string;
  order: number;
};
