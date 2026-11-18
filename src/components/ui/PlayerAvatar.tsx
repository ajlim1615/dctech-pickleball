"use client";

const SIZE_CLASS = {
  xs: "h-6 w-6 text-[9px]",
  sm: "h-7 w-7 text-[10px]",
  md: "h-9 w-9 text-[11px]",
} as const;

/** Circular player avatar with initials fallback when no photo is set. */
export function PlayerAvatar({
  name,
  avatarUrl,
  size = "sm",
  className = "",
}: {
  name: string;
  avatarUrl?: string | null;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  const initials = (name || "P").trim().slice(0, 2).toUpperCase();
  const base = `${SIZE_CLASS[size]} rounded-full border border-slate-200 dark:border-slate-700 shrink-0 ${className}`;

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        loading="lazy"
        decoding="async"
        className={`${base} object-cover bg-slate-100 dark:bg-slate-800`}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`${base} bg-slate-100 dark:bg-slate-800 inline-flex items-center justify-center font-mono font-bold text-emerald-700 dark:text-emerald-400`}
    >
      {initials}
    </span>
  );
}
