import { describe, expect, it } from 'vitest';
import { appendSessionRecord, computeStats, localDayKey, splitByLocalDay } from '@/lib/statistics';
import { createEmptyHistory } from '@/lib/storage';
import type { FocusHistory, SessionRecord } from '@/types/focus';

const MIN = 60_000;
const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime(); // October 2026, local time

function record(startedAt: number, minutes: number, outcome: SessionRecord['outcome'] = 'completed'): SessionRecord {
  return { id: `r${startedAt}`, startedAt, endedAt: startedAt + minutes * MIN, plannedMinutes: minutes, outcome };
}

function historyOf(...records: SessionRecord[]): FocusHistory {
  return records.reduce((h, r) => appendSessionRecord(h, r, r.endedAt), createEmptyHistory());
}

describe('statistics', () => {
  it('runs in a non-UTC timezone so local-day logic is exercised', () => {
    expect(process.env.TZ).toBe('Asia/Kolkata');
    expect(new Date(at(13, 0)).getTimezoneOffset()).toBe(-330);
  });

  it("computes today's completed sessions and minutes", () => {
    const history = historyOf(record(at(13, 9), 25), record(at(13, 11), 45), record(at(12, 20), 60));
    const stats = computeStats(history, at(13, 18));
    expect(stats.today).toEqual({ sessions: 2, minutes: 70 });
    expect(stats.total).toEqual({ sessions: 3, minutes: 130 });
  });

  it('ignores sessions that were not completed', () => {
    const history = historyOf(
      record(at(13, 9), 25, 'stopped-early'),
      record(at(13, 10), 25, 'overridden'),
      record(at(13, 11), 0.5, 'ended'), // indefinite session under a minute
      record(at(13, 12), 30, 'ended'),
    );
    const stats = computeStats(history, at(13, 18));
    expect(stats.today).toEqual({ sessions: 1, minutes: 30 });
    expect(history.totals.completedSessions).toBe(1);
    expect(history.sessions).toHaveLength(4); // still recorded, just not counted
  });

  it('splits focus time across local midnight', () => {
    // 23:30 on the 12th → 00:30 on the 13th, local time.
    const history = historyOf(record(at(12, 23, 30), 60));
    const stats = computeStats(history, at(13, 9));
    expect(stats.today).toEqual({ sessions: 1, minutes: 30 }); // counted on the day it ended
    const yesterday = stats.daily.at(-2)!;
    expect(yesterday).toMatchObject({ dayKey: '2026-10-12', minutes: 30, sessions: 0 });
  });

  it('uses local days, not UTC days', () => {
    // 02:00 IST on the 13th is still the 12th in UTC.
    expect(localDayKey(at(13, 2))).toBe('2026-10-13');
    expect(new Date(at(13, 2)).toISOString().slice(0, 10)).toBe('2026-10-12');
    expect([...splitByLocalDay(at(13, 2), at(13, 3)).keys()]).toEqual(['2026-10-13']);
  });

  it('builds a daily history ending today, with empty days included', () => {
    const history = historyOf(record(at(10, 9), 50), record(at(13, 9), 25));
    const { daily } = computeStats(history, at(13, 12), 7);
    expect(daily.map((d) => d.dayKey)).toEqual([
      '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13',
    ]);
    expect(daily.map((d) => d.minutes)).toEqual([0, 0, 0, 50, 0, 0, 25]);
  });

  it('prunes old records without losing lifetime totals', () => {
    let history = historyOf(record(new Date(2025, 0, 1, 9).getTime(), 30));
    history = appendSessionRecord(history, record(at(13, 9), 25), at(13, 9, 25));
    expect(history.sessions).toHaveLength(1);
    expect(history.totals).toEqual({ completedSessions: 2, completedMs: 55 * MIN });
  });
});
