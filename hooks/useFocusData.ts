import { STORAGE_KEYS, sanitizeHistory, sanitizeSettings, sanitizeState } from '@/lib/storage';
import { useStorageValue } from './useStorageValue';

export const useFocusState = () => useStorageValue(STORAGE_KEYS.state, sanitizeState);
export const useSettings = () => useStorageValue(STORAGE_KEYS.settings, sanitizeSettings);
export const useHistory = () => useStorageValue(STORAGE_KEYS.history, sanitizeHistory);
