'use client';

import { useState } from 'react';

export type AccordionItem = {
  key: string;
  title: React.ReactNode;
  content: React.ReactNode;
};

type AccordionProps = {
  items: AccordionItem[];
  multiple?: boolean;
};

export default function Accordion({ items, multiple = false }: AccordionProps) {
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  const toggle = (key: string) => {
    setOpenKeys((prev) =>
      multiple
        ? prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
        : prev.includes(key) ? [] : [key]
    );
  };

  return (
    <div className="divide-y divide-white/10">
      {items.map(({ key, title, content }) => (
        <div key={key}>
          <button
            onClick={() => toggle(key)}
            className="w-full flex items-center gap-2 py-3 font-medium text-white hover:text-blue-400"
          >
            {title}
            <span className="ml-2 flex items-center gap-1 text-sm text-neutral-400">
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${openKeys.includes(key) ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </button>

          {openKeys.includes(key) && (
            <div className="pb-4 pl-2 text-sm text-neutral-300">
              {content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
