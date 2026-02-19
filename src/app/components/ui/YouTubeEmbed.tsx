type Props = {
  videoId: string;
  title?: string;
};

export default function YouTubeEmbed({ videoId, title = 'Video' }: Props) {
  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl border border-white/10">
      <iframe
        src={`https://www.youtube.com/embed/${videoId}`}
        title={title}
        allow="fullscreen"
        allowFullScreen
        className="h-full w-full"
        loading="lazy"
      />
    </div>
  );
}
