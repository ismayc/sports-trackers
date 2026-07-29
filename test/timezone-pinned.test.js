import { describe, it, expect } from 'vitest'

// The suite's timezone pin, asserted explicitly.
//
// Without this, deleting `env: { TZ: … }` from vite.config.js would not fail anything here
// — it would fail somewhere else, later, as a handful of unrelated-looking date assertions
// going red on a UTC CI runner. This test names the real cause.
describe('suite timezone', () => {
  it('is pinned to America/New_York', () => {
    expect(process.env.TZ).toBe('America/New_York')
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/New_York')
  })

  it('is NOT UTC, so UTC-day assumptions fail here rather than in CI', () => {
    // The point of choosing a non-UTC pin: this offset is what catches code that treats a
    // UTC date as the user's date.
    const lateTip = new Date('2026-07-30T02:00:00Z')
    expect(lateTip.toISOString().slice(0, 10)).toBe('2026-07-30')
    // Same instant, local (pinned) calendar day: the day before.
    expect(lateTip.getDate()).toBe(29)
  })
})
