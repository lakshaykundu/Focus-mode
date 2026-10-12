import type { FocusSession } from '@/types/focus';
import type { SessionDuration } from '@/types/settings';

export const SESSION_ALARM = 'focusguard:session-end';
export const PRESET_DURATIONS = [25, 45, 60, 90] as const;
export const MIN_CUSTOM_MINUTES = 1;
export const MAX_CUSTOM_MINUTES = 720;

export type DurationValidation =
  | { ok: true; duration: SessionDuration }
  | { ok: false; error: string };

/** Accept `'indefinite'` or a whole number of minutes between 1 and 720 (12 hours). */
export function validateDuration(value: unknown): DurationValidation {
  if (value === 'indefinite') return { ok: true, duration: 'indefinite' };
  const minutes = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) {
    return { ok: false, error: 'Enter a number of minutes' };
  }
  if (!Number.isInteger(minutes)) return { ok: false, error: 'Use whole minutes' };
  if (minutes < MIN_CUSTOM_MINUTES || minutes > MAX_CUSTOM_MINUTES) {
    return {
      ok: false,
      error: `Choose between ${MIN_CUSTOM_MINUTES} and ${MAX_CUSTOM_MINUTES} minutes`,
    };
  }
  return { ok: true, duration: minutes };
}

/** Remaining milliseconds, derived from stored timestamps. `null` for indefinite sessions. */
export function remainingMs(session: FocusSession, now: number): number | null {
  if (session.endsAt === null) return null;
  return Math.max(0, session.endsAt - now);
}

export function isExpired(session: FocusSession, now: number): boolean {
  return session.endsAt !== null && now >= session.endsAt;
}

/** `mm:ss`, or `h:mm:ss` once the value reaches an hour. */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Compact human duration: `45m`, `1h 30m`. */
export function formatMinutes(totalMinutes: number): string {
  const minutes = Math.round(totalMinutes);
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
