import { createFocusController } from '@/lib/focusController';
import { handleFocusRequest, isFocusRequest } from '@/lib/messaging';
import { createChromeDeps } from '@/lib/platform';
import { SESSION_ALARM } from '@/lib/timer';

export default defineBackground(() => {
  const controller = createFocusController(createChromeDeps());

  const reconcile = (reason: string) =>
    controller.reconcile().catch((error: unknown) => {
      console.error(`[FocusGuard] reconcile (${reason}) failed`, error);
    });

  // MV3: every listener is registered synchronously on each worker start, so Chrome can wake
  // the worker for these events after it has been suspended.
  browser.runtime.onInstalled.addListener(() => {
    void controller
      .initialize()
      .catch((error: unknown) => console.error('[FocusGuard] initialize failed', error))
      .then(() => reconcile('installed'));
  });

  browser.runtime.onStartup.addListener(() => {
    void reconcile('startup');
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === SESSION_ALARM) void reconcile('alarm');
  });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Only FocusGuard's own extension pages may drive state changes.
    const fromExtensionPage =
      sender.id === browser.runtime.id &&
      (sender.url === undefined || sender.url.startsWith(browser.runtime.getURL('/')));
    if (!fromExtensionPage || !isFocusRequest(message)) return;
    void handleFocusRequest(controller, message).then(sendResponse);
    return true; // keep the channel open for the async response
  });

  // Navigations that never make a network request, and so can't be stopped by block rules:
  // back/forward-cache restores (onCommitted) and history-API URL changes. Blocked navigations
  // end in onErrorOccurred instead, so tabs already showing Chrome's block page aren't reloaded.
  const onTopFrameNavigation = ({ tabId, frameId, url }: { tabId: number; frameId: number; url: string }) => {
    if (frameId !== 0 || tabId < 0) return;
    void controller.handleTabUrlChange(tabId, url).catch(() => undefined);
  };
  browser.webNavigation.onCommitted.addListener(onTopFrameNavigation);
  browser.webNavigation.onHistoryStateUpdated.addListener(onTopFrameNavigation);

  browser.tabs.onRemoved.addListener((tabId) => controller.forgetTab(tabId));

  // The worker may have been woken for any reason (including after a crash or an update);
  // make sure the alarm, rules and badge match stored state.
  void reconcile('wake');
});
