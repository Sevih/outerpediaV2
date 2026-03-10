import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/images/', '/audio/', '/_next/', '/equipments/'],
    },
    sitemap: 'https://outerpedia.com/sitemap.xml',
  };
}
