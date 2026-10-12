export interface FocusSession {
  id: string;
  /** Epoch milliseconds. */
  startedAt: number;
  /** Epoch milliseconds, or `null` for an indefinite session. */
  endsAt: number | null;
  status: 'active';
  /** Strict Mode is captured at start and only applies to timed sessions. */
  strictMode: boolean;
  /** Planned length in minutes, or `null` for an indefinite session. */
  durationMinutes: number | null;
}

export interface FocusState {
  enabled: boolean;
  activeSession: FocusSession | null;
  lastUpdatedAt: number;
}

/**
 * How a session ended:
 * - `completed`: a timed session reached its end time.
 * - `ended`: an indefinite session was ended by the user.
 * - `stopped-early`: a timed (non-strict) session was ended before its end time.
 * - `overridden`: a strict session was ended through the emergency override.
 */
export type SessionOutcome = 'completed' | 'ended' | 'stopped-early' | 'overridden';

export interface SessionRecord {
  id: string;
  startedAt: number;
  endedAt: number;
  /** Planned length in minutes, `null` for indefinite sessions. */
  plannedMinutes: number | null;
  outcome: SessionOutcome;
}

export interface FocusHistory {
  schemaVersion: 1;
  sessions: SessionRecord[];
  /** Lifetime aggregates; kept separately so pruning old records never loses them. */
  totals: {
    completedSessions: number;
    completedMs: number;
  };
}
