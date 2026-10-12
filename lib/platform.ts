import { browser, type Browser } from 'wxt/browser';
import type { FocusDeps } from './focusController';

/** Wire the controller's dependencies to the real Chrome extension APIs. */
export function createChromeDeps(): FocusDeps {
  return {
    storage: {
      get: (keys) => browser.storage.local.get(keys),
      set: (items) => browser.storage.local.set(items),
    },
    dnr: {
      getDynamicRules: () => browser.declarativeNetRequest.getDynamicRules(),
      // FocusGuard's rule literals ('block', 'main_frame') are the string values of Chrome's
      // RuleActionType / ResourceType enums, so the structural cast is exact.
      updateDynamicRules: (options) =>
        browser.declarativeNetRequest.updateDynamicRules(
          options as unknown as Browser.declarativeNetRequest.UpdateRuleOptions,
        ),
    },
    alarms: {
      create: (name, info) => browser.alarms.create(name, info),
      clear: (name) => browser.alarms.clear(name),
      get: (name) => browser.alarms.get(name),
    },
    tabs: {
      query: (queryInfo) => browser.tabs.query(queryInfo),
      reload: (tabId) => browser.tabs.reload(tabId),
    },
    badge: {
      async update(active) {
        await browser.action.setBadgeText({ text: active ? 'ON' : '' });
        if (active) {
          await browser.action.setBadgeBackgroundColor({ color: '#10b981' });
          await browser.action.setBadgeTextColor?.({ color: '#04130d' });
        }
      },
    },
  };
}
