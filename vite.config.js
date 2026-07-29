import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative base so the same dist/ serves under the GitHub Pages subpath
  // (/sports-trackers/) as well as a domain root. Matches the family.
  base: './',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.js'],
    // Pin the suite's timezone. The hub's whole job is re-bucketing a UTC-bucketed feed
    // into the USER'S calendar day (utils/time dayKey/todayKey), so every "is this today"
    // assertion is timezone-sensitive and would otherwise pass locally and fail on a UTC
    // runner. New York is chosen deliberately over UTC: a test that quietly assumes UTC day
    // boundaries fails here rather than hiding until CI. test/timezone-pinned.test.js
    // asserts the pin is actually in effect.
    env: { TZ: 'America/New_York' },
    // Serialize the files. The v8 provider races when several jsdom workers report at once
    // and drops coverage for files that WERE exercised, which shows up as an unstable
    // percentage between identical runs. The sibling premier-league repo hit this first.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      all: true, // count untested files too, so the badge isn't flattered
      include: ['src/**'],
      exclude: ['src/main.jsx', 'src/**/*.test.{js,jsx}'],
      reporter: ['text-summary', 'json-summary'],
    },
  },
})
