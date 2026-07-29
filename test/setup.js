import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Unmount React trees between tests.
afterEach(() => cleanup())

// NETWORK IS OFF BY DEFAULT, unconditionally.
//
// The sibling viewers guard this with `if (!global.fetch)`, which on Node 18+ never fires —
// `fetch` is native, so the stub is skipped and anything unmocked reaches the real network.
// That is tolerable there (they ship committed data and only overlay live scores) but not
// here: App.jsx fetches every viewer's scoreboard on mount, so an unstubbed render would
// make real ESPN calls from the suite — slow, flaky, and dependent on today's fixtures.
//
// The default resolves to an EMPTY but well-formed ESPN scoreboard, which is the honest
// "nothing on" case. Tests that care about games install their own fetch.
export const emptyScoreboard = () => ({ ok: true, json: async () => ({ events: [] }) })

beforeEach(() => {
  global.fetch = vi.fn(async () => emptyScoreboard())
})

// localStorage persists across tests inside one jsdom instance, so a test that picks sports
// or services would silently change the starting state of the next one.
afterEach(() => {
  try {
    localStorage.clear()
  } catch {
    /* ignore */
  }
  vi.useRealTimers()
})

// jsdom has no matchMedia. Default to "not matching" so any layout hook takes its wide
// branch; a test needing the narrow one overrides window.matchMedia itself.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })
}
