'use client';

import { useState } from 'react';
import Image from 'next/image';

export type BannerTab = {
  key: string;
  image: string;
  label: string;
  badgeImg?: string;
  badgePosition?: string;
  content: React.ReactNode;
};

type Props = {
  tabs: BannerTab[];
  defaultKey?: string;
  imagePath?: string;
  badgePath?: string;
};

export default function BannerTabCards({
  tabs,
  defaultKey,
  imagePath = '/images/guides/general-guides/banner/',
  badgePath = '/images/guides/general-guides/banner/',
}: Props) {
  const [selected, setSelected] = useState(defaultKey || tabs[0].key);

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      {/* Tab buttons */}
      <div className="flex w-70 flex-col gap-4 md:max-w-70">
        {tabs.map((tab) => {
          const isActive = tab.key === selected;

          return (
            <button
              key={tab.key}
              onClick={() => setSelected(tab.key)}
              className={`relative group overflow-visible transition-all duration-300 w-full rounded-xl ${
                isActive
                  ? 'ring-2 ring-yellow-400 ring-offset-black shadow-[0_0_8px_rgba(255,215,0,0.6)]'
                  : 'ring-2 ring-transparent hover:ring-yellow-100'
              }`}
            >
              <div className="relative h-20 w-70 overflow-hidden rounded-xl">
                <Image
                  src={`${imagePath}${tab.image}.webp`}
                  alt={tab.label}
                  width={280}
                  height={80}
                  style={{ width: 280, height: 80 }}
                  className="object-cover"
                />
                <div className="pointer-events-none absolute bottom-2 right-3 text-left text-sm font-bold text-white drop-shadow-md sm:text-base [text-shadow:0_1px_3px_rgb(0_0_0/80%)]">
                  {tab.label}
                </div>
              </div>

              {tab.badgeImg && (
                <div className={`absolute ${tab.badgePosition || 'top-2 right-2'} h-11.25 w-22.5`}>
                  <Image
                    src={`${badgePath}${tab.badgeImg}.webp`}
                    alt="badge"
                    width={90}
                    height={45}
                    style={{ width: 90, height: 45 }}
                    className="object-contain"
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Active tab content */}
      <div className="flex-1">{tabs.find((t) => t.key === selected)?.content}</div>
    </div>
  );
}
