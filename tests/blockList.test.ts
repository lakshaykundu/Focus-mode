import { describe, expect, it } from 'vitest';
import { countActiveSites, getBlockTargets, isCleanYouTubeActive, isHostBlocked } from '@/lib/blockList';
import { createDefaultSettings, createIdleState } from '@/lib/storage';
import type { FocusSettings } from '@/types/settings';

const domains = (settings: FocusSettings) => getBlockTargets(settings).map((t) => t.domain);
const withSite = (settings: FocusSettings, domain: string, enabled: boolean): FocusSettings => ({
  ...settings,
  sites: settings.sites.map((s) => (s.domain === domain ? { ...s, enabled } : s)),
});

describe('getBlockTargets', () => {
  it('blocks every default site by default', () => {
    const settings = createDefaultSettings();
    expect(domains(settings)).toHaveLength(15);
    expect(domains(settings)).toContain('instagram.com');
    expect(domains(settings)).toContain('music.youtube.com');
  });

  it('respects individual site toggles', () => {
    const settings = withSite(createDefaultSettings(), 'reddit.com', false);
    expect(domains(settings)).not.toContain('reddit.com');
    expect(domains(settings)).toContain('instagram.com');
  });

  it('disabling a category removes all of its sites but keeps their preferences', () => {
    const base = withSite(createDefaultSettings(), 'x.com', false);
    const off = { ...base, categories: { ...base.categories, social: { enabled: false } } };
    expect(domains(off).some((d) => ['instagram.com', 'facebook.com', 'tiktok.com', 'reddit.com'].includes(d))).toBe(false);
    expect(countActiveSites(off, 'social')).toEqual({ enabled: 4, total: 5 });

    const on = { ...off, categories: { ...off.categories, social: { enabled: true } } };
    expect(domains(on)).toContain('instagram.com');
    expect(domains(on)).not.toContain('x.com');
  });

  it('includes custom sites, controlled by the custom category', () => {
    const base = createDefaultSettings();
    const settings: FocusSettings = {
      ...base,
      sites: [...base.sites, { id: 'custom:news.ycombinator.com', domain: 'news.ycombinator.com', category: 'custom', enabled: true, custom: true }],
    };
    expect(domains(settings)).toContain('news.ycombinator.com');
    const off = { ...settings, categories: { ...settings.categories, custom: { enabled: false } } };
    expect(domains(off)).not.toContain('news.ycombinator.com');
  });

  it('Block YouTube blocks youtube.com and YouTube Music independently', () => {
    const settings = createDefaultSettings();
    expect(settings.youtubePolicy).toBe('block');
    expect(domains(settings)).toEqual(expect.arrayContaining(['youtube.com', 'music.youtube.com']));
    const youtube = getBlockTargets(settings).find((t) => t.domain === 'youtube.com');
    expect(youtube?.excludedDomains).toEqual([]);
  });

  it('keeps YouTube Music reachable when only youtube.com is blocked', () => {
    const settings = withSite(createDefaultSettings(), 'music.youtube.com', false);
    const targets = getBlockTargets(settings);
    expect(targets.find((t) => t.domain === 'youtube.com')?.excludedDomains).toEqual(['music.youtube.com']);
    expect(isHostBlocked('www.youtube.com', targets)).toBe(true);
    expect(isHostBlocked('music.youtube.com', targets)).toBe(false);
  });

  it('Clean YouTube never adds a youtube.com block rule, but YouTube Music stays blockable', () => {
    const settings = { ...createDefaultSettings(), youtubePolicy: 'clean' as const };
    const targets = getBlockTargets(settings);
    expect(domains(settings)).not.toContain('youtube.com');
    expect(isHostBlocked('www.youtube.com', targets)).toBe(false);
    expect(isHostBlocked('music.youtube.com', targets)).toBe(true);
  });
});

describe('isCleanYouTubeActive', () => {
  const active = { enabled: true, activeSession: null, lastUpdatedAt: 0 };
  it('requires a session, the clean policy, and YouTube enabled', () => {
    const clean = { ...createDefaultSettings(), youtubePolicy: 'clean' as const };
    expect(isCleanYouTubeActive(clean, active)).toBe(true);
    expect(isCleanYouTubeActive(clean, createIdleState())).toBe(false);
    expect(isCleanYouTubeActive(createDefaultSettings(), active)).toBe(false);
    expect(isCleanYouTubeActive(withSite(clean, 'youtube.com', false), active)).toBe(false);
  });
});
