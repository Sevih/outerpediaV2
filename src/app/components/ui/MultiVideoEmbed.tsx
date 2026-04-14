'use client';

import { useState } from 'react';
import Tabs from './Tabs';

export type VideoPlatform = 'youtube' | 'twitch' | 'bilibili';

export type VideoItem = {
  platform: VideoPlatform;
  id: string;
  title: string;
  author?: string;
  label?: string;
};

type Props = {
  videos: VideoItem[];
  hashPrefix?: string;
};

const TWITCH_PARENTS = ['outerpedia.com', 'localhost'];

function getEmbedUrl(video: VideoItem): string {
  switch (video.platform) {
    case 'youtube':
      return `https://www.youtube.com/embed/${video.id}`;
    case 'twitch': {
      const parents = TWITCH_PARENTS.map((p) => `parent=${p}`).join('&');
      return `https://player.twitch.tv/?video=${video.id}&${parents}&autoplay=false`;
    }
    case 'bilibili':
      return `https://player.bilibili.com/player.html?bvid=${video.id}&high_quality=1`;
  }
}

function VideoFrame({ video }: { video: VideoItem }) {
  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl border border-white/10">
      <iframe
        src={getEmbedUrl(video)}
        title={video.title}
        allow="fullscreen"
        allowFullScreen
        className="h-full w-full"
        loading="lazy"
      />
    </div>
  );
}

export default function MultiVideoEmbed({ videos, hashPrefix }: Props) {
  const [activeId, setActiveId] = useState(videos[0]?.id ?? '');

  if (videos.length === 0) return null;

  if (videos.length === 1) {
    const v = videos[0];
    return (
      <div className="space-y-2">
        {(v.author || v.title) && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
            <span className="font-medium text-zinc-300">{v.title}</span>
            {v.author && <span>by {v.author}</span>}
          </div>
        )}
        <VideoFrame video={v} />
      </div>
    );
  }

  const items = videos.map((v) => v.id);
  const labels = videos.map((v) => v.label ?? v.title);
  const active = videos.find((v) => v.id === activeId) ?? videos[0];

  return (
    <div className="space-y-3">
      <Tabs
        items={items}
        labels={labels}
        value={active.id}
        onChange={setActiveId}
        hashPrefix={hashPrefix}
      />
      {(active.author || active.title) && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
          <span className="font-medium text-zinc-300">{active.title}</span>
          {active.author && <span>by {active.author}</span>}
        </div>
      )}
      <VideoFrame video={active} />
    </div>
  );
}
