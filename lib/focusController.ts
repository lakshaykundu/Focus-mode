import type { FocusSession, SessionOutcome } from '@/types/focus';
import type { SettingsPatch, StateSnapshot } from '@/types/messages';
import type { FocusSettings, SessionDuration, SiteCategory } from '@/types/settings';
import { getBlockTargets, isHostBlocked, type BlockTarget } from './blockList';
import { normalizeDomain } from './domainUtils';
import { createMutex } from './mutex';
import { reconcileRules, type DnrApi } from './ruleManager';
import { siteId } from './siteRegistry';
import { appendSessionRecord } from './statistics';
import {
  createDefaultSettings,
  createIdleState,
  loadAll,
  sanitizeSettings,
  saveData,
  type StorageArea,
  type StoredData,
} from './storage';
import { createNavigationGuard, enforceOpenTabs, type TabsApi } from './tabEnforcer';
import { SESSION_ALARM, isExpired, validateDuration } from './timer';
import { isChannelId, isFilterLoosened, isVideoId } from './youtubeFilter';

/** The slice of `chrome.alarms` FocusGuard needs. */
export interface AlarmsApi {
  create(name: string, info: { when: number }): Promise<void>;
  clear(name: string): Promise<boolean>;
  get(name: string): Promise<{ scheduledTime: number } | undefined>;
}

export interface BadgeApi {
  update(active: boolean): Promise<void>;
}

export interface FocusDeps {
  storage: StorageArea;
  dnr: DnrApi;
  alarms: AlarmsApi;
  tabs: TabsApi;
  badge?: BadgeApi;
  now?: () => number;
  createId?: () => string;
}

/** An expected, user-facing failure (as opposed to a bug). Its message is shown in the UI. */
export class FocusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FocusError';
  }
}

/** Whether `next` still blocks everything `previous` blocked. */
function coversAll(previous: readonly BlockTarget[], next: readonly BlockTarget[]): boolean {
  return previous.every(
    (target) =>
      isHostBlocked(target.domain, next) &&
      // Every subdomain that used to be blocked must still be blocked too.
      next
        .filter((n) => n.domain === target.domain)
        .every((n) => n.excludedDomains.every((ex) => target.excludedDomains.includes(ex))),
  );
}

/**
 * The single owner of focus-session state transitions. Every public operation runs under a
 * mutex and re-reads storage first, so it stays correct no matter how often the MV3 service
 * worker is suspended, or how many extension pages send messages at once.
 */
export function createFocusController(deps: FocusDeps) {
  const now = deps.now ?? (() => Date.now());
  const createId = deps.createId ?? (() => crypto.randomUUID());
  const exclusive = createMutex();
  const navigationGuard = createNavigationGuard(deps.tabs, now);

  const snapshot = (data: Pick<StoredData, 'state' | 'settings'>): StateSnapshot => ({
    state: data.state,
    settings: data.settings,
  });

  async function setBadge(active: boolean): Promise<void> {
    try {
      await deps.badge?.update(active);
    } catch {
      // Cosmetic only.
    }
  }

  async function scheduleAlarm(session: FocusSession): Promise<void> {
    if (session.endsAt === null) {
      await deps.alarms.clear(SESSION_ALARM);
      return;
    }
    const existing = await deps.alarms.get(SESSION_ALARM);
    if (!existing || existing.scheduledTime !== session.endsAt) {
      await deps.alarms.create(SESSION_ALARM, { when: session.endsAt });
    }
  }

  /** Unblock, record the session, and return to idle. Rules are removed first. */
  async function finalize(
    data: StoredData,
    session: FocusSession,
    outcome: SessionOutcome,
    endedAt: number,
  ): Promise<StoredData> {
    await reconcileRules(deps.dnr, []);
    const history = appendSessionRecord(
      data.history,
      {
        id: session.id,
        startedAt: session.startedAt,
        endedAt: Math.max(session.startedAt, endedAt),
        plannedMinutes: session.durationMinutes,
        outcome,
      },
      now(),
    );
    const state = createIdleState(now());
    await saveData(deps.storage, { state, history });
    await deps.alarms.clear(SESSION_ALARM);
    await setBadge(false);
    return { ...data, state, history };
  }

  /** Complete the active session if its end time has passed. */
  async function settleExpired(data: StoredData): Promise<StoredData> {
    const session = data.state.activeSession;
    if (session && isExpired(session, now())) {
      return finalize(data, session, 'completed', session.endsAt!);
    }
    return data;
  }

  function isStrictLocked(data: StoredData): boolean {
    const session = data.state.activeSession;
    return session !== null && session.strictMode && !isExpired(session, now());
  }

  /**
   * Apply a settings change. During a session the block rules are updated first; if that fails
   * the change is not saved, so stored settings never claim protection that isn't installed.
   */
  async function mutateSettings(
    change: (settings: FocusSettings) => FocusSettings,
  ): Promise<StateSnapshot> {
    const data = await settleExpired(await loadAll(deps.storage));
    const next = change(data.settings);
    if (data.state.activeSession) {
      const before = getBlockTargets(data.settings);
      const after = getBlockTargets(next);
      if (isStrictLocked(data)) {
        if (!coversAll(before, after)) {
          throw new FocusError(
            'Strict Mode is on: you can block more sites, but not unblock any until the session ends.',
          );
        }
        if (data.settings.youtubePolicy === 'clean' && isFilterLoosened(data.settings.youtubeFilter, next.youtubeFilter)) {
          throw new FocusError(
            'Strict Mode is on: the YouTube filter can be tightened, but not loosened until the session ends.',
          );
        }
      }
      await reconcileRules(deps.dnr, after);
      await saveData(deps.storage, { settings: next });
      await enforceOpenTabs(deps.tabs, after, before);
    } else {
      await saveData(deps.storage, { settings: next });
    }
    return snapshot({ ...data, settings: next });
  }

  return {
    getSnapshot: () =>
      exclusive(async () => snapshot(await loadAll(deps.storage))),

    /** First install or update: persist sanitized/migrated data, then reconcile. */
    initialize: () =>
      exclusive(async () => {
        const data = await loadAll(deps.storage);
        await saveData(deps.storage, data);
      }),

    startSession: (duration: SessionDuration) =>
      exclusive(async () => {
        const valid = validateDuration(duration);
        if (!valid.ok) throw new FocusError(valid.error);
        const data = await settleExpired(await loadAll(deps.storage));
        if (data.state.activeSession) throw new FocusError('A focus session is already running.');

        const startedAt = now();
        const timed = valid.duration !== 'indefinite';
        const session: FocusSession = {
          id: createId(),
          startedAt,
          endsAt: timed ? startedAt + (valid.duration as number) * 60_000 : null,
          status: 'active',
          strictMode: timed && data.settings.strictMode,
          durationMinutes: timed ? (valid.duration as number) : null,
          allowedVideoIds: [],
        };

        const targets = getBlockTargets(data.settings);
        // Rules first: if Chrome rejects them, no session is recorded as active.
        await reconcileRules(deps.dnr, targets);
        const state = { enabled: true, activeSession: session, lastUpdatedAt: startedAt };
        try {
          await saveData(deps.storage, { state });
        } catch (error) {
          await reconcileRules(deps.dnr, []).catch(() => undefined);
          throw error;
        }
        await scheduleAlarm(session);
        await enforceOpenTabs(deps.tabs, targets);
        await setBadge(true);
        return snapshot({ ...data, state });
      }),

    endSession: (options: { emergencyOverride?: boolean } = {}) =>
      exclusive(async () => {
        let data = await loadAll(deps.storage);
        const session = data.state.activeSession;
        if (!session) {
          // Nothing active; still make sure nothing is left behind.
          await reconcileRules(deps.dnr, []);
          await deps.alarms.clear(SESSION_ALARM);
          await setBadge(false);
          return snapshot(data);
        }
        if (isExpired(session, now())) {
          data = await finalize(data, session, 'completed', session.endsAt!);
          return snapshot(data);
        }
        if (session.strictMode && !options.emergencyOverride) {
          throw new FocusError('Strict Mode is on. This session can only end when the timer finishes.');
        }
        const outcome: SessionOutcome =
          session.endsAt === null ? 'ended' : session.strictMode ? 'overridden' : 'stopped-early';
        data = await finalize(data, session, outcome, now());
        return snapshot(data);
      }),

    /**
     * Bring Chrome in line with stored state. Runs on install, browser startup, every service
     * worker wake-up, alarm, and whenever the popup's countdown reaches zero.
     */
    reconcile: () =>
      exclusive(async () => {
        const data = await settleExpired(await loadAll(deps.storage));
        const session = data.state.activeSession;
        if (session) {
          await reconcileRules(deps.dnr, getBlockTargets(data.settings));
          await scheduleAlarm(session);
          await setBadge(true);
        } else {
          await reconcileRules(deps.dnr, []);
          await deps.alarms.clear(SESSION_ALARM);
          await setBadge(false);
        }
        return snapshot(data);
      }),

    updateSettings: (patch: SettingsPatch) =>
      exclusive(() =>
        mutateSettings((settings) => {
          if (patch.defaultDuration !== undefined) {
            const valid = validateDuration(patch.defaultDuration);
            if (!valid.ok) throw new FocusError(valid.error);
          }
          if (patch.ui?.lastCustomMinutes !== undefined) {
            const valid = validateDuration(patch.ui.lastCustomMinutes);
            if (!valid.ok) throw new FocusError(valid.error);
          }
          return sanitizeSettings({
            ...settings,
            ...patch,
            cleanYouTube: { ...settings.cleanYouTube, ...patch.cleanYouTube },
            youtubeFilter: { ...settings.youtubeFilter, ...patch.youtubeFilter },
            ui: { ...settings.ui, ...patch.ui },
          });
        }),
      ),

    toggleSite: (id: string, enabled: boolean) =>
      exclusive(() =>
        mutateSettings((settings) => {
          if (!settings.sites.some((site) => site.id === id)) throw new FocusError('Site not found.');
          return {
            ...settings,
            sites: settings.sites.map((site) => (site.id === id ? { ...site, enabled } : site)),
          };
        }),
      ),

    toggleCategory: (category: SiteCategory, enabled: boolean) =>
      exclusive(() =>
        mutateSettings((settings) => ({
          ...settings,
          categories: { ...settings.categories, [category]: { enabled } },
        })),
      ),

    addCustomSite: (input: string) =>
      exclusive(() =>
        mutateSettings((settings) => {
          const normalized = normalizeDomain(input);
          if (!normalized.ok) throw new FocusError(normalized.error);
          const existing = settings.sites.find((site) => site.domain === normalized.domain);
          if (existing) {
            throw new FocusError(
              existing.enabled
                ? `${normalized.domain} is already on your list.`
                : `${normalized.domain} is already on your list (currently off).`,
            );
          }
          return {
            ...settings,
            sites: [
              ...settings.sites,
              {
                id: siteId(normalized.domain, true),
                domain: normalized.domain,
                category: 'custom',
                enabled: true,
                custom: true,
              },
            ],
          };
        }),
      ),

    removeSite: (id: string) =>
      exclusive(() =>
        mutateSettings((settings) => {
          const site = settings.sites.find((s) => s.id === id);
          if (!site) throw new FocusError('Site not found.');
          if (!site.custom) {
            throw new FocusError('Built-in sites can be turned off, but not removed.');
          }
          return { ...settings, sites: settings.sites.filter((s) => s.id !== id) };
        }),
      ),

    resetSettings: () => exclusive(() => mutateSettings(() => createDefaultSettings())),

    /** Let one YouTube video play for the rest of the current session (from the video overlay). */
    allowVideo: (videoId: string) =>
      exclusive(async () => {
        if (!isVideoId(videoId)) throw new FocusError('Invalid video.');
        const data = await settleExpired(await loadAll(deps.storage));
        const session = data.state.activeSession;
        if (!session) throw new FocusError('No focus session is running.');
        if (isStrictLocked(data)) {
          throw new FocusError('Strict Mode is on: videos can\'t be allowed until the session ends.');
        }
        if (session.allowedVideoIds.includes(videoId)) return snapshot(data);
        const state = {
          ...data.state,
          activeSession: { ...session, allowedVideoIds: [...session.allowedVideoIds, videoId] },
          lastUpdatedAt: now(),
        };
        await saveData(deps.storage, { state });
        return snapshot({ ...data, state });
      }),

    allowChannel: (channelId: string, name: string) =>
      exclusive(() =>
        mutateSettings((settings) => {
          if (!isChannelId(channelId)) throw new FocusError('Invalid channel.');
          if (settings.youtubeFilter.allowedChannels.some((c) => c.id === channelId)) return settings;
          return sanitizeSettings({
            ...settings,
            youtubeFilter: {
              ...settings.youtubeFilter,
              allowedChannels: [...settings.youtubeFilter.allowedChannels, { id: channelId, name }],
            },
          });
        }),
      ),

    removeAllowedChannel: (channelId: string) =>
      exclusive(() =>
        mutateSettings((settings) => ({
          ...settings,
          youtubeFilter: {
            ...settings.youtubeFilter,
            allowedChannels: settings.youtubeFilter.allowedChannels.filter((c) => c.id !== channelId),
          },
        })),
      ),

    /** Called for committed top-frame navigations. Read-only, so no mutex needed. */
    async handleTabUrlChange(tabId: number, url: string): Promise<boolean> {
      const data = await loadAll(deps.storage);
      const session = data.state.activeSession;
      if (!session || isExpired(session, now())) return false;
      return navigationGuard.check(tabId, url, getBlockTargets(data.settings));
    },

    forgetTab(tabId: number): void {
      navigationGuard.forget(tabId);
    },
  };
}

export type FocusController = ReturnType<typeof createFocusController>;
