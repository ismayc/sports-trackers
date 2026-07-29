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
 */
export function stubFetch(events) {
  const fn = typeof events === 'function' ? events : () => events
  global.fetch = vi.fn(async (url) => ({ ok: true, json: async () => ({ events: fn(String(url)) || [] }) }))
  return global.fetch
}
