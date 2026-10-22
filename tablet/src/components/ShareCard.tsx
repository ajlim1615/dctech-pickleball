import { forwardRef } from "react";
import type { ShareRow } from "../lib/shareRankings";

const MEDALS = ["🥇", "🥈", "🥉"];

/**
 * The results card that gets shared as an image. Its colours are fixed (not theme tokens)
 * so the picture looks the same whichever theme the tablet is in.
 */
export const ShareCard = forwardRef<
  HTMLDivElement,
  {
    title: string;
    players: number;
    games: number;
    ranked: ShareRow[];
    provisional: ShareRow[];
    more: number;
    minGames: number;
    footer: string;
  }
>(function ShareCard({ title, players, games, ranked, provisional, more, minGames, footer }, ref) {
  return (
    <div
      ref={ref}
      className="w-[360px] overflow-hidden rounded-[22px] px-5 pb-5 pt-6 text-[#f6f3ec]"
      style={{ background: "linear-gradient(160deg, #2a5a43 0%, #1f3b2f 55%, #16291f 100%)" }}
    >
      <div className="text-center">
        <p className="break-words font-serif text-[22px] font-semibold leading-tight tracking-[-0.01em]">
          {title.trim() || "Session results"}
        </p>
        <p className="mt-1 text-[12px] text-[#f6f3ec]/80">Session results</p>
        <p className="text-[10px] text-[#f6f3ec]/60">Total wins · Ranked after {minGames} games</p>
        <div aria-hidden className="mt-3 text-[34px] leading-none">🏆</div>
      </div>

      <div className="mt-4 grid grid-cols-2 rounded-2xl bg-white/[0.08] py-3 text-center">
        <Stat value={players} label={players === 1 ? "Player" : "Players"} />
        <Stat value={games} label={games === 1 ? "Game" : "Games"} />
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl bg-white/[0.08]">
        {ranked.map((r, i) => (
          <Row key={r.id} row={r} marker={MEDALS[i] ?? String(i + 1)} medal={i < 3} />
        ))}
        {provisional.length > 0 && (
          <>
            <p className="border-t border-white/10 px-4 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#f6f3ec]/55">
              Provisional
            </p>
            {provisional.map((r) => (
              <Row key={r.id} row={r} marker="–" />
            ))}
          </>
        )}
        {more > 0 && <p className="border-t border-white/10 px-4 py-2.5 text-center text-[12px] text-[#f6f3ec]/65">+{more} more</p>}
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 border-t border-white/10 pt-3 text-[11px] text-[#f6f3ec]/70">
        <span aria-hidden className="h-3 w-3 rounded-full bg-[#d4e938]" />
        <span>{footer}</span>
      </div>
    </div>
  );
});

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="font-serif text-[24px] font-semibold leading-none tabular-nums">{value}</p>
      <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#f6f3ec]/65">{label}</p>
    </div>
  );
}

function Row({ row, marker, medal = false }: { row: ShareRow; marker: string; medal?: boolean }) {
  return (
    <div className="flex items-center gap-3 border-t border-white/10 px-4 py-2.5 first:border-t-0">
      <span className={medal ? "w-6 text-center text-[16px] leading-none" : "w-6 text-center font-mono text-[12px] text-[#f6f3ec]/60"}>
        {marker}
      </span>
      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{row.name}</span>
      <span className="text-right">
        <span className="block font-mono text-[15px] font-semibold leading-none text-[#a9d1b4] tabular-nums">{row.won}</span>
        <span className="text-[9px] text-[#f6f3ec]/55">{row.won === 1 ? "win" : "wins"}</span>
      </span>
    </div>
  );
}
