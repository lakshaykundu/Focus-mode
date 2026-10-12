import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Pin a timezone with a non-zero UTC offset so date-boundary tests are meaningful.
    env: { TZ: 'Asia/Kolkata' },
  },
});
