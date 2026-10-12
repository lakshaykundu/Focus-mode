import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],
  autoIcons: {
    baseIconPath: 'assets/icon.svg',
    developmentIndicator: false,
  },
  manifest: {
    name: 'FocusGuard',
    description:
      'Block distracting websites during focus sessions. Local-only, privacy-first.',
    minimum_chrome_version: '110',
    // storage: settings, session state and statistics (local only).
    // declarativeNetRequest: block top-level navigation to distracting domains.
    // alarms: end timed sessions even while the service worker is suspended.
    // tabs: find already-open distracting tabs and reload them into the block.
    // webNavigation: catch back/forward-cache restores and history-API navigations, which
    //   don't make a network request for block rules to stop.
    permissions: ['storage', 'declarativeNetRequest', 'alarms', 'tabs', 'webNavigation'],
    action: {
      default_title: 'FocusGuard',
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
