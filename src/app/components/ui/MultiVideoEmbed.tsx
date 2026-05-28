'use client';

import { useState } from 'react';
import Tabs from './Tabs';
import { buildVideoObjectJsonLd } from '@/lib/seo';
import JsonLd from '@/app/components/seo/JsonLd';
import videoMeta from '@data/generated/video-meta.json';

type VideoMeta = { uploadDate: string; title: string; author: string };
const VIDEO_META = videoMeta as Record<string, VideoMeta>;

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

function VideoJsonLd({ videos }: { videos: VideoItem[] }) {
  // Only emit VideoObject when we have an uploadDate — Google rejects the
  // schema without it. Meta comes from data/video-meta.json (YouTube only).
  const withMeta = videos.filter((v) => VIDEO_META[v.id]);
  if (withMeta.length === 0) return null;
  return (
    <>
      {withMeta.map((v) => (
        <JsonLd
          key={`${v.platform}-${v.id}`}
          data={buildVideoObjectJsonLd({
            platform: v.platform,
            id: v.id,
            title: v.title,
            author: v.author,
            uploadDate: VIDEO_META[v.id].uploadDate,
          })}
        />
      ))}
    </>
  );
}

export default function MultiVideoEmbed({ videos, hashPrefix }: Props) {
  const [activeId, setActiveId] = useState(videos[0]?.id ?? '');

  if (videos.length === 0) return null;

  if (videos.length === 1) {
    const v = videos[0];
    return (
      <div className="space-y-2">
        <VideoJsonLd videos={videos} />
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
  const labels = videos.map((v) => {
    const text = v.label ?? v.title;
    return (
      <span title={text} className="block max-w-32 truncate sm:max-w-48">
        {text}
      </span>
    );
  });
  const active = videos.find((v) => v.id === activeId) ?? videos[0];

  return (
    <div className="space-y-3">
      <VideoJsonLd videos={videos} />
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
