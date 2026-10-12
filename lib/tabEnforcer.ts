import { isHostBlocked, type BlockTarget } from './blockList';
import { hostnameFromUrl } from './domainUtils';

export interface TabInfo {
  id?: number;
  url?: string;
  discarded?: boolean;
}

/** The slice of `chrome.tabs` FocusGuard needs. */
export interface TabsApi {
  query(queryInfo: Record<string, never>): Promise<TabInfo[]>;
  reload(tabId: number): Promise<void>;
}

/**
 * Reload open tabs that are newly blocked, so the reload's top-level navigation hits the
 * declarativeNetRequest block rule. Tabs that were already blocked by `previousTargets`, tabs on
 * unrelated sites, and discarded tabs (which reload through the rules when activated) are left
 * alone. Returns the IDs of reloaded tabs.
 */
export async function enforceOpenTabs(
  tabs: TabsApi,
  targets: readonly BlockTarget[],
  previousTargets: readonly BlockTarget[] = [],
): Promise<number[]> {
  if (targets.length === 0) return [];
  const open = await tabs.query({});
  const reloaded: number[] = [];
  await Promise.all(
    open.map(async (tab) => {
      const host = hostnameFromUrl(tab.url);
      if (tab.id === undefined || tab.discarded || !host) return;
      if (!isHostBlocked(host, targets) || isHostBlocked(host, previousTargets)) return;
      try {
        await tabs.reload(tab.id);
        reloaded.push(tab.id);
      } catch {
        // The tab closed between query and reload; nothing to enforce.
      }
    }),
  );
  return reloaded.sort((a, b) => a - b);
}

/**
 * Catches committed navigations that didn't produce a blockable network request: back/forward
 * cache restores and client-side (history API) navigation inside a page that loaded before focus
 * began. Reloading forces a real navigation, which the block rule then stops.
 *
 * A short per-tab dedupe guards against reload loops if a page keeps rewriting its URL.
 */
export function createNavigationGuard(tabs: TabsApi, now: () => number, dedupeMs = 3000) {
  const recent = new Map<number, { url: string; at: number }>();
  return {
    async check(tabId: number, url: string, targets: readonly BlockTarget[]): Promise<boolean> {
      const host = hostnameFromUrl(url);
      if (!host || !isHostBlocked(host, targets)) return false;
      const last = recent.get(tabId);
      const t = now();
      if (last && last.url === url && t - last.at < dedupeMs) return false;
      recent.set(tabId, { url, at: t });
      try {
        await tabs.reload(tabId);
        return true;
      } catch {
        return false;
      }
    },
    forget(tabId: number): void {
      recent.delete(tabId);
    },
  };
}
