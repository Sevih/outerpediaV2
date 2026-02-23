import type { NextConfig } from "next";
import { readFileSync } from "fs";

// Read version from package.json (single source of truth)
const { version } = JSON.parse(readFileSync("./package.json", "utf-8"));

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://cloudflareinsights.com",
      "media-src 'self' https://*.youtube.com https://cdn.discordapp.com",
      "frame-src 'self' https://*.youtube.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "upgrade-insecure-requests",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    'outerpedia.local',
    '*.outerpedia.local',
  ],

  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },

  images: {
    unoptimized: true,
  },

  typedRoutes: true,

  poweredByHeader: false,

  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default nextConfig;
