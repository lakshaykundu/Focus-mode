import type { FocusState } from './focus';
import type { FocusSettings, SessionDuration, SiteCategory } from './settings';

/** Settings fields the UI may patch directly. Sites and categories have dedicated messages. */
export type SettingsPatch = Partial<
  Pick<FocusSettings, 'defaultDuration' | 'strictMode' | 'youtubePolicy' | 'ui'>
> & {
  cleanYouTube?: Partial<FocusSettings['cleanYouTube']>;
  youtubeFilter?: Partial<Pick<FocusSettings['youtubeFilter'], 'enabled' | 'allowedCategories' | 'unknownPolicy'>>;
};

export type FocusRequest =
  | { type: 'GET_STATE' }
  | { type: 'START_SESSION'; duration: SessionDuration }
  | { type: 'END_SESSION'; emergencyOverride?: boolean }
  | { type: 'RECONCILE' }
  | { type: 'UPDATE_SETTINGS'; patch: SettingsPatch }
  | { type: 'TOGGLE_SITE'; siteId: string; enabled: boolean }
  | { type: 'TOGGLE_CATEGORY'; category: SiteCategory; enabled: boolean }
  | { type: 'ADD_CUSTOM_SITE'; input: string }
  | { type: 'REMOVE_SITE'; siteId: string }
  | { type: 'RESET_SETTINGS' }
  | { type: 'ALLOW_VIDEO'; videoId: string }
  | { type: 'ALLOW_CHANNEL'; channelId: string; name: string }
  | { type: 'REMOVE_ALLOWED_CHANNEL'; channelId: string };

/** The only requests the YouTube content script may send. Everything else is extension-page only. */
export const CONTENT_SCRIPT_REQUESTS = ['ALLOW_VIDEO', 'ALLOW_CHANNEL'] as const satisfies ReadonlyArray<
  FocusRequest['type']
>;

export interface StateSnapshot {
  state: FocusState;
  settings: FocusSettings;
}

export type FocusResponse<T = StateSnapshot> =
  | { ok: true; data: T }
  | { ok: false; error: string };
