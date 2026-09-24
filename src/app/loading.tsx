export default function RootLoading() {
  return (
    <div className="mx-auto max-w-7xl px-3.5 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8 animate-pulse">
      {/* Stadium Hero Skeleton */}
      <div className="rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40 p-6 sm:p-10 backdrop-blur-md space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="h-6 w-28 rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="h-6 w-36 rounded-full bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="h-10 sm:h-12 w-4/5 max-w-xl rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-3/5 max-w-md rounded-xl bg-slate-100 dark:bg-slate-800/60" />
      </div>

      {/* Court Matrix Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-3xl border border-slate-200/50 dark:border-slate-800/50 bg-white/30 dark:bg-slate-900/30 p-6 space-y-5"
          >
            <div className="flex items-center justify-between">
              <div className="h-6 w-24 rounded-lg bg-slate-200 dark:bg-slate-800" />
              <div className="h-5 w-16 rounded-full bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="h-28 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
            <div className="flex items-center justify-between pt-2">
              <div className="h-4 w-28 rounded bg-slate-100 dark:bg-slate-800/60" />
              <div className="h-8 w-24 rounded-xl bg-slate-200 dark:bg-slate-800" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
