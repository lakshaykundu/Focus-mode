import { useCallback, useState } from 'react';
import { sendFocusRequest } from '@/lib/messageClient';
import type { FocusRequest, FocusResponse } from '@/types/messages';

/**
 * Send requests to the background worker with pending/error state for the UI. `pending` holds
 * the key of the in-flight action so only the relevant control shows a spinner.
 */
export function useBackgroundAction() {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (request: FocusRequest, key: string = request.type): Promise<FocusResponse> => {
    setPending(key);
    setError(null);
    const response = await sendFocusRequest(request);
    setPending((current) => (current === key ? null : current));
    if (!response.ok) setError(response.error);
    return response;
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { run, pending, error, clearError };
}
