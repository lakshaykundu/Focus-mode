import { browser } from 'wxt/browser';
import type { FocusRequest, FocusResponse, StateSnapshot } from '@/types/messages';
import type { FocusController } from './focusController';
import { FocusError } from './focusController';
import { RuleUpdateError } from './ruleManager';

const REQUEST_TYPES: ReadonlySet<FocusRequest['type']> = new Set([
  'GET_STATE',
  'START_SESSION',
  'END_SESSION',
  'RECONCILE',
  'UPDATE_SETTINGS',
  'TOGGLE_SITE',
  'TOGGLE_CATEGORY',
  'ADD_CUSTOM_SITE',
  'REMOVE_SITE',
  'RESET_SETTINGS',
]);

export function isFocusRequest(value: unknown): value is FocusRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    REQUEST_TYPES.has((value as { type?: unknown }).type as FocusRequest['type'])
  );
}

/** Route a request to the controller. Expected failures become `{ ok: false, error }`. */
export async function handleFocusRequest(
  controller: FocusController,
  request: FocusRequest,
): Promise<FocusResponse> {
  try {
    const data = await dispatch(controller, request);
    return { ok: true, data };
  } catch (error) {
    if (error instanceof FocusError || error instanceof RuleUpdateError) {
      return { ok: false, error: error.message };
    }
    console.error('[FocusGuard] request failed', request.type, error);
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
}

function dispatch(controller: FocusController, request: FocusRequest): Promise<StateSnapshot> {
  switch (request.type) {
    case 'GET_STATE':
      return controller.getSnapshot();
    case 'START_SESSION':
      return controller.startSession(request.duration);
    case 'END_SESSION':
      return controller.endSession({ emergencyOverride: request.emergencyOverride === true });
    case 'RECONCILE':
      return controller.reconcile();
    case 'UPDATE_SETTINGS':
      return controller.updateSettings(request.patch);
    case 'TOGGLE_SITE':
      return controller.toggleSite(request.siteId, request.enabled);
    case 'TOGGLE_CATEGORY':
      return controller.toggleCategory(request.category, request.enabled);
    case 'ADD_CUSTOM_SITE':
      return controller.addCustomSite(request.input);
    case 'REMOVE_SITE':
      return controller.removeSite(request.siteId);
    case 'RESET_SETTINGS':
      return controller.resetSettings();
  }
}

/** Send a typed request to the background service worker (which wakes up if suspended). */
export async function sendFocusRequest(request: FocusRequest): Promise<FocusResponse> {
  try {
    const response = (await browser.runtime.sendMessage(request)) as FocusResponse | undefined;
    return response ?? { ok: false, error: 'No response from FocusGuard background worker.' };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not reach FocusGuard background worker.',
    };
  }
}
