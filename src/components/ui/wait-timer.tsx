"use client";

import { useSyncExternalStore } from "react";
import { formatClockDuration } from "@/lib/duration";

let currentNow = Date.now();
let intervalId: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    currentNow = Date.now();
    intervalId = setInterval(() => {
      currentNow = Date.now();
      listeners.forEach((cb) => cb());
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

function getSnapshot(): number {
  return currentNow;
}

function getServerSnapshot(): null {
  return null;
}

/**
 * Leaf 1-second ticking elapsed timer backed by a single shared clock.
 * Renders null on SSR so hydration never mismatches and parent lists don't re-render.
 */
export function WaitTimer({
  since,
  prefix = "",
  className = "",
}: {
  since: string;
  prefix?: string;
  className?: string;
}) {
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (now === null) return null;

  return (
    <span className={`font-mono tabular-nums ${className}`.trim()}>
      {prefix}
      {formatClockDuration(since, now)}
    </span>
  );
}
