import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { Navigate } from "../App";
import { Button, Card, Chips, Label, ScreenHeader, TextInput, Toggle, toast } from "../components/ui";
import { createSession, getLiveSession } from "../db/repo";
import type { DeskCourt, DeskSession, MatchingStyle } from "../engine/types";
import { MATCHING_STYLES, todayIso } from "../lib/ctx";

const MAX_COURTS = 8;
const TARGETS = [11, 15, 21];

function defaultTitle() {
  return `Open play – ${new Date().toLocaleDateString(undefined, { weekday: "long" })}`;
}

export function NewSession({ navigate }: { navigate: Navigate }) {
  const [title, setTitle] = useState(defaultTitle);
  const [date, setDate] = useState(todayIso);
  const [courtNames, setCourtNames] = useState(["Court 1", "Court 2"]);
  const [style, setStyle] = useState<MatchingStyle>("balanced");
  const [trackScores, setTrackScores] = useState(true);
  const [targetScore, setTargetScore] = useState(11);
  const [winBy2, setWinBy2] = useState(true);
  const [saving, setSaving] = useState(false);

  function setCourtCount(count: number) {
    const n = Math.max(1, Math.min(MAX_COURTS, count));
    setCourtNames((names) =>
      n > names.length
        ? [...names, ...Array.from({ length: n - names.length }, (_, i) => `Court ${names.length + i + 1}`)]
        : names.slice(0, n)
    );
  }

  async function start() {
    setSaving(true);
    try {
      if (await getLiveSession()) {
        toast("End the live session before starting another.");
        return;
      }
      const courts: DeskCourt[] = courtNames.map((name, i) => ({
        id: crypto.randomUUID(),
        name: name.trim() || `Court ${i + 1}`,
        closed: false,
      }));
      const session: DeskSession = {
        id: crypto.randomUUID(),
        title: title.trim() || defaultTitle(),
        date,
        courts,
        matchingStyle: style,
        trackScores,
        targetScore,
        winBy2,
        status: "live",
        startedAt: new Date().toISOString(),
      };
      await createSession(session);
      navigate({ name: "live", sessionId: session.id });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ScreenHeader
        title="New session"
        onBack={() => navigate({ name: "home" })}
        actions={
          <Button variant="primary" onClick={start} disabled={saving}>
            Start session
          </Button>
        }
      />
      <main className="mx-auto grid w-full max-w-5xl flex-1 grid-cols-2 gap-6 overflow-y-auto p-6">
        <Card className="space-y-5 p-5">
          <label className="block">
            <Label>Title</Label>
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="block">
            <Label>Date</Label>
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <div>
            <Label>Courts</Label>
            <div className="mb-3 flex items-center gap-3">
              <Button onClick={() => setCourtCount(courtNames.length - 1)} aria-label="Fewer courts" className="px-3">
                <Minus size={18} />
              </Button>
              <span className="w-8 text-center font-mono text-xl tabular-nums">{courtNames.length}</span>
              <Button onClick={() => setCourtCount(courtNames.length + 1)} aria-label="More courts" className="px-3">
                <Plus size={18} />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {courtNames.map((name, i) => (
                <TextInput
                  key={i}
                  aria-label={`Court ${i + 1} name`}
                  value={name}
                  onChange={(e) => setCourtNames((names) => names.map((n, j) => (j === i ? e.target.value : n)))}
                />
              ))}
            </div>
          </div>
        </Card>

        <Card className="space-y-5 p-5">
          <div>
            <Label>Matchmaking</Label>
            <div className="grid grid-cols-2 gap-2">
              {MATCHING_STYLES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStyle(s.value)}
                  className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm ${
                    style === s.value ? "border-volt bg-volt/10" : "border-border"
                  }`}
                >
                  <span className={`block font-medium ${style === s.value ? "text-volt" : ""}`}>{s.label}</span>
                  <span className="block text-xs text-muted-foreground">{s.hint}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Toggle label="Track scores" checked={trackScores} onChange={setTrackScores} />
            {trackScores ? (
              <>
                <div>
                  <Label>Play to</Label>
                  <Chips options={TARGETS} value={targetScore} onChange={setTargetScore} />
                </div>
                <Toggle label="Win by 2" checked={winBy2} onChange={setWinBy2} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">You'll just tap which team won.</p>
            )}
          </div>
        </Card>
      </main>
    </>
  );
}
