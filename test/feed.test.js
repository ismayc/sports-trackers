import { describe, it, expect, vi, afterEach } from 'vitest'
import { normalizeFeedGame, feedTeams, fetchFeed, fetchFeedGames } from '../src/services/feed.js'
import { fetchViewerDay } from '../src/services/espn.js'
import { fetchTeams } from '../src/services/teams.js'

// The Unrivaled viewer's hub-feed.json, in the shape its build writes
// (the-unrivaled-schedule src/utils/hubFeed.js).
const UNR = { id: 'unrivaled', feedUrl: 'https://ismayc.github.io/unrivaled-schedule/hub-feed.json', kind: 'league' }
const TEAMS = [
  { abbr: 'PHA', name: 'Phantom', logo: 'https://ismayc.github.io/unrivaled-schedule/logos/phantom.png' },
  { abbr: 'MIS', name: 'Mist', logo: 'https://ismayc.github.io/unrivaled-schedule/logos/mist.png' },
]
const NOW = new Date('2027-01-09T19:00:00Z') // noon in Phoenix, January 9
const TZ = 'America/Phoenix'

const serve = (body, ok = true) => {
  global.fetch = vi.fn(async () => (ok ? { ok: true, json: async () => body } : { ok: false, status: 404 }))
  return global.fetch
}

afterEach(() => {
  try {
    localStorage.clear()
  } catch {
    /* jsdom always has it */
  }
})

describe('normalizeFeedGame', () => {
  const teams = Object.fromEntries(TEAMS.map((t) => [t.abbr, t]))

  it('maps a final onto the hub shape, score already away-first', () => {
    const g = normalizeFeedGame(
      { id: 'a', tip: '2027-01-09T00:00:00.000Z', home: 'MIS', away: 'PHA', postseason: false, score: [74, 80], broadcast: ['TNT'] },
      teams
    )
    expect(g).toMatchObject({
      home: 'Mist',
      away: 'Phantom',
      homeAbbr: 'MIS',
      awayAbbr: 'PHA',
      homeLogo: TEAMS[1].logo,
      state: 'post',
      statusLabel: 'Final',
      score: [74, 80],
      timeTBD: false,
      day: null,
      broadcast: ['TNT'],
      broadcastTBA: false,
    })
  })

  it('never calls a game live: no score is "pre", even past its tip', () => {
    const g = normalizeFeedGame({ id: 'b', tip: '2027-01-09T00:00:00.000Z', home: 'MIS', away: 'PHA' }, teams)
    expect(g).toMatchObject({ state: 'pre', score: null, statusLabel: null, broadcast: [], broadcastTBA: true, postseason: false })
  })

  it('carries an unannounced tip as timeTBD with its day, like ESPN timeValid false', () => {
    const g = normalizeFeedGame({ id: 'c', tip: '2027-01-24T19:00:00.000Z', day: '2027-01-24', home: 'MIS', away: 'PHA', postseason: true }, teams)
    expect(g).toMatchObject({ timeTBD: true, day: '2027-01-24', postseason: true })
  })

  it('drops a postponed game and a game with a club it does not know', () => {
    expect(normalizeFeedGame({ id: 'd', postponed: true, home: 'MIS', away: 'PHA' }, teams)).toBeNull()
    expect(normalizeFeedGame({ id: 'e', home: 'MIS', away: 'XXX' }, teams)).toBeNull()
  })

  it('reports no logo rather than an undefined src', () => {
    const g = normalizeFeedGame({ id: 'f', tip: 'x', home: 'A', away: 'B' }, { A: { name: 'A' }, B: { name: 'B' } })
    expect([g.homeLogo, g.awayLogo]).toEqual([null, null])
  })
})

describe('feedTeams', () => {
  it('lists the clubs in name order, and nothing for a feed without teams', () => {
    expect(feedTeams({ teams: TEAMS }).map((t) => t.abbr)).toEqual(['MIS', 'PHA'])
    expect(feedTeams({ teams: [{ abbr: 'A', name: 'A' }] })).toEqual([{ abbr: 'A', name: 'A', logo: null }])
    expect(feedTeams({})).toEqual([])
  })
})

describe('fetchFeed and fetchFeedGames', () => {
  it('throws on a failed request or a body with no games list', async () => {
    serve({}, false)
    await expect(fetchFeed(UNR)).rejects.toThrow(/HTTP 404/)
    serve({ teams: TEAMS })
    await expect(fetchFeed(UNR)).rejects.toThrow(/no games/)
    serve(null)
    await expect(fetchFeed(UNR)).rejects.toThrow(/no games/)
  })

  it('never throws itself: a bad feed is ok false with no games', async () => {
    serve({}, false)
    expect(await fetchFeedGames(UNR)).toEqual({ ok: false, games: [] })
  })

  it('reads a feed with no team list as games it cannot name, so none', async () => {
    serve({ games: [{ id: 'a', tip: '2027-01-09T00:00:00Z', home: 'MIS', away: 'PHA' }] })
    expect(await fetchFeedGames(UNR)).toEqual({ ok: true, games: [] })
  })
})

describe('fetchViewerDay on a feed viewer', () => {
  const games = [
    // Last night in Phoenix (January 8, 5:00 PM MST).
    { id: 'y', tip: '2027-01-09T00:00:00.000Z', home: 'MIS', away: 'PHA', score: [74, 80] },
    // Tonight, and an untimed game today filed by its day.
    { id: 't', tip: '2027-01-10T01:30:00.000Z', home: 'PHA', away: 'MIS' },
    { id: 'u', tip: '2027-01-09T19:00:00.000Z', day: '2027-01-09', home: 'MIS', away: 'PHA' },
    // Two weeks out is the last day in the window; fifteen days out is past it.
    { id: 'h', tip: '2027-01-24T01:00:00.000Z', home: 'MIS', away: 'PHA' },
    { id: 'far', tip: '2027-01-25T01:00:00.000Z', home: 'MIS', away: 'PHA' },
    // Three days back is before the window.
    { id: 'old', tip: '2027-01-06T01:00:00.000Z', home: 'MIS', away: 'PHA', score: [60, 70] },
  ]

  it('fetches only the feed, and buckets it like a scoreboard, within the same window', async () => {
    const f = serve({ teams: TEAMS, games })
    const day = await fetchViewerDay(UNR, { now: NOW, tz: TZ })
    expect(f).toHaveBeenCalledTimes(1)
    expect(f.mock.calls[0][0]).toBe(UNR.feedUrl)
    expect(day.ok).toBe(true)
    expect(day.yesterday.map((g) => g.id)).toEqual(['y'])
    expect(day.today.map((g) => g.id).sort()).toEqual(['t', 'u'])
    expect(day.live).toBe(0)
    expect(day.upcoming.map((g) => g.id)).toEqual(['u', 't', 'h'])
    expect(day.next.id).toBe('u')
  })

  it('is an empty, not-ok viewer when the feed cannot be read', async () => {
    serve({}, false)
    const day = await fetchViewerDay(UNR, { now: NOW, tz: TZ })
    expect(day).toMatchObject({ ok: false, today: [], upcoming: [], next: null })
  })
})

describe('fetchTeams on a feed viewer', () => {
  it('reads the clubs from the feed, not from ESPN standings', async () => {
    const f = serve({ teams: TEAMS, games: [] })
    const out = await fetchTeams([UNR], { now: 1 })
    expect(f.mock.calls[0][0]).toBe(UNR.feedUrl)
    expect(out.unrivaled.map((t) => t.abbr)).toEqual(['MIS', 'PHA'])
  })
})
