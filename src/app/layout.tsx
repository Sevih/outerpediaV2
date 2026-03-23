import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { getBaseUrl } from "@/lib/seo";
import { isValidLang, getLangConfig } from "@/lib/i18n/config";
import { getClientBootstrapScript } from "@/lib/client-bootstrap";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  icons: {
    apple: '/apple-touch-icon.png',
  },
  alternates: {
    types: {
      'application/rss+xml': '/feed',
    },
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
  },
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const paybooc = localFont({
  src: "../fonts/Paybooc-Bold.ttf",
  variable: "--font-game",
  weight: "700",
  display: "swap",
});

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ lang?: string }>;
}>) {
  const { lang } = await params;
  const htmlLang = lang && isValidLang(lang) ? getLangConfig(lang).htmlLang : 'en';

  return (
    <html lang={htmlLang} className={`dark ${geistSans.variable} ${geistMono.variable} ${paybooc.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        {children}
        <div id="portal-root" />
        <script
          dangerouslySetInnerHTML={{
            __html: getClientBootstrapScript(process.env.NEXT_PUBLIC_APP_VERSION || ''),
          }}
        />
      </body>
    </html>
  );
}
