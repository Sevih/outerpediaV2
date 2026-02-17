export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse space-y-6 px-4 py-10 md:px-6">
      {/* Title skeleton */}
      <div className="h-8 w-48 rounded bg-zinc-800" />
      {/* Content skeletons */}
      <div className="space-y-4">
        <div className="h-4 w-full rounded bg-zinc-800" />
        <div className="h-4 w-5/6 rounded bg-zinc-800" />
        <div className="h-4 w-4/6 rounded bg-zinc-800" />
      </div>
      {/* Card grid skeleton */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="h-48 rounded bg-zinc-800" />
        ))}
      </div>
    </div>
  );
}
