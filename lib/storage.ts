import type { FocusHistory, FocusSession, FocusState, SessionOutcome, SessionRecord } from '@/types/focus';
import {
  SITE_CATEGORIES,
  type BlockedSite,
  type CleanYouTubeOptions,
  type FocusSettings,
  type SiteCategory,
} from '@/types/settings';
import { normalizeDomain } from './domainUtils';
import { createDefaultSites, siteId } from './siteRegistry';
import { validateDuration } from './timer';

export const STORAGE_KEYS = {
  settings: 'fg:settings',
  state: 'fg:state',
  history: 'fg:history',
} as const;

/** The slice of `chrome.storage.StorageArea` FocusGuard uses. */
export interface StorageArea {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export interface StoredData {
  settings: FocusSettings;
  state: FocusState;
  history: FocusHistory;
}

export const DEFAULT_CLEAN_YOUTUBE: CleanYouTubeOptions = {
  hideShorts: true,
  hideHomeFeed: true,
  hideSidebar: true,
  hideComments: false,
  hideAutoplay: true,
};

export function createDefaultSettings(): FocusSettings {
  return {
    schemaVersion: 1,
    defaultDuration: 25,
    strictMode: false,
    categories: Object.fromEntries(SITE_CATEGORIES.map((c) => [c, { enabled: true }])) as Record<
      SiteCategory,
      { enabled: boolean }
    >,
    sites: createDefaultSites(),
    youtubePolicy: 'block',
    cleanYouTube: { ...DEFAULT_CLEAN_YOUTUBE },
    ui: { lastCustomMinutes: 30 },
  };
}

export function createIdleState(now = 0): FocusState {
  return { enabled: false, activeSession: null, lastUpdatedAt: now };
}

export function createEmptyHistory(): FocusHistory {
  return { schemaVersion: 1, sessions: [], totals: { completedSessions: 0, completedMs: 0 } };
}

// ---------------------------------------------------------------------------
// Sanitizers: stored data may be missing, partial, corrupted, or from an older schema.
// Every field is validated independently and falls back to its default.
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isCategory = (value: unknown): value is SiteCategory =>
  typeof value === 'string' && (SITE_CATEGORIES as readonly string[]).includes(value);

/**
 * Default sites always come from the current registry (so new defaults appear after an update
 * and retired ones disappear), carrying over the user's stored enabled flags. Custom sites are
 * kept in stored order after normalization and de-duplication.
 */
function sanitizeSites(raw: unknown): BlockedSite[] {
  const stored = Array.isArray(raw) ? raw.filter(isObj) : [];
  const storedEnabled = new Map<string, boolean>();
  const custom: BlockedSite[] = [];
  const seen = new Set<string>();

  const defaults = createDefaultSites();
  const defaultDomains = new Set(defaults.map((site) => site.domain));

  for (const item of stored) {
    if (typeof item.domain !== 'string') continue;
    const normalized = normalizeDomain(item.domain);
    if (!normalized.ok) continue;
    const domain = normalized.domain;
    const isCustom = item.custom === true || (typeof item.id === 'string' && item.id.startsWith('custom:'));
    if (!isCustom || defaultDomains.has(domain)) {
      if (defaultDomains.has(domain) && !storedEnabled.has(domain)) {
        storedEnabled.set(domain, bool(item.enabled, true));
      }
      continue;
    }
    if (seen.has(domain)) continue;
    seen.add(domain);
    custom.push({
      id: siteId(domain, true),
      domain,
      category: 'custom',
      enabled: bool(item.enabled, true),
      custom: true,
    });
  }

  return [
    ...defaults.map((site) => ({ ...site, enabled: storedEnabled.get(site.domain) ?? site.enabled })),
    ...custom,
  ];
}

export function sanitizeSettings(raw: unknown): FocusSettings {
  const defaults = createDefaultSettings();
  if (!isObj(raw)) return defaults;

  const duration = validateDuration(raw.defaultDuration);
  const categoriesRaw = isObj(raw.categories) ? raw.categories : {};
  const cleanRaw = isObj(raw.cleanYouTube) ? raw.cleanYouTube : {};
  const uiRaw = isObj(raw.ui) ? raw.ui : {};
  const lastCustom = validateDuration(uiRaw.lastCustomMinutes);

  return {
    schemaVersion: 1,
    defaultDuration: duration.ok ? duration.duration : defaults.defaultDuration,
    strictMode: bool(raw.strictMode, defaults.strictMode),
    categories: Object.fromEntries(
      SITE_CATEGORIES.map((category) => {
        const pref = categoriesRaw[category];
        return [category, { enabled: bool(isObj(pref) ? pref.enabled : undefined, true) }];
      }),
    ) as FocusSettings['categories'],
    sites: sanitizeSites(raw.sites),
    youtubePolicy: raw.youtubePolicy === 'clean' || raw.youtubePolicy === 'block'
      ? raw.youtubePolicy
      : defaults.youtubePolicy,
    cleanYouTube: {
      hideShorts: bool(cleanRaw.hideShorts, DEFAULT_CLEAN_YOUTUBE.hideShorts),
      hideHomeFeed: bool(cleanRaw.hideHomeFeed, DEFAULT_CLEAN_YOUTUBE.hideHomeFeed),
      hideSidebar: bool(cleanRaw.hideSidebar, DEFAULT_CLEAN_YOUTUBE.hideSidebar),
      hideComments: bool(cleanRaw.hideComments, DEFAULT_CLEAN_YOUTUBE.hideComments),
      hideAutoplay: bool(cleanRaw.hideAutoplay, DEFAULT_CLEAN_YOUTUBE.hideAutoplay),
    },
    ui: {
      lastCustomMinutes:
        lastCustom.ok && typeof lastCustom.duration === 'number'
          ? lastCustom.duration
          : defaults.ui.lastCustomMinutes,
    },
  };
}

function sanitizeSession(raw: unknown): FocusSession | null {
  if (!isObj(raw)) return null;
  if (typeof raw.id !== 'string' || !raw.id || !finite(raw.startedAt)) return null;
  const endsAt = raw.endsAt === null ? null : finite(raw.endsAt) ? raw.endsAt : undefined;
  if (endsAt === undefined || (endsAt !== null && endsAt <= raw.startedAt)) return null;
  const durationMinutes = endsAt === null ? null : finite(raw.durationMinutes)
    ? raw.durationMinutes
    : Math.round((endsAt - raw.startedAt) / 60_000);
  return {
    id: raw.id,
    startedAt: raw.startedAt,
    endsAt,
    status: 'active',
    // Strict Mode only applies to timed sessions.
    strictMode: endsAt !== null && raw.strictMode === true,
    durationMinutes,
  };
}

export function sanitizeState(raw: unknown): FocusState {
  if (!isObj(raw)) return createIdleState();
  const activeSession = sanitizeSession(raw.activeSession);
  return {
    // `enabled` is derived so it can never disagree with the session.
    enabled: activeSession !== null,
    activeSession,
    lastUpdatedAt: finite(raw.lastUpdatedAt) ? raw.lastUpdatedAt : 0,
  };
}

const OUTCOMES: readonly SessionOutcome[] = ['completed', 'ended', 'stopped-early', 'overridden'];

function sanitizeRecord(raw: unknown): SessionRecord | null {
  if (!isObj(raw)) return null;
  if (typeof raw.id !== 'string' || !finite(raw.startedAt) || !finite(raw.endedAt)) return null;
  if (raw.endedAt < raw.startedAt) return null;
  if (!OUTCOMES.includes(raw.outcome as SessionOutcome)) return null;
  return {
    id: raw.id,
    startedAt: raw.startedAt,
    endedAt: raw.endedAt,
    plannedMinutes: finite(raw.plannedMinutes) ? raw.plannedMinutes : null,
    outcome: raw.outcome as SessionOutcome,
  };
}

export function sanitizeHistory(raw: unknown): FocusHistory {
  if (!isObj(raw)) return createEmptyHistory();
  const sessions = (Array.isArray(raw.sessions) ? raw.sessions : [])
    .map(sanitizeRecord)
    .filter((record): record is SessionRecord => record !== null)
    .sort((a, b) => a.endedAt - b.endedAt);
  const totals = isObj(raw.totals) ? raw.totals : {};
  const valid = (value: unknown): value is number => finite(value) && value >= 0;
  if (valid(totals.completedSessions) && valid(totals.completedMs)) {
    return {
      schemaVersion: 1,
      sessions,
      totals: { completedSessions: totals.completedSessions, completedMs: totals.completedMs },
    };
  }
  // Totals missing or corrupted: rebuild them from the records we still have.
  return { schemaVersion: 1, sessions, totals: recomputeTotals(sessions) };
}

/**
 * A session counts as completed when a timed session ran to its end, or an indefinite session
 * lasted at least a minute before the user ended it. Abandoned sessions never count.
 */
export function countsAsCompleted(record: SessionRecord): boolean {
  if (record.outcome === 'completed') return true;
  return record.outcome === 'ended' && record.endedAt - record.startedAt >= 60_000;
}

function recomputeTotals(sessions: readonly SessionRecord[]): FocusHistory['totals'] {
  const completed = sessions.filter(countsAsCompleted);
  return {
    completedSessions: completed.length,
    completedMs: completed.reduce((sum, r) => sum + (r.endedAt - r.startedAt), 0),
  };
}

export async function loadAll(area: StorageArea): Promise<StoredData> {
  const raw = await area.get([STORAGE_KEYS.settings, STORAGE_KEYS.state, STORAGE_KEYS.history]);
  return {
    settings: sanitizeSettings(raw[STORAGE_KEYS.settings]),
    state: sanitizeState(raw[STORAGE_KEYS.state]),
    history: sanitizeHistory(raw[STORAGE_KEYS.history]),
  };
}

export async function saveData(area: StorageArea, data: Partial<StoredData>): Promise<void> {
  const items: Record<string, unknown> = {};
  if (data.settings) items[STORAGE_KEYS.settings] = data.settings;
  if (data.state) items[STORAGE_KEYS.state] = data.state;
  if (data.history) items[STORAGE_KEYS.history] = data.history;
  if (Object.keys(items).length > 0) await area.set(items);
}
