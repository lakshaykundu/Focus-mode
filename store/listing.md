# Chrome Web Store submission kit

Copy each field below into the [Developer Dashboard](https://chrome.google.com/webstore/devconsole).
Upload images from `store/images/`.

---

## Package tab

Upload: `.output/focusguard-1.0.0-chrome.zip` (create it with `npm run zip`).

## Store listing tab

**Title** (taken from the manifest automatically)
> FocusGuard – Focus Mode & YouTube Study Filter

**Summary** (taken from the manifest automatically)
> Block distracting sites during focus sessions and let only study videos play on YouTube. Local-only, no tracking.

**Description**
```
Stay on task without fighting your browser.

FocusGuard blocks the sites that pull you away, like Instagram, Reddit, X, Netflix, Spotify and any site you add, for as long as your focus session runs. Pick 25, 45, 60 or 90 minutes, a custom length, or no time limit. When the timer ends, everything unblocks on its own.

YOUTUBE, MINUS THE RABBIT HOLES
Need YouTube for tutorials? Switch it to Clean mode instead of blocking it:
• Shorts, the home feed and recommended videos disappear
• The left menu is trimmed to just Home
• Only videos in the categories you allow play (default: Education, Science & Technology, Howto & Style). Anything else is paused behind a friendly reminder, with one-click "Allow this video" or "Always allow this channel".
• YouTube Music can be blocked separately

The filter uses the category each uploader chose on YouTube. It's a simple metadata check, not AI, and FocusGuard tells you exactly why a video was paused.

STRICT MODE
Make a commitment: during a strict session there's no End button, and sites can't be unblocked until the timer finishes. An emergency override is available behind a deliberate "type a phrase, then hold" step.

ALSO
• Already-open distracting tabs are blocked the moment you start
• Blocks a site and all of its subdomains, never look-alike domains
• Keeps working while the popup is closed, and resumes correctly after a browser restart
• Today's and lifetime focus time, plus a 14-day chart, counted from sessions you actually completed

PRIVATE BY DESIGN
No account, no servers, no analytics, no tracking. Your settings and statistics stay in your browser, and FocusGuard never sends your data anywhere.

Note: FocusGuard works inside Chrome. It can't block desktop or phone apps, and Strict Mode is a commitment device, not a lock. The extension can still be disabled from chrome://extensions.

Open source: https://github.com/lakshaykundu/Focus-mode
```

**Category:** Productivity › Workflow & Planning
**Language:** English

**Graphic assets** (`store/images/`)
| Field | File |
| --- | --- |
| Store icon (128×128) | `icon-128.png` |
| Screenshots (1280×800) | `screenshot-1-blocking.png` … `screenshot-5-settings.png` (upload in order) |
| Small promo tile (440×280) | `promo-small-440x280.png` |
| Marquee promo tile (1400×560, optional) | `promo-marquee-1400x560.png` |

**Additional fields**
- Homepage URL: `https://github.com/lakshaykundu/Focus-mode`
- Support URL: `https://github.com/lakshaykundu/Focus-mode/issues`
- Mature content: No

## Privacy tab

**Single purpose description**
```
FocusGuard helps the user stay focused: during a focus session it blocks websites the user has marked as distracting and, optionally, limits YouTube to videos in categories the user has allowed.
```

**Permission justifications**

| Permission | Justification |
| --- | --- |
| `storage` | Saves the user's blocklist, settings, the current focus session and local focus statistics on the device. |
| `declarativeNetRequest` | Blocks top-level navigation to the websites on the user's blocklist while a focus session is active. FocusGuard removes its rules when the session ends. |
| `alarms` | Ends timed focus sessions at the scheduled time, even while the extension's background service worker is asleep. |
| `tabs` | When a session starts, compares the URLs of already-open tabs with the blocklist in memory and reloads only the matching tabs so the block applies. URLs are not stored or transmitted. |
| `webNavigation` | Detects back/forward-cache restores and in-page navigations to blocked sites, which make no network request and so bypass the block rules, so FocusGuard can reload those tabs into the block. |
| Host permissions (content scripts on `www.youtube.com`, `m.youtube.com`) | Applies the optional Clean YouTube mode. It hides Shorts and recommendations and reads the current video's public category to pause videos outside the user's allowed categories. It runs only on YouTube and does nothing outside focus sessions. |

**Are you using remote code?** No, I am not using remote code.

**Data usage:** tick these and nothing else:
- [x] **Web history**: open tabs' URLs are compared on-device with the blocklist during focus sessions (never stored or transmitted).
- [x] **Website content**: on YouTube, the current video's category, channel and title are read on-device to apply the user's category filter.

**Certifications:** tick all three:
- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL**
```
https://github.com/lakshaykundu/Focus-mode/blob/main/PRIVACY.md
```

## Distribution tab

- Visibility: Public (or Unlisted to share a link with friends first)
- Regions: All regions
