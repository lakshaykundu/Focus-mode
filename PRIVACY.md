# FocusGuard Privacy Policy

_Last updated: October 13, 2026_

FocusGuard ("the extension") is a Chrome extension that blocks distracting websites during focus
sessions and can filter YouTube videos by category. This policy explains what data the extension
handles and how. In short, **everything stays on your device. FocusGuard has no servers, accounts,
analytics or tracking.**

## What FocusGuard handles, and why

| Data | When | Purpose | Stored? |
| --- | --- | --- | --- |
| Your settings (blocked sites, categories, YouTube options, Strict Mode, durations) | Always | To remember your preferences | Yes, locally in `chrome.storage.local` |
| Focus session times (start, end, planned length, how the session ended) | When you use focus sessions | To run the timer and show your own statistics | Yes, locally. Records older than 365 days are deleted automatically |
| URLs of your open tabs and of pages you navigate to | Only during a focus session | Compared in memory against your blocklist so already-open or cached distracting pages can be reloaded into the block | **No.** Never saved, logged or transmitted |
| The current YouTube video's ID, category, channel ID, channel name and title | Only on youtube.com, during a session with Clean YouTube | To decide whether the video fits your allowed categories | **No**, except: video IDs you choose to "Allow this video" are kept until the session ends, and channels you choose to "Always allow" are saved in your settings |

FocusGuard does **not** read or store page text, comments, messages, form inputs, passwords,
search queries or browsing history, and does not track which sites you visit.

## Sharing

FocusGuard does not sell, transfer or share any data with anyone. It makes no network requests
of its own. It doesn't even load website favicons, since that would reveal your blocklist to
third parties.

## Permissions

FocusGuard requests only what its features need: `storage`, `declarativeNetRequest`, `alarms`,
`tabs`, `webNavigation`, and access to `www.youtube.com` / `m.youtube.com` for Clean YouTube. The
[README](README.md#permissions) explains each one.

## Your control

- Change or reset your settings at any time on the FocusGuard settings page.
- Uninstalling the extension deletes all of its data from your browser.

## Limited use

FocusGuard's use of information complies with the
[Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq),
including the Limited Use requirements. Data is used only to provide the extension's
single purpose, helping you stay focused, and is never used for advertising, credit decisions
or any unrelated purpose.

## Changes and contact

If this policy changes, the updated version will be published at this address with a new date.
Questions: open an issue at <https://github.com/lakshaykundu/Focus-mode/issues>.
