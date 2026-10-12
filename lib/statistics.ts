import type { FocusHistory, SessionRecord } from '@/types/focus';
import { countsAsCompleted } from './storage';

const DAY_MS = 86_400_000;
export const HISTORY_RETENTION_DAYS = 365;

/** `YYYY-MM-DD` for the user's local calendar day containing `timestamp`. */
export function localDayKey(timestamp: number): string {
  const d = new Date(timestamp);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function startOfLocalDay(timestamp: number): number {
  const d = new Date(timestamp);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Local midnight following `timestamp`. Uses calendar math, so DST days are 23h or 25h long. */
function nextLocalMidnight(timestamp: number): number {
  const d = new Date(timestamp);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
}

/** Split a time span into milliseconds per local calendar day. */
export function splitByLocalDay(start: number, end: number): Map<string, number> {
  const result = new Map<string, number>();
  let cursor = start;
  while (cursor < end) {
    const boundary = Math.min(end, nextLocalMidnight(cursor));
    const key = localDayKey(cursor);
    result.set(key, (result.get(key) ?? 0) + (boundary - cursor));
    cursor = boundary;
  }
  return result;
}

/** Add a finished session, update lifetime totals, and prune records past the retention window. */
export function appendSessionRecord(
  history: FocusHistory,
  record: SessionRecord,
  now: number,
): FocusHistory {
  const cutoff = now - HISTORY_RETENTION_DAYS * DAY_MS;
  const counted = countsAsCompleted(record);
  return {
    schemaVersion: 1,
    sessions: [...history.sessions, record].filter((r) => r.endedAt >= cutoff),
    totals: {
      completedSessions: history.totals.completedSessions + (counted ? 1 : 0),
      completedMs: history.totals.completedMs + (counted ? record.endedAt - record.startedAt : 0),
    },
  };
}

export interface DayStats {
  dayKey: string;
  /** Local midnight of the day, for labelling. */
  date: number;
  minutes: number;
  sessions: number;
}

export interface FocusStats {
  today: { minutes: number; sessions: number };
  total: { minutes: number; sessions: number };
  /** Oldest first, ending with today. */
  daily: DayStats[];
}

/**
 * Derive statistics from real, completed session records only. Focus time is attributed to the
 * local day it happened on (a session across midnight is split); the session itself is counted
 * on the day it finished.
 */
export function computeStats(history: FocusHistory, now: number, days = 14): FocusStats {
  const minutesByDay = new Map<string, number>();
  const sessionsByDay = new Map<string, number>();
  for (const record of history.sessions) {
    if (!countsAsCompleted(record)) continue;
    for (const [key, ms] of splitByLocalDay(record.startedAt, record.endedAt)) {
      minutesByDay.set(key, (minutesByDay.get(key) ?? 0) + ms / 60_000);
    }
    const endKey = localDayKey(record.endedAt);
    sessionsByDay.set(endKey, (sessionsByDay.get(endKey) ?? 0) + 1);
  }

  const daily: DayStats[] = [];
  const todayStart = startOfLocalDay(now);
  for (let offset = days - 1; offset >= 0; offset--) {
    const d = new Date(todayStart);
    const date = new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset).getTime();
    const dayKey = localDayKey(date);
    daily.push({
      dayKey,
      date,
      minutes: Math.round(minutesByDay.get(dayKey) ?? 0),
      sessions: sessionsByDay.get(dayKey) ?? 0,
    });
  }

  const todayKey = localDayKey(now);
  return {
    today: {
      minutes: Math.round(minutesByDay.get(todayKey) ?? 0),
      sessions: sessionsByDay.get(todayKey) ?? 0,
    },
    total: {
      minutes: Math.round(history.totals.completedMs / 60_000),
      sessions: history.totals.completedSessions,
    },
    daily,
  };
}
