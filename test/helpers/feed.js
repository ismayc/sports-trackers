// Builders for the two shapes the suite needs: a raw ESPN scoreboard event (for
// services/espn.js, which parses them) and the hub's normalized feed (for every component,
// which consumes them). Keeping both here stops each test from hand-rolling a slightly
// different fixture and drifting from what ESPN actually sends.

/** A raw ESPN event, shaped like the real scoreboard payload. */
export function espnEvent({
  id = '1',
  date = '2026-07-29T23:00Z',
  away = 'Away Team',
  home = 'Home Team',
  awayAbbr = 'AWY',
  homeAbbr = 'HME',
  awayScore = null,
  homeScore = null,
  state = 'pre',
  completed = false,
  shortDetail = '7:00 PM',
  broadcasts = [],
  geoBroadcasts = [],
  seasonType = 2,
  seasonSlug = 'regular-season',
  headline = null,
  competitors = undefined,
} = {}) {
  return {
    id,
    date,
    ...(seasonType === null ? {} : { season: { type: seasonType, slug: seasonSlug } }),
    competitions: [
      {
        ...(headline ? { notes: [{ headline }] } : {}),
        status: { type: { state, completed, shortDetail } },
        broadcasts,
        geoBroadcasts,
        competitors:
          competitors !== undefined
            ? competitors
            : [
                { homeAway: 'home', score: homeScore, team: { displayName: home, abbreviation: homeAbbr } },
                { homeAway: 'away', score: awayScore, team: { displayName: away, abbreviation: awayAbbr } },
              ],
      },
    ],
  }
}

/** A normalized hub game, as services/espn.js emits it. */
export function game(over = {}) {
  return {
    id: 'g1',
    tip: '2026-07-29T23:00:00.000Z',
    home: 'Home Team',
    away: 'Away Team',
    homeAbbr: 'HME',
    awayAbbr: 'AWY',
    state: 'pre',
    score: null,
    statusLabel: '7:00 PM',
    broadcast: [],
    ...over,
  }
}

/** A normalized per-viewer feed. */
export function feed(over = {}) {
  const today = over.today || []
  return {
    id: 'nba',
    ok: true,
    today,
    live: today.filter((g) => g.state === 'in').length,
    yesterday: [],
    upcoming: [],
    next: null,
    ...over,
  }
}

/**
 * Install a global.fetch that answers every scoreboard request with `events`.
 * Accepts either an array (same answer every time) or a function of the request URL.
 *
 * NOTE this ignores the requested `dates=`, so it cannot tell you whether the code asked for
 * the right days — every query returns everything. Fine for parsing/bucketing shape; use
 * stubFetchByDate below for anything about the query WINDOW.
 */
export function stubFetch(events) {
  const fn = typeof events === 'function' ? events : () => events
  global.fetch = vi.fn(async (url) => ({ ok: true, json: async () => ({ events: fn(String(url)) || [] }) }))
  return global.fetch
}

// ESPN files an event under its US EASTERN calendar day, not the UTC one — verified against
// the live feed, where `dates=20260728` returned instants from 2026-07-28T23:30Z through
// 2026-07-29T02:00Z. Model that here so a test can prove the code asked for the right days.
const easternDay = (iso) => {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso))
  const get = (t) => p.find((x) => x.type === t).value
  return `${get('year')}${get('month')}${get('day')}`
}

/**
 * A fetch stub that HONOURS the requested date, single (`20260728`) or range
 * (`20260731-20260806`). An event is returned only when the day ESPN would file it under was
 * actually asked for — so a missing day in the query window shows up as a missing game,
 * which is the whole point when testing the window itself.
 */
export function stubFetchByDate(events) {
  global.fetch = vi.fn(async (url) => {
    const asked = String(url).match(/dates=([\d-]+)/)?.[1] ?? ''
    const [from, to = from] = asked.split('-')
    const hit = events.filter((ev) => {
      const day = easternDay(ev.date)
      return day >= from && day <= to
    })
    return { ok: true, json: async () => ({ events: hit }) }
  })
  return global.fetch
}
