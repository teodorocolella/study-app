import { useEffect, useRef, useState } from "react";

interface TypingEntry {
  name: string;
  expiresAt: number;
}

/** Tracks who's currently typing; an entry auto-expires a few seconds after its last event. */
export function useTypingUsers(ttlMs = 3000) {
  const [typing, setTyping] = useState<Record<string, TypingEntry>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      setTyping((prev) => {
        let changed = false;
        const next: Record<string, TypingEntry> = {};
        for (const [id, entry] of Object.entries(prev)) {
          if (entry.expiresAt > now) next[id] = entry;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function markTyping(userId: string, name: string) {
    setTyping((prev) => ({ ...prev, [userId]: { name, expiresAt: Date.now() + ttlMs } }));
  }

  function reset() {
    setTyping({});
  }

  return { typing, markTyping, reset };
}
