import { useState, type ReactNode } from "react";
import { describeRule } from "@/features/matches/utils/scoring";
import type { Navigate } from "../App";
import { Button, Card, Chip, ChipGroup, Label, ScreenHeader, Stepper, TextField, TextInput, Toggle, toast } from "../components/ui";
import { createSession, getLiveSession } from "../db/repo";
import type { DeskCourt, DeskSession, MatchingStyle } from "../engine/types";
import { MATCHING_STYLES, styleLabel, todayIso } from "../lib/ctx";

const MAX_COURTS = 8;
const TARGETS = [11, 15, 21];
const COMMON_STYLES: MatchingStyle[] = ["balanced", "social_mixer", "skill_separated", "winners_stay"];

function defaultTitle() {
  return `Open play – ${new Date().toLocaleDateString(undefined, { weekday: "long" })}`;
}

function Section({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <Card className={`p-5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </Card>
  );
}

export function NewSession({ navigate }: { navigate: Navigate }) {
  const [title, setTitle] = useState(defaultTitle);
  const [date, setDate] = useState(todayIso);
  const [courtNames, setCourtNames] = useState(["Court 1", "Court 2"]);
  const [style, setStyle] = useState<MatchingStyle>("balanced");
  const [showAllStyles, setShowAllStyles] = useState(false);
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

  const expanded = showAllStyles || !COMMON_STYLES.includes(style);
  const shownStyles = expanded ? MATCHING_STYLES : MATCHING_STYLES.filter((s) => COMMON_STYLES.includes(s.value));
  const hint = MATCHING_STYLES.find((s) => s.value === style)?.hint;
  const rule = describeRule({ targetPoints: targetScore, winByTwo: winBy2, trackScores });

  return (
    <>
      <ScreenHeader title="New session" onBack={() => navigate({ name: "home" })} />
      <main className="mx-auto grid w-full max-w-5xl flex-1 grid-cols-1 content-start gap-4 overflow-y-auto px-6 py-6 md:grid-cols-2">
        <Section label="The night">
          <div className="space-y-4">
            <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </Section>

        <Section label="Scoring">
          <Toggle label="Track scores" checked={trackScores} onChange={setTrackScores} />
          {trackScores ? (
            <div className="mt-3 space-y-3">
              <div>
                <span className="mb-2 block text-sm text-muted">Play to</span>
                <ChipGroup options={TARGETS} value={targetScore} onChange={setTargetScore} mono />
              </div>
              <Toggle label="Win by 2" checked={winBy2} onChange={setWinBy2} />
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">You'll just tap which team won.</p>
          )}
        </Section>

        <Section label="Courts" className="md:col-span-2">
          <div className="flex flex-wrap items-start gap-6">
            <Stepper label="Courts" value={courtNames.length} min={1} max={MAX_COURTS} onChange={setCourtCount} />
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 lg:grid-cols-4">
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
        </Section>

        <Section label="Matchmaking" className="md:col-span-2">
          <div className="flex flex-wrap gap-2">
            {shownStyles.map((s) => (
              <Chip key={s.value} selected={style === s.value} onClick={() => setStyle(s.value)}>
                {s.label}
              </Chip>
            ))}
            {!expanded && (
              <Chip selected={false} onClick={() => setShowAllStyles(true)} className="text-muted">
                +{MATCHING_STYLES.length - COMMON_STYLES.length} more
              </Chip>
            )}
          </div>
          {hint && <p className="mt-3 text-sm text-muted">{hint}</p>}
        </Section>
      </main>

      <footer className="flex min-h-16 shrink-0 items-center gap-3 border-t border-line bg-surface px-6 py-2">
        <span className="min-w-0 flex-1 truncate text-sm text-muted">
          <span className="font-mono tabular-nums">{courtNames.length}</span> {courtNames.length === 1 ? "court" : "courts"} ·{" "}
          {styleLabel(style)} · {rule}
        </span>
        <Button variant="primary" size="lg" onClick={start} disabled={saving}>
          Start session
        </Button>
      </footer>
    </>
  );
}
