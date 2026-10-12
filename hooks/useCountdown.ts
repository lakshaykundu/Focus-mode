import { useEffect, useRef, useState } from 'react';
import { remainingMs } from '@/lib/timer';
import type { FocusSession } from '@/types/focus';

/** Current time, refreshed every `intervalMs`. Purely for rendering; never a source of truth. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export interface Countdown {
  now: number;
  /** Milliseconds left, or `null` for an indefinite session / no session. */
  remaining: number | null;
  elapsed: number;
  /** 0–1 share of the timed session that has passed. */
  progress: number;
}

/**
 * Countdown derived from the session's stored timestamps on every tick, so it's correct no
 * matter how long the popup was closed. Calls `onExpire` once per session when it reaches zero.
 */
export function useCountdown(session: FocusSession | null, onExpire?: () => void): Countdown {
  const now = useNow();
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const firedFor = useRef<string | null>(null);

  const remaining = session ? remainingMs(session, now) : null;
  const elapsed = session ? Math.max(0, now - session.startedAt) : 0;
  const total = session?.endsAt ? session.endsAt - session.startedAt : 0;
  const progress = total > 0 ? Math.min(1, elapsed / total) : 0;

  useEffect(() => {
    if (session && remaining === 0 && firedFor.current !== session.id) {
      firedFor.current = session.id;
      onExpireRef.current?.();
    }
  }, [session, remaining]);

  return { now, remaining, elapsed, progress };
}
