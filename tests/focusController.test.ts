import { describe, expect, it } from 'vitest';
import { createFocusController, FocusError } from '@/lib/focusController';
import { RuleUpdateError } from '@/lib/ruleManager';
import { STORAGE_KEYS, createDefaultSettings, loadAll } from '@/lib/storage';
import { SESSION_ALARM } from '@/lib/timer';
import { createFakeDeps } from './helpers/fakes';

const MIN = 60_000;

function setup() {
  const fakes = createFakeDeps();
  const controller = createFocusController(fakes.deps);
  return { ...fakes, controller };
}

describe('starting a session', () => {
  it('starts a timed session: timestamps, rules, alarm', async () => {
    const { controller, dnr, alarms, clock, storage } = setup();
    const { state } = await controller.startSession(25);

    expect(state.enabled).toBe(true);
    expect(state.activeSession).toMatchObject({
      startedAt: clock.now,
      endsAt: clock.now + 25 * MIN,
      durationMinutes: 25,
      strictMode: false,
      status: 'active',
    });
    expect(dnr.blockedDomains()).toContain('instagram.com');
    expect(alarms.alarms.get(SESSION_ALARM)).toBe(clock.now + 25 * MIN);
    expect((await loadAll(storage)).state).toEqual(state);
  });

  it('starts an indefinite session with no end time and no alarm', async () => {
    const { controller, alarms } = setup();
    const { state } = await controller.startSession('indefinite');
    expect(state.activeSession?.endsAt).toBeNull();
    expect(state.activeSession?.durationMinutes).toBeNull();
    expect(alarms.alarms.has(SESSION_ALARM)).toBe(false);
  });

  it('never applies Strict Mode to indefinite sessions', async () => {
    const { controller, storage } = setup();
    await storage.set({ [STORAGE_KEYS.settings]: { ...createDefaultSettings(), strictMode: true } });
    const { state } = await controller.startSession('indefinite');
    expect(state.activeSession?.strictMode).toBe(false);
  });

  it('reloads already-open distracting tabs, and only those', async () => {
    const { controller, tabs } = setup();
    tabs.tabs = [
      { id: 1, url: 'https://www.instagram.com/explore/' },
      { id: 2, url: 'https://developer.mozilla.org/en-US/' },
      { id: 3, url: 'https://fakeinstagram.com/' },
      { id: 4, url: 'https://m.reddit.com/r/all', discarded: true },
      { id: 5, url: 'chrome://extensions/' },
      { id: 6, url: 'https://old.reddit.com/' },
    ];
    await controller.startSession(25);
    expect(tabs.reloaded.sort()).toEqual([1, 6]);
  });

  it('rejects a second session while one is running', async () => {
    const { controller } = setup();
    await controller.startSession(25);
    await expect(controller.startSession(45)).rejects.toThrow('already running');
  });

  it.each([0, -5, 721, 2.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid custom duration %j',
    async (duration) => {
      const { controller, dnr, storage } = setup();
      await expect(controller.startSession(duration)).rejects.toBeInstanceOf(FocusError);
      expect(dnr.rules.size).toBe(0);
      expect((await loadAll(storage)).state.enabled).toBe(false);
    },
  );

  it('accepts custom durations within 1–720 minutes', async () => {
    const { controller } = setup();
    const { state } = await controller.startSession(720);
    expect(state.activeSession?.durationMinutes).toBe(720);
  });

  it('does not record an active session if Chrome rejects the block rules', async () => {
    const { controller, dnr, storage, alarms } = setup();
    dnr.failNextUpdate = 'Internal error';
    await expect(controller.startSession(25)).rejects.toBeInstanceOf(RuleUpdateError);
    expect((await loadAll(storage)).state.enabled).toBe(false);
    expect(alarms.alarms.size).toBe(0);
  });

  it('rolls the rules back if the session cannot be saved', async () => {
    const { controller, dnr, storage } = setup();
    storage.failNextSet = true;
    await expect(controller.startSession(25)).rejects.toThrow();
    expect(dnr.rules.size).toBe(0);
  });
});

describe('ending a session', () => {
  it('removes rules and alarm, clears state, preserves preferences', async () => {
    const { controller, dnr, alarms, storage, advance } = setup();
    await controller.toggleSite('default:reddit.com', false);
    await controller.startSession(25);
    advance(10 * MIN);
    const { state, settings } = await controller.endSession();

    expect(state).toMatchObject({ enabled: false, activeSession: null });
    expect(dnr.rules.size).toBe(0);
    expect(alarms.alarms.size).toBe(0);
    expect(settings.sites.find((s) => s.domain === 'reddit.com')?.enabled).toBe(false);

    const { history } = await loadAll(storage);
    expect(history.sessions).toHaveLength(1);
    expect(history.sessions[0]).toMatchObject({ outcome: 'stopped-early', plannedMinutes: 25 });
    expect(history.totals.completedSessions).toBe(0); // early stops don't count
  });

  it('records an ended indefinite session as completed focus time', async () => {
    const { controller, storage, advance } = setup();
    await controller.startSession('indefinite');
    advance(40 * MIN);
    await controller.endSession();
    const { history } = await loadAll(storage);
    expect(history.sessions[0]?.outcome).toBe('ended');
    expect(history.totals).toEqual({ completedSessions: 1, completedMs: 40 * MIN });
  });

  it('Strict Mode blocks ending early unless the emergency override is used', async () => {
    const { controller, storage, dnr, advance } = setup();
    await controller.updateSettings({ strictMode: true });
    await controller.startSession(45);
    advance(5 * MIN);

    await expect(controller.endSession()).rejects.toThrow('Strict Mode');
    expect(dnr.rules.size).toBeGreaterThan(0);

    const { state } = await controller.endSession({ emergencyOverride: true });
    expect(state.enabled).toBe(false);
    expect((await loadAll(storage)).history.sessions[0]?.outcome).toBe('overridden');
  });

  it('Strict Mode prevents unblocking sites mid-session but allows adding more', async () => {
    const { controller, dnr } = setup();
    await controller.updateSettings({ strictMode: true });
    await controller.startSession(45);

    await expect(controller.toggleSite('default:instagram.com', false)).rejects.toThrow('Strict Mode');
    await expect(controller.toggleCategory('social', false)).rejects.toThrow('Strict Mode');
    await expect(controller.updateSettings({ youtubePolicy: 'clean' })).rejects.toThrow('Strict Mode');
    await expect(controller.toggleSite('default:music.youtube.com', false)).rejects.toThrow('Strict Mode');
    await expect(controller.resetSettings()).resolves.toBeDefined(); // defaults block everything

    await controller.addCustomSite('news.ycombinator.com');
    expect(dnr.blockedDomains()).toContain('news.ycombinator.com');
    expect(dnr.blockedDomains()).toContain('instagram.com');
  });

  it('ending with no active session is a safe no-op that cleans up stray rules', async () => {
    const { controller, dnr } = setup();
    await dnr.updateDynamicRules({
      removeRuleIds: [],
      addRules: [{ id: 1_000_123, priority: 1, action: { type: 'block' }, condition: { requestDomains: ['x.com'], resourceTypes: ['main_frame'] } }],
    });
    const { state } = await controller.endSession();
    expect(state.enabled).toBe(false);
    expect(dnr.rules.size).toBe(0);
  });
});

describe('expiration', () => {
  it('the alarm completes an expired session and records it', async () => {
    const { controller, dnr, alarms, storage, clock, advance } = setup();
    await controller.startSession(25);
    const startedAt = clock.now;
    advance(25 * MIN + 1500); // alarms may fire a little late

    const { state } = await controller.reconcile();
    expect(state.enabled).toBe(false);
    expect(dnr.rules.size).toBe(0);
    expect(alarms.alarms.size).toBe(0);
    const { history } = await loadAll(storage);
    // Recorded with the planned end time, not the (late) alarm time.
    expect(history.sessions[0]).toMatchObject({ outcome: 'completed', startedAt, endedAt: startedAt + 25 * MIN });
    expect(history.totals).toEqual({ completedSessions: 1, completedMs: 25 * MIN });
  });

  it('reconcile before expiry keeps the session running', async () => {
    const { controller, advance } = setup();
    await controller.startSession(25);
    advance(24 * MIN);
    expect((await controller.reconcile()).state.enabled).toBe(true);
  });

  it('a strict session can be ended normally once its time is up', async () => {
    const { controller, storage, advance } = setup();
    await controller.updateSettings({ strictMode: true });
    await controller.startSession(25);
    advance(26 * MIN);
    await controller.endSession();
    expect((await loadAll(storage)).history.sessions[0]?.outcome).toBe('completed');
  });

  it('indefinite sessions never expire on their own', async () => {
    const { controller, advance } = setup();
    await controller.startSession('indefinite');
    advance(48 * 60 * MIN);
    expect((await controller.reconcile()).state.enabled).toBe(true);
  });
});

describe('browser restart / service worker wake-up', () => {
  it('restores rules and a missing alarm for a session still in progress', async () => {
    const { deps, dnr, alarms, advance } = createFakeDeps();
    await createFocusController(deps).startSession(60);
    // Simulate Chrome dropping both the alarm and the dynamic rules.
    alarms.alarms.clear();
    dnr.rules.clear();
    advance(20 * MIN);

    const restarted = createFocusController(deps); // fresh worker, same storage
    const { state } = await restarted.reconcile();
    expect(state.enabled).toBe(true);
    expect(dnr.blockedDomains()).toContain('instagram.com');
    expect(alarms.alarms.get(SESSION_ALARM)).toBe(state.activeSession!.endsAt);
  });

  it('completes a session that expired while the browser was closed', async () => {
    const { deps, dnr, storage, advance } = createFakeDeps();
    await createFocusController(deps).startSession(25);
    advance(3 * 60 * MIN);

    const { state } = await createFocusController(deps).reconcile();
    expect(state.enabled).toBe(false);
    expect(dnr.rules.size).toBe(0);
    expect((await loadAll(storage)).history.sessions[0]?.outcome).toBe('completed');
  });

  it('removes stale FocusGuard rules when no session is active', async () => {
    const { deps, dnr } = createFakeDeps();
    const controller = createFocusController(deps);
    await controller.startSession(25);
    // State lost/corrupted, rules left behind.
    await deps.storage.set({ [STORAGE_KEYS.state]: 'garbage' });
    await createFocusController(deps).reconcile();
    expect(dnr.rules.size).toBe(0);
  });

  it('is idempotent across repeated wake-ups', async () => {
    const { deps, dnr } = createFakeDeps();
    await createFocusController(deps).startSession(25);
    const calls = dnr.updateCalls;
    await createFocusController(deps).reconcile();
    await createFocusController(deps).reconcile();
    expect(dnr.updateCalls).toBe(calls);
  });
});

describe('settings while focusing', () => {
  it('category changes apply to live rules and reload newly blocked tabs', async () => {
    const { controller, dnr, tabs } = setup();
    await controller.toggleCategory('music', false);
    tabs.tabs = [
      { id: 1, url: 'https://open.spotify.com/' },
      { id: 2, url: 'https://www.instagram.com/' },
    ];
    await controller.startSession(25);
    expect(dnr.blockedDomains()).not.toContain('spotify.com');
    expect(tabs.reloaded).toEqual([2]);

    await controller.toggleCategory('music', true);
    expect(dnr.blockedDomains()).toContain('spotify.com');
    // Only the newly blocked Spotify tab is reloaded; Instagram was already blocked.
    expect(tabs.reloaded).toEqual([2, 1]);
  });

  it('does not save a setting if the rule update fails', async () => {
    const { controller, dnr, storage } = setup();
    await controller.startSession('indefinite');
    dnr.failNextUpdate = 'boom';
    await expect(controller.addCustomSite('example.com')).rejects.toBeInstanceOf(RuleUpdateError);
    const { settings } = await loadAll(storage);
    expect(settings.sites.some((s) => s.domain === 'example.com')).toBe(false);
  });

  it('serializes concurrent operations', async () => {
    const { controller, storage } = setup();
    await Promise.all([
      controller.addCustomSite('a.com'),
      controller.addCustomSite('b.com'),
      controller.addCustomSite('c.com'),
      controller.toggleSite('default:x.com', false),
    ]);
    const { settings } = await loadAll(storage);
    expect(settings.sites.filter((s) => s.custom).map((s) => s.domain)).toEqual(['a.com', 'b.com', 'c.com']);
    expect(settings.sites.find((s) => s.domain === 'x.com')?.enabled).toBe(false);
  });
});

describe('custom sites', () => {
  it('normalizes input and rejects duplicates', async () => {
    const { controller } = setup();
    const { settings } = await controller.addCustomSite('https://www.Example.com/path');
    expect(settings.sites.at(-1)).toEqual({ id: 'custom:example.com', domain: 'example.com', category: 'custom', enabled: true, custom: true });
    await expect(controller.addCustomSite('example.com')).rejects.toThrow('already on your list');
    await expect(controller.addCustomSite('instagram.com')).rejects.toThrow('already on your list');
    await expect(controller.addCustomSite('not a domain')).rejects.toBeInstanceOf(FocusError);
  });

  it('removes custom sites but refuses to remove built-in ones', async () => {
    const { controller } = setup();
    await controller.addCustomSite('example.com');
    const { settings } = await controller.removeSite('custom:example.com');
    expect(settings.sites.some((s) => s.domain === 'example.com')).toBe(false);
    await expect(controller.removeSite('default:instagram.com')).rejects.toThrow('Built-in');
  });
});

describe('tab URL changes (bfcache / client-side navigation)', () => {
  it('reloads a tab that lands on a blocked host during a session, without looping', async () => {
    const { controller, tabs } = setup();
    tabs.tabs = [{ id: 9, url: 'https://example.org/' }];
    expect(await controller.handleTabUrlChange(9, 'https://www.instagram.com/')).toBe(false); // no session
    await controller.startSession(25);
    expect(await controller.handleTabUrlChange(9, 'https://www.instagram.com/')).toBe(true);
    expect(await controller.handleTabUrlChange(9, 'https://www.instagram.com/')).toBe(false); // deduped
    expect(await controller.handleTabUrlChange(9, 'https://docs.python.org/')).toBe(false);
  });
});
