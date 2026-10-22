import { useEffect, useState } from "react";
import { getLiveSession } from "./db/repo";
import { MotionConfig } from "motion/react";
import { ToastHost } from "./components/ui";
import { Home } from "./screens/Home";
import { Roster } from "./screens/Roster";
import { NewSession } from "./screens/NewSession";
import { LiveBoard } from "./screens/LiveBoard";
import { Summary } from "./screens/Summary";
import { Backup } from "./screens/Backup";

export type Screen =
  | { name: "home" }
  | { name: "roster" }
  | { name: "new" }
  | { name: "backup" }
  | { name: "live"; sessionId: string }
  | { name: "summary"; sessionId: string };

export type Navigate = (screen: Screen) => void;

export function App() {
  const [screen, setScreen] = useState<Screen | null>(null);

  // Reopening the app goes straight back to a live session.
  useEffect(() => {
    getLiveSession()
      .then((live) => setScreen(live ? { name: "live", sessionId: live.id } : { name: "home" }))
      .catch(() => setScreen({ name: "home" }));
  }, []);

  return (
    // Animations follow the tablet's "reduce motion" setting.
    <MotionConfig reducedMotion="user">
    <div className="flex h-full flex-col bg-bg text-ink">
      {screen?.name === "home" && <Home navigate={setScreen} />}
      {screen?.name === "roster" && <Roster navigate={setScreen} />}
      {screen?.name === "new" && <NewSession navigate={setScreen} />}
      {screen?.name === "backup" && <Backup navigate={setScreen} />}
      {screen?.name === "live" && <LiveBoard key={screen.sessionId} sessionId={screen.sessionId} navigate={setScreen} />}
      {screen?.name === "summary" && <Summary key={screen.sessionId} sessionId={screen.sessionId} navigate={setScreen} />}
      <ToastHost />
    </div>
    </MotionConfig>
  );
}
