export default function AppLoading() {
  return (
    <div className="mx-auto max-w-7xl px-3.5 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8 animate-pulse">
      {/* Top Header Skeleton */}
      <div className="rounded-3xl border border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40 p-6 sm:p-8 backdrop-blur-md space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-5 w-24 rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="h-5 w-32 rounded-full bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="h-8 sm:h-10 w-3/5 max-w-md rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-4/5 max-w-lg rounded-xl bg-slate-100 dark:bg-slate-800/60" />
      </div>

      {/* Grid Content Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200/50 dark:border-slate-800/50 bg-white/30 dark:bg-slate-900/30 p-5 space-y-4 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <div className="h-6 w-20 rounded-lg bg-slate-200 dark:bg-slate-800" />
              <div className="h-4 w-12 rounded-md bg-slate-100 dark:bg-slate-800/60" />
            </div>
            <div className="h-5 w-3/4 rounded-lg bg-slate-200 dark:bg-slate-800" />
            <div className="space-y-2 pt-2">
              <div className="h-3.5 w-full rounded bg-slate-100 dark:bg-slate-800/60" />
              <div className="h-3.5 w-2/3 rounded bg-slate-100 dark:bg-slate-800/60" />
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/40">
              <div className="h-4 w-24 rounded bg-slate-100 dark:bg-slate-800/60" />
              <div className="h-8 w-20 rounded-lg bg-slate-200 dark:bg-slate-800" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
