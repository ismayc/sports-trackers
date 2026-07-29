import { describe, it, expect } from 'vitest'
import { seasonPhase } from '../src/utils/phase.js'
import { VIEWERS } from '../src/data/viewers.js'

const league = (over = {}) => ({
  kind: 'league',
  season: { startMonth: 10, startDay: 21, endMonth: 6 },
  playoffs: { startMonth: 4, endMonth: 6 },
  ...over,
})
const tournament = (over = {}) => ({
  kind: 'tournament',
  tournamentLabel: 'Tournament',
  window: { start: { m: 3, d: 17 }, end: { m: 4, d: 7 } },
  ...over,
})
const on = (y, m, d) => new Date(y, m - 1, d)

describe('seasonPhase — tournaments', () => {
  it('games on the feed win outright', () => {
    expect(seasonPhase(tournament(), { now: on(2026, 3, 20), hasGames: true })).toEqual({
      label: 'Tournament',
      tone: 'hot',
    })
  })

  it('uses the configured label when one is given', () => {
    const p = seasonPhase(tournament({ tournamentLabel: 'Group stage' }), { now: on(2026, 6, 15), hasGames: true })
    expect(p.label).toBe('Group stage')
  })

  it('falls back to "Tournament" with no label configured', () => {
    const p = seasonPhase(tournament({ tournamentLabel: undefined }), { now: on(2026, 6, 15), hasGames: true })
    expect(p.label).toBe('Tournament')
  })

  it('counts down inside 30 days of the window opening', () => {
    const p = seasonPhase(tournament(), { now: on(2026, 3, 7) })
    expect(p).toEqual({ label: 'Starts in 10d', tone: 'soon', days: 10 })
  })

  it('is offseason more than 30 days out', () => {
    expect(seasonPhase(tournament(), { now: on(2026, 1, 1) })).toEqual({ label: 'Offseason', tone: 'cold' })
  })

  it('is offseason with no window at all', () => {
    expect(seasonPhase(tournament({ window: undefined }), { now: on(2026, 1, 1) })).toEqual({
      label: 'Offseason',
      tone: 'cold',
    })
  })
})

describe('seasonPhase — leagues', () => {
  it('reports playoffs inside the playoff months', () => {
    expect(seasonPhase(league(), { now: on(2026, 5, 10) })).toEqual({ label: 'Playoffs', tone: 'hot' })
  })

  it('reports in-season inside the season but outside the playoffs', () => {
    expect(seasonPhase(league(), { now: on(2026, 12, 1) })).toEqual({ label: 'In season', tone: 'on' })
  })

  it('handles a season that does NOT wrap the new year', () => {
    const wnba = league({ season: { startMonth: 5, startDay: 1, endMonth: 10 }, playoffs: { startMonth: 9, endMonth: 10 } })
    expect(seasonPhase(wnba, { now: on(2026, 7, 1) }).label).toBe('In season')
    expect(seasonPhase(wnba, { now: on(2026, 9, 20) }).label).toBe('Playoffs')
    expect(seasonPhase(wnba, { now: on(2026, 2, 1) }).tone).not.toBe('on')
  })

  it('treats a league with no playoff block as simply in season', () => {
    const epl = league({ season: { startMonth: 8, startDay: 15, endMonth: 5 }, playoffs: undefined })
    expect(seasonPhase(epl, { now: on(2026, 4, 1) })).toEqual({ label: 'In season', tone: 'on' })
  })

  it('counts down inside 45 days of the season opening', () => {
    const nfl = league({ season: { startMonth: 9, startDay: 4, endMonth: 2 }, playoffs: { startMonth: 1, endMonth: 2 } })
    const p = seasonPhase(nfl, { now: on(2026, 7, 29) })
    expect(p.tone).toBe('soon')
    expect(p.days).toBe(37)
    expect(p.label).toBe('Starts in 37d')
  })

  it('is offseason beyond the 45-day runway', () => {
    const nfl = league({ season: { startMonth: 9, startDay: 4, endMonth: 2 } })
    expect(seasonPhase(nfl, { now: on(2026, 5, 1) })).toEqual({ label: 'Offseason', tone: 'cold' })
  })

  it('defaults startDay to the 1st when omitted', () => {
    const v = league({ season: { startMonth: 9, endMonth: 12 }, playoffs: undefined })
    const p = seasonPhase(v, { now: on(2026, 8, 20) })
    expect(p.label).toBe('Starts in 12d')
  })

  it('defaults now to the real clock and hasGames to false', () => {
    // Called with no options at all: must not throw and must return a usable badge.
    const p = seasonPhase(league())
    expect(typeof p.label).toBe('string')
    expect(['hot', 'on', 'soon', 'cold']).toContain(p.tone)
  })
})

describe('every configured viewer produces a valid badge year-round', () => {
  it('never returns an undefined label or an unknown tone', () => {
    for (const v of VIEWERS) {
      for (let m = 1; m <= 12; m++) {
        const p = seasonPhase(v, { now: on(2026, m, 15) })
        expect(p.label, `${v.id} in month ${m}`).toBeTruthy()
        expect(['hot', 'on', 'soon', 'cold']).toContain(p.tone)
      }
    }
  })

  // App.jsx sorts the "starts soon" tier on `days` WITHOUT a nullish guard, which is only
  // safe because this invariant holds. Asserted here so the guard lives in a test rather
  // than as an untestable `?? 0` in the sort comparator.
  it('ALWAYS pairs the "soon" tone with a numeric days count', () => {
    const seen = { soon: 0, other: 0 }
    const check = (p, where) => {
      if (p.tone === 'soon') {
        expect(typeof p.days, `${where} had tone soon with days=${p.days}`).toBe('number')
        expect(Number.isFinite(p.days), where).toBe(true)
        seen.soon += 1
      } else {
        seen.other += 1
      }
    }
    for (const v of VIEWERS) {
      for (let m = 1; m <= 12; m++) {
        for (const d of [1, 15, 28]) check(seasonPhase(v, { now: on(2026, m, d) }), `${v.id} ${m}/${d}`)
      }
    }
    // Both a league and a tournament reach the 'soon' branch, so this is not vacuous.
    expect(seen.soon).toBeGreaterThan(0)
    expect(seen.other).toBeGreaterThan(0)
  })
})
