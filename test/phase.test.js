import { describe, it, expect } from 'vitest'
import { seasonPhase, currentBreak } from '../src/utils/phase.js'
import { ALL_VIEWERS } from '../src/data/viewers.js'

const league = (over = {}) => ({
  kind: 'league',
  season: { startMonth: 10, startDay: 21, endMonth: 6 },
  ...over,
})
const tournament = (over = {}) => ({
  kind: 'tournament',
  tournamentLabel: 'Tournament',
  runs: { start: '2026-03-17', end: '2026-04-07' },
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

  it('counts down inside 30 days of the edition opening', () => {
    const p = seasonPhase(tournament(), { now: on(2026, 3, 7) })
    expect(p).toEqual({ label: 'Starts in 10d', tone: 'soon', days: 10 })
  })

  it('is offseason more than 30 days out', () => {
    expect(seasonPhase(tournament(), { now: on(2026, 1, 1) })).toEqual({ label: 'Offseason', tone: 'cold' })
  })

  it('is offseason once the edition start has passed with no games', () => {
    // A concrete runs.start in the past yields a negative countdown, which is not "soon".
    expect(seasonPhase(tournament(), { now: on(2026, 3, 20) })).toEqual({ label: 'Offseason', tone: 'cold' })
  })

  it('is offseason with no runs at all', () => {
    expect(seasonPhase(tournament({ runs: undefined }), { now: on(2026, 1, 1) })).toEqual({
      label: 'Offseason',
      tone: 'cold',
    })
  })
})

describe('seasonPhase — leagues', () => {
  it('reports playoffs when a postseason game is on the feed', () => {
    expect(seasonPhase(league(), { now: on(2026, 5, 10), postseason: true })).toEqual({
      label: 'Playoffs',
      tone: 'hot',
    })
  })

  it('stays in-season inside the season when no postseason game is on the feed', () => {
    // Same May date, but the feed shows no postseason game: the calendar alone must not
    // call it "Playoffs".
    expect(seasonPhase(league(), { now: on(2026, 5, 10) })).toEqual({ label: 'In season', tone: 'on' })
    expect(seasonPhase(league(), { now: on(2026, 12, 1) })).toEqual({ label: 'In season', tone: 'on' })
  })

  it('does not call the WNBA regular-season tail "Playoffs"', () => {
    // The bug: on Sep 13 the WNBA regular season is still running (it ends Sep 25), yet a
    // Sep-Oct playoff month-window labeled it "Playoffs". With no postseason game on the
    // feed it must read "In season"; a real postseason game upgrades it.
    const wnba = league({ season: { startMonth: 5, startDay: 1, endMonth: 10 } })
    expect(seasonPhase(wnba, { now: on(2026, 7, 1) }).label).toBe('In season')
    expect(seasonPhase(wnba, { now: on(2026, 9, 13) }).label).toBe('In season')
    expect(seasonPhase(wnba, { now: on(2026, 9, 13), postseason: true }).label).toBe('Playoffs')
    expect(seasonPhase(wnba, { now: on(2026, 2, 1) }).tone).not.toBe('on')
  })

  it('treats a league with no postseason game as simply in season', () => {
    const epl = league({ season: { startMonth: 8, startDay: 15, endMonth: 5 } })
    expect(seasonPhase(epl, { now: on(2026, 4, 1) })).toEqual({ label: 'In season', tone: 'on' })
  })

  it('is still "Starts in Nd" inside the start month but before startDay', () => {
    // Aug 9 with a PL that kicks off Aug 15: month-granular logic said "In season"
    // twelve days early; the leading edge must respect startDay.
    const epl = league({ season: { startMonth: 8, startDay: 15, endMonth: 5 }, playoffs: undefined })
    const p = seasonPhase(epl, { now: on(2026, 8, 9) })
    expect(p.tone).toBe('soon')
    expect(p.label).toBe('Starts in 6d')
    // From startDay itself, the season is on.
    expect(seasonPhase(epl, { now: on(2026, 8, 15) })).toEqual({ label: 'In season', tone: 'on' })
    // A league with no startDay starts on the 1st — the whole start month is in season.
    const noDay = league({ season: { startMonth: 8, endMonth: 5 }, playoffs: undefined })
    expect(seasonPhase(noDay, { now: on(2026, 8, 1) })).toEqual({ label: 'In season', tone: 'on' })
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
    for (const v of ALL_VIEWERS) {
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
    for (const v of ALL_VIEWERS) {
      for (let m = 1; m <= 12; m++) {
        for (const d of [1, 15, 28]) check(seasonPhase(v, { now: on(2026, m, d) }), `${v.id} ${m}/${d}`)
      }
    }
    // Both a league and a tournament reach the 'soon' branch, so this is not vacuous.
    expect(seen.soon).toBeGreaterThan(0)
    expect(seen.other).toBeGreaterThan(0)
  })
})

describe('seasonPhase — international breaks', () => {
  // The real Premier League windows, so these tests fail the day the config is wrong.
  const epl = () => ALL_VIEWERS.find((v) => v.id === 'epl')

  it('names the break instead of leaving an empty card "In season"', () => {
    // 21 Sep 2026 – 9 Oct 2026: MW5 finished the day before, MW6 is 10 Oct. Nineteen days
    // in which "In season" over a card with nothing on it is the vaguest possible answer.
    expect(seasonPhase(epl(), { now: on(2026, 9, 21) })).toEqual({ label: 'Int’l break', tone: 'cold' })
    expect(seasonPhase(epl(), { now: on(2026, 10, 9) })).toEqual({ label: 'Int’l break', tone: 'cold' })
  })

  it('is back in season on the matchday either side of a window', () => {
    expect(seasonPhase(epl(), { now: on(2026, 9, 20) }).label).toBe('In season')
    expect(seasonPhase(epl(), { now: on(2026, 10, 10) }).label).toBe('In season')
  })

  it('covers the November and March windows too', () => {
    expect(seasonPhase(epl(), { now: on(2026, 11, 14) }).label).toBe('Int’l break')
    expect(seasonPhase(epl(), { now: on(2026, 11, 21) }).label).toBe('In season')
    expect(seasonPhase(epl(), { now: on(2027, 3, 24) }).label).toBe('Int’l break')
    expect(seasonPhase(epl(), { now: on(2027, 3, 20) }).label).toBe('In season')
  })

  it('lets a game on the feed cancel the break — the feed is never overruled by a date', () => {
    // A fixture inside the window (a rearrangement, or the config drifting from reality)
    // means the calendar is wrong about that day, not the feed. Same rule as "Playoffs".
    expect(seasonPhase(epl(), { now: on(2026, 9, 21), hasGames: true }).label).toBe('In season')
    expect(seasonPhase(epl(), { now: on(2026, 9, 21), postseason: true }).label).toBe('Playoffs')
  })

  it('sorts down with the quiet cards, because nothing is on', () => {
    // `cold` is what puts it below the leagues that are actually playing (see rankOf in App).
    expect(seasonPhase(epl(), { now: on(2026, 9, 21) }).tone).toBe('cold')
  })

  it('leaves every other viewer alone', () => {
    // Only the Premier League has breaks configured; nothing else may acquire the label.
    for (const v of ALL_VIEWERS.filter((x) => x.kind === 'league' && x.id !== 'epl')) {
      expect(v.breaks, `${v.id} has breaks but nothing knows about them`).toBeUndefined()
      expect(seasonPhase(v, { now: on(2026, 9, 21) }).label).not.toBe('Int’l break')
    }
  })
})

describe('currentBreak', () => {
  const epl = () => ALL_VIEWERS.find((v) => v.id === 'epl')

  it('returns the window the day falls in, inclusive at both ends', () => {
    expect(currentBreak(epl(), on(2026, 9, 21))).toMatchObject({ start: '2026-09-21' })
    expect(currentBreak(epl(), on(2026, 10, 9))).toMatchObject({ end: '2026-10-09' })
    expect(currentBreak(epl(), on(2026, 10, 10))).toBeNull()
  })

  it('carries the first matchday back, so the page note can say when football returns', () => {
    expect(currentBreak(epl(), on(2026, 9, 25)).resumes).toBe('2026-10-10')
    expect(currentBreak(epl(), on(2026, 11, 14)).resumes).toBe('2026-11-21')
    // March's fixtures are not published yet: no `resumes`, and the note says so instead
    // of inventing a date.
    expect(currentBreak(epl(), on(2027, 3, 24)).resumes).toBeUndefined()
  })

  it('is null for a viewer with no breaks at all', () => {
    expect(currentBreak(league(), on(2026, 9, 21))).toBeNull()
  })

  it('reads the local day, not UTC — a break does not start an evening early', () => {
    // Late on 20 Sep west of UTC is already the 21st in UTC. The window is a calendar fact
    // about the league, so it must turn over on the user's own midnight.
    expect(currentBreak(epl(), new Date(2026, 8, 20, 23, 30))).toBeNull()
  })
})
