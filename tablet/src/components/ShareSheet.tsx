import { useRef, useState } from "react";
import { Share2 } from "lucide-react";
import { toPng } from "html-to-image";
import type { SessionState } from "../engine/types";
import { shareImageName } from "../io/export";
import { shareFile } from "../io/native";
import { formatDate, styleLabel } from "../lib/ctx";
import { MIN_RANKED_GAMES, shareRankings } from "../lib/shareRankings";
import { ShareCard } from "./ShareCard";
import { Button, Sheet, TextField, toast } from "./ui";

/** Renders a node to a high-resolution PNG (3× the on-screen size). */
export async function renderCardPng(node: HTMLElement): Promise<Uint8Array> {
  const dataUrl = await toPng(node, { pixelRatio: 3, cacheBust: true });
  const binary = atob(dataUrl.split(",")[1]);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** Preview the results card, edit its title, and share it as an image. */
export function ShareSheet({ state, onClose }: { state: SessionState; onClose: () => void }) {
  const [title, setTitle] = useState(state.session.title);
  const [busy, setBusy] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const rankings = shareRankings(state);

  async function share() {
    if (!card.current) return;
    setBusy(true);
    try {
      const png = await renderCardPng(card.current);
      await shareFile(shareImageName(title.trim() || state.session.title), png, "image/png");
    } catch {
      toast("The image couldn't be made. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      title="Share results"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" size="lg" onClick={share} disabled={busy}>
            <Share2 size={18} /> {busy ? "Preparing…" : "Share"}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 pt-1 md:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          <TextField label="Card title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <p className="text-sm text-muted">
            Only changes the card. Share opens your tablet's share menu, where you can save the image to Photos or
            Files, or send it to a chat.
          </p>
        </div>
        <div className="flex justify-center">
          <ShareCard
            ref={card}
            title={title}
            players={rankings.players}
            games={rankings.games}
            ranked={rankings.ranked}
            provisional={rankings.provisional}
            more={rankings.more}
            minGames={MIN_RANKED_GAMES}
            footer={`${formatDate(state.session.date)} · ${styleLabel(state.session.matchingStyle)}`}
          />
        </div>
      </div>
    </Sheet>
  );
}
