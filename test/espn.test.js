import { describe, it, expect, vi } from 'vitest'
import { isPreseason, fetchViewerDay, fetchAllViewers } from '../src/services/espn.js'
import { espnEvent, stubFetch, stubFetchByDate } from './helpers/feed.js'

const NBA = { id: 'nba', espnPath: 'basketball/nba', kind: 'league' }
const NOW = new Date('2026-07-29T18:00:00Z') // 2pm Eastern
const TZ = 'America/New_York'

const run = (v = NBA, opts = {}) => fetchViewerDay(v, { now: NOW, tz: TZ, ...opts })

describe('isPreseason', () => {
  it('is true for ESPN\'s preseason stamp, by type or slug', () => {
    expect(isPreseason({ season: { type: 1, slug: 'preseason' } })).toBe(true)
    expect(isPreseason({ season: { type: 1 } })).toBe(true)
    expect(isPreseason({ season: { slug: 'preseason' } })).toBe(true)
  })

  it('is false for regular season, postseason, all-star and the NBA play-in', () => {
    // 3 is the postseason and 5 is the play-in. Neither may ever be filtered: the play-in
    // sits OUTSIDE the postseason in ESPN's numbering, which has bitten this family before.
    for (const type of [2, 3, 4, 5]) {
      expect(isPreseason({ season: { type, slug: 'x' } }), `type ${type}`).toBe(false)
    }
  })

  it('is false when ESPN says nothing, so a real game is never hidden by guesswork', () => {
    expect(isPreseason({})).toBe(false)
    expect(isPreseason({ season: {} })).toBe(false)
  })
})

describe('preseason is dropped from the feed', () => {
  it('drops a preseason game and keeps a regular-season one on the same day', () => {
    stubFetch([
      espnEvent({ id: 'pre', date: '2026-07-29T23:00Z', seasonType: 1, seasonSlug: 'preseason' }),
      espnEvent({ id: 'reg', date: '2026-07-29T23:30Z', seasonType: 2 }),
    ])
    return run().then((f) => {
      expect(f.today.map((g) => g.id)).toEqual(['reg'])
    })
  })

  it('is the real 2026 case: the NFL Hall of Fame Game never becomes "next up"', async () => {
    // Verified against the live feed on 2026-07-29: this event, in the hub's own two-week
    // look-ahead, was the NFL card's "Next:" line.
    stubFetch([
      espnEvent({
        id: '401800000',
        date: '2026-08-07T24:00Z'.replace('24:00', '00:00'),
        away: 'Carolina Panthers',
        home: 'Arizona Cardinals',
        awayAbbr: 'CAR',
        homeAbbr: 'ARI',
        seasonType: 1,
        seasonSlug: 'preseason',
        headline: 'Hall of Fame Game',
      }),
    ])
    const f = await run({ id: 'nfl', espnPath: 'football/nfl', kind: 'league' })
    expect(f.upcoming).toEqual([])
    expect(f.next).toBeNull()
    expect(f.today).toEqual([])
  })

  it('keeps the postseason, which shares the "not regular season" space', async () => {
    stubFetch([espnEvent({ id: 'po', date: '2026-07-29T23:00Z', seasonType: 3, seasonSlug: 'post-season' })])
    const f = await run()
    expect(f.today.map((g) => g.id)).toEqual(['po'])
  })
})

describe('normalize', () => {
  it('maps a pre-game event into the hub shape', async () => {
    stubFetch([espnEvent({ id: 'x', date: '2026-07-29T23:00Z', broadcasts: [{ names: ['ESPN'] }] })])
    const f = await run()
    expect(f.today[0]).toMatchObject({
      id: 'x',
      away: 'Away Team',
      home: 'Home Team',
      awayAbbr: 'AWY',
      homeAbbr: 'HME',
      state: 'pre',
      score: null,
      statusLabel: '7:00 PM',
      broadcast: ['ESPN'],
    })
  })

  it('reads a score only once the game is live or complete', async () => {
    stubFetch([
      espnEvent({ id: 'live', date: '2026-07-29T22:00Z', state: 'in', awayScore: '55', homeScore: '60' }),
      espnEvent({ id: 'done', date: '2026-07-29T18:00Z', state: 'post', completed: true, awayScore: '99', homeScore: '101' }),
      espnEvent({ id: 'soon', date: '2026-07-29T23:00Z', state: 'pre', awayScore: '0', homeScore: '0' }),
    ])
    const f = await run()
    const byId = Object.fromEntries(f.today.map((g) => [g.id, g]))
    expect(byId.live.score).toEqual([55, 60]) // [away, home]
    expect(byId.done.score).toEqual([99, 101])
    expect(byId.soon.score).toBeNull() // the feed's 0-0 placeholder is not a score
  })

  it('ignores a non-numeric score', async () => {
    stubFetch([espnEvent({ id: 'odd', date: '2026-07-29T22:00Z', state: 'in', awayScore: 'TBD', homeScore: '3' })])
    const f = await run()
    expect(f.today[0].score).toBeNull()
  })

  it('counts live games', async () => {
    stubFetch([
      espnEvent({ id: 'a', date: '2026-07-29T22:00Z', state: 'in' }),
      espnEvent({ id: 'b', date: '2026-07-29T22:30Z', state: 'in' }),
      espnEvent({ id: 'c', date: '2026-07-29T23:30Z', state: 'pre' }),
    ])
    const f = await run()
    expect(f.live).toBe(2)
  })

  it('skips an event with no competition or missing competitors', async () => {
    stubFetch([
      { id: 'no-comp', date: '2026-07-29T23:00Z' },
      espnEvent({ id: 'home-only', date: '2026-07-29T23:00Z', competitors: [{ homeAway: 'home', team: { displayName: 'H' } }] }),
      espnEvent({ id: 'ok', date: '2026-07-29T23:00Z' }),
    ])
    const f = await run()
    expect(f.today.map((g) => g.id)).toEqual(['ok'])
  })

  it('falls back through ESPN\'s team-name fields', async () => {
    stubFetch([
      espnEvent({
        id: 'names',
        date: '2026-07-29T23:00Z',
        competitors: [
          { homeAway: 'home', team: { shortDisplayName: 'Shorty' } },
          { homeAway: 'away', team: { name: 'Namey' } },
        ],
      }),
    ])
    const f = await run()
    expect(f.today[0]).toMatchObject({ home: 'Shorty', away: 'Namey', homeAbbr: '', awayAbbr: '' })
  })

  it('defaults a missing status to pre', async () => {
    const ev = espnEvent({ id: 'nostatus', date: '2026-07-29T23:00Z' })
    delete ev.competitions[0].status
    stubFetch([ev])
    const f = await run()
    expect(f.today[0].state).toBe('pre')
    expect(f.today[0].statusLabel).toBeNull()
  })
})

describe('broadcast extraction', () => {
  it('keeps national geoBroadcasts and streaming, and drops local RSNs', async () => {
    stubFetch([
      espnEvent({
        id: 'b',
        date: '2026-07-29T23:00Z',
        broadcasts: [{ names: ['ABC'] }],
        geoBroadcasts: [
          { market: { type: 'National' }, media: { shortName: 'ESPN2' } },
          { type: { shortName: 'Streaming' }, media: { shortName: 'ESPN+' } },
          { market: { type: 'Home' }, media: { shortName: 'MSG' } },
        ],
      }),
    ])
    const f = await run()
    expect(f.today[0].broadcast).toEqual(['ABC', 'ESPN2', 'ESPN+'])
    expect(f.today[0].broadcast).not.toContain('MSG')
  })

  it('de-duplicates a network listed twice', async () => {
    stubFetch([
      espnEvent({
        id: 'dup',
        date: '2026-07-29T23:00Z',
        broadcasts: [{ names: ['TNT'] }, { names: ['TNT'] }],
        geoBroadcasts: [{ market: { type: 'National' }, media: { shortName: 'TNT' } }],
      }),
    ])
    const f = await run()
    expect(f.today[0].broadcast).toEqual(['TNT'])
  })

  it('survives geoBroadcasts with no media name', async () => {
    stubFetch([espnEvent({ id: 'g', date: '2026-07-29T23:00Z', geoBroadcasts: [{ market: { type: 'National' }, media: {} }] })])
    const f = await run()
    expect(f.today[0].broadcast).toEqual([])
  })
})

describe('the March-Madness headline filter', () => {
  const MM = {
    id: 'mens-mm',
    espnPath: 'basketball/mens-college-basketball',
    kind: 'tournament',
    college: true,
    mmHeadline: "NCAA Men's Basketball Championship",
  }

  it('keeps tournament games and drops NIT/Crown games sharing the window', async () => {
    stubFetch([
      espnEvent({ id: 'ncaa', date: '2026-07-29T23:00Z', headline: "NCAA Men's Basketball Championship - First Round" }),
      espnEvent({ id: 'nit', date: '2026-07-29T23:30Z', headline: 'NIT Quarterfinals' }),
      espnEvent({ id: 'none', date: '2026-07-29T23:45Z' }),
    ])
    const f = await run(MM)
    expect(f.today.map((g) => g.id)).toEqual(['ncaa'])
  })

  it('appends the college bracket group and postseason type to the query', async () => {
    const fetchMock = stubFetch([])
    await run(MM)
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).toContain('&groups=50&seasontype=3')
    }
  })

  it('does not append them for a non-college viewer', async () => {
    const fetchMock = stubFetch([])
    await run()
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).not.toContain('seasontype=3')
    }
  })
})

describe('day bucketing and the look-ahead', () => {
  it('splits today / yesterday / upcoming by the USER\'S calendar day', async () => {
    stubFetch([
      // 10pm Jul 28 Eastern — yesterday for this user, Jul 29 in UTC.
      espnEvent({ id: 'y', date: '2026-07-29T02:00Z', state: 'post', completed: true, awayScore: '1', homeScore: '2' }),
      espnEvent({ id: 't', date: '2026-07-29T23:00Z' }),
      espnEvent({ id: 'later', date: '2026-08-04T23:00Z' }),
    ])
    const f = await run()
    expect(f.yesterday.map((g) => g.id)).toEqual(['y'])
    expect(f.today.map((g) => g.id)).toEqual(['t'])
    expect(f.upcoming.map((g) => g.id)).toEqual(['t', 'later'])
    expect(f.next.id).toBe('t')
  })

  it('excludes a game that already started from upcoming', async () => {
    stubFetch([espnEvent({ id: 'gone', date: '2026-07-29T10:00Z', state: 'post', completed: true })])
    const f = await run()
    expect(f.upcoming).toEqual([])
    expect(f.next).toBeNull()
  })

  it('sorts everything chronologically and de-duplicates across the day queries', async () => {
    // The same event legitimately appears in more than one of the five queries.
    stubFetch([
      espnEvent({ id: 'b', date: '2026-07-29T23:30Z' }),
      espnEvent({ id: 'a', date: '2026-07-29T22:00Z' }),
    ])
    const f = await run()
    expect(f.today.map((g) => g.id)).toEqual(['a', 'b'])
    expect(f.today).toHaveLength(2) // not 10, despite five identical query responses
  })

  it('asks for four single days plus two forward ranges, anchored on the USER\'S today', async () => {
    const fetchMock = stubFetch([])
    await run()
    const dates = fetchMock.mock.calls.map((c) => String(c[0]).match(/dates=([\d-]+)/)[1])
    // now = 2026-07-29T18:00Z, which is Jul 29 in New York, so tKey = 2026-07-29 and the
    // singles run tKey-2 .. tKey+1. The ranges then carry on contiguously to tKey+14.
    expect(dates).toEqual([
      '20260727',
      '20260728',
      '20260729',
      '20260730',
      '20260731-20260806',
      '20260807-20260812', // tKey + 14
    ])
  })

  it('covers a contiguous span with no gap between the singles and the ranges', async () => {
    const fetchMock = stubFetch([])
    await run()
    const dates = fetchMock.mock.calls.map((c) => String(c[0]).match(/dates=([\d-]+)/)[1])
    // Flatten every requested day, single or range endpoint, and check the union is unbroken.
    const days = []
    for (const d of dates) {
      const [a, b] = d.split('-')
      days.push(a)
      if (b) days.push(b)
    }
    const asDate = (k) => new Date(`${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6)}T12:00:00Z`)
    for (let i = 1; i < days.length; i++) {
      const gap = (asDate(days[i]) - asDate(days[i - 1])) / 86400000
      expect(gap, `gap between ${days[i - 1]} and ${days[i]}`).toBeLessThanOrEqual(7)
      expect(gap).toBeGreaterThan(0)
    }
  })

  // The bug this window shape exists to prevent.
  describe('the "Yesterday" regression: a western zone late in its own day', () => {
    // 2026-07-30T00:10Z is 17:10 on Jul 29 in Phoenix. UTC has rolled to the 30th while the
    // user is still on the 29th, so their yesterday (the 28th) begins two days back. The old
    // window (UTC now ±1 = Jul 29/30/31) never asked for the 28th, and the section emptied.
    const LATE = new Date('2026-07-30T00:10:00Z')
    const PHX = 'America/Phoenix'

    it('requests the day holding yesterday\'s AFTERNOON games', async () => {
      const fetchMock = stubFetch([])
      await fetchViewerDay(NBA, { now: LATE, tz: PHX })
      const dates = fetchMock.mock.calls.map((c) => String(c[0]).match(/dates=([\d-]+)/)[1])
      expect(dates).toContain('20260728')
    })

    it('puts a 1pm and a 4pm game from yesterday in the yesterday bucket', async () => {
      stubFetchByDate([
        // 13:00 and 16:00 Phoenix on Jul 28 — the two that used to vanish.
        espnEvent({ id: 'aft', date: '2026-07-28T20:00Z', state: 'post', completed: true, awayScore: '70', homeScore: '80' }),
        espnEvent({ id: 'eve', date: '2026-07-28T23:00Z', state: 'post', completed: true, awayScore: '71', homeScore: '81' }),
        // 19:00 Phoenix on Jul 28 — already on the next UTC day, so it always survived.
        espnEvent({ id: 'night', date: '2026-07-29T02:00Z', state: 'post', completed: true, awayScore: '72', homeScore: '82' }),
      ])
      const f = await fetchViewerDay(NBA, { now: LATE, tz: PHX })
      expect(f.yesterday.map((g) => g.id)).toEqual(['aft', 'eve', 'night'])
      expect(f.today).toEqual([])
    })

    it('still separates today from yesterday correctly in that same moment', async () => {
      stubFetchByDate([
        espnEvent({ id: 'y', date: '2026-07-28T20:00Z', state: 'post', completed: true }),
        espnEvent({ id: 't', date: '2026-07-30T01:00Z' }), // 18:00 Jul 29 Phoenix — today
      ])
      const f = await fetchViewerDay(NBA, { now: LATE, tz: PHX })
      expect(f.yesterday.map((g) => g.id)).toEqual(['y'])
      expect(f.today.map((g) => g.id)).toEqual(['t'])
    })
  })

  // The mirror image: a zone far AHEAD of UTC, where the local day starts before UTC's.
  describe('an eastern zone early in its own day', () => {
    const EARLY = new Date('2026-07-29T22:00:00Z') // 08:00 Jul 30 in Sydney
    const SYD = 'Australia/Sydney'

    it('requests back far enough for that zone\'s yesterday', async () => {
      const fetchMock = stubFetch([])
      await fetchViewerDay(NBA, { now: EARLY, tz: SYD })
      const dates = fetchMock.mock.calls.map((c) => String(c[0]).match(/dates=([\d-]+)/)[1])
      // Local today is Jul 30, so yesterday is Jul 29 and the singles start at Jul 28.
      expect(dates.slice(0, 4)).toEqual(['20260728', '20260729', '20260730', '20260731'])
    })

    it('buckets an evening game from the local yesterday', async () => {
      stubFetchByDate([
        // 19:00 Jul 29 Sydney = 09:00Z Jul 29.
        espnEvent({ id: 'syd-y', date: '2026-07-29T09:00Z', state: 'post', completed: true }),
      ])
      const f = await fetchViewerDay(NBA, { now: EARLY, tz: SYD })
      expect(f.yesterday.map((g) => g.id)).toEqual(['syd-y'])
    })
  })
})

describe('failure tolerance', () => {
  it('reports ok:false and empty lists when every query fails', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }))
    const f = await run()
    expect(f).toMatchObject({ id: 'nba', ok: false, today: [], live: 0, next: null })
  })

  it('still returns the games from the queries that DID succeed', async () => {
    let n = 0
    global.fetch = vi.fn(async () => {
      n += 1
      if (n % 2 === 0) throw new Error('network')
      return { ok: true, json: async () => ({ events: [espnEvent({ id: `ok${n}`, date: '2026-07-29T23:00Z' })] }) }
    })
    const f = await run()
    expect(f.ok).toBe(true)
    expect(f.today.length).toBeGreaterThan(0)
  })

  it('tolerates a response with no events array', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) }))
    const f = await run()
    expect(f).toMatchObject({ ok: true, today: [] })
  })
})

describe('fetchAllViewers', () => {
  const VS = [NBA, { id: 'nfl', espnPath: 'football/nfl', kind: 'league' }]

  it('returns one feed per viewer, in order', async () => {
    stubFetch([espnEvent({ id: 'g', date: '2026-07-29T23:00Z' })])
    const feeds = await fetchAllViewers(VS, { now: NOW, tz: TZ })
    expect(feeds.map((f) => f.id)).toEqual(['nba', 'nfl'])
    expect(feeds.every((f) => f.today.length === 1)).toBe(true)
  })

  it('one viewer throwing never sinks the rest', async () => {
    global.fetch = vi.fn(async (url) => {
      if (String(url).includes('football/nfl')) throw new Error('nfl down')
      return { ok: true, json: async () => ({ events: [espnEvent({ id: 'g', date: '2026-07-29T23:00Z' })] }) }
    })
    const feeds = await fetchAllViewers(VS, { now: NOW, tz: TZ })
    expect(feeds[0]).toMatchObject({ id: 'nba', ok: true })
    expect(feeds[1]).toMatchObject({ id: 'nfl', ok: false, today: [], live: 0, next: null })
  })

  it('defaults its options, so a bare call still resolves', async () => {
    stubFetch([])
    const feeds = await fetchAllViewers([NBA])
    expect(feeds).toHaveLength(1)
    expect(feeds[0].id).toBe('nba')
  })
})
