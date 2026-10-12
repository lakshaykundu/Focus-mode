import { describe, expect, it } from 'vitest';
import { createDefaultSites } from '@/lib/siteRegistry';
import {
  STORAGE_KEYS,
  createDefaultSettings,
  loadAll,
  sanitizeHistory,
  sanitizeSettings,
  sanitizeState,
} from '@/lib/storage';
import { FakeStorage } from './helpers/fakes';

describe('sanitizeSettings', () => {
  it('returns defaults on first install or garbage', async () => {
    const defaults = createDefaultSettings();
    expect(sanitizeSettings(undefined)).toEqual(defaults);
    expect(sanitizeSettings('corrupted')).toEqual(defaults);
    expect(sanitizeSettings([1, 2, 3])).toEqual(defaults);
    expect((await loadAll(new FakeStorage())).settings).toEqual(defaults);
  });

  it('repairs individual invalid fields and keeps valid ones', () => {
    const settings = sanitizeSettings({
      defaultDuration: -4,
      strictMode: 'yes',
      youtubePolicy: 'clean',
      categories: { social: { enabled: false }, music: 'nope' },
      cleanYouTube: { hideComments: true, hideShorts: 0 },
      ui: { lastCustomMinutes: 5000 },
    });
    expect(settings.defaultDuration).toBe(25);
    expect(settings.strictMode).toBe(false);
    expect(settings.youtubePolicy).toBe('clean');
    expect(settings.categories.social.enabled).toBe(false);
    expect(settings.categories.music.enabled).toBe(true);
    expect(settings.cleanYouTube.hideComments).toBe(true);
    expect(settings.cleanYouTube.hideShorts).toBe(true);
    expect(settings.ui.lastCustomMinutes).toBe(30);
  });

  it('keeps stored site preferences and normalizes and dedupes custom sites', () => {
    const settings = sanitizeSettings({
      sites: [
        { id: 'default:reddit.com', domain: 'reddit.com', category: 'social', enabled: false, custom: false },
        { domain: 'https://www.Example.com/', custom: true, enabled: true },
        { domain: 'example.com', custom: true, enabled: false },
        { domain: '   ', custom: true },
        { domain: 42 },
        null,
      ],
    });
    expect(settings.sites.find((s) => s.domain === 'reddit.com')?.enabled).toBe(false);
    const custom = settings.sites.filter((s) => s.custom);
    expect(custom).toEqual([{ id: 'custom:example.com', domain: 'example.com', category: 'custom', enabled: true, custom: true }]);
  });

  it('migrates older data by adding new built-in sites', () => {
    // An older version that only knew about two social sites.
    const settings = sanitizeSettings({
      sites: [
        { domain: 'instagram.com', category: 'social', enabled: false },
        { domain: 'facebook.com', category: 'social', enabled: true },
      ],
    });
    expect(settings.sites.filter((s) => !s.custom)).toHaveLength(createDefaultSites().length);
    expect(settings.sites.find((s) => s.domain === 'instagram.com')?.enabled).toBe(false);
    expect(settings.sites.find((s) => s.domain === 'netflix.com')?.enabled).toBe(true);
    expect(settings.schemaVersion).toBe(1);
  });
});

describe('sanitizeState', () => {
  it('derives enabled from a valid session', () => {
    const session = { id: 's', startedAt: 1000, endsAt: 61_000, status: 'active', strictMode: true, durationMinutes: 1 };
    expect(sanitizeState({ enabled: false, activeSession: session, lastUpdatedAt: 5 })).toEqual({
      enabled: true,
      activeSession: session,
      lastUpdatedAt: 5,
    });
  });

  it('drops corrupted sessions', () => {
    expect(sanitizeState({ enabled: true, activeSession: { id: 's', startedAt: 'x' } }).enabled).toBe(false);
    expect(sanitizeState({ enabled: true, activeSession: { id: 's', startedAt: 10, endsAt: 5 } }).activeSession).toBeNull();
    expect(sanitizeState(null).enabled).toBe(false);
  });

  it('accepts indefinite sessions and strips Strict Mode from them', () => {
    const state = sanitizeState({ activeSession: { id: 's', startedAt: 10, endsAt: null, strictMode: true } });
    expect(state.activeSession).toMatchObject({ endsAt: null, strictMode: false, durationMinutes: null });
  });
});

describe('sanitizeHistory', () => {
  it('drops invalid records and rebuilds missing totals', () => {
    const history = sanitizeHistory({
      sessions: [
        { id: 'a', startedAt: 0, endedAt: 25 * 60_000, plannedMinutes: 25, outcome: 'completed' },
        { id: 'b', startedAt: 10, endedAt: 5, outcome: 'completed' },
        { id: 'c', startedAt: 0, endedAt: 10, outcome: 'won' },
      ],
      totals: 'bad',
    });
    expect(history.sessions.map((s) => s.id)).toEqual(['a']);
    expect(history.totals).toEqual({ completedSessions: 1, completedMs: 25 * 60_000 });
  });

  it('round-trips through storage', async () => {
    const storage = new FakeStorage();
    const history = sanitizeHistory({ sessions: [], totals: { completedSessions: 3, completedMs: 9 } });
    await storage.set({ [STORAGE_KEYS.history]: history });
    expect((await loadAll(storage)).history).toEqual(history);
  });
});

describe('validateDuration', async () => {
  const { validateDuration } = await import('@/lib/timer');
  it('accepts presets, custom whole minutes (including numeric strings from inputs) and indefinite', () => {
    expect(validateDuration(25)).toEqual({ ok: true, duration: 25 });
    expect(validateDuration('90')).toEqual({ ok: true, duration: 90 });
    expect(validateDuration(1)).toEqual({ ok: true, duration: 1 });
    expect(validateDuration(720)).toEqual({ ok: true, duration: 720 });
    expect(validateDuration('indefinite')).toEqual({ ok: true, duration: 'indefinite' });
  });
  it('rejects everything else with a readable message', () => {
    expect(validateDuration('')).toMatchObject({ ok: false, error: 'Enter a number of minutes' });
    expect(validateDuration('abc')).toMatchObject({ ok: false });
    expect(validateDuration(10.5)).toMatchObject({ ok: false, error: 'Use whole minutes' });
    expect(validateDuration(0)).toMatchObject({ ok: false, error: 'Choose between 1 and 720 minutes' });
    expect(validateDuration(null)).toMatchObject({ ok: false });
  });
});
