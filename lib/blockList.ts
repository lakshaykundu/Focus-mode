import type { FocusState } from '@/types/focus';
import type { BlockedSite, FocusSettings, SiteCategory } from '@/types/settings';
import { isSubdomainOf, matchesDomain } from './domainUtils';
import { YOUTUBE_DOMAIN } from './siteRegistry';

/** One domain to block, plus known subdomains the user has explicitly left unblocked. */
export interface BlockTarget {
  domain: string;
  excludedDomains: string[];
}

/** A site is in effect when both it and its category are enabled. */
export function isSiteActive(site: BlockedSite, settings: FocusSettings): boolean {
  return site.enabled && settings.categories[site.category].enabled;
}

/** Whether a site's traffic is blocked by network rules (YouTube in clean mode is not). */
function isSiteNetworkBlocked(site: BlockedSite, settings: FocusSettings): boolean {
  if (!isSiteActive(site, settings)) return false;
  if (site.domain === YOUTUBE_DOMAIN && settings.youtubePolicy === 'clean') return false;
  return true;
}

/**
 * The full set of domains FocusGuard blocks during a session, sorted for stable output.
 *
 * Exclusions keep independently-toggled subdomains independent: blocking youtube.com while
 * music.youtube.com is switched off must leave YouTube Music reachable.
 */
export function getBlockTargets(settings: FocusSettings): BlockTarget[] {
  const blocked = new Set<string>();
  const notBlocked = new Set<string>();
  for (const site of settings.sites) {
    if (isSiteNetworkBlocked(site, settings)) blocked.add(site.domain);
    else notBlocked.add(site.domain);
  }
  // A domain listed twice (e.g. once disabled, once enabled) is blocked.
  for (const domain of blocked) notBlocked.delete(domain);

  return [...blocked].sort().map((domain) => ({
    domain,
    excludedDomains: [...notBlocked].filter((other) => isSubdomainOf(other, domain)).sort(),
  }));
}

/** Whether navigating to `host` would be blocked by the given targets. */
export function isHostBlocked(host: string, targets: readonly BlockTarget[]): boolean {
  return targets.some(
    (target) =>
      matchesDomain(host, target.domain) &&
      !target.excludedDomains.some((excluded) => matchesDomain(host, excluded)),
  );
}

export function countActiveSites(settings: FocusSettings, category: SiteCategory): {
  enabled: number;
  total: number;
} {
  const sites = settings.sites.filter((site) => site.category === category);
  return { enabled: sites.filter((site) => site.enabled).length, total: sites.length };
}

/** Clean YouTube applies only during a session, with YouTube enabled and the clean policy chosen. */
export function isCleanYouTubeActive(settings: FocusSettings, state: FocusState): boolean {
  if (!state.enabled || settings.youtubePolicy !== 'clean') return false;
  const youtube = settings.sites.find((site) => site.domain === YOUTUBE_DOMAIN);
  return youtube !== undefined && isSiteActive(youtube, settings);
}
