import { browser } from 'wxt/browser';
import type { FocusRequest, FocusResponse } from '@/types/messages';

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
