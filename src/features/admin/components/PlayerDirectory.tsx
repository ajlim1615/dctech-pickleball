"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Gauge,
  ImageOff,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Power,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { formatRating } from "@/lib/utils";
import { isGuestProfile, isRootSystemAdminEmail, ratingLevel } from "../utils/playerDirectory";
import type { Profile } from "@/types";

const PAGE_SIZE = 25;

type Filter = "all" | "admins" | "players" | "off";
type SortKey = "name" | "role" | "rating" | "games";

export interface PlayerDirectoryActions {
  onToggleActive: (p: Profile) => void;
  onChangeRole: (p: Profile, role: "admin" | "player") => void;
  onChangeRating: (p: Profile) => void;
  onEdit: (p: Profile) => void;
  onResetPassword: (p: Profile) => void;
  onViewPhoto: (p: Profile) => void;
}

const nameOf = (p: Profile) => p.full_name || p.display_name || "Player";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "P";
}

/**
 * The admin roster: one sortable, paged table of every player. The System Admin
 * account sits above it as a single line. Rating, role, name, photo and password
 * changes live in each row's menu and only appear for the System Admin; every admin
 * can turn an account on or off.
 */
export function PlayerDirectory({
  players,
  viewerIsSystemAdmin,
  actions,
  headerActions,
}: {
  players: Profile[];
  viewerIsSystemAdmin: boolean;
  actions: PlayerDirectoryActions;
  headerActions?: ReactNode;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [page, setPage] = useState(0);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  /** New page: back to the top of the table, so the list starts where you're looking. */
  function goToPage(n: number) {
    setPage(n);
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sectionRef.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }

  const systemAdmin = players.find((p) => isRootSystemAdminEmail(p.email));
  const roster = useMemo(
    () => players.filter((p) => !isRootSystemAdminEmail(p.email) && !isGuestProfile(p)),
    [players]
  );

  const counts = useMemo(
    () => ({
      all: roster.length,
      admins: roster.filter((p) => p.role === "admin").length,
      players: roster.filter((p) => p.role !== "admin").length,
      off: roster.filter((p) => !p.is_active).length,
    }),
    [roster]
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = roster.filter((p) => {
      if (filter === "admins" && p.role !== "admin") return false;
      if (filter === "players" && p.role === "admin") return false;
      if (filter === "off" && p.is_active) return false;
      if (!q) return true;
      return nameOf(p).toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q);
    });
    const byName = (a: Profile, b: Profile) => nameOf(a).localeCompare(nameOf(b));
    const compare: Record<SortKey, (a: Profile, b: Profile) => number> = {
      name: byName,
      role: (a, b) => (a.role === b.role ? 0 : a.role === "admin" ? -1 : 1),
      rating: (a, b) => Number(a.skill_rating || 0) - Number(b.skill_rating || 0),
      games: (a, b) => (a.games_played || 0) - (b.games_played || 0),
    };
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => sign * compare[sort.key](a, b) || byName(a, b));
  }, [roster, filter, search, sort]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  // Any change to what's listed starts again on the first page.
  function toggleSort(key: SortKey) {
    setPage(0);
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" ? "asc" : "desc" }
    );
  }

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "Everyone" },
    { id: "admins", label: "Admins" },
    { id: "players", label: "Players" },
    { id: "off", label: "Turned off" },
  ];

  return (
    <section
      ref={sectionRef}
      aria-labelledby="player-directory-heading"
      className="scroll-mt-20 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm"
    >
      {/* Title and main actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 pt-4 pb-3">
        <div>
          <h2 id="player-directory-heading" className="text-base font-bold text-slate-900 dark:text-slate-100">
            Players <span className="font-mono text-slate-400 dark:text-slate-500">{roster.length}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {viewerIsSystemAdmin
              ? "Use a player's menu to change their rating, role, name, photo or password."
              : "Turn an account off to keep someone out of the line."}
          </p>
        </div>
        {headerActions && <div className="flex flex-wrap items-center gap-2 shrink-0">{headerActions}</div>}
      </div>

      {/* The System Admin account isn't a player, so it gets one line, not a row */}
      {systemAdmin && (
        <div className="mx-4 sm:mx-5 mb-3 flex items-center gap-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-500/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            System Admin: <span className="font-mono">{systemAdmin.email}</span>. Doesn&apos;t play and isn&apos;t listed.
          </span>
        </div>
      )}

      {/* Filters and search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-4 sm:px-5 pb-3">
        <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
          {filters.map((f) => {
            const on = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setFilter(f.id);
                  setPage(0);
                }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-500 ${
                  on
                    ? "border-slate-900 bg-slate-900 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-slate-950"
                    : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                }`}
              >
                {f.label}
                <span className={`font-mono tabular-nums ${on ? "opacity-80" : "text-slate-400 dark:text-slate-500"}`}>
                  {counts[f.id]}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 w-full md:w-auto">
        {/* Phones have no column headings, so sorting lives here */}
        <select
          aria-label="Sort players"
          value={`${sort.key}:${sort.dir}`}
          onChange={(e) => {
            const [key, dir] = e.target.value.split(":") as [SortKey, "asc" | "desc"];
            setSort({ key, dir });
            setPage(0);
          }}
          className="sm:hidden h-9 shrink-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 text-sm text-slate-900 dark:text-slate-100"
        >
          <option value="name:asc">Name</option>
          <option value="rating:desc">Rating</option>
          <option value="games:desc">Games</option>
          <option value="role:asc">Admins first</option>
        </select>
        <label className="relative w-full md:w-64">
          <span className="sr-only">Search players</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search name or email"
            className="h-9 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 pl-8 pr-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </label>
        </div>
      </div>

      {/* Column headings (wide screens) */}
      <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_88px_120px_64px_44px_44px] items-center gap-3 border-y border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40 px-5 py-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        <SortHeader label="Player" k="name" sort={sort} onSort={toggleSort} />
        <SortHeader label="Role" k="role" sort={sort} onSort={toggleSort} />
        <SortHeader label="Rating" k="rating" sort={sort} onSort={toggleSort} />
        <SortHeader label="Games" k="games" sort={sort} onSort={toggleSort} align="right" />
        <span className="text-center">On</span>
        <span className="sr-only">Actions</span>
      </div>

      {pageRows.length === 0 ? (
        <div className="px-5 py-12 text-center border-t border-slate-100 dark:border-slate-800 sm:border-t-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {search.trim() ? `No players match "${search.trim()}"` : "No one here"}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {search.trim() ? "Try a first name, last name or email." : "Pick a different filter above."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800/70 border-t border-slate-100 dark:border-slate-800 sm:border-t-0">
          {pageRows.map((p) => {
            const name = nameOf(p);
            const level = ratingLevel(p.skill_rating);
            const isAdmin = p.role === "admin";
            return (
              <li
                key={p.id}
                className={`deferred-list-row grid grid-cols-[minmax(0,1fr)_auto_auto] sm:grid-cols-[minmax(0,1fr)_88px_120px_64px_44px_44px] items-center gap-3 px-4 sm:px-5 py-2.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors ${
                  p.is_active ? "" : "bg-slate-50/60 dark:bg-slate-950/30"
                }`}
              >
                {/* Player */}
                <div className="flex items-center gap-3 min-w-0">
                  {p.avatar_url ? (
                    <button
                      type="button"
                      onClick={() => actions.onViewPhoto(p)}
                      title="View photo"
                      aria-label={`View ${name}'s photo`}
                      className="h-9 w-9 shrink-0 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 cursor-zoom-in focus-visible:outline-2 focus-visible:outline-emerald-500"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.avatar_url} alt="" width={36} height={36} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    </button>
                  ) : (
                    <span
                      aria-hidden
                      className="h-9 w-9 shrink-0 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300"
                    >
                      {initials(name)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-semibold ${p.is_active ? "text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"}`}>
                      {name}
                      {!p.is_active && <span className="ml-1.5 text-[11px] font-medium text-slate-400">(off)</span>}
                    </p>
                    <p className="truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {p.email || "No email (guest)"}
                    </p>
                    {/* Phones: the other columns, in one line */}
                    <p className="sm:hidden mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {isAdmin ? "Admin · " : ""}
                      <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">{formatRating(p.skill_rating)}</span>
                      {` ${level} · ${p.games_played || 0} games`}
                    </p>
                  </div>
                </div>

                {/* Role */}
                <span className="hidden sm:block">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      isAdmin
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {isAdmin ? "Admin" : "Player"}
                  </span>
                </span>

                {/* Rating */}
                <span className="hidden sm:flex items-baseline gap-1.5 min-w-0">
                  <span className="font-mono text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatRating(p.skill_rating)}
                  </span>
                  <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">{level}</span>
                </span>

                {/* Games */}
                <span className="hidden sm:block text-right font-mono text-sm tabular-nums text-slate-700 dark:text-slate-300">
                  {p.games_played || 0}
                </span>

                {/* Account on/off: every admin */}
                <span className="flex justify-center">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={p.is_active}
                    aria-label={`${name}'s account is ${p.is_active ? "on" : "off"}`}
                    title={p.is_active ? "Account on: click to turn off" : "Account off: click to turn on"}
                    onClick={() => actions.onToggleActive(p)}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-500 ${
                      p.is_active
                        ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/40 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-500/40"
                        : "border-slate-300 dark:border-slate-700 text-slate-400 bg-slate-100 dark:bg-slate-900 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-500/40"
                    }`}
                  >
                    <Power className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </span>

                {/* System Admin menu */}
                <span className="flex justify-end">
                  {viewerIsSystemAdmin ? (
                    <RowMenu
                      open={menuFor === p.id}
                      onOpenChange={(o) => setMenuFor(o ? p.id : null)}
                      name={name}
                      items={[
                        { label: "Change rating", icon: Gauge, onSelect: () => actions.onChangeRating(p) },
                        {
                          label: isAdmin ? "Make player" : "Make admin",
                          icon: isAdmin ? UserRound : ShieldCheck,
                          onSelect: () => actions.onChangeRole(p, isAdmin ? "player" : "admin"),
                        },
                        { label: "Edit name and email", icon: Pencil, onSelect: () => actions.onEdit(p) },
                        ...(p.avatar_url
                          ? [{ label: "Remove photo", icon: ImageOff, onSelect: () => actions.onViewPhoto(p) }]
                          : []),
                        ...(p.email
                          ? [{ label: "Reset password", icon: KeyRound, onSelect: () => actions.onResetPassword(p), danger: true }]
                          : []),
                      ]}
                    />
                  ) : (
                    <span className="h-8 w-8" aria-hidden />
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Pages */}
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 px-4 sm:px-5 py-3 text-xs text-slate-500 dark:text-slate-400">
        <span className="tabular-nums">
          {rows.length === 0
            ? "0 players"
            : `${currentPage * PAGE_SIZE + 1}–${Math.min(rows.length, (currentPage + 1) * PAGE_SIZE)} of ${rows.length}`}
        </span>
        {pageCount > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 0}
              aria-label="Previous page"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer disabled:cursor-default"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            {Array.from({ length: pageCount }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goToPage(i)}
                aria-label={`Page ${i + 1}`}
                aria-current={i === currentPage ? "page" : undefined}
                className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 font-mono tabular-nums cursor-pointer ${
                  i === currentPage
                    ? "bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              type="button"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= pageCount - 1}
              aria-label="Next page"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer disabled:cursor-default"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function SortHeader({
  label,
  k,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === k;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(k)}
      aria-label={`Sort by ${label.toLowerCase()}${active ? (sort.dir === "asc" ? ", ascending" : ", descending") : ""}`}
      className={`inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer ${
        align === "right" ? "justify-end" : ""
      } ${active ? "text-slate-900 dark:text-slate-100" : ""}`}
    >
      {label}
      <Icon className="h-3 w-3" aria-hidden />
    </button>
  );
}

interface MenuItem {
  label: string;
  icon: typeof Pencil;
  onSelect: () => void;
  danger?: boolean;
}

/** A small menu of a player's System Admin actions. Closes on outside click, Escape or after a choice. */
function RowMenu({
  open,
  onOpenChange,
  name,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  items: MenuItem[];
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOpenChange(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More for ${name}`}
        onClick={() => onOpenChange(!open)}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-500 ${
          open
            ? "border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            : "border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
        }`}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={`Actions for ${name}`}
          className="absolute right-0 top-full z-30 mt-1 w-52 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                onOpenChange(false);
                item.onSelect();
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm cursor-pointer ${
                item.danger
                  ? "text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" aria-hidden />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
