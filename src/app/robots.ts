import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/audio/', '/_next/', '/node_modules/'],
    },
    sitemap: `https://${process.env.NEXT_PUBLIC_BASE_DOMAIN ?? 'outerpedia.com'}/sitemap.xml`,
  };
}
