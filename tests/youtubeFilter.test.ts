import { describe, expect, it } from 'vitest';
import { createDefaultYouTubeFilter } from '@/lib/storage';
import { parseBridgeDetail, watchVideoId } from '@/lib/youtubeBridge';
import { categoryIdFromName } from '@/lib/youtubeCategories';
import { decideVideo, isFilterLoosened, type VideoMetadata } from '@/lib/youtubeFilter';
import type { YouTubeFilterSettings } from '@/types/settings';

const video = (category: string | null, extra: Partial<VideoMetadata> = {}): VideoMetadata => ({
  videoId: 'thsUZEzL8ts',
  category,
  channelId: 'UCowumzu6ojutpuj-wzqTIcA',
  channelName: 'Code Sketched',
  title: 'Some video',
  ...extra,
});
const filter = (overrides: Partial<YouTubeFilterSettings> = {}): YouTubeFilterSettings => ({
  ...createDefaultYouTubeFilter(),
  ...overrides,
});

describe('categoryIdFromName', () => {
  it('maps the names YouTube reports, case-insensitively', () => {
    expect(categoryIdFromName('Education')).toBe('education');
    expect(categoryIdFromName('Science & Technology')).toBe('science');
    expect(categoryIdFromName('science and technology')).toBe('science');
    expect(categoryIdFromName('  Howto & Style ')).toBe('howto');
    expect(categoryIdFromName('People & Blogs')).toBe('people');
  });
  it('returns null for missing or non-assignable categories', () => {
    expect(categoryIdFromName(null)).toBeNull();
    expect(categoryIdFromName('')).toBeNull();
    expect(categoryIdFromName('Trailers')).toBeNull();
  });
});

describe('decideVideo', () => {
  it('allows the default study categories and blocks entertainment (real examples)', () => {
    // Categories observed on live YouTube for these titles.
    expect(decideVideo(video('Education'), filter(), null)).toEqual({ allowed: true, reason: 'category' });
    expect(decideVideo(video('Science & Technology'), filter(), null).allowed).toBe(true);
    expect(decideVideo(video('Comedy'), filter(), null)).toEqual({ allowed: false, reason: 'category', category: 'Comedy' });
    expect(decideVideo(video('Gaming'), filter(), null).allowed).toBe(false);
    expect(decideVideo(video('Music'), filter(), null).allowed).toBe(false);
  });

  it('respects the configured categories', () => {
    expect(decideVideo(video('Music'), filter({ allowedCategories: ['music'] }), null).allowed).toBe(true);
    expect(decideVideo(video('Education'), filter({ allowedCategories: [] }), null).allowed).toBe(false);
  });

  it('applies the unknown policy explicitly when the category is unavailable', () => {
    expect(decideVideo(video(null), filter({ unknownPolicy: 'allow' }), null)).toEqual({ allowed: true, reason: 'unknown-allowed' });
    expect(decideVideo(video(null), filter({ unknownPolicy: 'block' }), null)).toEqual({ allowed: false, reason: 'unknown', category: null });
    expect(decideVideo(video('Trailers'), filter({ unknownPolicy: 'block' }), null)).toMatchObject({ allowed: false, reason: 'unknown' });
  });

  it('allowed channels and session-allowed videos override the category', () => {
    const music = video('Music');
    const withChannel = filter({ allowedChannels: [{ id: 'UCowumzu6ojutpuj-wzqTIcA', name: 'Code Sketched' }] });
    expect(decideVideo(music, withChannel, null)).toEqual({ allowed: true, reason: 'channel' });
    expect(decideVideo(music, filter(), { allowedVideoIds: ['thsUZEzL8ts'] })).toEqual({ allowed: true, reason: 'video' });
    expect(decideVideo(video('Music', { channelId: null }), withChannel, null).allowed).toBe(false);
  });
});

describe('isFilterLoosened', () => {
  const base = filter({ unknownPolicy: 'block' });
  it('detects every way of letting more through', () => {
    expect(isFilterLoosened(base, { ...base, enabled: false })).toBe(true);
    expect(isFilterLoosened(base, { ...base, unknownPolicy: 'allow' })).toBe(true);
    expect(isFilterLoosened(base, { ...base, allowedCategories: [...base.allowedCategories, 'music'] })).toBe(true);
    expect(isFilterLoosened(base, { ...base, allowedChannels: [{ id: 'UCowumzu6ojutpuj-wzqTIcA', name: 'x' }] })).toBe(true);
  });
  it('treats tightening as safe', () => {
    expect(isFilterLoosened(base, base)).toBe(false);
    expect(isFilterLoosened(base, { ...base, allowedCategories: ['education'] })).toBe(false);
    expect(isFilterLoosened({ ...base, enabled: false }, base)).toBe(false);
  });
});

describe('bridge parsing', () => {
  it('accepts well-formed metadata and trims it', () => {
    const detail = JSON.stringify({ videoId: 'thsUZEzL8ts', category: ' Education ', channelId: 'UCowumzu6ojutpuj-wzqTIcA', channelName: 'Code Sketched', title: 'React' });
    expect(parseBridgeDetail(detail)).toEqual({ videoId: 'thsUZEzL8ts', category: 'Education', channelId: 'UCowumzu6ojutpuj-wzqTIcA', channelName: 'Code Sketched', title: 'React' });
  });
  it('handles non-watch pages and rejects malformed input', () => {
    expect(parseBridgeDetail(JSON.stringify({ videoId: null }))).toBeNull();
    expect(parseBridgeDetail({ videoId: 'thsUZEzL8ts' })).toBeUndefined(); // must be a JSON string
    expect(parseBridgeDetail('not json')).toBeUndefined();
    expect(parseBridgeDetail(JSON.stringify({ videoId: '<script>' }))).toBeUndefined();
    expect(parseBridgeDetail(JSON.stringify({ videoId: 'thsUZEzL8ts', channelId: 'evil', category: 42 }))).toMatchObject({ channelId: null, category: null });
  });
  it('reads the video ID from watch URLs only', () => {
    expect(watchVideoId('https://www.youtube.com/watch?v=thsUZEzL8ts&list=x')).toBe('thsUZEzL8ts');
    expect(watchVideoId('https://www.youtube.com/results?search_query=react')).toBeNull();
    expect(watchVideoId('https://www.youtube.com/watch')).toBeNull();
  });
});
