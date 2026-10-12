import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';

/**
 * Read one `chrome.storage.local` key and stay subscribed to changes. Values pass through
 * `sanitize` so components never see corrupted data. `sanitize` must be a stable reference.
 * Returns `undefined` until the first read completes.
 */
export function useStorageValue<T>(key: string, sanitize: (raw: unknown) => T): T | undefined {
  const [value, setValue] = useState<T>();

  useEffect(() => {
    let disposed = false;
    let changedSinceRead = false;

    const listener = (
      changes: Record<string, { newValue?: unknown }>,
      area: string,
    ) => {
      if (area !== 'local' || !(key in changes)) return;
      changedSinceRead = true;
      setValue(sanitize(changes[key]?.newValue));
    };
    browser.storage.onChanged.addListener(listener);

    browser.storage.local
      .get(key)
      .then((result) => {
        // A change event that arrived first is newer than this read.
        if (!disposed && !changedSinceRead) setValue(sanitize(result[key]));
      })
      .catch(() => {
        if (!disposed && !changedSinceRead) setValue(sanitize(undefined));
      });

    return () => {
      disposed = true;
      browser.storage.onChanged.removeListener(listener);
    };
  }, [key, sanitize]);

  return value;
}
