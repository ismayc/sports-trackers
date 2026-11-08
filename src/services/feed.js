// The committed feed, for the one viewer ESPN does not carry (Unrivaled). Its own build
// publishes the season as `hub-feed.json` on this origin (see `feedUrl` in data/viewers.js),
// so this is one same-origin request instead of a scoreboard per day.
//
// The feed is the viewer's committed snapshot, not a live scoreboard, and nothing here
// pretends otherwise:
//   * a game with a score is final ('post'); a game without one is 'pre', even after its
//     tip has passed. No state is ever 'in', because nothing reports a game as live, and
//     the hub's "Live" pill would be a guess. The result appears when the viewer's refresh
//     commits it (every 30 minutes on game nights).
//   * a game whose tip is not announced carries `day`, and its `tip` is a placeholder. That
//     is the same contract as ESPN's `timeValid: false` (see hub CLAUDE.md, error 1), so it
//     maps onto the same `timeTBD` and `day` fields and every renderer already handles it.
//   * a postponed game is dropped: it is not on the day its old tip says.

// Normalize one feed game into the hub's flat game shape (the same shape services/espn.js
// builds from a scoreboard event). `teams` maps abbreviation to { name, logo }.
export function normalizeFeedGame(g, teams) {
  if (g.postponed) return null
  const home = teams[g.home]
  const away = teams[g.away]
  if (!home || !away) return null
  const broadcast = g.broadcast || []
  return {
    id: g.id,
    tip: g.tip,
    home: home.name,
    away: away.name,
    homeShort: home.name,
    awayShort: away.name,
    homeAbbr: g.home,
    awayAbbr: g.away,
    homeLogo: home.logo || null,
    awayLogo: away.logo || null,
    state: g.score ? 'post' : 'pre',
    timeTBD: Boolean(g.day),
    day: g.day || null,
    postseason: Boolean(g.postseason),
    ifNecessary: false,
    score: g.score || null, // already [away, home], the hub's order
    statusLabel: g.score ? 'Final' : null,
    broadcast,
    broadcastTBA: broadcast.length === 0,
  }
}

// The feed's team catalog, in the picker's row shape, in name order.
export function feedTeams(feed) {
  return (feed.teams || [])
    .map((t) => ({ abbr: t.abbr, name: t.name, logo: t.logo || null }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// Fetch the feed once. Throws on a failed request or a body with no games list; callers
// turn that into their own "not loaded" state.
export async function fetchFeed(v, { signal } = {}) {
  const res = await fetch(v.feedUrl, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const feed = await res.json()
  if (!Array.isArray(feed?.games)) throw new Error('no games in the feed')
  return feed
}

// Every game in the feed, normalized and sorted by tip, or `ok: false` when the feed could
// not be read. Never throws, like the scoreboard path: one viewer's failure stays its own.
export async function fetchFeedGames(v, { signal } = {}) {
  try {
    const feed = await fetchFeed(v, { signal })
    const teams = Object.fromEntries((feed.teams || []).map((t) => [t.abbr, t]))
    const games = feed.games.map((g) => normalizeFeedGame(g, teams)).filter(Boolean)
    return { ok: true, games }
  } catch {
    return { ok: false, games: [] }
  }
}
