"use client";

import { useCallback, useEffect, useState } from "react";

export type FlashKind = "success" | "error";
export type FlashMessage = { kind: FlashKind; text: string };

/** Success notices clear on their own after 4 s; errors stay until replaced or dismissed. */
export function flashClearsAfter(kind: FlashKind): number | null {
  return kind === "success" ? 4000 : null;
}

export function useFlashMessage(): {
  message: FlashMessage | null;
  flash: (kind: FlashKind, text: string) => void;
  clear: () => void;
} {
  const [message, setMessage] = useState<FlashMessage | null>(null);

  useEffect(() => {
    if (!message) return;
    const ms = flashClearsAfter(message.kind);
    if (ms === null) return;
    const timer = setTimeout(() => setMessage(null), ms);
    return () => clearTimeout(timer);
  }, [message]);

  const flash = useCallback((kind: FlashKind, text: string) => {
    setMessage({ kind, text });
  }, []);

  const clear = useCallback(() => {
    setMessage(null);
  }, []);

  return { message, flash, clear };
}
