import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { getBaseUrl } from "@/lib/seo";
import { isValidLang, getLangConfig } from "@/lib/i18n/config";
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
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>{if(location.hostname==='localhost'||location.hostname==='127.0.0.1'||location.hostname.endsWith('.localhost')||location.hostname.endsWith('.local')){navigator.serviceWorker.getRegistrations().then(r=>r.forEach(w=>w.unregister()))}else{var refreshing=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(refreshing)return;refreshing=true;var b=document.createElement('div');b.setAttribute('style','position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:9999;background:#1e293b;color:#f1f5f9;padding:12px 20px;border-radius:8px;font-size:14px;display:flex;align-items:center;gap:12px;box-shadow:0 4px 12px rgba(0,0,0,.3);font-family:system-ui,sans-serif');b.innerHTML='Update available <button style=\"background:#3b82f6;color:#fff;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px\">Reload</button>';b.querySelector('button').onclick=()=>location.reload();document.body.appendChild(b)});navigator.serviceWorker.register('/sw.js')}})}`,
          }}
        />
      </body>
    </html>
  );
}
