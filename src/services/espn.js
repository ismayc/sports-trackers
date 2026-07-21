// The hub's one and only network dependency: ESPN's keyless, CORS-open scoreboard.
// No backend, no API key, no .env — a hard family rule. Called client-side at page load.
//
// For each viewer we ask for a today-centered [-1, 0, +1] day window (the family's shape),
// because the scoreboard is a rolling UTC-bucketed feed: last night's late game and
// tonight's game can land on either side of a UTC midnight, so a single day query would
// miss games the user still thinks of as "today" in their own zone. We then re-bucket by
// the *user's* calendar day with Intl parts (see utils/time dayKey).

import { dayKey, todayKey } from '../utils/time.js'

const BASE = 'https://site.api.espn.com/apis/site/v2/sports'

const yyyymmdd = (d) =>
  `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`

// National broadcast/stream names for a game. `broadcasts[].names` is the flat network
// list; `geoBroadcasts[]` adds streamers and carries a market type — we keep National feeds
// and streaming, and drop home/away RSNs (not universally available). Used by the "what can
// I watch" filter (see utils/watch.js).
function broadcastNames(c) {
  const names = new Set()
  for (const b of c.broadcasts || []) for (const n of b.names || []) names.add(n)
  for (const gb of c.geoBroadcasts || []) {
    const n = gb.media?.shortName
    const nat = gb.market?.type === 'National' || gb.type?.shortName === 'Streaming'
    if (n && nat) names.add(n)
  }
  return [...names]
}

// Normalize one ESPN event into the hub's flat game shape. Returns null for anything the
// hub can't or shouldn't show (missing competitors, or — for college — a non-tournament
// game that shares the seasontype=3 window).
function normalize(ev, v) {
  const c = ev.competitions?.[0]
  if (!c) return null

  // March-Madness filter. The men's/women's college seasontype=3 window ALSO carries NIT,
  // College Basketball Crown, and WBIT games. The only reliable tell that a row belongs to
  // the actual tournament is its competition headline. Drop everything else.
  if (v.mmHeadline) {
    const headline = c.notes?.[0]?.headline || ''
    if (!headline.startsWith(v.mmHeadline)) return null
  }

  const home = c.competitors?.find((t) => t.homeAway === 'home')
  const away = c.competitors?.find((t) => t.homeAway === 'away')
  if (!home || !away) return null

  const st = c.status?.type || {}
  const num = (s) => {
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }
  const as = num(away.score)
  const hs = num(home.score)
  // A score is only meaningful once the game is live or done; ignore the 0–0 the feed
  // shows for a game that hasn't tipped.
  const hasScore = as !== null && hs !== null && (st.state === 'in' || st.completed)

  return {
    id: ev.id,
    tip: ev.date, // absolute ISO instant
    home: home.team?.displayName || home.team?.shortDisplayName || home.team?.name || '',
    away: away.team?.displayName || away.team?.shortDisplayName || away.team?.name || '',
    homeAbbr: home.team?.abbreviation || '',
    awayAbbr: away.team?.abbreviation || '',
    state: st.state || 'pre', // 'pre' | 'in' | 'post'
    score: hasScore ? [as, hs] : null, // [away, home] so it reads left-to-right as AWAY @ HOME
    statusLabel: st.shortDetail || st.detail || null, // "Q3 4:21", "Final", "7:00 PM"
    broadcast: broadcastNames(c), // national networks/streamers, for the watch filter
  }
}

// Fetch one viewer's today window. Tolerant of per-day failures (allSettled): if one of
// the three day-queries 404s or the feed is empty (an offseason viewer), the others still
// resolve and we simply return fewer games. Never throws for a viewer being out of season.
export async function fetchViewerDay(v, { signal, now = new Date(), tz } = {}) {
  const days = [-1, 0, 1].map((off) => {
    const x = new Date(now)
    x.setUTCDate(x.getUTCDate() + off)
    return yyyymmdd(x)
  })

  // College viewers need the tournament bracket group + postseason type. Harmless for a
  // non-tournament date (the feed just returns whatever seasontype=3 it has, then the
  // headline filter empties it).
  const suffix = v.college ? '&groups=50&seasontype=3' : ''

  const results = await Promise.allSettled(
    days.map(async (d) => {
      const res = await fetch(`${BASE}/${v.espnPath}/scoreboard?dates=${d}${suffix}`, { signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    })
  )

  const byId = new Map()
  let anyOk = false
  for (const r of results) {
    if (r.status !== 'fulfilled') continue
    anyOk = true
    for (const ev of r.value.events || []) {
      const g = normalize(ev, v)
      if (g) byId.set(g.id, g)
    }
  }

  const all = [...byId.values()].sort((a, b) => new Date(a.tip) - new Date(b.tip))
  const tKey = todayKey(tz, now)
  const today = all.filter((g) => dayKey(g.tip, tz) === tKey)
  const live = today.filter((g) => g.state === 'in').length
  // Every not-yet-started game in the window, soonest first. `next` is the first of these;
  // the watch filter re-derives its own next from this list after dropping unwatchable games.
  const upcoming = all.filter((g) => g.state === 'pre' && new Date(g.tip).getTime() > now.getTime())

  return { id: v.id, ok: anyOk, today, live, upcoming, next: upcoming[0] || null }
}

// Load every viewer at once. One slow/failed feed never blocks the rest.
export async function fetchAllViewers(viewers, opts = {}) {
  const settled = await Promise.allSettled(viewers.map((v) => fetchViewerDay(v, opts)))
  return settled.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { id: viewers[i].id, ok: false, today: [], live: 0, upcoming: [], next: null }
  )
}
