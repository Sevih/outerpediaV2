import type { NextConfig } from "next";
import { readFileSync, existsSync } from "fs";

// Read version from package.json (single source of truth)
const { version } = JSON.parse(readFileSync("./package.json", "utf-8"));

// Game (resource) version — written by `pipeline/steps/game-version` from
// `datamine/files/bundles/manifest.dat`. Absent on bare prod deploys without
// the generated artifact; we fall back to an empty string so the UI can hide it.
function readGameVersion(): string {
  const p = "./data/generated/game-version.json";
  if (!existsSync(p)) return "";
  try {
    const { resVersion } = JSON.parse(readFileSync(p, "utf-8")) as { resVersion?: string };
    return resVersion ?? "";
  } catch {
    return "";
  }
}
const gameVersion = readGameVersion();

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
    NEXT_PUBLIC_GAME_VERSION: gameVersion,
  },

  images: {
    unoptimized: true,
  },

  typedRoutes: true,

  poweredByHeader: false,

  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      {
        source: '/_next/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/images/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex' }],
      },
    ];
  },

  async redirects() {
    return [
      // Renamed Dimensional Singularity guides: <name> → <name>-<element>
      // to disambiguate Light/Dark variants of the same boss.
      {
        source: '/guides/dimensional-singularity/urd',
        destination: '/guides/dimensional-singularity/urd-light',
        permanent: true,
      },
      {
        source: '/:lang/guides/dimensional-singularity/urd',
        destination: '/:lang/guides/dimensional-singularity/urd-light',
        permanent: true,
      },
      {
        source: '/guides/dimensional-singularity/verdandi',
        destination: '/guides/dimensional-singularity/verdandi-dark',
        permanent: true,
      },
      {
        source: '/:lang/guides/dimensional-singularity/verdandi',
        destination: '/:lang/guides/dimensional-singularity/verdandi-dark',
        permanent: true,
      },
      {
        source: '/guides/dimensional-singularity/skuld',
        destination: '/guides/dimensional-singularity/skuld-light',
        permanent: true,
      },
      {
        source: '/:lang/guides/dimensional-singularity/skuld',
        destination: '/:lang/guides/dimensional-singularity/skuld-light',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
